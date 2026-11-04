# Báo Cáo Nghiệm Thu Kỹ Thuật Sprint S07

- **Sprint**: S07 — Visual studio và giáo án có vòng đời nguồn (Release R2 / Phase P04)
- **Thời gian thực hiện**: 2026-11-03
- **Phạm vi hoàn thành**: `US-022`, `US-023`, `US-024` (100% Slices S07-A, S07-B, S07-C)
- **Repositories tác động**: `arc-academy-backend`, `arc-academy-web`, `arc-academy-cms`

---

## 1. Kết Quả Thực Hiện Chi Tiết Theo User Story

### Slice S07-A: Visual Studio Nâng Cao & 3D Presets (US-022)
- **AC-022-01: Approved 3D Presets Catalog**:
  - Backend cung cấp danh mục `VISUAL_PRESETS` (`arch-layer-3d`, `memory-layout-3d`, `network-topology-3d`) qua endpoint `GET /api/i/v1/visual-presets`.
  - Hỗ trợ kind `preset-3d` trong `visualSchema` và `lintVisual`, kiểm tra bắt buộc `fallbackKind` và `fallbackText`.
  - CMS & Web đồng bộ schema `preset-3d`, hỗ trợ preview và authoring trực quan.
- **AC-022-02: Interactive Timeline Scrubber & Fallback**:
  - Web & CMS nâng cấp component `NarrationClock.tsx` với timeline scrubber tương tác (`<Input type="range" data-testid="timeline-scrubber" />`).
  - Hỗ trợ chế độ fallback đồ hoạ ngữ nghĩa (`fallbackText`, isometric SVG) khi client giảm chuyển động hoặc không bật chế độ 3D đầy đủ.
- **AC-022-03: Session Immutability**:
  - Các phiên học trực tuyến (`ClassroomSession`) tiếp tục pin đúng visual revision được snapshot tại thời điểm bắt đầu phiên hoặc xuất bản gói bài giảng, không bị ảnh hưởng khi xuất bản visual revision mới.

---

### Slice S07-B: AI Tạo Ảnh Minh Hoạ Có Human Review (US-023)
- **AC-023-01: AI Image Generation with Provenance**:
  - Mô hình DB `ImageJob` và `ImageArtifact` với migration Postgres `20261103170000_image_jobs_artifacts`.
  - Endpoint `POST /api/i/v1/ai/image-jobs`: sinh ảnh và tạo bản nháp `ImageArtifact` chứa đầy đủ metadata provenance (`prompt`, `promptVersion`, `model: 'mock-imagen-3'`, `sourceDocumentRef`, `rights`, `altDraft`, `assetUrl`).
- **AC-023-02: Human Review Gate**:
  - Endpoint `PATCH /api/i/v1/image-artifacts/:id/review`: Yêu cầu quyền `content:lesson:review` hoặc `admin`.
  - Bắt buộc kiểm tra độ chính xác kỹ thuật: nếu `decision === 'approve'` nhưng `technicalAccuracyConfirmed !== true`, hệ thống trả về HTTP 400 (`technical_accuracy_not_confirmed`).
  - Cấm tự động áp dụng (apply) ảnh nháp hoặc ảnh bị từ chối vào visual (HTTP 412).
- **AC-023-03: Idempotency & Usage Settlement & Single Apply**:
  - Header `Idempotency-Key` ngăn chặn việc sinh trùng job hoặc charge phí lặp lại.
  - Phí sử dụng provider được ghi nhận thực tế không âm: `costTokens: 120`, `costMicros: 6000`.
  - Endpoint `POST /api/i/v1/image-artifacts/:id/apply`: cập nhật visual sang kind `image-annotation` và gắn `assetId`.
  - Quy tắc Single Apply: Chặn việc áp dụng một artifact nhiều lần vào bài giảng (HTTP 409 Conflict).
  - CMS Studio: Component `AiImageStudio.tsx` tích hợp đầy đủ quy trình Prompt -> Preview Artifact -> Review Gate Checklist -> Apply to Visual.

---

### Slice S07-C: Cập Nhật Nguồn & Impact Review (US-024)
- **AC-024-01: Document Revision Impact Diff**:
  - Endpoint `GET /api/i/v1/document-revisions/:id/impact`: phân tích toàn diện các bài học (`affectedLessons`), giáo án (`affectedTeachingPlans`), đồ hoạ (`affectedVisuals`), gói bài giảng (`affectedLecturePackages`).
  - Tự động so sánh diff với revision mới nhất (`diffSummary`: added, modified, removed) và phân loại độ nghiêm trọng (`breaking` vs `additive` vs `none`).
- **AC-024-02: Draft Fork with Extraction Gate**:
  - Endpoint `POST /api/i/v1/teaching-plans/fork-revision`: tạo bản nháp giáo án mới (draft fork) cập nhật các citation sang revision mới nhất.
  - Extraction Gate: Chặn việc tạo bản nháp nếu revision đích chưa hoàn tất trích xuất (`status !== 'ready'`) trả về HTTP 412.
- **AC-024-03: Immutability & Citation Preservation**:
  - Các bản sửa đổi giáo án cũ và các phiên học lớp học đã lưu giữ nguyên vẹn trích dẫn tới revision cũ, không bị ghi đè lịch sử (no history rewriting).
  - CMS: Hộp thoại `SourceImpactDialog.tsx` hiển thị bảng phân tích tác động và cho phép bấm tạo bản nháp (Fork Draft with Updated Source) trực tiếp.

---

## 2. Kết Quả Kiểm Thử Chất Lượng (Quality Gates)

| Dự án | Test Suites / Unit Tests | Coverage / Quy tắc | Product Checks | Trạng thái |
| :--- | :--- | :--- | :--- | :--- |
| **Backend** (`arc-academy-backend`) | 25 suites / 148 tests PASS | Stmts > 85%, Branch > 63% | 138 Bruno smoke requests PASS, OpenAPI export valid | **100% XANH** |
| **CMS** (`arc-academy-cms`) | 15 suites / 72 tests PASS | Foundation rules (5/5 PASS) | 970 bilingual strings (vi/en) PASS, Client reproducible | **100% XANH** |
| **Web** (`arc-academy-web`) | 15 suites / 58 tests PASS | Foundation rules (5/5 PASS) | 324 bilingual strings (vi/en) PASS, Client reproducible | **100% XANH** |
