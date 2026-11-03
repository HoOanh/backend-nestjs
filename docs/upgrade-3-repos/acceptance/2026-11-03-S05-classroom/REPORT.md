# Acceptance Report — S05: Classroom Room và Engine AI 1-1

**Thời gian**: 03/11/2026  
**Phạm vi**: US-016 (FR-16), US-017 (FR-17), US-018 (FR-18)  
**Trạng thái**: **LOCALLY QUALIFIED** (chờ human acceptance / review sign-off của ĐẠI CA)

---

## 1. Tóm tắt kết quả theo User Stories

| Story ID | Tiêu đề | Lớp kiểm thử | Kết quả |
|---|---|---|---|
| **US-016** | Room AI có phiên bản | Backend E2E (`test/classroom.e2e-spec.ts`) + CMS Playwright E2E (`e2e/classroom-authoring.spec.ts`) | **PASSED** (AC-016-01, AC-016-02, AC-016-03) |
| **US-017** | Engine giảng/vẽ/voice có fallback | Web Vitest (`src/lib/classroom/schema.test.ts`, `speech.test.ts`) + Web Playwright E2E (`e2e/classroom.spec.ts`) | **PASSED** (AC-017-01, AC-017-02, AC-017-03) |
| **US-018** | Session durable và single writer | Backend E2E (`test/classroom.e2e-spec.ts`) + Web Playwright E2E (`e2e/classroom.spec.ts`) | **PASSED** (AC-018-01, AC-018-02, AC-018-03) |

---

## 2. Chi tiết bằng chứng nghiệm thu (Evidence Matrix)

### AC-016: Room AI có phiên bản

- **AC-016-01 (Pin package/persona/policy + Student assignment active)**:
  - *Backend E2E*: `creates a room, rejects draft package, requires an independent publisher` + `gates session creation by assignment and pins the published room version`. Kiểm tra tạo room, publish version pin package/persona/voicePolicy/checkpointPolicy; student có assignment active tạo được session, outsider không có assignment nhận `404 not_found` (chống probe tồn tại).
  - *CMS Playwright E2E*: `Editor creates room, pins published package and configures version` và `Reviewer publishes room version with independent approval`. Verify toàn bộ luồng UI tạo phòng, chọn package đã publish, điền persona, tick checkpoint bắt buộc và reviewer publish version.
- **AC-016-02 (Chặn bind package draft)**:
  - *Backend E2E*: Reject tạo version khi package chưa được publish với `409 Conflict` và details chính xác.
  - *CMS Playwright E2E*: UI chỉ hiển thị danh sách package đã publish; hiển thị thông báo chặn khi chưa có package publish.
- **AC-016-03 (Immutability mid-session)**:
  - *Backend E2E*: `keeps an active session on its pinned version after publishing a new room version`. Khi reviewer publish version 2 giữa lúc student đang học session v1, `GET session` vẫn giữ nguyên snapshot của version 1.

### AC-017: Engine giảng/vẽ/voice có fallback

- **AC-017-01 (Vào phòng, narration, pause/resume đúng beat)**:
  - *Web Playwright E2E*: Vào phòng học `/vi/learn/courses/.../lessons/.../classroom`, đọc narration, chuyển trạng thái "Đang học" -> bấm "Tạm dừng" -> chuyển sang "Tạm dừng" -> bấm "Tiếp tục" -> tiếp tục session mà không mất dữ liệu.
- **AC-017-02 (Fallback text-first & Checkpoint server grade)**:
  - *Web Playwright E2E*: Nhãn "Luôn có bản chữ; giọng đọc là tuỳ chọn" luôn hiển thị; câu hỏi kiểm tra checkpoint được gửi lên server chấm điểm `/attempts`; server trả kết quả và lời giải thích giải trình tự động.
- **AC-017-03 (Cleanup khi rời route/remount)**:
  - *Web Playwright E2E*: Bấm nút "Về khoá học" điều hướng route; speech synthesis bị huỷ lập tức (`speechRef.current?.cancel()`), interval timer tick và heartbeat bị clear, không rò rỉ tài nguyên.

### AC-018: Session durable và single writer

- **AC-018-01 (Resume checkpoint/lastAck trên thiết bị khác)**:
  - *Backend E2E*: Device A submit checkpoint đạt -> Device B mở session nhận đúng checkpoint đã pass, đúng lastAckSequence và snapshot gốc.
- **AC-018-02 (Lease CAS takeover & Chống giả mạo mastery)**:
  - *Backend E2E*: Tab B takeover lease thành công; Tab A gửi tick/event kế tiếp nhận `409 stale_lease`; client không thể gửi flag `passed: true` giả (mọi kết quả chấm điểm do server tính toán).
- **AC-018-03 (Dedup eventId & Idempotent finish)**:
  - *Backend E2E*: Gửi lại event cùng `eventId` trả `duplicate: true`, giữ nguyên sequence; gọi `/finish` nhiều lần cùng `Idempotency-Key` trả kết quả nhất quán.

---

## 3. Trạng thái chất lượng 3 Repos

- `arc-academy-backend`: `pnpm quality:check` **PASSED** (134/134 unit & integration tests, 83/83 e2e tests, 0 lint/format/typescript errors).
- `arc-academy-cms`: `pnpm quality:check` **PASSED** (70/70 unit tests, 2/2 e2e tests, 0 lint/format/typescript errors, 931 bilingual keys).
- `arc-academy-web`: `pnpm quality:check` **PASSED** (55/55 unit tests, 1/1 e2e tests, 0 lint/format/typescript errors, 310 bilingual keys).
- **Không có bất kỳ trường hợp nào sử dụng `any` trong TypeScript**.
