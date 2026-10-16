import { createHash } from 'node:crypto';
import { mkdir, writeFile } from 'node:fs/promises';
import { instructor_c1_l1 } from '../src/data/instructor-curriculum/chapter1/c1-l1.ts';
import { normalizeTextForVietnameseSpeech } from '../src/services/vietnameseVoiceService.ts';

const engine = 'zerotts-0.1.5-quangminh-v1';
const voice = 'quangminh';
const entries = new Map<string, { id: string; text: string; key: string }>();

function add(id: string, rawText: string): void {
  const text = normalizeTextForVietnameseSpeech(rawText);
  if (!text) return;

  const key = createHash('sha256')
    .update(`${engine}\0${voice}\0${text}`)
    .digest('hex');
  entries.set(key, { id, text, key });
}

add(instructor_c1_l1.opening.id, instructor_c1_l1.opening.narration);
if (instructor_c1_l1.roadmap) {
  add(instructor_c1_l1.roadmap.id, instructor_c1_l1.roadmap.narration);
}

for (const section of instructor_c1_l1.sections) {
  for (const slide of section.slides) {
    add(slide.id, slide.narration);
  }

  add(
    `${section.id}-check`,
    `Mình vừa lần theo xong cơ chế này. Trước khi nối sang tình huống kế tiếp, mình muốn nghe cách bạn tự giải thích: ${section.check.question}`
  );
}

add(instructor_c1_l1.closing.id, instructor_c1_l1.closing.narration);

const outputPath = 'data/instructor-audio/c1-l1/source.json';
await mkdir('data/instructor-audio/c1-l1', { recursive: true });
await writeFile(
  outputPath,
  `${JSON.stringify({ lessonId: instructor_c1_l1.lessonId, engine, voice, entries: [...entries.values()] }, null, 2)}\n`
);

console.log(`Đã xuất ${entries.size} đoạn audio cho ${instructor_c1_l1.lessonId}: ${outputPath}`);
