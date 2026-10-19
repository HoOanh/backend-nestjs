"""ZeroTTS endpoints executed directly as Vercel Python Functions."""

from __future__ import annotations

import base64
import hashlib
import hmac
import io
import json
import logging
import os
import threading
import time
import wave
from http.server import BaseHTTPRequestHandler
from pathlib import Path
from typing import Iterable
from urllib.parse import parse_qs, urlsplit

import numpy as np
from huggingface_hub import snapshot_download
from zerotts import ZeroTTS
from zerotts.chunking import chunk_text, clean_segment_punctuation, normalize_punctuation


MODEL_REPO = "zeroweight-ai/ZeroTTS"
VOICE = "quangminh"
PAUSE_SECONDS = 0.16
MAX_TEXT_CHARACTERS = 6000
MAX_REQUEST_BYTES = 32768
MODEL_DIRECTORY = Path("/tmp/arc-irobot/zerotts")

_MODEL: ZeroTTS | None = None
_MODEL_LOCK = threading.Lock()
_SYNTHESIS_LOCK = threading.Lock()


def _header_value(handler: BaseHTTPRequestHandler, name: str) -> str:
    for key, value in handler.headers.items():
        if key.lower() == name.lower():
            return value
    return ""


def _decode_base64url(value: str) -> bytes:
    return base64.urlsafe_b64decode(value + "=" * (-len(value) % 4))


def _verify_session_token(token: str) -> bool:
    secret = os.environ.get("JWT_SECRET") or os.environ.get("AUTH_SECRET")
    if not secret or len(secret) < 32:
        logging.error("JWT_SECRET is missing or shorter than 32 characters.")
        return False

    try:
        header, payload, signature = token.split(".")
        signed_value = f"{header}.{payload}"
        expected = hmac.new(secret.encode(), signed_value.encode(), hashlib.sha256).digest()
        received = _decode_base64url(signature)
        if not hmac.compare_digest(expected, received):
            return False

        decoded_header = json.loads(_decode_base64url(header))
        claims = json.loads(_decode_base64url(payload))
        if not isinstance(decoded_header, dict) or not isinstance(claims, dict):
            return False
        if decoded_header.get("alg") != "HS256":
            return False
        if not isinstance(claims.get("userId"), str) or not claims["userId"]:
            return False
        if not isinstance(claims.get("exp"), (int, float)):
            return False
        if claims["exp"] <= time.time():
            return False

        store_path = Path(os.environ.get("ARC_STORE_PATH", "/tmp/arc_irobot_store.json"))
        if store_path.is_file():
            try:
                store = json.loads(store_path.read_text(encoding="utf-8"))
                user_id = claims["userId"]
                if token in store.get("revoked_tokens", []):
                    return False
                if user_id in store.get("deleted_users", []):
                    return False
                user = next(
                    (row for row in store.get("users", []) if row.get("id") == user_id),
                    None,
                )
                if user and user.get("status") == "suspended":
                    return False
                if user and (claims.get("authVersion") or 0) != (user.get("auth_version") or 0):
                    return False
            except (OSError, json.JSONDecodeError, AttributeError, TypeError):
                logging.exception("Could not read local auth state for ZeroTTS.")

        return True
    except (ValueError, TypeError, KeyError, json.JSONDecodeError):
        return False


def _is_authenticated(handler: BaseHTTPRequestHandler) -> bool:
    authorization = _header_value(handler, "authorization")
    token = authorization[7:].strip() if authorization.startswith("Bearer ") else ""
    if not token:
        cookie_header = _header_value(handler, "cookie")
        for entry in cookie_header.split(";"):
            name, separator, value = entry.strip().partition("=")
            if separator and name == "arc_session":
                token = value
                break
    return bool(token and _verify_session_token(token))


def _json_response(handler: BaseHTTPRequestHandler, status: int, message: str) -> None:
    body = json.dumps({"error": message}, ensure_ascii=False).encode("utf-8")
    handler.send_response(status)
    handler.send_header("Content-Type", "application/json; charset=utf-8")
    handler.send_header("Content-Length", str(len(body)))
    handler.send_header("Cache-Control", "no-store")
    handler.end_headers()
    handler.wfile.write(body)


def _load_model() -> ZeroTTS:
    global _MODEL
    if _MODEL is not None:
        return _MODEL

    with _MODEL_LOCK:
        if _MODEL is not None:
            return _MODEL

        os.environ.setdefault("HF_HOME", "/tmp/huggingface")
        os.environ.setdefault("HF_HUB_DISABLE_TELEMETRY", "1")
        MODEL_DIRECTORY.parent.mkdir(parents=True, exist_ok=True)
        model_path = snapshot_download(
            MODEL_REPO,
            local_dir=str(MODEL_DIRECTORY),
            allow_patterns=[
                "config.json",
                "tokenizer.json",
                "null_voice_emb.npy",
                "silence_frame.npy",
                "onnx/**",
                f"voices/{VOICE}/**",
            ],
        )
        logging.info("Loading ZeroTTS voice=%s from %s", VOICE, model_path)
        model = ZeroTTS.from_pretrained(model_path)
        model.warmup()
        _MODEL = model
        logging.info("ZeroTTS model warmed and ready.")
        return model


def _segments(text: str) -> list[str]:
    normalized = normalize_punctuation(text)
    return [
        clean_segment_punctuation(segment)
        for segment in chunk_text(normalized, max_chunk_sec=15)
        if segment.strip()
    ]


def _audio_bytes(samples: np.ndarray) -> bytes:
    pcm = (
        np.clip(np.nan_to_num(np.asarray(samples).reshape(-1)), -1.0, 1.0)
        * 32767
    ).astype("<i2")
    return pcm.tobytes()


def _synthesize_wav(model: ZeroTTS, text: str) -> bytes:
    silence = np.zeros(round(model.sample_rate * PAUSE_SECONDS), dtype=np.float32)
    audio_parts: list[np.ndarray] = []
    for segment in _segments(text):
        audio = np.asarray(model.synthesize(segment, voice=VOICE), dtype=np.float32).reshape(-1)
        audio_parts.extend((audio, silence))
    if audio_parts:
        audio_parts.pop()

    combined = np.concatenate(audio_parts) if audio_parts else np.zeros(0, dtype=np.float32)
    output = io.BytesIO()
    with wave.open(output, "wb") as wav_file:
        wav_file.setnchannels(1)
        wav_file.setsampwidth(2)
        wav_file.setframerate(model.sample_rate)
        wav_file.writeframes(_audio_bytes(combined))
    return output.getvalue()


def _stream_frames(model: ZeroTTS, sentences: list[str]) -> Iterable[bytes]:
    silence = np.zeros(round(model.sample_rate * PAUSE_SECONDS), dtype=np.float32)
    with _SYNTHESIS_LOCK:
        for sentence_index, sentence in enumerate(sentences):
            for segment in _segments(sentence):
                for chunk in model.synthesize_stream(segment, voice=VOICE):
                    pcm = _audio_bytes(np.asarray(chunk))
                    if pcm:
                        yield sentence_index.to_bytes(4, byteorder="big") + len(pcm).to_bytes(4, byteorder="big") + pcm
            if sentence_index < len(sentences) - 1:
                pcm = _audio_bytes(silence)
                if pcm:
                    yield sentence_index.to_bytes(4, byteorder="big") + len(pcm).to_bytes(4, byteorder="big") + pcm


class handler(BaseHTTPRequestHandler):
    """Route both public TTS paths through one warm model instance."""

    def do_GET(self) -> None:
        _json_response(self, 405, "Chỉ hỗ trợ POST.")

    def do_POST(self) -> None:
        request_path = urlsplit(self.path)
        query = parse_qs(request_path.query)
        is_stream = query.get("mode", [""])[0] == "stream" or request_path.path.endswith("/stream")

        if not _is_authenticated(self):
            _json_response(self, 401, "Đăng nhập để sử dụng giọng đọc của lớp học.")
            return

        try:
            content_length = int(_header_value(self, "content-length") or "0")
        except ValueError:
            _json_response(self, 400, "Content-Length không hợp lệ.")
            return
        if content_length <= 0 or content_length > MAX_REQUEST_BYTES:
            _json_response(self, 413, "Request TTS không hợp lệ hoặc quá lớn.")
            return

        try:
            payload = json.loads(self.rfile.read(content_length))
        except (json.JSONDecodeError, UnicodeDecodeError):
            _json_response(self, 400, "Request TTS không phải JSON hợp lệ.")
            return

        sentences = payload.get("sentences") if isinstance(payload, dict) else None
        if sentences is None and isinstance(payload, dict) and isinstance(payload.get("text"), str):
            sentences = [payload["text"]]
        if not isinstance(sentences, list) or not sentences or not all(
            isinstance(sentence, str) and sentence.strip() for sentence in sentences
        ):
            _json_response(self, 400, "Thiếu nội dung cần đọc.")
            return
        sentences = [sentence.strip() for sentence in sentences]
        if len(sentences) > 100 or sum(map(len, sentences)) > MAX_TEXT_CHARACTERS:
            _json_response(self, 413, "Đoạn đọc vượt quá giới hạn 6.000 ký tự.")
            return
        text = " ".join(sentences)

        response_started = False
        try:
            model = _load_model()
            if is_stream:
                self.send_response(200)
                self.send_header("Content-Type", "application/x-zerotts-pcm")
                self.send_header("X-Audio-Sample-Rate", str(model.sample_rate))
                self.send_header("Cache-Control", "no-store")
                self.end_headers()
                response_started = True
                for frame in _stream_frames(model, sentences):
                    self.wfile.write(frame)
                    self.wfile.flush()
                return

            with _SYNTHESIS_LOCK:
                audio = _synthesize_wav(model, text)
            self.send_response(200)
            self.send_header("Content-Type", "audio/wav")
            self.send_header("Content-Length", str(len(audio)))
            self.send_header("Cache-Control", "no-store")
            self.end_headers()
            response_started = True
            self.wfile.write(audio)
        except Exception as error:
            logging.exception("ZeroTTS Vercel Function failed: %s", error)
            if response_started:
                self.close_connection = True
            else:
                _json_response(self, 503, "ZeroTTS chưa khởi động được. Kiểm tra Function Logs trên Vercel.")


