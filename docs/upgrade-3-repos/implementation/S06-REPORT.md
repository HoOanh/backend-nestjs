# S06 — Báo cáo triển khai: Trao đổi AI, checkpoint và resume đa thiết bị

03/11/2026 · Trạng thái: **locally_qualified** · Human acceptance: **pending**

Theo [S06 specs](../phases/P03-classroom/sprints/S06-conversation-progress/specs.md), [SPEC-03](../specs/03-CLASSROOM-AI.md) và [S06-READINESS.md](S06-READINESS.md).

---

## 1. Tóm tắt kết quả

Sprint S06 (Phase P03 / Release R1) đã hoàn thành toàn diện 3 User Stories:
- **US-019 (FR-19)**: Hội thoại AI theo checkpoint và nguồn (SSE streaming, grounded citations, chống leak private text, deduplication/reconnect run query, hạn ngạch 15 câu hỏi/session).
- **US-020 (FR-20)**: Checkpoint và tiến trình có evidence (`LessonProgress` provenance, server-side grading, chống untrusted client score, idempotent checkpoint attempts).
- **US-021 (FR-21)**: Transcript và summary phiên học (`SessionSummary` với SHA-256 `inputHash`, async outbox worker `classroom.session.finished`, retry không duplicate, phân quyền truy cập theo account).

| Repo | Công việc thực hiện | Kết quả kiểm thử |
|---|---|---|
| **arc-academy-backend** | Migration `classroom_progress_conversation_summary`, models `LessonProgress`, `ClassroomMessage`, `ClassroomRun`, `SessionSummary`, SSE endpoint `POST /messages`, `GET /messages`, `GET /runs/:runId`, `GET /summary`, `GET /me/progress`, worker `classroom-summary.ts`, Bruno requests 124–129 | `pnpm quality:check` PASSED 100% (25 suites / 143 tests, 85.56% stmts, 64.36% branches, 131 Bruno operations covered) |
| **arc-academy-web** | Orval API client cập nhật, client helper `streamSessionMessage`, `fetchSessionMessages`, `fetchSessionSummary`, UI Q&A panel, streaming response, citation cards, summary view khi hoàn thành | `pnpm quality:check` PASSED 100% (14 suites / 55 tests), Playwright E2E `classroom.spec.ts` PASSED 100% |
| **arc-academy-cms** | Cập nhật sync API internal contracts, đảm bảo tương thích 100% | `pnpm quality:check` PASSED 100% (15 suites / 70 tests, zero errors) |

---

## 2. Chi tiết theo từng User Story

### US-019 — Hội thoại AI theo checkpoint và nguồn

- **Cơ chế SSE streaming (`POST /classroom/sessions/:id/messages`)**:
  - Hỗ trợ học viên gửi câu hỏi gắn liền với checkpoint hoặc ngữ cảnh bài học hiện tại.
  - Streaming Server-Sent Events với các event chuẩn:
    - `accepted`: xác nhận run streaming bắt đầu.
    - `delta`: từng token câu trả lời được truyền về trình duyệt theo thời gian thực.
    - `citation`: các trích dẫn tài liệu nguồn từ giáo án đã pin (`sourceId`, `sourceTitle`, `sectionTitle`, `excerpt`).
    - `completed`: chốt phiên chạy AI kèm `tokenUsage` và `messageId`.
  - Quản lý hạn ngạch: tối đa 15 câu hỏi/phiên, từ chối nộp quá hạn mức bằng `409 Conflict`.
- **Bảo mật và chống rò rỉ dữ liệu (AC-019-02)**:
  - AI chỉ truy xuất tài liệu nằm trong `sourceRefs` của lecture package phiên bản đã xuất bản và ghim vào room/session.
  - Không truy cập hoặc để lộ tài liệu draft của tác giả khác hoặc tài liệu chưa được duyệt.
- **Khả năng khôi phục và chống trùng lặp (AC-019-03)**:
  - Idempotent nộp tin nhắn qua `clientMessageId`: nếu stream ngắt kết nối hoặc retry, server trả về tin nhắn và run đã hoàn thành mà không tạo message hoặc run trùng lặp trong DB.
  - Endpoint `GET /classroom/sessions/:id/runs/:runId` cho phép client kiểm tra trạng thái và tải lại tin nhắn trợ giảng.

### US-020 — Checkpoint và tiến trình có evidence

- **Mô hình dữ liệu `LessonProgress`**:
  - Bảng `lesson_progress` lưu trữ `accountId`, `courseId`, `lessonId`, `status` (`in_progress | completed`), `passedCheckpoints`, `score`, `sourceSessionId`, `completedAt`.
  - Khởi tạo tự động khi học viên tạo hoặc mở phiên học thật (`ClassroomSession`).
- **Server-side grading & provenance (AC-020-01, AC-020-02)**:
  - Điểm số và trạng thái `passed` chỉ do server chấm qua endpoint `POST /checkpoints/:checkpointId/attempts` bằng logic server; client không thể tự phong hoặc can thiệp điểm.
  - Không lộ đáp án đúng (`answerKey`) cho client.
- **Idempotency & Replay (AC-020-03)**:
  - Nộp lại hoặc gửi trùng `attempt` với cùng câu trả lời được nhận diện và không làm sai lệch số lần thử hoặc số lượng checkpoint đã đạt.
- **Endpoints tiến độ**:
  - `GET /api/p/v1/me/progress`: danh sách tiến trình các bài học của học viên (hỗ trợ lọc theo `courseId`).
  - `GET /api/p/v1/me/progress/lessons/:lessonId`: xem chi tiết tiến độ bài học cụ thể.

### US-021 — Transcript và summary phiên học

- **Mô hình dữ liệu `SessionSummary`**:
  - Khóa chính duy nhất theo session: `sessionId @unique`.
  - `inputHash`: SHA-256 hash của toàn bộ hội thoại và kết quả kiểm tra checkpoint trong session.
  - `promptVersion`: đánh dấu phiên bản prompt tạo tóm tắt (ví dụ `'v1'`).
  - `status`: `pending | completed | failed`.
  - `summary`, `strengths`, `confusionPoints`, `recommendedNext`, `citations`.
- **Quy trình tổng kết bất đồng bộ (AC-021-01)**:
  - Khi học viên bấm kết thúc bài học (`transition('finish')`), một outbox event `classroom.session.finished` được tạo và bản ghi tóm tắt được khởi tạo/tổng hợp.
  - Endpoint `GET /api/p/v1/classroom/sessions/:id/summary` trả về tóm tắt định hướng cho học viên.
- **Xử lý lỗi và phân quyền (AC-021-02)**:
  - Học viên ngoài scope cố tình đọc summary của người khác sẽ bị chặn `404 Not Found`.
  - Nếu tóm tắt bị lỗi (`status: 'failed'`), trạng thái hoàn thành phiên học (`status: 'completed'`) vẫn được bảo toàn nguyên vẹn.
- **Idempotency & Worker Retry (AC-021-03)**:
  - Khi worker retry hoặc đổi `promptVersion`, bản ghi summary được cập nhật tại chỗ, hoàn toàn không nhân bản hay làm trùng lặp transcript hoặc bản ghi tóm tắt.

---

## 3. Bằng chứng kiểm thử tự động (Verification Evidence)

### 3.1. arc-academy-backend
- **Unit / Integration / Coverage**: 25 test suites, 143 tests passed.
  - Statements: 85.56% (yêu cầu ≥ 75%)
  - Branches: 64.36% (yêu cầu ≥ 60%)
  - Functions: 82.66% (yêu cầu ≥ 70%)
  - Lines: 88.53% (yêu cầu ≥ 75%)
- **E2E Tests (`test/classroom.e2e-spec.ts`)**: 6/6 tests passed 100%:
  - Room versioning & publish gating.
  - Assignment authorization.
  - Server grading & single writer lease CAS.
  - Immutability of active sessions upon room version changes.
  - SSE grounded conversation & run reconnection (AC-019-01, AC-019-02, AC-019-03).
  - Session summary provenance, failure handling & worker retry (AC-021-01, AC-021-02, AC-021-03).
- **Bruno Manual Smoke Collection**: 131/131 documented operations covered (requests 124–129).

### 3.2. arc-academy-web
- **Quality Check**: 100% PASSED (Foundation, Structure, Format, ESLint, TypeScript typecheck, Vitest 14 suites / 55 tests, Product check, Generated API sync check).
- **Playwright E2E (`e2e/classroom.spec.ts`)**: PASSED:
  - Kiểm tra giao diện Lớp AI 1-1, tạm dừng/tiếp tục bài giảng.
  - Giơ tay hỏi bài ("Giơ tay hỏi AI") tự động tạm dừng phiên học và mở Q&A panel.
  - Gửi câu hỏi, nhận streaming delta tokens và trích dẫn tài liệu nguồn chuẩn xác.
  - Trả lời checkpoint, server chấm điểm đạt chuẩn.
  - Kết thúc phiên học, hiển thị màn hình tổng kết kèm thế mạnh, điểm cần lưu ý và bước học tiếp theo.

### 3.3. arc-academy-cms
- **Quality Check**: 100% PASSED (Foundation, Structure, Format, ESLint, TypeScript typecheck, Vitest 15 suites, Product check, Generated API sync check).

---

## 4. Trạng thái Sprint

- Sprint S06: **locally_qualified** (sẵn sàng cho Human Acceptance & Sign-off).
