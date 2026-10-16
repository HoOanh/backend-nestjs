#!/usr/bin/env python3
"""Pre-render fixed instructor narration into static MP3 files."""

from __future__ import annotations

import json
import shutil
import subprocess
import sys
from pathlib import Path
from typing import cast

import numpy as np
from huggingface_hub import snapshot_download
from zerotts import ZeroTTS
from zerotts.chunking import chunk_text, clean_segment_punctuation, normalize_punctuation


ROOT = Path(__file__).resolve().parents[1]
SOURCE = ROOT / "data/instructor-audio/c1-l1/source.json"
OUTPUT = ROOT / "public/assets/instructor-audio/c1-l1"
VOICE = "quangminh"
PAUSE_SECONDS = 0.16
MODEL_REPO = "zeroweight-ai/ZeroTTS"


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
    shutil.copytree(snapshot, runtime_model, symlinks=False)
    marker.write_text("Copied from the Hugging Face snapshot to preserve ONNX external-data paths.\n")
    return runtime_model


def encode_mp3(wave_path: Path, mp3_path: Path) -> None:
    ffmpeg = shutil.which("ffmpeg")
    if ffmpeg is None:
        raise RuntimeError("Cần cài ffmpeg để nén audio WAV thành MP3.")

    subprocess.run(
        [
            ffmpeg,
            "-hide_banner",
            "-loglevel",
            "error",
            "-y",
            "-i",
            str(wave_path),
            "-codec:a",
            "libmp3lame",
            "-b:a",
            "64k",
            str(mp3_path),
        ],
        check=True,
    )


def main() -> None:
    if not SOURCE.is_file():
        raise FileNotFoundError(f"Không tìm thấy {SOURCE}. Chạy script export trước.")

    source = json.loads(SOURCE.read_text(encoding="utf-8"))
    if source.get("voice") != VOICE:
        raise ValueError(f"Voice trong source phải là {VOICE}.")

    OUTPUT.mkdir(parents=True, exist_ok=True)
    manifest: dict[str, str] = {}
    model_dir = materialize_model_snapshot()
    tts = ZeroTTS.from_pretrained(str(model_dir))
    silence = np.zeros(round(tts.sample_rate * PAUSE_SECONDS), dtype=np.float32)
    entries = source["entries"]

    for index, entry in enumerate(entries, start=1):
        key = cast(str, entry["key"])
        text = cast(str, entry["text"])
        mp3_path = OUTPUT / f"{key}.mp3"
        manifest[key] = f"/assets/instructor-audio/c1-l1/{key}.mp3"
        if mp3_path.is_file():
            print(f"[{index}/{len(entries)}] Có sẵn: {entry['id']}", flush=True)
            continue

        normalized = normalize_punctuation(text)
        segments = [
            clean_segment_punctuation(segment)
            for segment in chunk_text(normalized, max_chunk_sec=15)
            if segment.strip()
        ]
        audio_parts: list[np.ndarray] = []
        for segment in segments:
            audio = np.asarray(tts.synthesize(segment, voice=VOICE), dtype=np.float32).reshape(-1)
            audio_parts.extend((audio, silence))

        if audio_parts:
            audio_parts.pop()
        combined = np.concatenate(audio_parts) if audio_parts else np.zeros(0, dtype=np.float32)
        temporary_wave = mp3_path.with_suffix(".wav")
        tts.save_audio(combined, str(temporary_wave))
        encode_mp3(temporary_wave, mp3_path)
        temporary_wave.unlink(missing_ok=True)
        print(f"[{index}/{len(entries)}] Tạo xong: {entry['id']} ({len(segments)} đoạn)", flush=True)

    manifest_path = OUTPUT / "manifest.json"
    manifest_path.write_text(
        f"{json.dumps(manifest, ensure_ascii=False, indent=2)}\n",
        encoding="utf-8",
    )
    print(f"Đã tạo manifest: {manifest_path}", flush=True)


if __name__ == "__main__":
    try:
        main()
    except Exception as error:
        print(f"Lỗi tạo audio: {error}", file=sys.stderr)
        raise
