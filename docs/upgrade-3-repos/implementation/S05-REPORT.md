# S05 — Báo cáo triển khai: Room và engine AI 1-1 có state bền vững

03/11/2026 · Trạng thái: **locally_qualified** · Human acceptance: **pending**

Theo [S05 README](../phases/P03-classroom/sprints/S05-classroom-engine/README.md), [S05 specs](../phases/P03-classroom/sprints/S05-classroom-engine/specs.md), [SPEC-03](../specs/03-CLASSROOM-AI.md) và [S05-READINESS.md](S05-READINESS.md).

---

## 1. Tóm tắt kết quả

Sprint S05 (Phase P03 / Release R1) đã hoàn thành toàn bộ 3 stories cốt lõi:
- **US-016 (FR-16)**: Room AI có phiên bản (Pin package/persona/policy, draft rejection, mid-session immutability).
- **US-017 (FR-17)**: Engine giảng/vẽ/voice có fallback (Narration, ink/focus, raise-hand pause/resume, text/TTS fallback, cleanup remount).
- **US-018 (FR-18)**: Session durable và single writer (Lease CAS takeover, multi-device resume, dedup event sequence, server checkpoint grading).

| Repo | Công việc thực hiện | Kết quả kiểm thử |
|---|---|---|
| **arc-academy-backend** | Migration `classroom_rooms_sessions`, module `classroom/rooms` & `classroom/sessions`, OpenAPI internal/public, Bruno requests 106–123, e2e tests | `pnpm quality:check` PASSED 100% (134 tests coverage, 83 e2e tests) |
| **arc-academy-cms** | Orval API client, `ClassroomRoomEditorPage`, route `classrooms.$courseId.$lessonId`, browser e2e authoring test | `pnpm quality:check` PASSED 100% (70 unit tests, 2 e2e browser tests) |
| **arc-academy-web** | Orval API client, route `.../classroom/page`, component `ClassroomRoom`, `SessionClient`, browser TTS wrapper, browser e2e learner test | `pnpm quality:check` PASSED 100% (55 unit tests, 1 e2e browser test) |

---

## 2. Chi tiết theo từng User Story

### US-016 — Room AI có phiên bản

- **Schema & Migration Backend**:
  - `Room`: `id`, `lessonId` (unique 1 room/lesson), `title`, `ownerId`, `state` (`draft | published | archived`), `currentVersion`, `version` (optimistic locking), `createdAt`, `updatedAt`.
  - `RoomVersion`: `id`, `roomId`, `version` (unique `roomId, version`), `packageId` (FK `LecturePackage`, bắt buộc state=published), `packageHash`, `persona` (JSON), `voicePolicy` (JSON), `checkpointPolicy` (JSON), `publishedBy`, `publishedAt`, `createdAt`.
  - Migration: `20261103090000_classroom_rooms_sessions`.
- **API Staff (`/api/i/v1`)**:
  - `POST /i/v1/rooms`: tạo draft room cho bài học.
  - `GET /i/v1/rooms?lessonId=`: liệt kê room theo lesson.
  - `GET /i/v1/rooms/:id`: xem chi tiết room kèm danh sách phiên bản và capabilities (`canEdit`, `canPublish`).
  - `POST /i/v1/rooms/:id/versions`: tạo phiên bản nháp; từ chối `409 Conflict` nếu package chưa xuất bản.
  - `POST /i/v1/rooms/:id/versions/:version/publish`: reviewer độc lập xuất bản phiên bản, cập nhật `currentVersion` và ghi `AuditLog` + `OutboxMessage`.
- **CMS UI**:
  - Route: `/cms/classrooms/:courseId/:lessonId`.
  - Component: `ClassroomRoomEditorPage`. Hỗ trợ tạo room nháp, tạo phiên bản liên kết package đã xuất bản, điền persona/voice/checkpoint policy, và nút xuất bản cho reviewer.
  - E2E Test: `arc-academy-cms/e2e/classroom-authoring.spec.ts` xác minh luồng tác giả và duyệt độc lập.

### US-017 — Engine giảng/vẽ/voice có fallback

- **Web Classroom Engine**:
  - Route: `/:locale/learn/courses/:courseId/lessons/:lessonId/classroom`.
  - Component: `ClassroomRoom` (`arc-academy-web/src/features/learning/ClassroomRoom.tsx`).
  - Hỗ trợ học viên nghe narration với Web Speech API qua `speakNarration` (`src/lib/tts/speech.ts`).
  - Trạng thái text-first: luôn có văn bản giảng dạy và ý đồ đồ hoạ hiển thị trực quan; TTS là tuỳ chọn bật/tắt linh hoạt.
  - Giơ tay / Tạm dừng: học viên có thể tạm dừng bài giảng bất cứ lúc nào qua API `/pause`, trạng thái phiên chuyển sang `paused`; bấm "Tiếp tục" `/resume` trở lại trạng thái `active`.
  - Dọn dẹp tài nguyên (AC-017-03): khi unmount hoặc chuyển route, toàn bộ speech synthesis bị cancel lập tức, timer gửi tick heartbeat 20s bị xoá, không rò rỉ bộ nhớ hoặc worker/RAF.
  - E2E Test: `arc-academy-web/e2e/classroom.spec.ts` xác minh đầy đủ luồng tạm dừng, tiếp tục, trả lời câu hỏi và kết thúc bài học.

### US-018 — Session durable và single writer

- **Schema & State Machine Backend**:
  - `ClassroomSession`: `id`, `accountId`, `roomId`, `roomVersionId`, `snapshot` (bản sao JSON đã pin của package/persona/policy), `status` (`created | preparing | active | paused | completed | aborted | expired`), `serverVersion`, `lastAckSequence`, `resumeCheckpointId`, `resumeBeatId`, `leaseId`, `leaseExpiresAt` (TTL 60s), `startedAt`, `endedAt`.
  - `SessionEvent`: append-only, `sessionId`, `eventId` (dedup client UUID), `sequence` (đơn điệu), `leaseId`, `kind` (`tick | checkpoint_ack | raise_hand | resume | pause | finish`), `position`.
  - `SessionCheckpointAttempt`: lưu lịch sử nộp bài của học viên, server chấm điểm (`passed`, `explanation`), client không được tự gửi kết quả mastery.
- **Lease CAS & Concurrency Control**:
  - API `/lease` hỗ trợ `acquire`, `renew`, và `takeover` với `expectedVersion`.
  - Khi thiết bị B thực hiện takeover, thiết bị A gửi request tiếp theo bị từ chối với `409 LEASE_REQUIRED` / `stale_lease`.
  - Tải lại phiên trên thiết bị mới phục hồi chính xác snapshot ban đầu, `lastAckSequence`, và checkpoint đã đạt.
  - Hoàn tất phiên `/finish` yêu cầu `Idempotency-Key` và chỉ cho phép khi tất cả câu hỏi kiểm tra bắt buộc đã pass trên máy chủ.
- **E2E Tests**:
  - `arc-academy-backend/test/classroom.e2e-spec.ts`: 4 kịch bản E2E kiểm tra toàn bộ luồng lease, takeover, dedup, server-side grading, và mid-session version immutability.

---

## 3. Bằng chứng kiểm thử (Verification Evidence)

1. **Backend Integration / E2E**:
   - `test/classroom.e2e-spec.ts`: PASSED 100% trên Postgres thật.
   - `pnpm quality:check`: PASSED (foundation, formatting, lint, typecheck, coverage 23 suites/134 tests, OpenAPI consistency, Bruno 125 operations).
2. **CMS Studio Browser E2E**:
   - `e2e/classroom-authoring.spec.ts`: PASSED 2/2 tests.
   - `pnpm quality:check`: PASSED (foundation, structure, formatting, lint, typecheck, coverage 15 files/70 tests, bilingual 931 keys).
3. **Web Learner Browser E2E**:
   - `e2e/classroom.spec.ts`: PASSED 1/1 test.
   - `pnpm quality:check`: PASSED (foundation, structure, formatting, lint, typecheck, coverage 14 files/55 tests, bilingual 310 keys).

---

## 4. Trạng thái Gate

- **Local Gate**: ĐẠT (`locally_qualified`).
- **Human Acceptance**: Chờ ĐẠI CA xem xét và phê duyệt sign-off.
- **Production Ops**: Chưa triển khai deploy lên Railway/Production cloud.
