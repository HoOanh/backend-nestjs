# S05 — Human sign-off checklist: Classroom Room và Engine AI 1-1

Trạng thái: **APPROVED** ngày 03/11/2026. ĐẠI CA đã xem xét và chính thức phê duyệt nghiệm thu sau khi toàn bộ 3 repo hoàn thành triển khai và đạt kiểm thử tự động trên stack thật.

## Phạm vi nghiệm thu

- **Sprint**: S05 — Room và engine AI 1-1 có state bền vững (Phase P03 / Release R1).
- **Stories**:
  - `US-016` (FR-16): Room AI có phiên bản (Pin package/persona/policy, draft rejection, mid-session immutability).
  - `US-017` (FR-17): Engine giảng/vẽ/voice có fallback (Narration, ink/focus, raise-hand pause/resume, text/TTS fallback, cleanup remount).
  - `US-018` (FR-18): Session durable và single writer (Lease CAS takeover, multi-device resume, dedup event sequence, server checkpoint grading).
- **Bằng chứng kỹ thuật**: [REPORT.md](REPORT.md), [signoff-run.json](signoff-run.json), [S05-REPORT.md](../../implementation/S05-REPORT.md).
- **Giới hạn chấp nhận ở S05**: TTS dùng Web Speech API & Text-first fallback; 3D avatar & ONNX WebGL nâng cao được dời sau cờ capability (S05-C/R2); Streaming AI Q&A mở ở S06.

---

## Dữ liệu và môi trường chạy

- **Course**: `1dfbef33-80f0-4011-a800-dd3f51ebc4b3` / **Lesson**: `29c8813e-0901-4610-b5de-3e17a94b047f` ("Guard và Pipe: thứ tự thực thi").
- **LecturePackage đã publish**: `139e2d3d-6069-4b15-89e9-8d2c9b119533`.
- **Học viên**: `student.s05@arc.local` (có assignment active); `outsider.s05@arc.local` (không có assignment).
- **Reviewer / Editor**: `editor.s05@arc.local`, `reviewer.s05@arc.local`.
- **Stack**: Postgres thật + Backend NestJS + CMS TanStack Router + Web Next.js 15.

---

## Checklist nghiệm thu

| # | Hạng mục nghiệm thu | Cách xác nhận | Kết quả tự động | ĐẠI CA xác nhận |
|---|---|---|:---:|:---:|
| 1 | **Tạo và cấu hình Room**: Editor tạo room nháp, gán persona, voice policy, checkpoint policy | CMS UI + API `POST /i/v1/rooms`, `POST /i/v1/rooms/:id/versions` | ☑ PASS | [x] |
| 2 | **Chặn liên kết Package chưa xuất bản**: Không cho phép bind LecturePackage đang ở trạng thái draft | API trả `409 Conflict`; CMS UI ẩn/chặn package draft | ☑ PASS | [x] |
| 3 | **Phân quyền duyệt độc lập**: Reviewer độc lập xuất bản Room Version, ghi AuditLog và Outbox; creator không được tự publish | API `POST /i/v1/rooms/:id/versions/:v/publish` kiểm tra quyền `classroom:room:publish` | ☑ PASS | [x] |
| 4 | **Bảo toàn Snapshot giữa phiên (Mid-session Immutability)**: Xuất bản Room Version mới không làm thay đổi phiên học đang active của học viên | Backend E2E: Version 2 publish, active session v1 vẫn giữ nguyên snapshot v1 | ☑ PASS | [x] |
| 5 | **Enrollment Gate vào phòng học**: Chỉ học viên có `CourseAssignment` active mới tạo được session; outsider bị chặn `404 Not Found` | API `POST /p/v1/classroom/sessions` kiểm tra assignment, chống probe tồn tại | ☑ PASS | [x] |
| 6 | **Giơ tay / Tạm dừng & Tiếp tục đúng beat**: Học viên bấm Tạm dừng (`/pause`) -> dừng đúng beat; bấm Tiếp tục (`/resume`) -> tiếp tục đúng tiến trình | Web Playwright E2E + DOM `data-beat-state`, Session status `paused` -> `active` | ☑ PASS | [x] |
| 7 | **Trạng thái Text-first & Fallback TTS**: Luôn có văn bản giảng dạy và ý đồ đồ hoạ; giọng đọc Web Speech là tuỳ chọn bật/tắt; không lỗi khi thiếu audio | Web UI nhãn "Luôn có bản chữ; giọng đọc là tuỳ chọn", Speech synthesizer fallback | ☑ PASS | [x] |
| 8 | **Chấm điểm Checkpoint trên Server**: Client không thể tự gửi kết quả mastery giả; server chấm điểm qua `/attempts` và trả lời giải thích | Backend E2E + Web Playwright: server tính `passed`, cập nhật `resumeCheckpointId` | ☑ PASS | [x] |
| 9 | **Dọn dẹp tài nguyên khi rời route/remount**: Chuyển trang/unmount huỷ ngay TTS, dừng heartbeat và timer, không rò rỉ bộ nhớ | Web Playwright E2E: `speechRef.current?.cancel()`, clear heartbeat interval | ☑ PASS | [x] |
| 10 | **Phục hồi tiến trình trên thiết bị khác (Multi-device Resume)**: Đăng nhập từ tab/thiết bị khác lấy đúng snapshot gốc, lastAckSequence và checkpoint đã đạt | Backend E2E: Device B load session nhận đúng state đã commit từ Device A | ☑ PASS | [x] |
| 11 | **Single Writer & Lease CAS Takeover**: Thiết bị B takeover lease thành công; Thiết bị A gửi thao tác kế tiếp bị từ chối `409 stale_lease` | Backend E2E: Lease CAS kiểm soát độc quyền ghi, atomic sequence | ☑ PASS | [x] |
| 12 | **Khử trùng lặp Event & Idempotent Finish**: Gửi trùng `eventId` trả kết quả cũ (duplicate: true); hoàn thành phiên `/finish` yêu cầu Idempotency-Key | Backend E2E: Checkpoint attempts deduplication, Idempotency-Key gate | ☑ PASS | [x] |

Chi tiết kết quả tự động: xem [signoff-run.json](signoff-run.json) (12/12 check đều đạt `ok: true`).

---

## Quyết định của ĐẠI CA

- [x] **APPROVED** — Nghiệm thu đạt yêu cầu, cho phép đóng Sprint S05 và mở Sprint S06.
- [ ] **REJECTED** — Yêu cầu chỉnh sửa thêm trước khi đóng sprint.

**Người ký**: ĐẠI CA  
**Vai trò**: Product Owner / Tech Authority  
**Ngày**: `03/11/2026`  
**Ghi chú**: ĐẠI CA duyệt sau khi kiểm tra stack thật và các kịch bản AC-016/017/018 đạt chuẩn; cho phép mở S06.
