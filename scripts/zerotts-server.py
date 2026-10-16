#!/usr/bin/env python3
"""Persistent, app-owned ZeroTTS inference service for Vietnamese instructor audio."""

from __future__ import annotations

import io
import json
import os
import shutil
import sys
import threading
import wave
import hmac
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from typing import cast

import numpy as np
from huggingface_hub import snapshot_download
from zerotts import ZeroTTS
from zerotts.chunking import chunk_text, clean_segment_punctuation, normalize_punctuation


MODEL_REPO = "zeroweight-ai/ZeroTTS"
VOICE = "quangminh"
PAUSE_SECONDS = 0.16
MAX_TEXT_CHARACTERS = 6000
ROOT = Path(__file__).resolve().parents[1]
MODEL = None
SYNTHESIS_LOCK = threading.Lock()


def materialize_model_snapshot() -> Path:
    snapshot = Path(
        snapshot_download(
            MODEL_REPO,
            allow_patterns=[
                "config.json",
                "tokenizer.json",
                "null_voice_emb.npy",
                "silence_frame.npy",
                "onnx/**",
                f"voices/{VOICE}/**",
            ],
        )
    )
    runtime_model = Path.home() / ".cache/arc-irobot/zerotts" / snapshot.name
    marker = runtime_model / ".materialized"

    if marker.is_file():
        return runtime_model

    if runtime_model.exists():
        shutil.rmtree(runtime_model)
    runtime_model.parent.mkdir(parents=True, exist_ok=True)
    shutil.copytree(snapshot, runtime_model, symlinks=False)
    marker.write_text(
        "Copied from the Hugging Face snapshot to preserve ONNX external-data paths.\n",
        encoding="utf-8",
    )
    return runtime_model


def load_model() -> ZeroTTS:
    model_dir = materialize_model_snapshot()
    print(f"Loading ZeroTTS voice={VOICE} from {model_dir}", flush=True)
    model = ZeroTTS.from_pretrained(str(model_dir))
    model.warmup()
    print("ZeroTTS model warmed and ready for speech.", flush=True)
    return model


def synthesize(text: str) -> bytes:
    model = cast(ZeroTTS, MODEL)
    normalized = normalize_punctuation(text)
    segments = [
        clean_segment_punctuation(segment)
        for segment in chunk_text(normalized, max_chunk_sec=15)
        if segment.strip()
    ]
    silence = np.zeros(round(model.sample_rate * PAUSE_SECONDS), dtype=np.float32)
    audio_parts: list[np.ndarray] = []

    for segment in segments:
        audio = np.asarray(model.synthesize(segment, voice=VOICE), dtype=np.float32).reshape(-1)
        audio_parts.extend((audio, silence))

    if audio_parts:
        audio_parts.pop()
    combined = np.concatenate(audio_parts) if audio_parts else np.zeros(0, dtype=np.float32)
    pcm = (np.clip(np.nan_to_num(combined), -1.0, 1.0) * 32767).astype("<i2")

    output = io.BytesIO()
    with wave.open(output, "wb") as wav_file:
        wav_file.setnchannels(1)
        wav_file.setsampwidth(2)
        wav_file.setframerate(model.sample_rate)
        wav_file.writeframes(pcm.tobytes())
    return output.getvalue()


class ZeroTTSRequestHandler(BaseHTTPRequestHandler):
    server_version = "ArcZeroTTS/1.0"
    protocol_version = "HTTP/1.1"

    def do_GET(self) -> None:
        if self.path != "/health":
            self.send_error(404)
            return
        self.send_response(200)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        body = json.dumps({"ready": True, "voice": VOICE}).encode()
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def do_POST(self) -> None:
        if self.path not in {"/synthesize", "/synthesize/stream"}:
            self.send_error(404)
            return
        stream_audio = self.path == "/synthesize/stream"

        expected_key = os.environ.get("ZEROTTS_API_KEY", "")
        received_key = self.headers.get("X-ZeroTTS-Key", "")
        if expected_key and not hmac.compare_digest(received_key, expected_key):
            self._send_json(401, {"error": "Yêu cầu không được xác thực."})
            return

        try:
            content_length = int(self.headers.get("Content-Length", "0"))
            if content_length <= 0 or content_length > 32768:
                self._send_json(413, {"error": "Request TTS không hợp lệ hoặc quá lớn."})
                return

            payload = json.loads(self.rfile.read(content_length))
            text = payload.get("text") if isinstance(payload, dict) else None
            if not isinstance(text, str) or not text.strip():
                self._send_json(400, {"error": "Thiếu nội dung cần đọc."})
                return
            if len(text) > MAX_TEXT_CHARACTERS:
                self._send_json(413, {"error": "Đoạn đọc vượt quá giới hạn 6.000 ký tự."})
                return

            if stream_audio:
                self._stream_synthesis(text)
                return

            with SYNTHESIS_LOCK:
                audio = synthesize(text)
            self.send_response(200)
            self.send_header("Content-Type", "audio/wav")
            self.send_header("Content-Length", str(len(audio)))
            self.send_header("Cache-Control", "no-store")
            self.end_headers()
            self.wfile.write(audio)
        except (json.JSONDecodeError, UnicodeDecodeError):
            self._send_json(400, {"error": "Request TTS không phải JSON hợp lệ."})
        except Exception as error:
            print(f"ZeroTTS synthesis failed: {error}", file=sys.stderr, flush=True)
            self._send_json(500, {"error": "ZeroTTS không tạo được giọng đọc."})

    def _stream_synthesis(self, text: str) -> None:
        model = cast(ZeroTTS, MODEL)
        normalized = normalize_punctuation(text)
        segments = [
            clean_segment_punctuation(segment)
            for segment in chunk_text(normalized, max_chunk_sec=15)
            if segment.strip()
        ]
        silence = np.zeros(round(model.sample_rate * PAUSE_SECONDS), dtype=np.float32)

        self.send_response(200)
        self.send_header("Content-Type", "application/x-zerotts-pcm")
        self.send_header("X-Audio-Sample-Rate", str(model.sample_rate))
        self.send_header("Transfer-Encoding", "chunked")
        self.send_header("Cache-Control", "no-store")
        self.end_headers()

        try:
            with SYNTHESIS_LOCK:
                for index, segment in enumerate(segments):
                    for audio_chunk in model.synthesize_stream(segment, voice=VOICE):
                        self._write_stream_frame(audio_chunk)
                    if index < len(segments) - 1:
                        self._write_stream_frame(silence)
            self.wfile.write(b"0\r\n\r\n")
            self.wfile.flush()
        except (BrokenPipeError, ConnectionResetError):
            self.close_connection = True
        except Exception as error:
            print(f"ZeroTTS streaming failed: {error}", file=sys.stderr, flush=True)
            self.close_connection = True

    def _write_stream_frame(self, samples: np.ndarray) -> None:
        pcm = (
            np.clip(np.nan_to_num(np.asarray(samples).reshape(-1)), -1.0, 1.0)
            * 32767
        ).astype("<i2").tobytes()
        if not pcm:
            return
        frame = len(pcm).to_bytes(4, byteorder="big") + pcm
        self.wfile.write(f"{len(frame):X}\r\n".encode("ascii"))
        self.wfile.write(frame)
        self.wfile.write(b"\r\n")
        self.wfile.flush()

    def _send_json(self, status: int, payload: dict[str, object]) -> None:
        body = json.dumps(payload, ensure_ascii=False).encode("utf-8")
        self.send_response(status)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def log_message(self, format_string: str, *args: object) -> None:
        print(f"ZeroTTS: {format_string % args}", flush=True)


def main() -> None:
    global MODEL
    MODEL = load_model()
    host = os.environ.get("ZEROTTS_HOST", "127.0.0.1")
    port = int(os.environ.get("ZEROTTS_PORT", "4179"))
    server = ThreadingHTTPServer((host, port), ZeroTTSRequestHandler)
    print(f"ZeroTTS ready at http://{host}:{port} (voice={VOICE})", flush=True)
    server.serve_forever()


if __name__ == "__main__":
    main()
