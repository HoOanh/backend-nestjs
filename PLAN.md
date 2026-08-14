# KẾ HOẠCH & LỘ TRÌNH ĐÀO TẠO MASTER BACKEND NESTJS CHO LẬP TRÌNH VIÊN FRONTEND (REACT / NEXT.JS)

> **Mục tiêu:** Đào tạo lập trình viên Frontend (React/Next.js) chuyển sang làm chủ hoàn toàn Backend NestJS, kiến trúc hệ thống, Database PostgreSQL, Redis, Queue và bảo mật thực tế trên codebase `esmiles-backend-v2`.

---

## 1. BẢNG SO SÁNH TƯ DUY: FRONTEND (REACT/NEXT.JS) $\leftrightarrow$ BACKEND (NESTJS)

| Khái niệm Frontend (React/Next.js) | Bản chất tương đương ở Backend (NestJS) | Khác biệt cốt lõi cần chuyển đổi tư duy |
| :--- | :--- | :--- |
| **React Context / Zustand Store** | **Dependency Injection (DI) & Providers** | Store trên FE chỉ phục vụ 1 user trong trình duyệt. Biến Singleton trên Backend được **chia sẻ chung cho toàn bộ hàng nghìn user** $\rightarrow$ Tuyệt đối không lưu state của user vào biến class để tránh leak dữ liệu! |
| **Custom Hooks (`useQuery`, `useForm`)** | **Custom Decorators (`@ActiveUnitId`, `@CurrentUser`) & Interceptors** | Hook chỉ chạy trên UI; Decorator/Interceptor trên Backend can thiệp vào vòng đời HTTP request trước khi chạm vào Service. |
| **Next.js Server Actions / Route Handlers** | **NestJS Controller + Validation Pipe + DTO** | Server Actions không tự validate dữ liệu. Backend bắt buộc phải có DTO (`class-validator`) kiểm tra từng trường dữ liệu để chống lỗi bảo mật và crash server. |
| **Next.js SSR / Serverless Functions** | **Node.js Long-running Process (Event Loop)** | Serverless chỉ chạy rồi tắt (stateless). Backend NestJS là một tiến trình sống liên tục, duy trì kết nối Database Pool, giữ WebSocket connections, và quản lý memory leak. |
| **State (`useState`, React Query Cache)** | **Database (PostgreSQL) + In-Memory Cache (Redis)** | Backend phải đảm bảo tính nhất quán dữ liệu (ACID), xử lý Race Condition (nhiều user cùng đặt 1 lịch), Deadlock và tối ưu Indexing. |

---

## 2. PHÂN PHỐI NỘI DUNG THEO 6 SPRINT (22 BÀI HỌC MASTER)

```
learn-backend/
├── 🌉 SPRINT 0: CẦU NỐI REACT/NEXT.JS → BACKEND MENTAL MODEL (Bài 1 -> 3)
│   ├── Bài 01: Từ React/Next.js sang Backend: Chuyển đổi tư duy Long-running Process & Concurrency
│   ├── Bài 02: Node.js Event Loop, Non-blocking I/O & Luồng xử lý đa người dùng
│   ├── Bài 03: Giao thức HTTP Sâu Sắc: Headers, Status Codes, CORS, Cookies & Idempotency
│   └── 🎯 KIỂM TRA CHUYÊN ĐỀ SPRINT 0 (Trắc nghiệm + Coding Lab)
│
├── 🚀 SPRINT 1: NESTJS CORE & CLEAN ARCHITECTURE (Bài 4 -> 7)
│   ├── Bài 04: Bootstrapping, Modules & IoC Container (So sánh với React Context)
│   ├── Bài 05: Controllers, Routing & Parameter Decorators (@Param, @Query, @Body)
│   ├── Bài 06: Services, Business Logic & Vòng đời DI (Singleton vs Request-scoped)
│   ├── Bài 07: DTOs, Validation Pipe & Tự động sinh Swagger OpenAPI
│   └── 🎯 KIỂM TRA CHUYÊN ĐỀ SPRINT 1 (Trắc nghiệm + Coding Lab)
│
├── 💾 SPRINT 2: CƠ SỞ DỮ LIỆU POSTGRESQL & PRISMA 7 (Bài 8 -> 12)
│   ├── Bài 08: Tư duy Thiết kế Database Quan hệ (1-1, 1-N, N-N, Index B-Tree, Compound Unique)
│   ├── Bài 09: Prisma 7 Multi-file Schema, Migrations & Database Seeding
│   ├── Bài 10: Prisma CRUD, Phân trang chuẩn & Kỹ thuật triệt tiêu N+1 Query
│   ├── Bài 11: Database Transactions (ACID), Isolation Levels & Concurrency Locking (Tránh Race Condition)
│   ├── Bài 12: Multi-Tenancy Isolation (Group -> Unit -> Branch) & Bảo mật Tenant Scope
│   └── 🎯 KIỂM TRA CHUYÊN ĐỀ SPRINT 2 (Trắc nghiệm + Coding Lab)
│
├── 🛡️ SPRINT 3: XỬ LÝ LỖI, BẢO MẬT & XÁC THỰC (Bài 13 -> 15)
│   ├── Bài 13: Xử lý lỗi tập trung (AllExceptionsFilter) & Chuẩn hóa Response Envelope
│   ├── Bài 14: Authentication: Mật khẩu Argon2, JWT Token, Refresh Token Rotation & HttpOnly Cookie
│   ├── Bài 15: Authorization: CASL Dynamic Permissions (@RequirePermission) & Multi-Surface API
│   └── 🎯 KIỂM TRA CHUYÊN ĐỀ SPRINT 3 (Trắc nghiệm + Coding Lab)
│
├── ⚡ SPRINT 4: TỐI ƯU HIỆU NĂNG, QUEUE BULLMQ & REALTIME (Bài 16 -> 19)
│   ├── Bài 16: Redis Caching: In-memory Cache, Cache Aside Pattern & Rate Limiting (Throttler)
│   ├── Bài 17: Message Queue với BullMQ & Redis (Async Jobs, Auto-retry, Dead Letter Queue)
│   ├── Bài 18: Upload File An Toàn: Presigned URL MinIO/S3 (Tại sao không stream file qua NestJS)
│   ├── Bài 19: Realtime WebSockets với Socket.IO & Redis Adapter Rooms
│   └── 🎯 KIỂM TRA CHUYÊN ĐỀ SPRINT 4 (Trắc nghiệm + Coding Lab)
│
└── 🧪 SPRINT 5: TESTING, AUDIT LOG & TRIỂN KHAI PRODUCTION (Bài 20 -> 22)
    ├── Bài 20: Audit Logging Event-driven (Ghi vết kiểm toán tài chính & hồ sơ bệnh án)
    ├── Bài 21: Kiểm thử API sống với Bruno (.bru) & Tích hợp CI Quality Gate
    ├── Bài 22: Unit Test Jest cho Service & E2E Testing với Supertest
    ├── 🎯 KIỂM TRA CHUYÊN ĐỀ SPRINT 5 (Trắc nghiệm + Coding Lab)
    └── 🎓 BÀI THI TỐT NGHIỆP TOÀN KHÓA & CẤP CHỨNG CHỈ KỸ SƯ MASTER
```

---

## 3. HƯỚNG DẪN TRIỂN KHAI & CHẠY ỨNG DỤNG

Ứng dụng được viết hoàn toàn bằng **React** (Component-based, Hooks, State, Modular).

### Chạy trực tiếp trên máy (Local):
```bash
cd /Users/oanhho/Documents/TienPhong/esmiles/learn-backend
# Mở trực tiếp trình duyệt
open index.html
# Hoặc chạy bất kỳ static server nào
npx serve .
```

### Triển khai lên Web (Vercel / Netlify / Cloudflare Pages / Coolify):
* **Build Command:** Để trống (hoặc `npm run build` nếu cấu hình bundler).
* **Publish Directory:** Thư mục gốc `.` (chứa `index.html`).
* Mọi file HTML/JS/CSS đều được đóng gói độc lập, chạy mượt mà trên mọi nền tảng hosting tĩnh!
