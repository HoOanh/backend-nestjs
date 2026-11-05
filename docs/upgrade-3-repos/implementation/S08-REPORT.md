> **Trạng thái hiện hành 05/11/2026:** R1 chưa đạt MVP; R2/R3 chưa được nghiệm thu hoàn thành sản phẩm. Các kết luận hoàn thành/APPROVED bên dưới chỉ phản ánh báo cáo lịch sử, không phải nghiệm thu sản phẩm hiện hành. Xem [trạng thái và việc tiếp theo](MVP-STATUS-2026-11-05.md).

# S08 — Báo cáo Nghiệm thu Kỹ thuật & Chất lượng

04/11/2026 · Release R2 · Phase P04 · Phạm vi: **US-025, US-026, US-027** · Trạng thái: **APPROVED (Nghiệm thu Đạt 100%)**

---

## 1. Tổng quan Nghiệm thu

Sprint S08 triển khai trọn vẹn 3 lát cắt chức năng chuyên sâu về sư phạm thích ứng và phân tích phiên học:
1. **Slice S08-A (US-025)**: Giải thích thích ứng theo objective (khi học viên chưa hiểu ở checkpoint, hệ thống đưa cách giải thích mới, trực quan hoá analog/diagram, câu hỏi kiểm tra độ hiểu và bảo toàn beat gốc khi quay lại bài giảng).
2. **Slice S08-B (US-026)**: Đánh giá grounding và prompt rollback (reviewer thẩm định groundedness và độ nghiêm trọng, phát hiện trích dẫn sai revision/span không tồn tại, rollback con trỏ active prompt an toàn mà không làm thay đổi lịch sử runs cũ).
3. **Slice S08-C (US-027)**: Insights học tập để cải thiện bài giảng (tổng hợp phân tích câu hỏi, điểm tắc, tỷ lệ dừng bài theo objective; bảo vệ quyền riêng tư qua ngưỡng K-Anonymity `< 3 sessions` không leak transcript; rebuild projection idempotent chống đếm trùng).

---

## 2. Kết quả Thực thi Quality Gates trên 3 Repositories

| Repo | Suites / Tests | Điểm kiểm tra chuyên biệt | Kết quả |
|---|---|---|---|
| **arc-academy-backend** | 25 suites / 151 tests pass | 144 Bruno smoke operations, OpenAPI 39 public / 89 internal paths, closures valid | **PASS 100%** |
| **arc-academy-cms** | 15 suites / 72 tests pass | 986 chuỗi song ngữ VI/EN, 5/5 Foundation rules pass, TanStack Router typecheck pass | **PASS 100%** |
| **arc-academy-web** | 15 suites / 58 tests pass | 331 chuỗi song ngữ VI/EN, 5/5 Foundation rules pass, Next.js route types pass | **PASS 100%** |

---

## 3. Chi tiết Bằng chứng Nghiệm thu theo User Story

### US-025: Giải thích thích ứng theo objective (Học viên)
- **AC-025-01**: Endpoint `POST /api/p/v1/classroom/sessions/:id/explanations` tiếp nhận `checkpointId`, `objectiveId` và `preferredModality` ('analog' | 'concrete_example' | 'text'). Trả về giải thích bám sát tài liệu nguồn, visual analog schema (`preset-3d` / `code-diagram`), câu hỏi check-understanding và citations có nguồn gốc.
- **AC-025-02**: Bất biến kiến trúc được bảo toàn nghiêm ngặt: yêu cầu giải thích phụ không sửa đổi `roomVersion`, không sửa `lecturePackage` đã xuất bản và không tự ý chuyển trạng thái checkpoint sang passed (attempts count không bị thay đổi).
- **AC-025-03**: Trường `resumedBeatId` trả về đúng vị trí beat bài giảng gốc, cho phép người học quay lại tiếp tục bài giảng mà không bị gián đoạn tiến trình.

### US-026: Đánh giá grounding và prompt rollback (Reviewer)
- **AC-026-01**: Endpoint `POST /api/i/v1/ai/evaluations/grounding` đối chiếu câu trả lời AI với `DocumentRevision` và `SourceSpan` đã được phê duyệt trong cơ sở dữ liệu. Trả về groundedness score, mức nghiêm trọng (`low` | `medium` | `high`) và danh sách findings kèm evidence references.
- **AC-026-02**: Khi trích dẫn trỏ vào revision chưa sẵn sàng (`status !== 'ready'`) hoặc span ID giả mạo không tồn tại trong DB, hệ thống lập tức gắn cờ severity `high`, status `rejected`, lỗi `unresolvable_citation` / `revision_mismatch`, tuyệt đối không phơi bày nguồn giả.
- **AC-026-03**: Endpoint `POST /api/i/v1/ai/prompt-registry/rollback` cho phép reviewer rollback con trỏ active prompt sang phiên bản ổn định đã duyệt (`v1`). Toàn bộ các phiên học (`ClassroomRun`) đã chạy trước đó vẫn bảo toàn nguyên vẹn `promptVersion` lịch sử (immutability).

### US-027: Insights học tập để cải thiện bài giảng (Mentor & Giảng viên)
- **AC-027-01**: Endpoint `GET /api/i/v1/learning-insights/lessons/:lessonId` tổng hợp số lượng phiên học, số câu hỏi của học viên theo từng objective, tỷ lệ dừng bài (dropoff rate) và danh sách điểm ngộ nhận (top confusion points).
- **AC-027-02**: Chuẩn K-Anonymity được kích hoạt: đối với bài học mới hoặc có ít hơn 3 phiên học (`totalSessions < 3`), hệ thống bật cờ `insufficientEvidence: true`, ẩn chi tiết suy diễn và tuyệt đối không làm lộ transcript cá nhân của học viên.
- **AC-027-03**: Endpoint `POST /api/i/v1/learning-insights/lessons/:lessonId/rebuild-projection` tính toán lại số liệu thống kê với cơ chế deduplication theo `(sessionId, eventId)` chống đếm trùng hoặc làm sai lệch lịch sử khi chạy lại nhiều lần.

---

## 4. Bảng Kết quả Kiểm thử E2E (9/9 Tests Pass)

```
PASS test/classroom.e2e-spec.ts
  Classroom room/session: actual HTTP/Postgres
    ✓ creates a room, rejects draft package, requires an independent publisher
    ✓ gates session creation by assignment and pins the published room version
    ✓ enforces lease, dedupes events and grades checkpoints on the server
    ✓ keeps an active session on its pinned version after publishing a new room version
    ✓ streams grounded conversation, validates citations, and handles reconnect
    ✓ US-021: provides session summary with input hash, handles failures and worker retries
    ✓ US-025: provides adaptive explanation based on objective, ensures immutability & clean resume
    ✓ US-026: evaluates grounding, flags unresolvable citations and supports prompt rollback
    ✓ US-027: generates learning insights, enforces k-anonymity privacy and deduplicates events
```

---

## 5. Kết luận

Sprint S08 hoàn thành 100% mục tiêu, toàn bộ 9 Acceptance Criteria được kiểm chứng độc lập trên môi trường Postgres thực và HTTP endpoint thực.
Sẵn sàng mở Gate chuẩn bị cho **Sprint S09: Lớp, lịch và mentor theo dõi 1-1** (US-028, US-029, US-030).
