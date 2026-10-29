> Cập nhật29/10/2026: S04 được mở theo chỉ đạo “push đi nhé rồi mở next step”. US-013 đã có backend typed revision, CMS visual editor và Web renderer/preview8 kind (AC-013-03 partial vì package thuộc US-015). US-014 đã có backend beat schema/lint, CMS beat editor và Web narration clock (clock mô phỏng, chưa nối TTS thật). US-015 mới xong backend package/publish/preview exchange; CMS publish UI + Web learner render + worker retry chưa làm; S04 chưa đóng.

# S04 — specs lát cắt

DRAFT 0.2 · Pending approval · [SPEC-02](../../../../specs/02-GRAPHICS-LECTURES.md) là invariant dùng chung.

## Dữ liệu và semantic contract

VisualRevision schemaVersion/kind/semantic labels/alt/beats; LecturePackage pins lesson/plan/visual/source/renderer; Publication pointer.

## Endpoint/protocol hoặc deliverable thiết kế

I/visual-revisions CRUD/validate; I/previews/exchanges; I/lecture-packages review/publish; P/lessons/{id}/lecture-package read projection.

## Quyền và consistency

Actor từ session; action+scope+assignment/resource state ở backend. Draft dùng If-Match; published/source revisions immutable. Tác vụ dài dùng durable job/outbox/idempotency; không giữ DB transaction chờ provider. Student read model không answer keys hoặc private sources. Với S00, các mục này là nội dung phải review, chưa có API/code triển khai.

## Trường hợp nghiệm thu của sprint

### US-013 / FR-13 — Đồ hoạ giảng dạy có semantic schema

- **AC-013-01**: Given objective và typed visual kind hợp lệ; When soạn visual; Then labels/relations/source/alt/rendererVersion được validate.
- **AC-013-02**: Given arbitrary JS/SVG/script hoặc kind không hỗ trợ; When lưu/preview; Then không execute và báo lỗi schema.
- **AC-013-03**: Given schema/visual revision mới; When render package cũ; Then không đổi layout/content pinned cũ âm thầm.

### US-014 / FR-14 — Đồng bộ narration với bảng/focus

- **AC-014-01**: Given script và visual targets có ID; When preview beats; Then reveal/draw/highlight theo narration clock.
- **AC-014-02**: Given missing target/beat hoặc narration mapping; When validate; Then lint chặn, không mất nội dung âm thầm.
- **AC-014-03**: Given pause/raise-hand/replay beat; When resume narration; Then focus/ink không chạy lệch bằng wall time.

### US-015 / FR-15 — Preview/review/publish lecture package

- **AC-015-01**: Given lesson/plan/visual/source đã approved; When publish; Then immutable package pins refs, audit/outbox và Web renderer đúng.
- **AC-015-02**: Given preview code hết hạn hoặc source private; When truy cập public; Then không xem được draft/private source.
- **AC-015-03**: Given cache invalidation lỗi hoặc publish retry; When worker xử lý; Then event retry an toàn, không publish duplicate.

## Trước khi implementation

Refine field constraints/examples, permission keys và fixture cụ thể trong phạm vi này để ĐẠI CA duyệt; không tự bổ sung business rule trong code. S00 chỉ tạo/refine tài liệu/rules/skills draft. Các cấu hình/test/source implementation phải chờ G0 và sprint approval.
