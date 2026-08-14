# TÀI LIỆU SPRINT 1: NestJS Core & Clean Architecture (eSmiles)

## 1. Bootstrapping và Cấu Hình Biên (`src/main.ts`)

Ứng dụng eSmiles khởi động từ `src/main.ts`:
- **Pino Logger:** Bắt toàn bộ log request, response và lỗi hệ thống.
- **Helmet:** Thiết lập các HTTP security headers chống clickjacking, XSS.
- **Trust Proxy:** Cần thiết khi ứng dụng đứng sau Nginx / Traefik / Cloudflare để lấy đúng client IP.
- **URI Versioning:** Mọi API được tự động gắn version `/api/v1/...`.

---

## 2. Quy Tắc Phân Tầng (Layered Architecture)

| Tầng | Thư mục | Trách nhiệm |
| :--- | :--- | :--- |
| **Interface (HTTP/Controller)** | `src/modules/<m>/interface/` | Tiếp nhận request, phân quyền `@RequirePermission`, validate DTO |
| **Application (Service/Logic)** | `src/modules/<m>/application/` | Xử lý nghiệp vụ, tính toán, tương tác DB qua `PrismaService` |
| **Domain (Contracts/Entities)** | `src/modules/<m>/domain/` | Định nghĩa catalog, hằng số, enum nghiệp vụ |
| **Module Packaging** | `<module>.module.ts` | Khai báo imports, controllers, providers, exports |

---

## 3. Quy Chuẩn Viết DTO với `class-validator`

```typescript
export class CreateInventoryCategoryDto {
  @ApiProperty({ description: 'Mã phân loại', example: 'VTTH' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(50)
  code!: string;

  @ApiProperty({ description: 'Tên phân loại', example: 'Vật tư tiêu hao' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  name!: string;
}
```
