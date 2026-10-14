/**
 * Automated Golden Standard Validator for Backend NestJS Curriculum Lessons & Sprint Exams
 * Usage:
 *   bun .agents/skills/curriculum-authoring/scripts/validate-lesson.ts c1-l1
 *   bun .agents/skills/curriculum-authoring/scripts/validate-lesson.ts c1
 *   bun .agents/skills/curriculum-authoring/scripts/validate-lesson.ts exam1
 */
import { CURRICULUM, type Lesson, type CodeChallenge } from '../../../../src/data/curriculum.ts';
import { SPRINT_EXAMS, type SprintExam } from '../../../../src/data/sprintExams.ts';
import { CodeEvaluator } from '../../../../src/services/codeEvaluator.ts';
import { detectDiagramCategory } from '../../../../src/components/mindmap/detectDiagramCategory.ts';
import { renderLayeredStack } from '../../../../src/components/mindmap/renderers/renderLayeredStack.ts';
import { renderComparisonFlow } from '../../../../src/components/mindmap/renderers/renderComparisonFlow.ts';
import { renderDecisionTree } from '../../../../src/components/mindmap/renderers/renderDecisionTree.ts';
import { renderLifecycleFlow } from '../../../../src/components/mindmap/renderers/renderLifecycleFlow.ts';

interface CheckResult {
  id: number;
  name: string;
  passed: boolean;
  detail: string;
}

const EMOJI_REGEX = /[\u{1F300}-\u{1FAFF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}]/u;
const AI_SLOP_PHRASES = [
  'trong thế giới công nghệ hiện đại',
  'chìa khóa vàng',
  'vũ khí bí mật',
  'thần thánh',
  'hãy cùng khám phá',
  'vô cùng quan trọng',
  'tuyệt chiêu',
];

function deepEqual(left: unknown, right: unknown): boolean {
  if (left === right) return true;
  if (
    left == null ||
    right == null ||
    typeof left !== 'object' ||
    typeof right !== 'object'
  ) {
    return false;
  }
  if (Array.isArray(left) !== Array.isArray(right)) return false;
  if (Array.isArray(left) && Array.isArray(right)) {
    return (
      left.length === right.length &&
      left.every((item, idx) => deepEqual(item, right[idx]))
    );
  }
  const leftObj = left as Record<string, unknown>;
  const rightObj = right as Record<string, unknown>;
  const leftKeys = Object.keys(leftObj).filter(
    (k) => k !== 'timestamp' && k !== 'createdAt'
  );
  const rightKeys = Object.keys(rightObj).filter(
    (k) => k !== 'timestamp' && k !== 'createdAt'
  );
  return (
    leftKeys.length === rightKeys.length &&
    leftKeys.every(
      (k) =>
        Object.prototype.hasOwnProperty.call(rightObj, k) &&
        deepEqual(leftObj[k], rightObj[k])
    )
  );
}

async function verifyChallengeExecution(
  challenge: CodeChallenge
): Promise<{ passed: boolean; message: string }> {
  const rawCode = challenge.solution || '';
  if (!rawCode.trim()) {
    return { passed: false, message: `Missing solution in "${challenge.title}"` };
  }
  const code = CodeEvaluator.stripSimpleTypeScript(rawCode);
  const cleanStarter = CodeEvaluator.stripSimpleTypeScript(challenge.starterCode || '');

  const match = code.match(/(?:async\s+)?(?:function\*?|class)\s+([A-Za-z0-9_$]+)/);
  const targetName = match ? match[1] : '';
  if (!targetName) {
    return {
      passed: false,
      message: `Cannot detect target function/class in "${challenge.title}"`,
    };
  }

  const starterMatch = cleanStarter.match(
    /(?:async\s+)?(?:function\*?|class)\s+([A-Za-z0-9_$]+)/
  );
  const starterName = starterMatch ? starterMatch[1] : '';
  if (starterName !== targetName) {
    return {
      passed: false,
      message: `Target function mismatch between starterCode (${starterName}) and solution (${targetName})`,
    };
  }

  const factory = new Function(
    `${code}\nreturn typeof ${targetName} === "undefined" ? null : ${targetName};`
  ) as () => ((...args: unknown[]) => unknown) | null;
  const fn = factory();
  if (!fn) {
    return { passed: false, message: `Failed to instantiate ${targetName}` };
  }

  for (let i = 0; i < challenge.testCases.length; i++) {
    const tc = challenge.testCases[i];
    try {
      const clonedInput = JSON.parse(JSON.stringify(tc.input)) as unknown[];
      const rawResult = fn(...clonedInput);
      const actual =
        rawResult &&
        typeof (rawResult as { then?: unknown }).then === 'function'
          ? await (rawResult as Promise<unknown>)
          : rawResult;

      if (tc.expected === 'ERROR_THROWN') {
        return {
          passed: false,
          message: `[${challenge.level}] Case #${i + 1} (${tc.name}) expected ERROR_THROWN but succeeded`,
        };
      }
      if (!deepEqual(actual, tc.expected)) {
        return {
          passed: false,
          message: `[${challenge.level}] Case #${i + 1} (${tc.name}) failed: expected ${JSON.stringify(tc.expected)}, got ${JSON.stringify(actual)}`,
        };
      }
    } catch (err) {
      if (tc.expected !== 'ERROR_THROWN') {
        const msg = err instanceof Error ? err.message : String(err);
        return {
          passed: false,
          message: `[${challenge.level}] Case #${i + 1} (${tc.name}) threw unexpected error: ${msg}`,
        };
      }
    }
  }

  return {
    passed: true,
    message: `${challenge.level} (${targetName}): ${challenge.testCases.length}/${challenge.testCases.length} test cases PASS`,
  };
}

export async function validateLesson(lesson: Lesson): Promise<CheckResult[]> {
  const results: CheckResult[] = [];
  const theory = lesson.theory.trim();

  // 1. Opening Learning Objectives Callout
  const startsWithObjectives =
    theory.startsWith('>') &&
    theory.slice(0, 350).toLowerCase().includes('mục tiêu');
  results.push({
    id: 1,
    name: 'Khối Mục tiêu bài học ở đầu theory',
    passed: startsWithObjectives,
    detail: startsWithObjectives
      ? 'Bắt đầu bằng blockquote Mục tiêu học thuật'
      : 'Thiếu blockquote Mục tiêu ở dòng đầu tiên của theory',
  });

  // 2. 5 H1 Sections (# 1. to # 5.)
  const h1Matches = theory.match(/^#\s+[1-5]\.\s+.+$/gm) || [];
  const subHeadings = theory.match(/^###\s+\d+\.\d+\s+.+$/gm) || [];
  results.push({
    id: 2,
    name: 'Cấu trúc 5 Phần lớn (# 1. -> # 5.) & Tiểu mục (### X.Y)',
    passed: h1Matches.length >= 5 && subHeadings.length >= 10,
    detail: `Tìm thấy ${h1Matches.length}/5 phần lớn (# 1..5) và ${subHeadings.length} tiểu mục (### X.Y)`,
  });

  // 3. Markdown Tables count
  const tableBlocks =
    theory.match(
      /(?:^|\n)([ \t]*\|[^\n]+\|[ \t]*\r?\n[ \t]*\|(?:\s*:?-+:?\s*\|)+\r?\n(?:[ \t]*\|[^\n]+\|[ \t]*\r?\n?)+)/g
    ) || [];
  results.push({
    id: 3,
    name: 'Bảng thông số & Ma trận kỹ thuật (>= 3 bảng)',
    passed: tableBlocks.length >= 3,
    detail: `Tìm thấy ${tableBlocks.length} bảng Markdown trong theory`,
  });

  // 4. TypeScript Code Blocks in theory have // File: header
  const tsBlocks = [...theory.matchAll(/```(?:typescript|ts)\r?\n([\s\S]*?)```/g)];
  const allTsHaveFileHeader =
    tsBlocks.length >= 1 &&
    tsBlocks.every((m) =>
      /\/\/\s*(?:File|Source|Trích từ):?\s*[a-zA-Z0-9_.\-/]+\.[a-z]+/i.test(
        m[1].split('\n')[0] || ''
      )
    );
  results.push({
    id: 4,
    name: 'Code mẫu trong theory có header // File: src/...',
    passed: allTsHaveFileHeader,
    detail: `${tsBlocks.length} khối code TypeScript, đầy đủ header // File: ${allTsHaveFileHeader}`,
  });

  // 5. Execution trace / timeline table or step analysis
  const hasTrace =
    /t\s*=\s*\d+\s*ms/i.test(theory) ||
    theory.includes('Stack Frame') ||
    theory.includes('Truy vết');
  results.push({
    id: 5,
    name: 'Truy vết thực thi theo mốc thời gian / bộ nhớ',
    passed: hasTrace,
    detail: hasTrace
      ? 'Có bảng/phân tích truy vết thực thi chi tiết'
      : 'Thiếu truy vết thực thi (t = 0 ms / Stack / Heap trace)',
  });

  // 6. Quantitative Formula Box
  const formulaBlocks = [
    ...theory.matchAll(/```(formula|math|text|)\r?\n([\s\S]*?)```/g),
  ].filter(
    (m) =>
      !m[2].includes('┌') &&
      !m[2].includes('──') &&
      !m[2].includes('│') &&
      !m[2].includes('▼')
  );
  results.push({
    id: 6,
    name: 'Hộp công thức định lượng (.theory-formula-box)',
    passed: formulaBlocks.length >= 1,
    detail: `Tìm thấy ${formulaBlocks.length} hộp công thức định lượng`,
  });

  // 7. End-of-Part Academic Summary Callout
  const summaryCallouts =
    theory.match(/^>\s*\*\*Tổng kết học thuật/gm) || [];
  results.push({
    id: 7,
    name: 'Hộp Tổng kết học thuật cuối phần (> **Tổng kết học thuật...)',
    passed: summaryCallouts.length >= 1,
    detail: `Tìm thấy ${summaryCallouts.length} khối Tổng kết học thuật`,
  });

  // 8. Section 4 MindMap Diagrams (>= 3 diagram blocks & actual renderer DOM verification)
  const diagramWithTitles = [
    ...theory.matchAll(/(?:(###\s+4\.[1-3][^\n]+)\r?\n\s*)?```diagram\r?\n([\s\S]*?)```/g),
  ];
  const section4Diagrams = diagramWithTitles.filter((m) => Boolean(m[1]));

  let mindmapRenderOk = diagramWithTitles.length >= 3 && section4Diagrams.length === 3;
  const mindmapDetails: string[] = [];

  if (section4Diagrams.length === 3) {
    // 4.1 Layered Stack + Interactive Radial SVG Mindmap
    const d1Title = section4Diagrams[0][1].replace(/^###\s+/, '').trim();
    const d1Code = section4Diagrams[0][2];
    const d1Cat = detectDiagramCategory(d1Code, d1Title);
    const d1Html = renderLayeredStack(d1Code, d1Title);
    const d1HasStack = d1Html.includes('arch-stack-container') && (d1Html.match(/arch-tier-card/g) || []).length >= 3;
    const d1HasRadial = d1Html.includes('arch-radial-container') && d1Html.includes('mindmap-master-svg');
    const d1NoBlueprint = !d1Html.includes('mindmap-blueprint-view');
    if (d1Cat !== 'layered-stack' || !d1HasStack || !d1HasRadial || !d1NoBlueprint) {
      mindmapRenderOk = false;
      mindmapDetails.push(`4.1 lỗi render (cat=${d1Cat}, stack=${d1HasStack}, radial=${d1HasRadial})`);
    } else {
      mindmapDetails.push('4.1 Stack+Radial OK');
    }

    // 4.2 Comparison or Lifecycle Flow
    const d2Title = section4Diagrams[1][1].replace(/^###\s+/, '').trim();
    const d2Code = section4Diagrams[1][2];
    const d2Cat = detectDiagramCategory(d2Code, d2Title);
    const d2Html =
      d2Cat === 'lifecycle-flow'
        ? renderLifecycleFlow(d2Code, d2Title)
        : renderComparisonFlow(d2Code, d2Title);
    const d2Valid =
      (d2Html.includes('mindmap-comparison') || d2Html.includes('mindmap-lifecycle')) &&
      !d2Html.includes('mindmap-blueprint-view') &&
      !d2Html.includes('<span class="point-text">MÔ HÌNH HIỆN ĐẠI');
    if (!d2Valid) {
      mindmapRenderOk = false;
      mindmapDetails.push(`4.2 lỗi render (cat=${d2Cat})`);
    } else {
      mindmapDetails.push(`4.2 ${d2Cat} OK`);
    }

    // 4.3 Decision Tree (must render decision-branch-card and NEVER fall back to blueprint)
    const d3Title = section4Diagrams[2][1].replace(/^###\s+/, '').trim();
    const d3Code = section4Diagrams[2][2];
    const d3Cat = detectDiagramCategory(d3Code, d3Title);
    const d3Html = renderDecisionTree(d3Code, d3Title);
    const d3Branches = (d3Html.match(/decision-branch-card/g) || []).length;
    const d3Valid =
      d3Cat === 'decision-tree' &&
      d3Html.includes('mindmap-decision-tree') &&
      !d3Html.includes('mindmap-blueprint-view') &&
      d3Branches >= 2;
    if (!d3Valid) {
      mindmapRenderOk = false;
      mindmapDetails.push(`4.3 lỗi render DecisionTree (cat=${d3Cat}, branches=${d3Branches}, fallbackBlueprint=${d3Html.includes('mindmap-blueprint-view')})`);
    } else {
      mindmapDetails.push(`4.3 DecisionTree (${d3Branches} nhánh) OK`);
    }
  } else {
    mindmapDetails.push(`Tìm thấy ${section4Diagrams.length}/3 sơ đồ có tiêu đề ### 4.1, 4.2, 4.3`);
  }

  results.push({
    id: 8,
    name: 'Phần 4 - Sơ đồ tư duy kỹ thuật (Render thực tế 4.1 Stack+Radial, 4.2 Comparison, 4.3 DecisionTree)',
    passed: mindmapRenderOk,
    detail: mindmapDetails.join(' | '),
  });

  // 9. Section 5 Engineering Invariants
  const hasSection5Invariants =
    theory.includes('# 5.') &&
    (theory.includes('Định đề') || theory.includes(' ENGINEERING INVARIANTS'));
  results.push({
    id: 9,
    name: 'Phần 5 - Tổng kết Học thuật & Định đề Kỹ thuật',
    passed: hasSection5Invariants,
    detail: hasSection5Invariants
      ? 'Đầy đủ Phần 5 & các định đề kỹ thuật'
      : 'Thiếu Phần 5 hoặc các định đề kỹ thuật',
  });

  // 10. Zero Emojis & No-AI-Slop
  const fullPayload = JSON.stringify({
    title: lesson.title,
    theory: lesson.theory,
    quiz: lesson.quiz,
    codeChallenges: lesson.codeChallenges,
  });
  const hasEmoji = EMOJI_REGEX.test(fullPayload);
  const lowerPayload = fullPayload.toLowerCase();
  const foundSlop = AI_SLOP_PHRASES.filter((p) => lowerPayload.includes(p));
  results.push({
    id: 10,
    name: 'Chuẩn lọc văn phong no-ai-slop & 0% Emoji',
    passed: !hasEmoji && foundSlop.length === 0,
    detail:
      !hasEmoji && foundSlop.length === 0
        ? '0 emoji, 0 cụm từ AI slop'
        : `Vi phạm: hasEmoji=${hasEmoji}, slop=${foundSlop.join(', ')}`,
  });

  // 11. realCodeSnippet checks
  const snippetLines = (lesson.realCodeSnippet || '').trim().split('\n');
  const snippetHasFile = /^\/\/\s*(?:File|Trích từ):?\s*src\//i.test(
    snippetLines[0] || ''
  );
  const snippetHasNoAny = !/:\s*any\b/.test(lesson.realCodeSnippet || '');
  results.push({
    id: 11,
    name: 'realCodeSnippet chuẩn Production (header // File: src/..., >= 35 dòng, 0 any)',
    passed: snippetHasFile && snippetLines.length >= 35 && snippetHasNoAny,
    detail: `Header=${snippetHasFile}, Lines=${snippetLines.length}, NoAny=${snippetHasNoAny}`,
  });

  // 12. Quiz (8 questions, 4 options each, explanation)
  const quizOk =
    Array.isArray(lesson.quiz) &&
    lesson.quiz.length === 8 &&
    lesson.quiz.every(
      (q) =>
        q.options.length === 4 &&
        q.correctIndex >= 0 &&
        q.correctIndex <= 3 &&
        q.explanation.trim().length >= 80
    );
  results.push({
    id: 12,
    name: 'Bộ câu hỏi khảo thí quiz (Đủ 8 câu, 4 đáp án/câu, giải thích sâu)',
    passed: quizOk,
    detail: `Số câu quiz: ${lesson.quiz?.length || 0}/8`,
  });

  // 13. 3-level codeChallenges
  const challenges = lesson.codeChallenges || [];
  const levels = challenges.map((c) => c.level);
  const has3Levels =
    challenges.length === 3 &&
    levels[0] === 'basic' &&
    levels[1] === 'intermediate' &&
    levels[2] === 'advanced';
  results.push({
    id: 13,
    name: 'Đủ 3 cấp độ bài tập Code Sandbox (basic, intermediate, advanced)',
    passed: has3Levels,
    detail: `Levels: [${levels.join(', ')}]`,
  });

  // 14. guidedSteps (4 steps each) & hints (2 hints each)
  const stepsAndHintsOk =
    challenges.length === 3 &&
    challenges.every(
      (c) =>
        Array.isArray(c.guidedSteps) &&
        c.guidedSteps.length >= 4 &&
        Array.isArray(c.hints) &&
        c.hints.length >= 2
    );
  results.push({
    id: 14,
    name: 'Đầy đủ guidedSteps (4 bước) và hints (2 gợi ý) cho cả 3 bài tập',
    passed: stepsAndHintsOk,
    detail: stepsAndHintsOk
      ? 'Đủ 4 bước hướng dẫn & 2 gợi ý cho từng bài'
      : 'Thiếu guidedSteps hoặc hints ở một trong các bài tập',
  });

  // 15. Visible & Hidden TestCases + Execution of all 3 Solutions
  const testSpecsOk =
    challenges.length === 3 &&
    challenges.every((c) => {
      const visible = c.testCases.filter((tc) => !tc.hidden);
      const hidden = c.testCases.filter((tc) => tc.hidden);
      return visible.length >= 2 && hidden.length >= 1;
    });
  results.push({
    id: 15,
    name: 'Phân bổ Test Cases Công khai (hidden: false) & Ẩn (hidden: true)',
    passed: testSpecsOk,
    detail: testSpecsOk
      ? 'Mỗi bài đều có đủ Visible Input/Output Specs và Hidden Edge Cases'
      : 'Thiếu test case công khai hoặc test case ẩn',
  });

  // 16. Execute all challenge solutions
  const execMessages: string[] = [];
  let allSolutionsPass = challenges.length === 3;
  for (const ch of challenges) {
    const res = await verifyChallengeExecution(ch);
    execMessages.push(res.message);
    if (!res.passed) allSolutionsPass = false;
  }
  results.push({
    id: 16,
    name: 'Thực thi tự động solution qua toàn bộ testCases (100% PASS)',
    passed: allSolutionsPass,
    detail: execMessages.join(' | '),
  });

  // 17. Modular 1-Lesson-Per-File Architecture (src/data/curriculum/chapterX/cX-lY.ts)
  const chapterMatch = lesson.id.match(/^c(\d+)-l(\d+)$/);
  let modularFileOk = false;
  let modularFileDetail = `ID không khớp định dạng cX-lY: ${lesson.id}`;
  if (chapterMatch) {
    const chapterNum = chapterMatch[1];
    const lessonNum = chapterMatch[2];
    const expectedExport = `c${chapterNum}_l${lessonNum}`;
    const expectedRelPath = `src/data/curriculum/chapter${chapterNum}/${lesson.id}.ts`;
    const expectedAbsPath = new URL(`../../../../${expectedRelPath}`, import.meta.url).pathname;
    const chapterBarrelPath = new URL(
      `../../../../src/data/curriculum/chapter${chapterNum}.ts`,
      import.meta.url
    ).pathname;

    try {
      const fs = await import('node:fs');
      const exists = fs.existsSync(expectedAbsPath);
      if (exists) {
        const fileContent = fs.readFileSync(expectedAbsPath, 'utf-8');
        const barrelContent = fs.readFileSync(chapterBarrelPath, 'utf-8');
        const hasNamedExport = fileContent.includes(`export const ${expectedExport}: Lesson`);
        const isImportedInBarrel = barrelContent.includes(
          `./chapter${chapterNum}/${lesson.id}`
        );
        modularFileOk = hasNamedExport && isImportedInBarrel;
        modularFileDetail = modularFileOk
          ? `Đã tách file độc lập tại ${expectedRelPath} (export ${expectedExport}) & liên kết vào chapter${chapterNum}.ts`
          : `File ${expectedRelPath} thiếu 'export const ${expectedExport}: Lesson' hoặc chưa import vào chapter${chapterNum}.ts`;
      } else {
        modularFileDetail = `Chưa tách file riêng! Cần tách ra: ${expectedRelPath}`;
      }
    } catch (err) {
      modularFileDetail = `Lỗi kiểm tra file modular: ${err instanceof Error ? err.message : String(err)}`;
    }
  }
  results.push({
    id: 17,
    name: 'Kiến trúc Modular 1 Bài = 1 File (src/data/curriculum/chapterX/cX-lY.ts)',
    passed: modularFileOk,
    detail: modularFileDetail,
  });

  return results;
}

async function validateSprintExam(exam: SprintExam): Promise<CheckResult[]> {
  const results: CheckResult[] = [];
  const serialized = JSON.stringify(exam);

  const hasNoEmoji = !EMOJI_REGEX.test(serialized);
  const lowerSerialized = serialized.toLowerCase();
  const foundSlop = AI_SLOP_PHRASES.filter((p) => lowerSerialized.includes(p));

  results.push({
    id: 1,
    name: 'Nghiêm cấm Emoji & Văn phong AI Slop trong Sprint Exam',
    passed: hasNoEmoji && foundSlop.length === 0,
    detail:
      hasNoEmoji && foundSlop.length === 0
        ? '0 Emoji, 0 từ ngữ sáo rỗng'
        : `Có Emoji: ${!hasNoEmoji}, Từ sáo rỗng: ${foundSlop.join(', ') || 'Không'}`,
  });

  const qCount = exam.questions.length;
  const all4Opts = exam.questions.every(
    (q) =>
      q.options.length === 4 &&
      q.correctIndex >= 0 &&
      q.correctIndex <= 3 &&
      (q.explanation || '').trim().length >= 80
  );
  const longestCorrectCount = exam.questions.filter((q) => {
    const correctLen = q.options[q.correctIndex].length;
    const maxOtherLen = Math.max(
      ...q.options.filter((_, idx) => idx !== q.correctIndex).map((o) => o.length)
    );
    return correctLen > maxOtherLen + 15;
  }).length;
  const maxAllowedLongest = Math.max(3, Math.floor(qCount * 0.25));

  results.push({
    id: 2,
    name: 'Ngân hàng câu hỏi Sprint Exam (>= 20 câu, 4 đáp án cân bằng độ dài, giải thích >= 80 ký tự)',
    passed: qCount >= 20 && all4Opts && longestCorrectCount <= maxAllowedLongest,
    detail: `Tổng: ${qCount} câu, 4 đáp án & giải thích sâu: ${all4Opts}, Đáp án đúng dài lộ liễu (>15 ký tự): ${longestCorrectCount}/${qCount} câu`,
  });

  const ch = exam.codeChallenge;
  const tcCount = ch.testCases?.length || 0;
  const hiddenCount = (ch.testCases || []).filter((tc) => tc.hidden).length;
  const guidedCount = (ch.guidedSteps || []).length;
  const hintsCount = (ch.hints || []).length;
  const execRes = await verifyChallengeExecution(ch);

  results.push({
    id: 3,
    name: 'Bài thi Thực hành (CodeEvaluator TS Strip + >= 4 TestCases + Hidden + GuidedSteps + Hints)',
    passed:
      tcCount >= 4 &&
      hiddenCount >= 1 &&
      guidedCount >= 3 &&
      hintsCount >= 2 &&
      execRes.passed,
    detail: `${ch.title}: ${tcCount} testCases (${hiddenCount} hidden), ${guidedCount} guidedSteps, ${hintsCount} hints -> ${execRes.message}`,
  });

  return results;
}

async function main() {
  const targetArg = process.argv[2] || 'c1-l1';
  const matchedLessons: Lesson[] = [];
  const matchedExams: SprintExam[] = [];

  for (const sprint of CURRICULUM) {
    for (const lesson of sprint.lessons) {
      if (
        lesson.id === targetArg ||
        lesson.id.startsWith(`${targetArg}-`) ||
        targetArg === 'all'
      ) {
        matchedLessons.push(lesson);
      }
    }
  }

  for (const exam of SPRINT_EXAMS) {
    const examNum = String(exam.sprintId);
    if (
      `exam-${examNum}` === targetArg ||
      `exam${examNum}` === targetArg ||
      `c${examNum}` === targetArg ||
      targetArg === 'all'
    ) {
      matchedExams.push(exam);
    }
  }

  if (matchedLessons.length === 0 && matchedExams.length === 0) {
    console.error(`Không tìm thấy bài học hoặc bài thi nào khớp với tham số: "${targetArg}"`);
    process.exit(1);
  }

  let hasFailure = false;
  for (const lesson of matchedLessons) {
    console.log(`\n================================================================`);
    console.log(`KIỂM ĐỊNH CHUẨN VÀNG: [${lesson.id}] ${lesson.title}`);
    console.log(`================================================================`);
    const checks = await validateLesson(lesson);
    const passedCount = checks.filter((c) => c.passed).length;

    for (const c of checks) {
      const statusTag = c.passed ? '[PASS]' : '[FAIL]';
      console.log(`  ${statusTag} #${String(c.id).padStart(2, '0')} ${c.name}`);
      console.log(`         -> ${c.detail}`);
    }

    console.log(`----------------------------------------------------------------`);
    console.log(`KẾT QUẢ [${lesson.id}]: ${passedCount}/${checks.length} TIÊU CHÍ ĐẠT CHUẨN`);
    if (passedCount < checks.length) {
      hasFailure = true;
    }
  }

  for (const exam of matchedExams) {
    console.log(`\n================================================================`);
    console.log(`KIỂM ĐỊNH SPRINT EXAM: [exam-${exam.sprintId}] ${exam.title}`);
    console.log(`================================================================`);
    const checks = await validateSprintExam(exam);
    const passedCount = checks.filter((c) => c.passed).length;

    for (const c of checks) {
      const statusTag = c.passed ? '[PASS]' : '[FAIL]';
      console.log(`  ${statusTag} #${String(c.id).padStart(2, '0')} ${c.name}`);
      console.log(`         -> ${c.detail}`);
    }

    console.log(`----------------------------------------------------------------`);
    console.log(`KẾT QUẢ [exam-${exam.sprintId}]: ${passedCount}/${checks.length} TIÊU CHÍ ĐẠT CHUẨN`);
    if (passedCount < checks.length) {
      hasFailure = true;
    }
  }

  if (hasFailure) {
    process.exit(1);
  }
}

void main();

