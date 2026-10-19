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
    configured_model_dir = os.environ.get("ZEROTTS_MODEL_DIR")
    if configured_model_dir:
        model_dir = Path(configured_model_dir).expanduser()
        if not model_dir.is_dir():
            raise FileNotFoundError(f"Configured ZeroTTS model directory not found: {model_dir}")
        return model_dir

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
            raw_sentences = payload.get("sentences") if isinstance(payload, dict) else None
            if raw_sentences is None and isinstance(payload, dict):
                raw_text = payload.get("text")
                raw_sentences = [raw_text] if isinstance(raw_text, str) else None
            if not isinstance(raw_sentences, list) or not raw_sentences or not all(
                isinstance(sentence, str) and sentence.strip() for sentence in raw_sentences
            ):
                self._send_json(400, {"error": "Thiếu nội dung cần đọc."})
                return
            sentences = [sentence.strip() for sentence in raw_sentences]
            if len(sentences) > 100 or sum(map(len, sentences)) > MAX_TEXT_CHARACTERS:
                self._send_json(413, {"error": "Đoạn đọc vượt quá giới hạn 6.000 ký tự."})
                return
            text = " ".join(sentences)

            if stream_audio:
                self._stream_synthesis(sentences)
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

    def _stream_synthesis(self, sentences: list[str]) -> None:
        model = cast(ZeroTTS, MODEL)
        silence = np.zeros(round(model.sample_rate * PAUSE_SECONDS), dtype=np.float32)

        self.send_response(200)
        self.send_header("Content-Type", "application/x-zerotts-pcm")
        self.send_header("X-Audio-Sample-Rate", str(model.sample_rate))
        self.send_header("Transfer-Encoding", "chunked")
        self.send_header("Cache-Control", "no-store")
        self.end_headers()

        try:
            with SYNTHESIS_LOCK:
                for sentence_index, sentence in enumerate(sentences):
                    normalized = normalize_punctuation(sentence)
                    segments = [
                        clean_segment_punctuation(segment)
                        for segment in chunk_text(normalized, max_chunk_sec=15)
                        if segment.strip()
                    ]
                    for segment in segments:
                        for audio_chunk in model.synthesize_stream(segment, voice=VOICE):
                            self._write_stream_frame(audio_chunk, sentence_index)
                    if sentence_index < len(sentences) - 1:
                        self._write_stream_frame(silence, sentence_index)
            self.wfile.write(b"0\r\n\r\n")
            self.wfile.flush()
        except (BrokenPipeError, ConnectionResetError):
            self.close_connection = True
        except Exception as error:
            print(f"ZeroTTS streaming failed: {error}", file=sys.stderr, flush=True)
            self.close_connection = True

    def _write_stream_frame(self, samples: np.ndarray, sentence_index: int) -> None:
        pcm = (
            np.clip(np.nan_to_num(np.asarray(samples).reshape(-1)), -1.0, 1.0)
            * 32767
        ).astype("<i2").tobytes()
        if not pcm:
            return
        frame = sentence_index.to_bytes(4, byteorder="big") + len(pcm).to_bytes(4, byteorder="big") + pcm
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
    host = os.environ.get("ZEROTTS_HOST", "0.0.0.0")
    port = int(os.environ.get("PORT", os.environ.get("ZEROTTS_PORT", "8080")))
    server = ThreadingHTTPServer((host, port), ZeroTTSRequestHandler)
    print(f"ZeroTTS ready at http://{host}:{port} (voice={VOICE})", flush=True)
    server.serve_forever()


if __name__ == "__main__":
    main()
