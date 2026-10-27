# SPEC-05 — Migration, chất lượng và production

DRAFT 0.2 · S10/S11; instrumentation/backup nền tảng có từ pilot.

## Inventory và scope chuyển đổi

Snapshot khảo sát:5courses/3roadmaps/40unique lessons/258lesson quiz items; backend course riêng31 bài. Freeze chạy lại manifest và checksum, không dùng count cũ làm count prod vĩnh viễn. Nội dung là đầu vào import, thiếu chuẩn mới gắn needs_review. c1-l1 authored plan là fixture vertical slice trước full import. Không auto publish mọi imported item.

Account/content/asset/document/assignment/progress/history/chat/audit trong core: mapping `(source,type,legacyId)` có transformer version, input hash, counts/conflicts/orphans report; dry-run không ghi; chạy lại idempotent, không tăng record trùng. Quiz IDs scope course/lesson tránh collision. FK conflicts không silently drop. PBKDF2 legacy migrate hash/salt protected; session/revoked tokens không migrate như credential usable.

Legacy exam/certificate records và commercial-plan fields nếu tồn tại chỉ giữ snapshot/archive hoặc read-only mapping được duyệt. Không tạo active domain/service tương ứng trong3release. Parity matrix phải ghi feature excluded và cách học viên xem lại nếu cần, không gọi là full MVP parity khi scope khác.

LocalStorage-only classroom state không có trong server snapshot; quyết định opt-in export/import provenance self_reported hoặc thông báo không bảo toàn dữ liệu chưa sync. Không tạo verified progress từ browser flags. Tài liệu/asset external cần inventory URI/checksum/usage/license; original source immutable.

## UAT và migration report

Mỗi item gồm legacyId/newId/inputHash/outputHash/status/warning/reviewer; compare count+semantic content refs + object checksums, không chỉ row counts. Core UAT: create course→attach doc→extract→plan→visual→preview/review/publish→student room1-1→question/citation→checkpoint→cross-device resume→summary. Không để endpoint trả answer keys trong payload/SSR/RSC.

URL map dựa router thật: hash fragment cần client bridge (server không thấy fragment), deep links dùng aliases/course IDs; không giả mọi route đều301 được. Proposed Web `/vi/learn/courses/{courseSlug}/lessons/{lessonId}/classroom`, `/vi/learn/.../documents/{id}`; canonical locale strategy duyệt trước setup.

## NFR và vận hành

API nghiệp vụ p95read300ms/write800ms,5xx<1%, staging100 VU/30m đề xuất; exclude transfer/AI latency. Classroom50concurrent sessions/100 ms RTT checkpoint ack p95≤1s/resume≤2s đề xuất. Giá trị này chưa benchmark, không coi16store users là tải prod. Public LCP2.5s/INP200ms/CLS0.1, classroom riêng bundle/memory/voice preparation budgets sau profile.

Browser stable Chrome/Edge/Firefox/Safari và mobile, capability matrix; text fallback khi3D/ONNX/STT không hỗ trợ. COOP/COEP document + worker/model assets/CORS/CORP, test OAuth/preview iframes. A11y keyboard/focus/reduced motion/captions/alt text, manual classroom UAT.

Backup off-host encrypted DB+media+keys; PITR nếu duyệtRPO 15m, không gọi daily dump là15m. Restore blank environment kiểm tra doc asset/citation refs, session snapshots, RTO 4h đề xuất. Redis cache rebuild, queue reconcile durable outbox/jobs. Logs redact credentials/raw private docs/transcript; retention per-class/purpose, proposed transcript90d/audit 365d chờ duyệt. Export/download signed URL, retention preview fingerprint và execution quyền riêng.

## Cutover

Rehearsal masked snapshot→ETL2runs→UAT/checksum/restore→approve exceptions→freeze tất cả writers→final snapshot/import→read-only smoke. Fail trước mở ghi: revert routing cùng snapshot. Sau mở ghi mới: không DNS rollback về JSON cũ; roll-forward hoặc maintenance/reconciliation/delta export có duyệt. Release manifest image/config/schema/contracts và event watermark. MVP read-only retention window duyệt trước archive.

Không deploy/cutover trong phiên chỉnh tài liệu. S11 gate cần ĐẠI CA ký UAT, source/privacy exceptions, off-host restore report và post-write incident runbook.
