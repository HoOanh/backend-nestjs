> Cập nhật29/10/2026: US-010 đã commit, US-011 được ĐẠI CA mở và đã chạy Gemini thật; US-012 còn lại. Execution contract/evidence xem S03-REPORT; các gate lịch sử phía dưới không thay chỉ đạo mới.

> Chỉ đạo29/10/2026: đã merge/push S02; bắt đầu US-010/S03 theo [execution contract](../../../../implementation/S03-REPORT.md). US-011/012 chưa triển khai trong lát cắt này; các gate lịch sử bên dưới được giữ để đối chiếu.

# S03 — specs lát cắt

DRAFT 0.2 · Pending approval · [SPEC-01](../../../../specs/01-CONTENT-DOCUMENTS.md) là invariant dùng chung.

## Dữ liệu và semantic contract

TeachingPlanRevision objectives/sections/scripts/checkpoints/sourceRefs/inputHash; AiRun/Artifact/PromptVersion/QuotaReservation; ReviewDecision.

## Endpoint/protocol hoặc deliverable thiết kế

I/lessons/{id}/plan-jobs; I/ai/jobs/{id}; I/plan-artifacts/{id}/apply If-Match; I/teaching-plans/{id} PATCH; submit-review/approve/reject gắn hash.

## Quyền và consistency

Actor từ session; action+scope+assignment/resource state ở backend. Draft dùng If-Match; published/source revisions immutable. Tác vụ dài dùng durable job/outbox/idempotency; không giữ DB transaction chờ provider. Student read model không answer keys hoặc private sources. Với S00, các mục này là nội dung phải review, chưa có API/code triển khai.

Cập nhật 29/10/2026: AC-011-04 (chọn model trong catalog) và AC-011-05 (provider/key quản trị trong CMS) đã chốt;
> v1 catalog từ env được thay bằng v2 catalog từ DB.

> Ghi chú bối cảnh (v1): catalog model công bố qua `GET /i/v1/ai/authoring-budget`; `POST /i/v1/lessons/{id}/plan-jobs` nhận `model` (id `ai_model`) tuỳ chọn; server từ chối id ngoài catalog. AC-011-04 giữ.

> Chỉ đạo 29/10/2026 (v2, thay thế nguồn catalog từ env): **không dùng env cho provider/key/model**. Admin cấu hình trong CMS tại `/providers` qua `GET|POST|PATCH|DELETE /i/v1/ai/providers…` (quyền `platform:ai:configure`, chỉ admin). Hỗ trợ hai giao thức: `gemini` (REST native, header `x-goog-api-key`) và `openai_compatible` (`POST {baseUrl}/chat/completions`, `Authorization: Bearer`) cho OpenRouter, CKEY, OpenAI, gateway khác. Ràng buộc: baseUrl bắt buộc HTTPS, không userinfo/query, không host loopback/private; key ≥8 ký tự, bị từ chối nếu có khoảng trắng; key mã hoá AES-GCM (CryptoService) và API chỉ trả `secretHint` 4 ký tự cuối; không ghi key vào audit/log/URL. Model `ai_model` bật/tắt/xoá; model đã có lịch sử chạy chỉ bị tắt thay vì xoá; provider có lịch sử chạy bị DB chặn xoá. `plan_ai_job.model` lưu snapshot `providerKey/modelId` (immutable) cạnh `aiModelId`. AC-011-05 giữ hành vi này.

## Trường hợp nghiệm thu của sprint

### US-010 / FR-10 — Biên soạn giáo án có cấu trúc

- **AC-010-01**: Given lesson/source ready; When soạn giáo án; Then objective→script→visual intent→checkpoint trace được.
- **AC-010-02**: Given dangling source hoặc checkpoint schema sai; When lint; Then error có ref/block/rule cụ thể.
- **AC-010-03**: Given editor khác đã lưu; When autosave ETag cũ; Then 412, không overwrite buffer người soạn.

### US-011 / FR-11 — AI dựng giáo án từ content và nguồn

- **AC-011-01**: Given budget/source được phép và model được chọn thuộc allow-list đang bật; When chạy authoring job; Then artifact schema-valid có prompt/model/input hash và citation; model ngoài allow-list bị từ chối.
- **AC-011-02**: Given source chứa instruction injection hoặc chưa cấp quyền; When build context; Then không cấp tool/quyền mới, không dùng source ngoài scope.
- **AC-011-03**: Given provider timeout hoặc apply stale; When retry/reconcile; Then usage unknown hoặc412 rõ, không auto publish/double apply.
- **AC-011-04**: Given deployment công bố danh sách model dựng giáo án; When editor chọn model trên CMS hoặc để mặc định; Then FE chỉ chọn trong danh sách server trả về, job ghi đúng model đã chọn; job có model không còn chạy được bị đóng kèm lý do và trả quota thay vì treo.
- **AC-011-05**: Given admin cấu hình provider/key/model trong CMS (Gemini native hoặc gateway OpenAI-compatible như OpenRouter, CKEY); When lưu hoặc chạy authoring job; Then key được mã hoá tại rest và không bao giờ trả lại qua API/log; chỉ model đang bật thuộc provider đang bật mới chọn được; không cần env AI hay restart.

### US-012 / FR-12 — Review giáo án và kiến thức

- **AC-012-01**: Given draft có đủ objective/source/lint; When review/approve; Then decision gắn hash và human findings disposition.
- **AC-012-02**: Given AI bịa nguồn hoặc author tự duyệt trái policy; When approve; Then bị chặn hoặc cần xử lý findings theo quyền.
- **AC-012-03**: Given draft đổi sau approval; When đi publish; Then approval cũ không còn đủ điều kiện.

## Bổ sung UX biên soạn 29/10/2026

ĐẠI CA chỉ đạo nâng cấp UX khoá học/giáo án (Outline + Sheet, AI-first, kéo-thả, mobile, danh sách). Không đổi AC-010/011 hay mở US-012; các yêu cầu dưới đây là ràng buộc giao diện bắt buộc giữ cho các lượt sau. Chi tiết và evidence: [AUTHORING-UX-2026-10-29](../../../../implementation/AUTHORING-UX-2026-10-29.md).

- **UX-S03-01**: Bài học đã lưu luôn mở được để xem/sửa (Sheet) và mở giáo án từ outline; mở giáo án khi còn thay đổi chưa lưu sẽ lưu trước, lỗi lưu thì ở lại và giữ bản nháp.
- **UX-S03-02**: Outline hiển thị trạng thái giáo án từng bài từ `GET courses/:id/teaching-plans`; danh sách khoá hiển thị số bài có giáo án từ `GET teaching-plans/coverage`. Cả hai tôn trọng ownership/phạm vi như API đọc khoá học.
- **UX-S03-03**: Sắp xếp chương/bài bằng kéo-thả có tay nắm, bàn phím và announcement VI/EN; thả mới commit một lần; luôn có phương án Lên/Xuống trong menu.
- **UX-S03-04**: Thao tác phá huỷ (xoá chương/bài/phần, lưu trữ khoá) cần AlertDialog; bài có giáo án không xoá được từ UI.
- **UX-S03-05**: AI chọn tài liệu theo file/đoạn ngay trong panel; đoạn mới được lưu vào sourceRefs bằng revision CAS trước khi tạo job (AC-011 giữ nguyên: xác nhận nguồn, If-Match, Idempotency-Key, model allow-list).
- **UX-S03-06**: Mobile 390px không tràn ngang; editor giáo án có thanh dính điều hướng phần và dàn ý dạng Sheet.

## Trước khi implementation

Refine field constraints/examples, permission keys và fixture cụ thể trong phạm vi này để ĐẠI CA duyệt; không tự bổ sung business rule trong code. S00 chỉ tạo/refine tài liệu/rules/skills draft. Các cấu hình/test/source implementation phải chờ G0 và sprint approval.
