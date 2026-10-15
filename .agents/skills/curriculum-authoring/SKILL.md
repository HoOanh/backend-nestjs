---
name: curriculum-authoring
description: >-
  Author, upgrade, audit, and validate Backend NestJS curriculum lessons in
  src/data/curriculum/chapterX/cX-lY.ts according to the c1-l1 Golden Standard
  and 1-Lesson-Per-File modular architecture. Use this skill whenever the user
  asks to write, rewrite, standardize, optimize, split, or review any lesson,
  theory content, engineering mindmap diagram, quiz, or 3-level progressive
  code sandbox challenge.
---

# Curriculum Authoring & Standardization Skill (`c1-l1` Golden Standard)

This skill enforces the **Principal Systems Architect & Computer Science Professor** authoring standard established in Lesson 1 ([`src/data/curriculum/chapter1/c1-l1.ts`](../../../src/data/curriculum/chapter1/c1-l1.ts)), Lesson 2 ([`src/data/curriculum/chapter1/c1-l2.ts`](../../../src/data/curriculum/chapter1/c1-l2.ts)), and documented in [`docs/CURRICULUM_AUTHORING_SPECIFICATION.md`](../../../docs/CURRICULUM_AUTHORING_SPECIFICATION.md).

---

## 0. Mandatory Modular File Architecture (1 Lesson = 1 File)

> **Rule ("Chuẩn hóa tới đâu tách ra tới đó — Mỗi bài 1 file"):**
> Because a Golden-Standard lesson spans **800–1,000 lines**, storing an entire chapter inside a single `chapterX.ts` file creates massive 3,000+ line monoliths. Every standardized lesson **MUST** be extracted into its own dedicated file.

1. **Dedicated Lesson File Path**:
   - Path: `src/data/curriculum/chapter<X>/c<X>-l<Y>.ts` (e.g., `src/data/curriculum/chapter1/c1-l1.ts`, `src/data/curriculum/chapter1/c1-l2.ts`).
   - Named export: `export const c<X>_l<Y>: Lesson = { ... };` (using underscore in the identifier, e.g., `c1_l1`, `c1_l2`).
2. **Lightweight Chapter Barrel File**:
   - Path: `src/data/curriculum/chapter<X>.ts` (kept under ~30 lines).
   - Imports `c<X>_l1`, `c<X>_l2`, ... from `./chapter<X>/c<X>-l<Y>.ts` and exports `export const chapter<X>: Sprint = { ... }`.
   - Keeping `src/data/curriculum/chapter<X>.ts` as the barrel preserves 100% backward compatibility with `src/data/curriculum.ts` and the rest of the application.
3. **Incremental Extraction ("Chuẩn hóa tới đâu tách ra tới đó")**:
   - Whenever you standardize a lesson in a chapter that has not yet been split, extract that lesson into `src/data/curriculum/chapter<X>/c<X>-l<Y>.ts` and import it back into `src/data/curriculum/chapter<X>.ts` (or split all lessons of that chapter into `./chapter<X>/c<X>-l*.ts` so the barrel file is immediately clean).

---

## 1. Mandatory Authoring Persona & Style Filter (`no-ai-slop`)

1. **Academic First-Principles Persona**:
   - Write as a University Computer Science Professor and Principal Backend Systems Architect.
   - Never write shallow overviews. Always explain from physical hardware (CPU registers, L1/L2/L3 cache, RAM pages, NVMe, NIC), OS Kernel internals (`epoll`, `kqueue`, file descriptors, virtual memory, `cgroups`), or runtime data structures (V8 Stack frames, Generational Heap, Libuv event queue) up to NestJS architecture.
   - Guide the student progressively: *Concept Definition* $\rightarrow$ *Quantitative Hardware/System Analysis* $\rightarrow$ *Anti-pattern vs. Production Code Comparison* $\rightarrow$ *Millisecond Execution Trace Table (`t = 0 ms`, `t = 1 ms`...)* $\rightarrow$ *Academic Summary Callout* $\rightarrow$ *3-Tier Progressive Code Sandbox*.
2. **Strict `no-ai-slop` Rules**:
   - **Zero Emojis**: Strictly forbidden to use any decorative emojis (`🚀`, `💡`, `🔥`, `✨`, `🎯`, `⚠️`, `✅`, `❌`, `📌`, `🧠`, etc.) anywhere in `title`, `theory`, `quiz`, or `codeChallenges`.
   - **Zero AI Clichés**: Never use phrases like *"Trong thế giới công nghệ hiện đại"*, *"Chìa khóa vàng"*, *"Vũ khí bí mật"*, *"Thần thánh"*, *"Hãy cùng khám phá"*, *"Tóm lại, việc hiểu rõ X là vô cùng quan trọng"*.
   - **Bilingual Technical Terminology**: Introduce key terms as **Vietnamese Term (Original English Term - Acronym)** on first mention.

---

## 2. Mandatory 5-Part `theory` Structure

Every lesson's `theory` field MUST follow this exact structural skeleton (see detailed template in [references/lesson-template.md](./references/lesson-template.md)):

1. **Opening Learning Objectives Callout (Line 1 of `theory`)**:
   - Blockquote `> **Mục tiêu học thuật & Chuẩn đầu ra của bài học:**` with 3 numbered core axes (`1.`, `2.`, `3.`) followed by `---`.
   - Note: `TheoryTab.tsx` automatically renders the lesson banner (`tag`, `duration`, `title`) above `theory`, so objectives appear directly underneath the lesson title.
2. **Parts 1, 2, and 3 (`# 1.`, `# 2.`, `# 3.`) — Deep Technical Pillars**:
   - Each part covers one core axis from the objectives and contains **3–4 subsections (`### X.1` to `### X.4`)**.
   - Across Parts 1–3, include:
     - **At least 2–3 Markdown Comparison/Diagnostic Tables** (3–5 columns, 5+ rows).
     - **At least 2 TypeScript Code Blocks (`\`\`\`typescript`)** where **Line 1 MUST be `// File: src/<module>/<filename>.ts`** so `CodeViewer` displays the contextual filename. Compare `THIẾT KẾ SAI (ANTI-PATTERN)` vs. `THIẾT KẾ CHUẨN` where applicable.
     - **At least 1 Execution Trace Table** tracing state/memory changes millisecond by millisecond (`t = 0 ms`, `t = 1 ms`...).
     - **At least 1–2 Quantitative Formula Blocks (`\`\`\`` with no language tag)** to trigger `.theory-formula-box` (**CÔNG THỨC & ĐỊNH LƯỢNG KỸ THUẬT**). Never put ASCII box characters (`┌`, `│`, `──`, `▼`) inside formula blocks.
     - **End-of-Part Academic Callout**: `> **Tổng kết học thuật Phần X (...):**` summarizing invariant rules.
3. **Part 4 (`# 4. HỆ THỐNG HÓA KIẾN THỨC & SƠ ĐỒ TƯ DUY (ENGINEERING MIND MAP)`)**:
   - **CRITICAL TEMPLATE LITERAL RULE**: Because `theory` is a TypeScript template literal (`` theory: `...` ``), any backslash `\` inside an ASCII diagram **MUST be escaped as `\\`** (especially at the end of a line like `/       \\`, otherwise JavaScript treats `\` + newline as a line continuation and collapses the next line!).
   - **STRICT CONTENT-DRIVEN MINDMAP TOPOLOGY RULE (NO FIXED SINGLE TEMPLATE)**:
     - Every lesson has different pedagogical mechanics. **Never** force all lessons into a single fixed 4-wing radial spider layout or reuse hardcoded labels from Lesson 1.
     - **`### 4.1 Sơ đồ 1: Bản Đồ Tầng Bậc Hệ Thống (...)`** + `\`\`\`diagram` triggers `renderLayeredStack`, which renders **BOTH** the `Kiến Trúc Phân Tầng (Stack)` view AND an **Excalidraw Hand-Drawn Interactive Mindmap (`excalidraw-sketch-svg`)** whose topology automatically adapts to the lesson's subject matter (or via an optional first-line directive `[TOPOLOGY: <kind>]` inside the `\`\`\`diagram` block):
       1. **`taxonomy-tree` (Sơ Đồ Phân Nhánh Đa Tầng — 4+ Tiers)**: Used for full-stack 4-tier hardware-to-application taxonomies (e.g., `c1-l1`: Hardware $\rightarrow$ Linux Kernel $\rightarrow$ Node.js Runtime $\rightarrow$ NestJS).
       2. **`pipeline-feedback-loop` (Sơ Đồ Đường Ống Thực Thi & Vòng Phản Hồi)**: Used for multi-stage compilation, parsing, stream, request pipeline, or inter-isolate transfer architectures with forward stages and speculative optimization / deoptimization bailout loops (e.g., `c1-l2`: V8 Frontend Parsing $\rightarrow$ Ignition Bytecode & IC $\rightarrow$ TurboFan JIT + OSR Bailout; `c2-l3`: Multi-Isolate Transfer Pipeline).
       3. **`dual-cycle-loop` (Sơ Đồ Vòng Lặp Kép — Inner Loop $\leftrightarrow$ Outer Loop + Foundation Bar)**: Used for dual-cycle, two-generation memory/GC, fast-path vs. slow-path, or event-loop systems (e.g., `c1-l3`: OS `cgroups` RSS Foundation Bar + Young Gen Scavenger Inner Loop $\leftrightarrow$ Old Gen Orinoco Major GC Outer Loop; `c2-l1`: V8 Call Stack + High-Priority Microtask Loop $\leftrightarrow$ Libuv 6-Phase Macrotask Loop).
       4. **`orbital-cycle` (Sơ Đồ Chu Trình Đa Trụ Cột — Balanced 3-Pillar Orbital Map)**: Used for 3-pillar subsystem routing or triangular architectures (e.g., `c2-l2`: Node.js API $\leftrightarrow$ Libuv Subsystem Routing $\leftrightarrow$ Linux Kernel `epoll` & NIC Hardware).
     - **Structural syntax inside `### 4.1` `\`\`\`diagram`**:
       - Optional line 1: `[TOPOLOGY: taxonomy-tree | pipeline-feedback-loop | dual-cycle-loop | orbital-cycle]` (if omitted, `detectMindmapTopology` selects the topology from the lesson's domain structure).
       - Enclose each tier/stage/loop in `┌───...───┐` and `└───┬───┘`.
       - Start each tier header with `│ 1. TẦNG ... (ENGLISH LAYER) │`, `│ 2. TẦNG ... │`, `│ 3. TẦNG ... │`.
       - Inside a tier box, list components either as `├── ComponentName: Technical description` or horizontal peer flow `[ Comp A (Spec A) ] ◄───► [ Comp B (Spec B) ] ◄───► [ Comp C (Spec C) ]`. **Always provide a concise parenthetical `(Spec)` or `: Spec` for each bracketed item** so the Mindmap card displays a real technical subtitle (never leave bare `[ Comp A ]` without a spec).
       - Between `└───┬───┘` and the next `┌───▼───┐`, place `│ <Protocol / Transition / Loop bridge description>` on its own line so the parser renders it on the inter-tier connectors, pipeline stage arrows, and feedback loops.
   - **`### 4.2 Sơ đồ 2: Dòng Chảy So Sánh ...`** + `\`\`\`diagram` (triggers `comparison` renderer -> renders `.mindmap-comparison` Excalidraw 2-column visual flow):
     - Block 1 MUST start with `MÔ HÌNH CŨ: <Tên mô hình Anti-pattern>` followed by 2–3 lines of flow (`──►`) and quantitative penalty (`= ...`), then a blank line.
     - Block 2 MUST start with `MÔ HÌNH HIỆN ĐẠI: <Tên mô hình Chuẩn Production>` followed by either linear flow lines or fan-in lines (`Item 1 ──┐` / `Item 2 ──┼──► [ Target ] ──► ...` / `Item 3 ──┘` / `└──► ...`).
   - **`### 4.3 Sơ đồ 3: Cây Quyết Định Kỹ Thuật (...)`** + `\`\`\`diagram` (triggers `decision-tree` renderer -> renders `.mindmap-decision-tree` Excalidraw flowchart + diagnostic cards; **MUST NEVER** fall back to raw blueprint):
     - Line 1: All-caps root question ending with `?`.
     - Every leaf outcome node MUST be enclosed in square brackets `[ TÊN KẾT QUẢ IN HOA ]` (include keywords like `CHUẨN`/`TỐI ƯU`/`MONOMORPHIC` for positive green badge, `SLOW`/`LỖI`/`CẤM` for danger red badge, or trade-off terms for caution amber badge).
     - Directly below each `[ TÊN KẾT QUẢ ]` in the same column, include 2–3 `- Đặc điểm kỹ thuật` bullet lines.
     - Always escape right-branch slashes as `\\` inside the `.ts` template string!
   - **`### 4.4 Bảng tổng hợp: Ma Trận Đánh Đổi Kỹ Thuật (...)`**:
     - 4-column Markdown trade-off matrix (`| Tiêu Chí So Sánh | Phương án 1 | Phương án 2 | Phương án 3 |`).
4. **Part 5 (`# 5. TỔNG KẾT HỌC THUẬT VÀ QUY TẮC THIẾT KẾ HỆ THỐNG (ENGINEERING INVARIANTS)`)**:
   - Lead-in sentence + 4 numbered engineering invariants (`1. **Định đề 1 (...):** ...` through `4. **Định đề 4 (...):** ...`) bridging the theory to `realCodeSnippet`, `quiz`, and `codeChallenges`.

---

## 3. Mandatory Specification for `realCodeSnippet`, `quiz`, and `codeChallenges`

### 3.1. `realCodeSnippet`
- **Line 1**: `// File: src/<module>/<file>.ts`
- **Line 2**: `// Trích dẫn từ dự án thực tế Arc Irobot Backend - <Mô tả>`
- **Body**: 45–90 lines of production-grade NestJS/TypeScript code with architectural JSDoc comments, zero `any`.

### 3.2. `quiz` (Exactly 8 Questions)
- IDs: `c<chapter>-l<lesson>-q1` through `q8`.
- 4 options per question with **balanced character lengths** so the correct answer is never obvious by length.
- `explanation`: 2–3 rigorous sentences explaining the underlying mechanism.

### 3.3. `codeChallenges` (3 Progressive Levels) & `codeChallenge`
- `codeChallenges` MUST contain 3 items:
  1. `level: 'basic'`, `levelLabel: 'Mức 1 · Cơ bản (Làm quen công thức)'`
  2. `level: 'intermediate'`, `levelLabel: 'Mức 2 · Trung bình (Mô hình hoá hệ thống)'`
  3. `level: 'advanced'`, `levelLabel: 'Mức 3 · Nâng cao (Chuẩn Production)'` (includes input validation and `throw new Error("<ERROR_CODE>")` tested with `expected: 'ERROR_THROWN'`).
- Copy the `basic` challenge object into `codeChallenge` for backward compatibility.
- Each challenge MUST include:
  - `title`, `description` (explicit function name, parameters, formulas, rounding rules, return keys).
  - `guidedSteps`: Array of 4 step-by-step strings (`'Bước 1 (...): ...'` to `'Bước 4 (...): ...'`).
  - `hints`: Array of 2 practical JavaScript/TypeScript hints.
  - `starterCode`: Target function declared FIRST (`function targetFn(...) { ... }`, no `export` keyword, no helper functions declared above the target function).
  - `solution`: Clean reference implementation that passes 100% of `testCases`.
  - `testCases`: 4–5 cases per challenge (**3 visible cases with `hidden: false`** so the UI renders the Input/Output specification cards, plus **1–2 hidden edge/error cases with `hidden: true`**).

---

## 4. Step-by-Step Execution Workflow

When asked to author or upgrade a lesson (e.g., `c1-l3` or `c2-l1`):

1. **Ensure Modular 1-Lesson-Per-File Structure**:
   - Check if `src/data/curriculum/chapter<X>/c<X>-l<Y>.ts` already exists.
   - If `src/data/curriculum/chapter<X>.ts` is still a monolithic file, split the target lesson (and sibling lessons in that chapter) into `src/data/curriculum/chapter<X>/c<X>-l<Y>.ts` and turn `src/data/curriculum/chapter<X>.ts` into a barrel file importing `c<X>_l<Y>`.
2. **Author / Rewrite the Lesson File**:
   - Consult [references/lesson-template.md](./references/lesson-template.md) for exact markdown patterns and Smart MindMap triggers.
   - Write the complete 5-part `theory`, `realCodeSnippet`, 8-question `quiz`, `codeChallenge`, and 3-tier `codeChallenges` inside `src/data/curriculum/chapter<X>/c<X>-l<Y>.ts`.
3. **Run the Automated Lesson Validator Script**:
   - Execute the validation script to verify all 17 QA criteria (including standalone file check and sandbox execution):
     ```bash
     npm run curriculum:validate <lesson-id>
     ```
   - Example: `npm run curriculum:validate c1-l1` or `npm run curriculum:validate c1-l2`
4. **Verify Project Build**:
   - Run `npm run build` to ensure zero TypeScript or Vite bundle errors.
