# eSmiles Backend Quick Reference & Cheatsheet

## 1. Lệnh Terminal Hàng Ngày

```bash
# Khởi động server watch mode
pnpm start:dev

# Kiểm tra tính đầy đủ của file Bruno so với Controller
pnpm bruno:check

# Đồng bộ Prisma Client sau khi sửa schema
pnpm prisma:generate

# Tạo migration mới trên DB Dev
pnpm prisma:migrate

# Mở giao diện xem DB trực quan
pnpm prisma:studio

# Nạp dữ liệu seed cơ bản
pnpm db:seed:core

# Build packages nội bộ (Authz / Error Catalog)
pnpm build:packages
```

---

## 2. Bảng Tra Cứu Decorator Thường Dùng

| Decorator | Ý nghĩa & Vị trí dùng |
| :--- | :--- |
| `@InternalController('path')` | Controller dành cho nhân viên nội bộ (`/api/i/v1/path`) |
| `@CustomerController('path')` | Controller dành cho bệnh nhân/khách hàng (`/api/p/v1/path`) |
| `@PlatformAdminController('path')` | Controller dành cho Super Admin (`/api/i/admin/v1/path`) |
| `@RequirePermission('m:r:a')` | Chặn quyền chi tiết (`inventory:category:create`) |
| `@ActiveUnitId()` | Lấy `unitId` phòng khám active từ context request |
| `@CurrentUser()` | Lấy đối tượng `AuthUser` đang đăng nhập |
| `@Paginated()` | Đánh dấu endpoint có hỗ trợ phân trang chuẩn `{ page, pageSize }` |

---

## 3. Quy Tắc Bất Biến Cần Nhớ (Golden Rules)

1. **Multi-tenancy:** 100% các câu query dữ liệu phòng khám phải có `where: { unitId }`.
2. **Không try/catch Prisma bừa bãi:** Để lỗi rò rỉ ra `AllExceptionsFilter` để tự động map mã HTTP 409/404.
3. **Thêm API là phải có `.bru`:** Mọi endpoint mới bắt buộc tạo file `.bru` trong `bruno/` trong cùng commit.
4. **Sửa `packages/authz`:** Phải chạy `pnpm build:packages` trước khi seed hoặc start server.
