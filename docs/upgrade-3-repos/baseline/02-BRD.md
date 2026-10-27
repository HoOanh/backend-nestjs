# BRD — nền tảng tạo và dạy bài giảng với AI

DRAFT 0.2 · Chủ duyệt: ĐẠI CA.

## 1. Mục tiêu

Sản phẩm biến dữ liệu content và giáo án thành bài giảng có đồ hoạ, sau đó AI instructor dùng bài giảng đó để dạy một học viên trong một phiên riêng, nghe/đọc câu hỏi, giải thích theo ngữ cảnh, kiểm tra hiểu bài và lưu tiến trình.

Giá trị lõi nằm ở **chất lượng bài giảng + cách trình bày + tương tác AI 1-1**, không nằm ở số màn CRUD. CMS là bàn làm việc để nhập tài liệu, tổ chức khoá/bài, biên soạn giáo án, thiết kế đồ hoạ, preview và duyệt. Web là nơi học viên học theo tài liệu/lộ trình và vào phiên AI. Backend sở hữu dữ liệu, phiên bản, quyền, tác vụ AI và tiến trình.

## 2. Mục tiêu có thể nghiệm thu

| ID | Mục tiêu | Bằng chứng |
|---|---|---|
| BO-01 | Setup dữ liệu khoá/bài/tài liệu | Tạo khoá/chương/bài, gắn tài liệu, import nội dung MVP, không sửa source |
| BO-02 | Giáo án đúng nguồn và có thể duyệt | AI/manual tạo mục tiêu/sections/script/checkpoints từ content và tài liệu có citation, sửa và review được |
| BO-03 | Bài giảng đồ hoạ dùng để giảng được | Visual/storyboard/focus/narration đồng bộ, preview bằng renderer Web, xuất bản immutable version |
| BO-04 | Lớp AI 1-1 có trao đổi thật theo bài | Học viên vào room, nghe/xem, giơ tay/hỏi, nhận giải thích bám checkpoint, pause/resume và finish |
| BO-05 | Bảo toàn tiến trình và cải thiện chất lượng | Server lưu evidence/transcript/summary; mentor xem đúng scope; analytics chỉ ra phần khó hiểu |
| BO-06 | Chuẩn hoá và vận hành ổn định | 3 repo độc lập theo contract/rules, migration đối soát, fallback, backup/restore và scope gates |

KPI học tập đề xuất cho pilot: thời gian editor tạo một bài đạt review, số findings factual/citation, mức đồng bộ narration/visual, tỷ lệ resume thành công, checkpoint misunderstanding và đánh giá hữu ích của giải thích. Chưa có baseline để cam kết tăng trưởng %. Instrument trước, chốt ngưỡng sau pilot với ĐẠI CA.

## 3. Actors và use cases

- Editor/content author: nhập dữ liệu và tài liệu, dựng cấu trúc, tạo/sửa giáo án, đồ hoạ, dùng AI draft và preview.
- Reviewer/publisher: kiểm chứng kiến thức/nguồn, mạch sư phạm và hình ảnh; duyệt đúng revision, xuất bản.
- Học viên: vào khoá/lộ trình được gán, đọc/xem tài liệu, học bài và tương tác với AI instructor trong phiên cá nhân.
- Mentor: theo dõi lớp được giao, tiến trình/checkpoint/summary, hỗ trợ từ các điểm học viên còn vướng.
- Admin/operator: quản lý account/quyền/phân công, module/cấu hình, provider AI/voice, dữ liệu và vận hành.
- ĐẠI CA: duyệt baseline, scope từng release/sprint và go-live.

## 4. Ranh giới ba release

| Năng lực | R1 — core end-to-end pilot | R2 — đào sâu core | R3 — sẵn sàng vận hành |
|---|---|---|---|
| Content/tài liệu | Khoá/chương/bài, PDF/DOCX/MD/TXT, extract/version/source refs, editor | Cập nhật tài liệu có impact review; authoring templates | Full import40 bài, legacy exceptions, data quality |
| Giáo án | AI/manual outline, sections, narration, checkpoints; human review | Rubric sâu, nhiều phương án giải thích theo objectives | Kiểm kê chất lượng bộ nội dung được publish |
| Đồ hoạ | Typed diagrams/storyboards, ảnh, focus/ink và preview | Visual studio/timeline, versioned3D presets, AI image workflow nâng cao | Thiết bị/browser/performance matrix |
| Classroom | Một học viên + AI, voice/text, raise-hand, Q&A, checkpoint/resume/summary | Adaptive explanation có kiểm soát, analysis, cohort/roster/lịch | Scale, recovery, accessibility và production cutover |
| Platform | Auth/action/scope, access assignment, contracts, module registry tối thiểu, audit/quota | Module settings và mentor capabilities cần cho core | Hardening, export/retention, monitoring/restore |

Thanh toán nằm ngoài toàn bộ giai đoạn này; chưa xác định thiết kế hoặc thời điểm. Không có user story, entity, endpoint hay sprint cho khả năng đó.

Thi cuối khoá/code runner/chứng chỉ nâng cao/forum cộng đồng không phải core của đợt này và không được xếp sprint triển khai. Dữ liệu legacy liên quan được kiểm kê/giữ archive hoặc read-only có quyết định khi cutover; không silently drop, không hứa parity các feature đã loại scope. Quiz/checkpoint kiểm tra hiểu bài vẫn thuộc core. Video1-1 người thật và đa tenant chưa nằm trong scope.

## 5. Business rules

| ID | Quy tắc |
|---|---|
| BR-01 | Room là template AI, session là phiên cá nhân, class là cohort/lịch; không có audio/video nhiều người trong scope |
| BR-02 | Backend là nguồn sự thật của quyền, published revision, evidence và progress; browser chỉ cache/renderer |
| BR-03 | Mọi bài giảng pin lesson/teaching plan/visual/source revisions; approval gắn hash, sửa phải review lại |
| BR-04 | Tài liệu chỉ dùng trong course/lesson được gán và actor có quyền; không đưa private document sang lớp/account khác |
| BR-05 | AI chỉ tạo draft/artifact/suggestion; editor áp dụng và reviewer duyệt, không tự publish |
| BR-06 | Citation phải resolve đúng document revision/page/section hoặc content block; không bịa nguồn khi thiếu dữ liệu |
| BR-07 | Đồ hoạ có semantic meaning và alt/description; timing dùng narration clock, không animation rời kiến thức |
| BR-08 | Checkpoint pass do server tính từ answer/evidence; playback/timing không chứng minh hiểu bài |
| BR-09 | Phiên có single writer/version/idempotency; resume dùng checkpoint đã ack, giữ pinned content khi có publish mới |
| BR-10 | Provider/voice unavailable có text mode; summary lỗi không làm mất completion; quota áp server |
| BR-11 | Mentor/reviewer chỉ đọc dữ liệu đúng assignment; access transcript audit, không ghi âm mic mặc định |
| BR-12 | Module compiled activation, disable giữ dữ liệu; retention/purge tách riêng |
| BR-13 | Migration giữ provenance; legacy/self-reported không tự chuyển server_verified; không bỏ ghi mới sau cutover |
| BR-14 | Chưa duyệt đủ tài liệu/rules/specs thì không setup/code; commit phải có yêu cầu riêng |

## 6. Demo cốt lõi để nghiệm thu R1

Editor tạo khoá/bài → đính kèm tài liệu → xem text/source đã extract → dựng giáo án/slide/script/checkpoint → tạo đồ hoạ → preview narration/bảng → review/publish → gán học viên → học viên vào room1-1 → AI giảng/vẽ → giơ tay hỏi nguồn/khái niệm → nhận giải thích bám bài → trả lời checkpoint → đổi thiết bị resume → finish và nhận summary. Toàn bộ flow có quyền, quota, audit và fallback.
