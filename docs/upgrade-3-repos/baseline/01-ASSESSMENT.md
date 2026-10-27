# Phân tích hiện trạng và điều chỉnh kế hoạch

Trạng thái: DRAFT 0.2 · Khảo sát ngày 27/10/2026 · MVP HEAD `25eae35`.

## 1. Kết luận

Tách theo ba sản phẩm Backend/CMS/Web là phù hợp để quản lý vòng đời phát hành, quyền truy cập và trải nghiệm khác nhau. Chưa có bằng chứng tải thực tế đòi hỏi microservices hay nhiều database. Độ phức tạp hiện tại chủ yếu là coupling giữa UI, nội dung TS, router tự viết, state trình duyệt và JSON store. Hướng đề xuất: modular monolith NestJS + PostgreSQL, workers riêng từ cùng repo; giữ engine AI classroom có giá trị, viết lại nguồn sự thật nghiệp vụ.

## 2. Bằng chứng đã kiểm tra

| Tài sản | Kết quả quan sát | Nguồn |
|---|---|---|
| Nền tảng | React 19, Vite, Tailwind 4, three/fiber/drei, onnxruntime-web | `package.json` |
| API | Router và nghiệp vụ dồn trong `server/index.ts`; adapter Vercel | `server/index.ts`, `api/index.js`, `vercel.json` |
| Khoá/lộ trình | 5 khoá, 3 lộ trình | Import read-only `COURSES`, `CAREER_PATHS` từ `src/data/courses.ts` |
| Bài/chương | Khoá backend: 10 chương, 31 bài. Tổng 5 khoá: 18 phần chương theo khoá, 40 lesson ID duy nhất | Import read-only dữ liệu runtime |
| Quiz/theory | 258 câu quiz cộng theo 40 bài duy nhất; theory UTF-8 918.690 byte | Tổng hợp từ `COURSES`; chưa bao gồm ngân hàng exam |
| Exam | 10 file exam sprint + `src/data/finalExam.ts` | `src/data/exams/`, `src/data/finalExam.ts` |
| Teaching plan authored | c1-l1 có plan và storyboard riêng; có cơ chế derive checkpoint | `src/data/instructor-curriculum/chapter1/`, `buildLessonCheckpoints` trong `courses.ts` |
| Store | 2.599.105 byte; 16 user, 11 progress, 28 history, 8 certificate, 1.335 audit; 10 chat session, 17 message, 45 chat log | Đếm collection JSON; không xuất record |
| Đăng nhập | PBKDF2-SHA512 10.000 vòng; session và cookie tồn tại; client có cleanup credential legacy | `server/index.ts:108`, `src/services/apiClient.ts` |
| Điểm thi | Server ghi kết quả browser là `unverified`, ép `passed=false` | `server/index.ts:3450` trở đi |
| Quiz/progress | Client chấm quiz; backend merge một số progress/quiz client gửi | `QuizTab.tsx`, `useLearningProgress.ts`, `server/index.ts:3320` |
| Classroom progress | Hook chứa `classroomProgress`; payload `DbProgress` hiện không có trường này | `useLearningProgress.ts`, `server/index.ts:65` và handler progress |
| Chat | Service tên db nhưng có fallback localStorage; không suy ra đang dùng SQLite từ tên test | `src/services/db/chatDbService.ts`, `test/sqliteChat.test.ts` |
| Isolation | Route `/ai-classroom/.*` có COOP same-origin, COEP credentialless | `vercel.json` |
| Kiểm thử | Có Bun tests cho engine, admin, data ops; không chạy trong đợt chỉ làm tài liệu | `test/`, `package.json` |

Đây là inventory nội dung, không phải số lượng người dùng production hay benchmark tải. Store có thể gồm fixture/demo. 8 chứng chỉ cần đối soát loại manual/honorary/exam và trạng thái riêng; không suy luận tất cả đều unverified từ kết quả thi.

## 3. Những chỗ phải sửa trong kế hoạch cũ

| Vấn đề | Điều chỉnh |
|---|---|
| Ghi 31 bài cho toàn bộ hệ thống | Migration baseline 40 bài/5 khoá; 31 là riêng backend. Quiz baseline 258, không 259. Freeze lại manifest ở cutover |
| Chốt Node 22 và mọi major quá sớm | Node 24 là ứng viên baseline; chọn bản LTS còn đủ hỗ trợ tại G0, pin patch sau kiểm tra tương thích. Chưa tuyên bố Next/Prisma mới nhất |
| Loại MySQL vì thiếu FTS, Mongo vì không transaction/join | Những kết luận tuyệt đối này không đúng. PostgreSQL phù hợp hơn với domain hiện tại và giảm số hệ quản trị; các lựa chọn khác vẫn có khả năng riêng |
| MinIO được coi như image community cập nhật sẵn | Giữ yêu cầu MinIO; cần xác nhận nguồn build, patch, chủ vận hành và hỗ trợ. Community hiện source-only; dùng S3 abstraction để có đường chuyển |
| Một Redis cho cache và queue | Production tách instance cache/queue: eviction cache không được làm mất queue; DB index riêng không tách policy memory |
| Pin room vào revision nhưng tự tạo mọi room sau import | Room có revision bất biến; publish phải tạo room version/con trỏ phiên bản mới rõ ràng; nội dung imported chưa được duyệt không tự public |
| AI phụ thuộc classroom nhưng AI tới phase sau | Port tutor tối thiểu + quota + TTS fallback cùng R1 classroom; AI soạn giáo án và đồ hoạ cơ bản nằm R1; biến thể nâng cao ở R2 |
| Checkpoint PATCH gửi completed/quiz_passed | Client gửi evidence/answer. Server xác minh prerequisite và tính pass; seek/timing không chứng minh hiểu bài |
| Mọi nội dung legacy đều đạt chuẩn mới | Import bảo toàn, gắn `needs_review`; grandfather có danh sách duyệt riêng. Không giả định đủ 8 quiz/3 challenge/teaching plan cho 40 bài |
| “Audit bất biến” chỉ bằng trigger | Append-only bảo vệ ứng dụng; DBA vẫn có thể sửa. Muốn tamper-evident cần export/hash/retention độc lập và quyền vận hành |
| Backup vào MinIO cùng VPS | Thêm bản off-host, mã hoá, restore drill; bản cùng host không bảo vệ mất cả máy |
| DNS rollback sau khi hệ mới có ghi | Không chuyển về snapshot cũ làm mất ghi mới. Sau mở write ưu tiên roll-forward hoặc read-only + reconciliation có duyệt |
| Ước lượng số tuần chắc chắn | Dùng person-days theo work package, capacity thực, dự phòng, phụ thuộc reviewer; AI không được tính như một dev độc lập |
| “install module” mơ hồ | Cài/bật code module đã build sẵn; không npm install/code download ở runtime. Marketplace nằm ngoài scope |
| Contracts chứa cả token CSS | Hợp đồng API chỉ schemas/permissions/errors/module catalog; design tokens có ownership khác, tránh khoá release UI vào API |

## 4. Hướng sản phẩm điều chỉnh

Trục phát triển: tài liệu nguồn → cấu trúc khoá học → giáo án → bài giảng có đồ hoạ → phiên học AI 1-1 → trao đổi và tiến trình. Backend cung cấp API như một phần trách nhiệm; tên repo đích là `arc-academy-backend`.

Tài sản MVP hữu ích nhất là content, authored teaching plan và engine narration/whiteboard/focus/3D. Các module thi/chứng chỉ đang tồn tại chỉ được kiểm kê, bảo toàn dữ liệu và quyết định archive/read-only khi chuyển đổi; chưa đưa nâng cấp các module đó thành đường găng của ba release này.

OpenAPI hai audience, schema closure, generated clients và policy theo action là pattern kỹ thuật của học viện. Không mang domain hoặc thuật ngữ ngoài sản phẩm vào thiết kế nghiệp vụ.

## 5. Tái sử dụng và kiểm chứng

| Nhóm | Chiến lược | Điều kiện trước khi dùng |
|---|---|---|
| narration clock, pen timeline, focus sequence, storyboard | Port thuật toán và regression tests | Tách dependency browser, deterministic fixtures, giữ visual behaviour |
| 3D instructor, Canvas, lesson/mindmap renderers | Port theo feature, client-only ở Next | Capability fallback, a11y, performance, lifecycle cleanup |
| ZeroTTS browser/vendor/model assets | Giữ qua adapter | Rà license/NOTICE model và code, worker URL, cache, isolation và bundle |
| Nội dung TS, exam, authored plan | Nguồn import một lần | Runtime schema validation, ID map, checksum, hidden-answer split |
| Tutor prompt/fallback/quota | Giữ hành vi và seed prompt có version | Không copy key/model mặc định mù; unit/cost budget và provider outage tests |
| Auth/router/JSON store | Tham chiếu hành vi rồi thay mới | Role mapping, legacy hash upgrade, session không migrate |
| Dữ liệu chỉ ở browser | Không thể lấy qua server ETL | Có công cụ export/import user opt-in sau duyệt hoặc thông báo giới hạn bảo toàn |

## Nguồn kỹ thuật đối chiếu

- [Node.js release policy và trạng thái](https://nodejs.org/en/about/previous-releases).
- [MinIO community distribution](https://github.com/minio/minio#source-only-distribution).
- [BullMQ production và noeviction](https://docs.bullmq.io/guide/going-to-production).
- [PostgreSQL transaction isolation](https://www.postgresql.org/docs/current/transaction-iso.html).
