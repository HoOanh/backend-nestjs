# Kiểm thử admin và kế hoạch nâng cấp

Ngày kiểm tra: 01/10/2026, múi giờ Asia/Ho_Chi_Minh.

Đã đăng nhập UI tại http://localhost:5173 bằng tài khoản admin ĐẠI CA cung cấp. Đi qua đủ 8 phân hệ, kiểm tra light/dark, tìm kiếm, form tạo/sửa, bộ lọc audit, diff trước/sau, các bảng DB, reload, URL sai, logout và login lỗi. Báo cáo này là kết quả kiểm thử và kế hoạch; chưa triển khai thay đổi UI/nghiệp vụ.

**Kết luận: admin hiện là giao diện vận hành sơ bộ, chưa đạt để quản lý dữ liệu và điều tra lỗi đáng tin cậy.** Có lỗi theme/layout tái hiện trực tiếp và lỗi xác thực/nghiệp vụ đã tái hiện trong kho dữ liệu test riêng. Cần sửa nhóm P0 trước khi mở admin production.

## 1. Phạm vi và bằng chứng

| Hạng mục | Đã thực hiện | Giới hạn |
| --- | --- | --- |
| Đăng nhập | Login bằng tài khoản được cung cấp; một lần sai mật khẩu; logout; truy cập deep link khi logout | Không đổi mật khẩu/quyền của tài khoản thật |
| UI | 8 phân hệ; light/dark desktop 1440px; layout 881px mặc định, 1024px và mobile 390px | Mobile/tablet là spot-check layout, chưa test mọi tương tác ở mọi breakpoint |
| Form | Tìm kiếm có/không kết quả, mở sửa, mở thêm, submit form trống, hủy, Escape, labels/focus | Không cấp bằng, mở bài hoặc xóa người dùng thật trên UI |
| Audit | Lọc lỗi, lọc request bằng click mã, mở before/after, che bí mật | Chưa test pagination UI trên dữ liệu >100 bản ghi hoặc export vì chưa có export |
| DB | Xem cả 9 bảng, bảng rỗng, tab dữ liệu cũ | Không sửa SQL dữ liệu trình duyệt |
| Nghiệp vụ API | 21 probes trong thư mục tạm, chỉ tài khoản tổng hợp; kết quả 4 PASS, 17 FAIL | Không thử bypass xác thực trên tài khoản thật; không gọi Google provider thực |
| Regression | E2E hiện có 24/24 PASS; bộ adminData và sqliteChat PASS; build PASS | Các test cũ không bao phủ toàn bộ tiêu chí nghiệp vụ mới |
| Production | Đọc cấu hình lưu trữ/deploy trong source | Chưa xác minh deployment thực, multi-instance, tải lớn, khôi phục backup hoặc provider AI thực |

Mật khẩu và token không được ghi vào báo cáo. Login/logout kiểm thử có tạo audit sự kiện xác thực bình thường trong dữ liệu local. Các probes tạo/sửa/xóa chỉ chạy trong thư mục tạm và được dọn sau khi chạy.

- [Kết quả 21 probes](/Users/hominhoanh/Documents/source/backend-nestjs/docs/admin-review/api-probe-results.json)
- Script tái hiện: `bun test/adminReview.probe.ts` từ root repo. Script chỉ xuất báo cáo; mã exit 0 nghĩa là chạy xong, không có nghĩa tiêu chí nghiệp vụ đạt.
- [Kế hoạch thực hiện chi tiết](/Users/hominhoanh/Documents/source/backend-nestjs/docs/admin-review/UPGRADE-PLAN.md)

## 2. Kết quả từng phân hệ

| Phân hệ | Đã chạy trên UI | Kết quả và khoảng trống |
| --- | --- | --- |
| Tổng quan | Light/dark, dashboard, link sang tài khoản, 3 kích thước desktop/tablet | KPI và danh sách mới nhất chứa test; 4 cột không responsive; không có kỳ báo cáo hoặc thống kê hoạt động theo kỳ. “Đang học tập” chưa được suy ra từ hoạt động thực. Revenue chưa có nguồn giao dịch |
| Tài khoản | Tìm email, tìm không có kết quả, mở sửa, mở tạo, form trống, hủy/Escape | Search hoạt động; không có empty state. Modal không có role dialog, focus trap, Escape hoặc label association. Tạo thành viên không có invite/password flow; các nút cấp bằng/mở bài xuất hiện cả cho admin |
| Gói học | Xem 3 gói và trạng thái trong cả hai theme | UI chỉ bật/tắt, chưa chỉnh giá/quyền; “bán chạy nhất” đến từ cờ cấu hình, không phải số đơn. Nội dung còn ghi 6 Sprints trong khi giáo trình hiện có 10 |
| Giáo trình | Xem 10 chương/31 bài, số câu hỏi/test cases | Danh sách xem, chưa CRUD/publish/versioning. Chương 10 hiển thị “SPRINT 010”. Thiếu tìm bài, trạng thái xuất bản và liên kết preview |
| AI Tutor | Xem model, trạng thái key và prompt | Đây là màn xem cấu hình, chưa có nghiệp vụ cấu hình. Prompt hiển thị trong UI là bản hardcode rút gọn, không đồng nhất với prompt backend. Có key không chứng minh provider/model dùng được |
| Nhật ký học tập | Xem 26 dòng trong cả hai theme | Chỉ mã học viên, mã action tiếng Anh; không filter/search/date range/pagination/export. Chưa phân biệt test. Label sự kiện thi trượt có thể sai theo API |
| Lịch sử thao tác | Xem sự kiện, filter FAILURE rỗng, click request trả 2 bản ghi, mở diff | Filter/request/diff cơ bản hoạt động. Light theme gần như không đọc được; filter và pager native. Hai dòng REQUEST/change cho mỗi thao tác làm timeline dài; nhiều update chỉ đổi `updated_at`. Lọc bằng ID khó cho người vận hành |
| Quản lý DB | Xem users/plans/progress/history/certificates/chat_sessions/chat_messages/chat_logs/audit_logs; tab legacy | DB light chữ quá nhạt. Mỗi ô scalar đều thành disclosure. Không đánh dấu tab active. Tab legacy báo “Table chat_messages does not exist” trên browser chưa có dữ liệu cũ. DB chính là JSON, màn hiện tại là data browser đọc, chưa có backup/restore/migration tooling |

## 3. Lỗi UI/UX có bằng chứng trực tiếp

### UI-01 — P1: audit light theme gần như không đọc được

Computed CSS: `.log-item` có background `rgb(11,17,32)` nhưng text kế thừa `rgb(15,23,42)`. Contrast tính từ màu CSS là **1.05:1**. `.log-item` dùng nền tối hardcode và không đặt màu chữ phù hợp cho light theme.

![Audit light](/Users/hominhoanh/Documents/source/backend-nestjs/docs/admin-review/evidence/audit-1440-light.jpg)

Source: `src/components/admin/SqliteConsolePane.css:331`, `src/components/admin/AuditTrailPane.tsx:69`.

### UI-02 — P1: bảng DB light chữ quá nhạt

`.sqlite-data-table td` cố định `#cbd5e1`; nền body light `#f1f5f9`. Contrast khoảng **1.36:1**. Header tối/cyan và body sáng cũng làm bảng mất tính nhất quán. Table desktop đo được rộng ~1835px trong container 1124px; có overflow ngang hợp lệ nhưng thiếu gợi ý và điều khiển cột.

![DB light](/Users/hominhoanh/Documents/source/backend-nestjs/docs/admin-review/evidence/database-1440-light.jpg)

Source: `src/components/admin/SqliteConsolePane.css:236`, `src/components/admin/ServerDatabasePane.tsx`.

### UI-03 — P1: layout tablet/mobile không dùng được

Ở 881px, dashboard ép `repeat(4, 1fr)`; chữ xuống từng từ, quick actions bị cắt. Ở 390px, sidebar vẫn rộng 260px, main chỉ còn **130px**, không có nút mở/đóng menu. Wrapper khóa overflow và chưa có breakpoint.

![Overview 881px](/Users/hominhoanh/Documents/source/backend-nestjs/docs/admin-review/evidence/overview-881-light.jpg)

![DB mobile 390px](/Users/hominhoanh/Documents/source/backend-nestjs/docs/admin-review/evidence/database-390-dark.jpg)

Source: `src/components/admin/AdminDashboard.css:393`, `:605`, `:669`.

### UI-04 — P1: bộ control chưa có thiết kế chung

Refresh, lọc audit, date picker, pager và theme toggle dùng nút/input native; refresh đo cao **19.5px**, padding `0px`. Form khác lại có class riêng. Hai nút phân trang trong DB/trace thiếu toolbar và trạng thái tổng số thống nhất. `--bg-canvas` được sử dụng nhưng không được khai báo; nền wrapper trở thành transparent.

### UI-05 — P1: modal tài khoản thiếu keyboard/accessibility

Mở modal nhưng focus vẫn ở nút edit ngoài modal; DOM không có `[role=dialog]`; labels không gắn `for`; Escape không đóng. Click backdrop có thể làm mất bản nháp mà không có cảnh báo.

![Modal](/Users/hominhoanh/Documents/source/backend-nestjs/docs/admin-review/evidence/user-edit-modal.jpg)

### UI-06 — P2: tìm tài khoản không có kết quả trả bảng trống

Tìm chuỗi không tồn tại: chỉ còn header, không giải thích, không nút bỏ lọc hoặc tổng số kết quả.

![Empty search](/Users/hominhoanh/Documents/source/backend-nestjs/docs/admin-review/evidence/users-empty-search.jpg)

### UI-07 — P2: trạng thái và điều hướng chưa rõ

Tab DB không có `.active` hay `aria-selected`; cảnh báo test đỏ xuất hiện trên mọi màn, lặp với tiêu đề mô tả. `/admin/does-not-exist` hiển thị overview dù URL vẫn sai. Reload `/admin/database` đúng; sau logout và login từ deep link thì trả về `/admin`, không quay lại trang đang định mở.

### UI-08 — P1: lỗi tải và thao tác bất đồng bộ chưa có state machine

Kiểm tra source: `loadData` bắt lỗi bằng `showToast` nhưng không đặt `loadError`; toast chung có màu thành công. Các mutation chưa có pending per-action/disable chống double-click; không có handling unsaved changes. Đây là phát hiện từ source, **chưa giả lập network failure trên UI**.

### UI-09 — P2: audit trình bày quá nhiều metadata kỹ thuật

REQUEST và change tách riêng, snapshot toàn object ngay cả khi chỉ thay thời gian. ID nhân sự và entity cần nhập thủ công. Trước/sau đang là hai JSON lớn, không phải diff chỉ các trường thay đổi. Filter mất khi reload vì state nằm trong component, chưa ở URL. Các lần autosave chỉ thay `updated_at` vẫn thành bằng chứng UPDATE, cần giảm noise nhưng giữ log kỹ thuật liên quan.

## 4. Lỗi nghiệp vụ API đã tái hiện

Tất cả dòng dưới được chạy trên fixture độc lập. “Mong đợi” là tiêu chí cho admin thực tế, không phải khẳng định rằng UI hiện đã cung cấp nghiệp vụ đó.

| ID probe | Ưu tiên | Thực tế | Tác động / sửa bắt buộc |
| --- | --- | --- | --- |
| REGISTER-ADMIN | P0 | Public register gửi `role=admin` trả 201/admin | Public luôn student; cấp role chỉ qua admin có quyền |
| GOOGLE-SPOOF | P0 | Chỉ gửi email admin qua `/auth/google` trả 200/admin | Xác minh token với provider; bỏ fallback tin email và decode credential không verify |
| EMAIL-GOOGLE-PASSWORD | P0 | Google account đăng nhập email với mật khẩu bất kỳ trả 200 | Account/provider phải đúng; email login cần password hash hợp lệ |
| USER-RESPONSE-SECRETS | P0 | PATCH user trả password_hash và password_salt | Mọi response dùng DTO whitelist; che bí mật cả error/audit |
| PROGRESS-READ-GUARD / HISTORY-READ-GUARD | P0 | GET không auth trả 200 | Xác thực + ownership trên read và write |
| EXAM-SERVER-GRADE | P0 | Student gửi score=999, passed=true được chấp nhận | Server chấm từ đáp án hoặc tách rõ exam không được kiểm chứng; không coi payload điểm là chứng chỉ đáng tin |
| USER-UNIQUE | P1 | Admin tạo trùng email vẫn 201 | Normalize + unique storage constraint + 409 |
| USER-VALIDATE | P1 | Tạo user `{}` trả 201 | Validate name/email trước lưu; không sửa bằng fallback dữ liệu giả |
| USER-CREDENTIAL | P1 | User mới có password mặc định dùng chung | Invite/set-password flow, không mật khẩu ngầm |
| USER-ENUMS | P1 | Role/plan không tồn tại vẫn 200 | Whitelist DTO + kiểm tra quan hệ gói học |
| INACTIVE-PLAN | P1 | Register tự nhận Pro dù gói inactive | Tách entitlement khỏi đăng ký; define chính sách grandfathering cho học viên hiện có |
| PLAN-PRICE | P1 | Giá âm được lưu | Giá không âm, currency/billing validation; cấm đổi id/field không hợp lệ |
| FAILED-EXAM-EVENT | P1 | Thi trượt vẫn ghi final_certified | Action thi đã nộp/đạt/trượt/cấp chứng chỉ phải khác nhau |
| ADMIN-CERT-LOOKUP | P1 | Grant bằng thao tác progress không có certificate record | Một command cấp chứng chỉ tạo cert + progress + audit trong transaction |
| SELF-DELETE | P1 | Backend cho admin xóa chính mình | Chặn self-delete/self-demote và admin cuối; UI không đủ để đảm bảo |
| BOOTSTRAP-RESURRECTION | P1 | Xóa env admin xong, request sau tạo lại | Bootstrap là task setup/migration có chủ đích, không chạy sửa account mỗi request |

Các tiêu chí đã PASS trong probes: admin login, student bị chặn danh sách users, evidence thay đổi được lưu, audit không chứa mật khẩu fixture.

Bằng chứng machine-readable: [api-probe-results.json](/Users/hominhoanh/Documents/source/backend-nestjs/docs/admin-review/api-probe-results.json). Source trọng tâm: `api/index.ts:894` (Google), `:972` (email login), `:1007` (register), `:1109` (create user), `:1135` (update user), `:1314` (final exam).

## 5. Khoảng trống nghiệp vụ và dữ liệu từ source

1. **Mở bài = hoàn thành bài:** `handleUnlockAllForUser` ghi cả `clearedLessons` và `completedLessons` cho mọi bài. Học viên chưa học cũng bị tính hoàn thành. Đồng thời `checkLessonUnlockStatus` hiện luôn true, nên ý nghĩa “mở bài” phải định nghĩa lại theo chính sách học hiện tại, không tự phục hồi khóa tuần tự.
2. **Cấp chứng chỉ danh dự = điểm thi 100:** UI viết vào `finalExam` thay vì command chứng chỉ. Cần loại `honorary/manual/exam`, lý do, người cấp, thời hạn/thu hồi; không tạo lịch sử thi giả.
3. **Các thao tác admin là nhiều request:** unlock rồi addHistory; grant rồi addHistory. Request thứ hai lỗi có thể khiến UI nói thất bại dù dữ liệu đầu đã thay đổi. Thi final cũng có nhiều lần save; chưa có transaction toàn command.
4. **Test data lẫn live local:** UI hiện có 14 users, 11 students, 10 accounts được đánh dấu test. KPI và danh sách mới nhất gồm test. Badge TEST không xuất hiện trong bảng users đang dùng, dù warning nói có đánh dấu. Có 2 account cùng email admin cũ. Không tự xóa hoặc gộp vì cần kiểm tra FK/audit và backup.
5. **Audit chưa đủ đảm bảo evidence production:** backend sinh log và lưu cùng file với thay đổi, nhưng JSON trên `/tmp` không durable multi-instance. Không có retention, backup/restore, tamper detection, transactional DB hoặc policy lưu trữ cho dữ liệu nhạy cảm. Rename file atomic không tương đương DB transaction hay chống lost update giữa nhiều process.
6. **Read admin chưa được audit đầy đủ:** successful GET thường không ghi. Cần policy audit xem/export thông tin nhạy cảm; không log every poll của audit page để tránh vòng lặp/noise.
7. **Legacy console báo lỗi thay vì empty state:** schema không được khởi tạo trong browser mới, nhưng UI chủ động chạy query. Nên chỉ có màn import/kiểm tra dữ liệu cũ có phát hiện presence, giữ advanced mode ngoài luồng admin thường ngày.
8. **Hiệu năng:** build main JS ~1.46MB, gzip ~416KB; admin tải cùng giáo trình/component toàn app. JSON store đọc/ghi sync và snapshot các bảng mỗi save; chưa stress-test nên chưa kết luận capacity. Cần route split, server pagination và index khi chuyển DB.
9. **Sai ngữ nghĩa KPI:** tổng số học viên không phải học viên active; cert count hiện là số user có cert/passed progress, không phải số certificate records. Nhãn KPI phải khớp truy vấn.
10. **Auth/bootstrap nằm trong file route:** cần tách auth, repository, domain command và audit context để test failure/rollback rõ ràng. Không cần rewrite framework chỉ để sửa admin.

## 6. Định hướng quyết định

Ưu tiên một admin giúp trả lời được: “Ai đang cần xử lý?”, “Thao tác này ảnh hưởng ai?”, “Điều gì thực sự thay đổi?”, “Lỗi nào thuộc cùng request?”, “Có thể hoàn tác/thu hồi không?”.

Giao diện mục tiêu: một shell nhất quán, bảng có search/filter/sort/pagination, detail drawer cho entity và audit request. Chức năng kỹ thuật DB đặt trong khu Vận hành, tách lịch sử học tập và lịch sử thao tác. Không coi thanh toán, CMS editor hoặc cấu hình AI là đã có chỉ vì menu mang tên đó.

Nghiệm thu contrast chữ thường tối thiểu 4.5:1; chữ lớn có ngoại lệ 3:1 theo [W3C Contrast Minimum](https://www.w3.org/WAI/WCAG22/Understanding/contrast-minimum.html). Thiết kế control admin cao 36–40px desktop, 44px touch là mục tiêu của sản phẩm; chuẩn target size AA có minimum 24×24 CSS px và ngoại lệ, xem [W3C Target Size Minimum](https://www.w3.org/WAI/WCAG22/Understanding/target-size-minimum.html).

Chi tiết backlog, thứ tự làm, API và tiêu chí hoàn thành nằm trong [UPGRADE-PLAN.md](/Users/hominhoanh/Documents/source/backend-nestjs/docs/admin-review/UPGRADE-PLAN.md).

## 7. Kết quả sau triển khai

Báo cáo phía trên giữ nguyên baseline trước sửa. Đợt triển khai ngày 01/10/2026 đã đưa 21 API probes sang PASS, sửa UI và bổ sung command có audit. Xem [IMPLEMENTATION.md](IMPLEMENTATION.md) để biết phạm vi thực tế, bằng chứng và phần còn lại; không coi toàn bộ backlog đã hoàn thành.
