# Arc Academy (Legacy Monolith) — ARCHIVED & READ-ONLY

> [!IMPORTANT]
> **KHO LƯU TRỮ NÀY ĐÃ ĐƯỢC ĐÓNG BĂNG VÀ CHUYỂN SANG CHẾ ĐỘ READ-ONLY (ARCHIVED)**
> 
> Hệ thống **Arc Academy** đã hoàn thành toàn bộ 12 Sprints (S00 $\rightarrow$ S11), hoàn tất 36/36 User Stories và đóng gói phát hành thành công **Release R3 (Phiên bản v1.0.0, ngày 04/11/2026)**.
> 
> Toàn bộ kiến trúc nguyên khối cũ (Monolith legacy) đã được chuyển giao và phân tách thành **3 repositories độc lập chuẩn công nghiệp**:
> 1. 🚀 **Backend Core API & Operations**: [`arc-academy-backend`](../arc-academy-backend)  
>    *NestJS 11, Prisma modular, PostgreSQL 17, Redis 7, S3/MinIO, BullMQ Outbox Worker, AES-256-GCM KMS sealed.*
> 2. 🎨 **Authoring & Management CMS**: [`arc-academy-cms`](../arc-academy-cms)  
>    *Vite, React 19, TanStack Router & Query, Orval typed OpenAPI client, Shadcn UI.*
> 3. 🎓 **Student Interactive Learning Web**: [`arc-academy-web`](../arc-academy-web)  
>    *Next.js 15, React 19, Light-only design system (0 dark-mode tokens), degraded audio fallback, i18n.*

---

## 1. Bản đồ chuyển giao kiến trúc (Architecture & Deprecation Map)

| Thành phần Legacy cũ | Trạng thái | Nơi chuyển giao trong hệ thống mới | Ghi chú kỹ thuật |
|---|---|---|---|
| **API Server (`server/`)** | **Deprecated** | [`arc-academy-backend/src/`](../arc-academy-backend/src/) | Tách thành các modules: `auth`, `content`, `teaching-plans`, `visuals`, `classroom`, `cohorts`, `migration`, `meta`. |
| **Outbox & Jobs** | **Deprecated** | [`arc-academy-backend/src/workers/`](../arc-academy-backend/src/workers/) | BullMQ worker ngầm xử lý email và sự kiện outbox bền vững. |
| **Dữ liệu JSON (`data/arc_irobot_store.json`)** | **Migrated** | PostgreSQL (`arc-academy-backend/prisma/`) | Đã di trú toàn diện 14 bảng dữ liệu, 0 lỗi orphan FK, đo lường RTO = 0.01s. |
| **Quản trị giáo án & Visuals** | **Deprecated** | [`arc-academy-cms/src/modules/`](../arc-academy-cms/src/modules/) | Visual Studio, Teaching Plan Review & AI Generation Studio. |
| **Giao diện học viên (`src/`, `index.html`)** | **Deprecated** | [`arc-academy-web/src/features/`](../arc-academy-web/src/features/) | Phòng học tương tác 1-1 Next.js 15, State machine bền vững, đa ngữ vi/en. |
| **Legacy URL Hash Fragment** | **Preserved** | [`arc-academy-web/src/app/[locale]/legacy-bridge/`](../arc-academy-web/src/app/[locale]/legacy-bridge/) | Cơ chế URL Bridge giữ nguyên fragment hash điều hướng không làm đứt gãy bookmark của người dùng cũ. |

---

## 2. Hồ sơ nghiệm thu & Chứng tích kiểm toán (Audit Trail)

Kho lưu trữ này được giữ lại nguyên vẹn làm **cơ sở dữ liệu gốc (Baseline)** và **kho tài liệu kiểm chứng (Audit Archive)** cho toàn bộ dự án nâng cấp:

- 📋 **Lộ trình tổng thể**: [`docs/upgrade-3-repos/ROADMAP.md`](docs/upgrade-3-repos/ROADMAP.md)
- 📌 **Chỉ mục 12 Sprints**: [`docs/upgrade-3-repos/sprint-index.json`](docs/upgrade-3-repos/sprint-index.json)
- 🔍 **Ma trận truy vết 36 Stories**: [`docs/upgrade-3-repos/TRACEABILITY.md`](docs/upgrade-3-repos/TRACEABILITY.md) & [`docs/upgrade-3-repos/user-stories.json`](docs/upgrade-3-repos/user-stories.json)
- 🏆 **Báo cáo đóng gói Release R3**: [`docs/upgrade-3-repos/implementation/RELEASE-R3.md`](docs/upgrade-3-repos/implementation/RELEASE-R3.md)
- 📦 **Manifest phát hành v1.0.0**: [`docs/upgrade-3-repos/implementation/release-manifest.json`](docs/upgrade-3-repos/implementation/release-manifest.json)
- ⚡ **Biên bản diễn tập Cutover**: [`docs/upgrade-3-repos/implementation/CUTOVER-DRILL-REPORT.md`](docs/upgrade-3-repos/implementation/CUTOVER-DRILL-REPORT.md)

---

## 3. Quy định bảo trì & Đóng băng (Maintenance Policy)

> [!CAUTION]
> **TUYỆT ĐỐI KHÔNG TẠO FEATURE HOẶC COMMIT MỚI VÀO KHO LƯU TRỮ NÀY.**
> 
> Mọi yêu cầu tính năng, sửa đổi schema, cải tiến giao diện hoặc triển khai production **bắt buộc** phải thực hiện trực tiếp tại 3 repositories mới:
> - Backend: `arc-academy-backend`
> - CMS: `arc-academy-cms`
> - Web: `arc-academy-web`
> 
> Bất kỳ sự cố nào xảy ra hậu cutover đều phải tuân theo nguyên tắc **Roll-Forward** hoặc **Read-Only Reconcile**, tuyệt đối cấm chuyển hướng rollback mù quáng về file JSON cũ của kho lưu trữ này (theo quy chuẩn [SPEC-05](docs/upgrade-3-repos/specs/05-MIGRATION-QUALITY.md) và tiêu chí AC-036-03).
