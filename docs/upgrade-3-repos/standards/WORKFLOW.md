> Chỉ đạo 28/10/2026: light-only, shadcn registry/MCP, rules/skills và coverage gates theo [Foundation quality](../implementation/FOUNDATION-QUALITY.md). Chưa mở sprint tính năng mới.

# Workflow và quality gates

DRAFT 0.2 · Chỉ áp sau phê duyệt tương ứng.

## Trước setup — S00

1. Chốt baseline BRD/architecture/SRS/phase+sprint stories/specs và D-01..10.
2. Duyệt rule templates/skill drafts; xác định external skill source/ref/license/owner, không cài cả collection.
3. Lập compatibility matrix proposed major/patch/support/target CI, inventory scaffold và report read-only; không chạy dependency spike/setup trước G0.
4. Ghi approval version/hash/scope. Chưa có đủ duyệt: refine tài liệu, không giả định được code.

## Definition of Ready từng sprint

Entry dependencies đạt gate; user stories có actor/value/AC; API/schema/state/permission/visual/source contract có spec được duyệt; fixture/reference lesson xác định; failure/negative cases; owner Backend/CMS/Web/reviewer/ops; capacity đủ. Nếu quyết định unresolved ảnh hưởng sprint thì không bắt đầu phần đó.

## Thực hiện sau duyệt

Không tự tạo commit. Khi cần nhánh mới dùng `feat/` hoặc `fix/` theo task; tuyệt đối không tạo/sử dụng branch chứa `code/` hoặc `codex/`. Trước thay đổi kiểm trạng thái git để giữ work người khác; không auto reset/overwrite scaffold. Search scope hẹp, CodeGraph trước khi đọc/search code nếu repo có index khả dụng; không tự index, không quét dependencies/build output.

Feature slice: backend contract/schema → producer tests → client generation → CMS/Web integration → core flow demo → AC evidence → reviewer sign-off. Generated mocks không dùng để kết luận auth/network/cookie đúng; có API smoke qua deployed-like edge. File/source/visual schema change phải update cả consumer liên quan trước close sprint.

## Definition of Done

- AC positive+negative+retry có evidence, chưa chạy thì ghi not_executed, không giả pass.
- Review source refs/visual semantics và content quality bằng người; clocks/state reducers được test phù hợp.
- Type/lint/build/contract drift/API smoke/critical browser flow pass; test rộng thêm khi thay đổi/risk đòi hỏi, không lặp vô hạn.
- Permission/audit/quota/idempotency/ETag/fallback/retention theo feature; docs/specs/contract version sync, approved scope không phình.
- Không có credential/PII/provider key trong fixture/log; không sửa generated code tay.
- Sprint review bằng demo sản phẩm của sprint, không chỉ3 repo build xanh.

## Gate owner

ĐẠI CA duyệt scope/spec và mở phase/release. Tech lead kiểm boundaries/contracts/rules; reviewer nội dung kiểm nguồn/giáo án/đồ hoạ; operator kiểm backup/monitoring/cutover; developer cung cấp evidence. Một người có thể nhiều vai trò nhưng xung đột self-approval cần policy được duyệt, không tự bỏ review vì thiếu nhân sự.

CI có thể enforce types/schema/dependency direction/contract drift; không thể tự kết luận kiến thức đúng, đồ hoạ sư phạm tốt hoặc skill an toàn chỉ vì validator pass. Skill validation syntax khác behavioral review.
