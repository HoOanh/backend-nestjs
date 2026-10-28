# Quyết định và phê duyệt

Baseline 0.2 · **G0 mở cho S00/S01 theo chỉ đạo “ok thực hiện đi nhé”, tiếp tục28/10/2026**. Bản0.1 được thay bởi0.2; không chuyển trạng thái duyệt cũ tự động.

## Đã xác nhận qua chỉ đạo scope

- Repo backend đặt tên `arc-academy-backend`; hai repo còn lại `arc-academy-cms`, `arc-academy-web`.
- Core là setup content/course/lesson/tài liệu, giáo án/đồ hoạ, lớp AI 1-1 và trao đổi AI.
- Hồ sơ triển khai chia phase/sprint; skill và coding rules phải chuẩn bị trước setup.
- Thanh toán ngoài cả ba release, chưa có kế hoạch thực hiện.
- Đã cấp quyền setup/implementation S00/S01 sau khi đồng ý hồ sơ0.2; xem [báo cáo](../implementation/S01-REPORT.md).

Xác nhận các ý scope trên không phải duyệt toàn bộ thiết kế hoặc mở G0.

## Quyết định thiết kế cần duyệt

| ID | Vấn đề | Đề xuất | Trạng thái |
|---|---|---|---|
| D-01 |Definition và release scope |R1 core flow pilot/S01–06, R2 depth/S07–09, R3 production/S10–11;1-1 là AI |Pending |
| D-02 |Data/infra/versions |Postgres/Prisma candidate, MinIO/S3, Redis; Node24 candidate và compatibility matrix |Pending |
| D-03 |Nguồn tài liệu |PDF text/DOCX/MD/TXT R1; scanned PDF báo needs_ocr, OCR tự động chưa xếp sprint; limit và confidentiality policy |Limits/default visibility approved28/10; retention/confidentiality pending |
| D-04 |Đồ hoạ |Typed diagram/image/whiteboard storyboard R1, advanced3D preset studio R2; không arbitrary code |Pending |
| D-05 |AI/voice và ngân sách vận hành |Provider text/image capabilities, model/voice rights, quota numbers, fallback server TTS; text always available |Pending |
| D-06 |Review/governance |Reviewer khác author; citation/hash/version rules; emergency waiver có audit, không waive structural errors |Pending |
| D-07 |Pilot/production NFR |Số học viên/phiên đồng thời, hardware, SLO/RPO/RTO/backup owner |Pending |
| D-08 |Migration/privacy |Local-only progress opt-in hoặc thông báo giới hạn; legacy archive/read-only; retention/citation permissions |Pending |
| D-09 |Standards/skills |Rule templates,5 skill drafts, source/pinning external skills, ownership sync3 repo |Pending |
| D-10 |Nhân sự/capacity |Sprint planning window2 tuần, effort PD và reviewer/operator availability |Pending |

## Gate theo artifact

Baseline/rules/specs0.2 được đồng ý về hướng và đã có quyền thực hiện S00/S01. Các quyết định chưa cần cho S01 hoặc cần dữ liệu/credentials thực tế vẫn Pending, không đánh dấu được xác nhận thay ĐẠI CA. Reviewer ĐẠI CA, version0.2. Approval record phải ghi version/hash, phạm vi release/sprint, ngày và người duyệt. Duyệt một phần không mở setup cho phần còn thiếu.

G0 mở chỉ khi toàn bộ baseline+S00 và blocking decisions cho sprint đầu đã được duyệt. Trước mỗi sprint: spec chi tiết và dependency được duyệt, story AC rõ, không còn blocking technical/business decision. Chỉ làm phần được duyệt; không tự thêm source type/renderer/AI capability khác scope. Chưa có phản hồi rõ thì không ghi Approved.

## Giới hạn khảo sát

Chưa đo production traffic, chưa chạy compatibility/performance spike, chưa có báo giá AI/hạ tầng, chưa nghiệm thu scaffold sibling. Phần thiết kế API/schema trong hồ sơ là semantic draft, không phải generated OpenAPI đã test. Trong giai đoạn tài liệu có thể refine specs và bảng DTO; mọi phần bổ sung vẫn phải duyệt trước implementation tương ứng.


## Chỉ đạo bổ sung được thực hiện — 28/10/2026

ĐẠI CA yêu cầu trực tiếp sửa nền tảng 3 source: CMS TanStack file-based; đa ngôn ngữ; logo/màu MVP; copyright ARC Irobot; bỏ nhãn nội bộ khỏi UI; áp dụng frontend-design. Đây là authorization cho scope rework này, không suy ra authorization các sprint sau. Quyết định và bằng chứng ở [FOUNDATION-REWORK](../implementation/FOUNDATION-REWORK.md).

## Mở P02 / S02 — 28/10/2026

ĐẠI CA xác nhận trực tiếp **“Mở P02, bắt đầu S02”**, sau đó **“Chốt giới hạn và quyền mặc định đề xuất”**: tài liệu tối đa20 MiB, PDF100trang, mặc định author-only; student-readable phải được gắn rõ và qua review. Không gửi nguồn tới AI, không tự OCR. Đây là quyền implementation S02, thay giới hạn “chưa mở S02” của các ghi chú foundation trước đó. S03/S04 chưa được triển khai trong đợt này; không có quyền commit/push/deploy. Retention/confidentiality/source-rights ngoài default quyền trên vẫn cần quyết định khi có dữ liệu thật. Xem [S02 report](../implementation/S02-REPORT.md) và [execution contract](../phases/P02-content/sprints/S02-course-documents/specs.md).
