> **Trạng thái hiện hành 05/11/2026:** R1 chưa đạt MVP; R2/R3 chưa được nghiệm thu hoàn thành sản phẩm. Các kết luận hoàn thành/APPROVED bên dưới chỉ phản ánh báo cáo lịch sử, không phải nghiệm thu sản phẩm hiện hành. Xem [trạng thái và việc tiếp theo](MVP-STATUS-2026-11-05.md).

# BÁO CÁO THỰC THI SPRINT S10

**Sprint S10: Migration content, nguồn và dữ liệu học tập**  
Phase: P05 (Production & Migration) · Release: R3  
Ngày hoàn thành: 04/11/2026  
Người phê duyệt: **ĐẠI CA**

---

## 1. Tóm tắt kết quả đạt được

Sprint S10 đã hoàn thành 100% phạm vi 3 User Stories phục vụ quá trình di trú và vận hành dữ liệu giữa hệ thống legacy và nền tảng mới Arc Academy:

1. **US-031 / FR-31 (Slice S10-A): Migration Core Manifest & ETL Idempotent Engine**
   - Đọc dữ liệu freeze từ `arc_irobot_store.json` và snapshot `courses.ts`.
   - Tính toán SHA-256 `inputHash`, bảo đảm idempotent khi chạy lại lần 2 (không tạo record trùng, trả về nguyên bản batch đã hoàn tất).
   - Cơ chế Quarantine bắt lỗi FK (missing user) và invalid email đưa vào bảng `migration_exception` để xử lý có kiểm soát.
   - Tiến trình học tập legacy được bảo toàn nguyên trạng với nhãn `provenance: "legacy_imported"` / `"self_reported"`, không tự động đánh dấu verified.

2. **US-032 / FR-32 (Slice S10-B): Legacy URL Resolution & Client Hash Fragment Bridge**
   - API Public `/api/p/v1/legacy/resolve?path=...` mapping chính xác các đường dẫn cũ sang canonical route mới.
   - Client-side bridge trong Next.js (`LegacyBridgeClient.tsx`) bắt các URL hash fragment (`#step-...`) phía trình duyệt mà server không thấy, bảo đảm điều hướng liền mạch.
   - Hiển thị card Archive chuẩn light-only cho các tính năng thương mại và chứng chỉ legacy được lưu trữ dạng read-only.

3. **US-033 / FR-33 (Slice S10-C): Data Ops & Retention Engine**
   - Tính toán preview scope và fingerprint ổn định theo mốc UTC midnight.
   - Chặn lệnh purge nếu fingerprint không khớp hoặc tài nguyên đang được tham chiếu bởi bài giảng/phiên học đang hoạt động.
   - Xuất dữ liệu qua signed download URL hết hạn sau 15 phút, tự động redact các thông tin nhạy cảm (mật khẩu hash, MFA secret).

---

## 2. Bằng chứng kiểm thử tự động

- **Backend**:
  - `test/migration.e2e-spec.ts`: 14/14 tests pass 100%.
  - Toàn bộ backend test coverage: 27 suites / 174 tests pass, Statements 86.13%, Lines 88.96%.
  - OpenAPI & Bruno: 174 requests coverage pass.
- **CMS**:
  - 15 test suites / 72 tests pass.
  - 5/5 foundation rules pass.
- **Web**:
  - 16 test suites / 61 tests pass.
  - 5/5 foundation rules pass (tuân thủ light-only).
