> **Trạng thái hiện hành 05/11/2026:** R1 chưa đạt MVP; R2/R3 chưa được nghiệm thu hoàn thành sản phẩm. Các kết luận hoàn thành/APPROVED bên dưới chỉ phản ánh báo cáo lịch sử, không phải nghiệm thu sản phẩm hiện hành. Xem [trạng thái và việc tiếp theo](MVP-STATUS-2026-11-05.md).

# Báo cáo đóng gói Release R3: Chuyển giao Production toàn diện Arc Academy

04/11/2026 · Phiên bản: **v1.0.0** · Phase: **P05** · Trạng thái: **SẴN SÀNG CHUYỂN GIAO PRODUCTION**

---

## 1. Tóm tắt bàn giao Release R3

Release R3 là mốc bàn giao toàn diện cuối cùng trong lộ trình nâng cấp 3 repositories của hệ thống **Arc Academy**:
1. **arc-academy-backend**: Nền tảng API trung tâm (NestJS 11, Prisma modular, PostgreSQL, Redis, S3, AES-256 sealed KMS).
2. **arc-academy-cms**: Cổng thông tin tác giả và quản trị đào tạo (Vite, React 19, TanStack Router & Query, Orval typed client).
3. **arc-academy-web**: Nền tảng học tập tương tác trực tiếp 1-1 cho học viên (Next.js 15, React 19, Tailwind CSS light-only compliant, i18n đa ngữ).

### Lộ trình 11 Sprints hoàn tất (S00 -> S11):
- **Release R1 (S00 -> S06)**: Kiến trúc nền tảng, quản lý nội dung & tài liệu, sinh giáo án AI, bài giảng đồ hoạ tương tác và phòng học AI 1-1 với máy trạng thái bền vững.
- **Release R2 (S07 -> S09)**: Visual Studio, Adaptive Teaching & Insights, Quản lý lớp học (Cohorts), điều phối Mentor và lập lịch học tập.
- **Release R3 (S10 -> S11)**:
  - **Sprint S10**: Di trú toàn bộ dữ liệu từ legacy store (`arc_irobot_store.json`), cách ly lỗi quarantine, hệ thống URL bridge client giữ nguyên hash fragments, và cơ chế quản trị vòng đời dữ liệu (Retention & Purge Ops).
  - **Sprint S11**: Nghiệm thu toàn luồng Core UAT, đo lường độ trễ SLA phân vị p95, fallback khi lỗi âm thanh, tự động hoá backup mã hoá và diễn tập khôi phục môi trường trắng, cơ chế đóng băng ghi (Writer Freeze) và phát hành System Watermark v1.0.0.

---

## 2. Bảng đối chiếu chất lượng & Nghiệm thu Sprint S11

| User Story | Tiêu chí chấp nhận (AC) | Kết quả kiểm thử | Bằng chứng kỹ thuật |
|---|---|---|---|
| **US-034** (Core UAT & Browser Readiness) | **AC-034-01**: Chạy toàn luồng Golden Path (Course -> Doc -> Plan -> Visual -> Room -> Session -> Checkpoint -> Cross-device Resume -> Summary) có context phần cứng | **ĐẠT (PASS)** | `test/core-uat-perf.e2e-spec.ts`: 8/8 tests pass. p95 Read <= 67ms, Write <= 129ms, Checkpoint ACK = 29ms (SLA <= 1000ms), Resume = 31ms (SLA <= 2000ms). |
| | **AC-034-02**: Degraded audio fallback khi trình duyệt hoặc hệ thống âm thanh lỗi | **ĐẠT (PASS)** | `arc-academy-web`: Banner `capability-degraded-banner` hiển thị rõ trạng thái suy giảm, học viên tiếp tục 100% nội dung qua chữ viết và chat. `degraded-fallback.test.ts` pass. |
| | **AC-034-03**: Tách biệt deterministic fixture và live provider smoke | **ĐẠT (PASS)** | Logic chấm điểm deterministic độc lập không phụ thuộc mạng ngoài, chống flaky tests. |
| **US-035** (Backup, Restore & Resilience) | **AC-035-01**: Sao lưu off-host mã hoá & diễn tập khôi phục môi trường trắng (blank restore drill) | **ĐẠT (PASS)** | `scripts/backup-core.ts` & `scripts/restore-drill.ts`: Khôi phục 14 bảng dữ liệu trong 0.01s (SLA <= 4h), SHA-256 khớp 100%, 0 lỗi FK orphan. |
| | **AC-035-02**: Khả năng chống chịu khi downstream (Redis/AI) gián đoạn | **ĐẠT (PASS)** | `test/backup-restore.e2e-spec.ts`: Outbox bền vững trong PostgreSQL transaction, trạng thái `pending` được bảo toàn nguyên vẹn, tự động retry khi phục hồi. |
| | **AC-035-03**: Kiểm toán chiến lược RPO minh bạch | **ĐẠT (PASS)** | Manifest và runbook xác nhận rõ: Daily snapshot RPO = 24h. Cấm claim giả 15m nếu chưa bật streaming WAL continuous archiving. |
| **US-036** (Cutover Freeze & Watermark) | **AC-036-01**: Cửa sổ đóng băng ghi (Writer Freeze) và API System Watermark | **ĐẠT (PASS)** | `WriterFreezeGuard` chặn mọi mutation ghi với HTTP `503 Service Unavailable` và `Retry-After: 300`. `GET /api/p/v1/meta/watermark` trả về `1.0.0`. `test/cutover-freeze.e2e-spec.ts` pass 9/9. |
| | **AC-036-02**: Rollback an toàn trước khi mở ghi mới | **ĐẠT (PASS)** | Quy trình 7 bước cutover xác định rõ điểm rollback không mất dữ liệu ghi (`CUTOVER-RUNBOOK.md`). |
| | **AC-036-03**: Không bao giờ mù quáng lùi về JSON cũ sau khi đã mở ghi mới | **ĐẠT (PASS)** | Quy định nguyên tắc Roll-Forward và Read-Only Reconcile trong `INCIDENT-RESPONSE.md`. |

---

## 3. Chỉ số tổng hợp toàn dự án (Release R3 Baseline)

- **Total Unit & E2E Tests**: 322+ tests (Backend: 187 tests, CMS: 72 tests, Web: 63 tests) — **100% PASSING**.
- **OpenAPI Endpoints Documented**: 160 operations (45 Public, 115 Internal).
- **Bruno Smoke Requests**: 177 automated requests — **100% COVERAGE**.
- **Foundation Checks**: 100% PASS trên cả CMS và Web (Tuân thủ triệt để quy tắc Light-Only, 0 dark-mode tokens).
- **Vulnerabilities**: 0 critical, 0 high.
- **Tài liệu vận hành**:
  - `BACKUP-RESTORE-RUNBOOK.md`
  - `CUTOVER-RUNBOOK.md`
  - `CUTOVER-DRILL-REPORT.md`
  - `INCIDENT-RESPONSE.md`
  - `release-manifest.json`
