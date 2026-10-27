# Quyết định và phê duyệt

DRAFT 0.2 · **G0=CLOSED**. Bản0.1 được thay bởi0.2; không chuyển trạng thái duyệt cũ tự động.

## Đã xác nhận qua chỉ đạo scope

- Repo backend đặt tên `arc-academy-backend`; hai repo còn lại `arc-academy-cms`, `arc-academy-web`.
- Core là setup content/course/lesson/tài liệu, giáo án/đồ hoạ, lớp AI 1-1 và trao đổi AI.
- Hồ sơ triển khai chia phase/sprint; skill và coding rules phải chuẩn bị trước setup.
- Thanh toán ngoài cả ba release, chưa có kế hoạch thực hiện.
- Hiện chỉ được chỉnh tài liệu và draft skill/rule; chưa setup/code.

Xác nhận các ý scope trên không phải duyệt toàn bộ thiết kế hoặc mở G0.

## Quyết định thiết kế cần duyệt

| ID | Vấn đề | Đề xuất | Trạng thái |
|---|---|---|---|
| D-01 |Definition và release scope |R1 core flow pilot/S01–06, R2 depth/S07–09, R3 production/S10–11;1-1 là AI |Pending |
| D-02 |Data/infra/versions |Postgres/Prisma candidate, MinIO/S3, Redis; Node24 candidate và compatibility matrix |Pending |
| D-03 |Nguồn tài liệu |PDF text/DOCX/MD/TXT R1; scanned PDF báo needs_ocr, OCR tự động chưa xếp sprint; limit và confidentiality policy |Pending |
| D-04 |Đồ hoạ |Typed diagram/image/whiteboard storyboard R1, advanced3D preset studio R2; không arbitrary code |Pending |
| D-05 |AI/voice và ngân sách vận hành |Provider text/image capabilities, model/voice rights, quota numbers, fallback server TTS; text always available |Pending |
| D-06 |Review/governance |Reviewer khác author; citation/hash/version rules; emergency waiver có audit, không waive structural errors |Pending |
| D-07 |Pilot/production NFR |Số học viên/phiên đồng thời, hardware, SLO/RPO/RTO/backup owner |Pending |
| D-08 |Migration/privacy |Local-only progress opt-in hoặc thông báo giới hạn; legacy archive/read-only; retention/citation permissions |Pending |
| D-09 |Standards/skills |Rule templates,5 skill drafts, source/pinning external skills, ownership sync3 repo |Pending |
| D-10 |Nhân sự/capacity |Sprint planning window2 tuần, effort PD và reviewer/operator availability |Pending |

## Gate theo artifact

BRD / Architecture+ADR / SRS / global+per-sprint stories JSON / shared+sprint specs / standards+skills / roadmap: **tất cả Pending**, reviewer ĐẠI CA, version0.2. Approval record phải ghi version/hash, phạm vi release/sprint, ngày và người duyệt. Duyệt một phần không mở setup cho phần còn thiếu.

G0 mở chỉ khi toàn bộ baseline+S00 và blocking decisions cho sprint đầu đã được duyệt. Trước mỗi sprint: spec chi tiết và dependency được duyệt, story AC rõ, không còn blocking technical/business decision. Chỉ làm phần được duyệt; không tự thêm source type/renderer/AI capability khác scope. Chưa có phản hồi rõ thì không ghi Approved.

## Giới hạn khảo sát

Chưa đo production traffic, chưa chạy compatibility/performance spike, chưa có báo giá AI/hạ tầng, chưa nghiệm thu scaffold sibling. Phần thiết kế API/schema trong hồ sơ là semantic draft, không phải generated OpenAPI đã test. Trong giai đoạn tài liệu có thể refine specs và bảng DTO; mọi phần bổ sung vẫn phải duyệt trước implementation tương ứng.
