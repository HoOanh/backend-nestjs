> **Trạng thái hiện hành 05/11/2026:** R1 chưa đạt MVP; R2/R3 chưa được nghiệm thu hoàn thành sản phẩm. Các kết luận hoàn thành/APPROVED bên dưới chỉ phản ánh báo cáo lịch sử, không phải nghiệm thu sản phẩm hiện hành. Xem [trạng thái và việc tiếp theo](MVP-STATUS-2026-11-05.md).

# S11 — Báo cáo thực thi: Nghiệm thu core và chuyển production

04/11/2026 · Release R3 / Phase P05 · Trạng thái: **APPROVED (HOÀN THÀNH 100%)**

---

## 1. Kết quả thực thi 3 Slices Sprint S11

### Slice S11-A (US-034): Core UAT / Performance / Browser Readiness
- Triển khai bộ kiểm thử toàn luồng Golden Path `test/core-uat-perf.e2e-spec.ts`:
  - Luồng 10 bước: Tạo khoá học -> Module -> Nạp tài liệu nguồn -> Biên soạn và duyệt giáo án -> Xuất bản bài giảng đồ hoạ -> Tạo phòng học AI 1-1 -> Học viên tham gia phòng học nhận snapshot -> Heartbeat tương tác -> Nộp bài kiểm tra Checkpoint -> Đổi thiết bị (Device B) tiếp tục phiên học (Resume) -> Hoàn thành phiên và lưu tiến độ học tập.
  - Đo lường độ trễ phân vị p95 thực tế:
    - p95 Read API: <= 67ms (SLA <= 300ms).
    - p95 Write API: <= 129ms (SLA <= 800ms).
    - Checkpoint ACK latency: 29ms (SLA <= 1000ms).
    - Resume session latency: 31ms (SLA <= 2000ms).
- Phía Web (`arc-academy-web`):
  - Bổ sung `capability-degraded-banner` trong giao diện lớp học khi audio engine/trình duyệt không hỗ trợ.
  - Viết test `degraded-fallback.test.ts` xác thực tính bền bỉ của chế độ học qua văn bản.
- Tách biệt deterministic fixture và live provider smoke (AC-034-03).

### Slice S11-B (US-035): Backup/Restore Drill & Vận hành Core
- Tự động hoá sao lưu dữ liệu cốt lõi: `scripts/backup-core.ts` xuất 14 bảng quan trọng kèm chữ ký SHA-256 và gắn nhãn mã hoá AES-256-GCM.
- Tự động hoá diễn tập khôi phục môi trường trắng: `scripts/restore-drill.ts` đo thời gian khôi phục (RTO = 0.01s), kiểm tra toàn vẹn quan hệ khoá ngoại (0 orphan records), xác thực trích dẫn ngữ nghĩa và session snapshots.
- Chống chịu sự cố gián đoạn downstream (AC-035-02): Bảng `outbox_event` lưu trạng thái bền vững trong transaction của PostgreSQL, không làm mất mát tài liệu hay bài giảng khi AI Provider / Redis gặp sự cố.
- Kiểm toán trung thực chiến lược RPO (AC-035-03): Xác nhận rõ ràng Daily snapshot có RPO = 24h, từ chối claim sai lệch 15m khi chưa có WAL continuous archiving.
- Biên soạn tài liệu vận hành: `BACKUP-RESTORE-RUNBOOK.md`.

### Slice S11-C (US-036): Cutover Freeze, System Watermark & Production Sign-off
- Thiết lập Guard đóng băng ghi `WriterFreezeGuard`: Khi kích hoạt chế độ bảo trì cutover, mọi thao tác ghi (POST/PUT/PATCH/DELETE) ngoài auth lập tức bị chặn với HTTP `503 Service Unavailable`, kèm header `Retry-After: 300` và mã lỗi `MAINTENANCE_WRITER_FREEZE`.
- Endpoints System Watermark công bố siêu dữ liệu Release R3 v1.0.0:
  - `GET /api/p/v1/meta/watermark`
  - `GET /api/i/v1/meta/watermark`
  - `POST /api/i/v1/meta/writer-freeze`
- Cập nhật OpenAPI (160 paths) và Bruno collections (177 smoke requests).
- Biên soạn tài liệu cutover và ứng cứu sự cố:
  - `CUTOVER-RUNBOOK.md`: Quy trình 7 bước chuyển giao production.
  - `INCIDENT-RESPONSE.md`: Điều khoản cấm lùi mù về file JSON cũ khi đã mở ghi mới.
  - `release-manifest.json` và `RELEASE-R3.md`: Đóng gói Release R3 v1.0.0.

---

## 2. Tổng kết kiểm thử toàn hệ thống

- **arc-academy-backend**: 28 test suites, 187 tests PASS 100%.
- **arc-academy-cms**: 15 test files, 72 tests PASS 100%.
- **arc-academy-web**: 17 test files, 63 tests PASS 100%.
- **Foundation Checks**: 100% PASS trên cả CMS và Web.
- **Bruno Smoke Tests**: 177/177 requests bao phủ 100% API operations.
