# Bộ chuẩn trước setup

DRAFT 0.2 · Deliverable S00 · Chưa cài/activate vào repo thật.

1. [Coding rules](CODING-RULES.md): quy tắc source, data/API, FE, AI/graphics và testing.
2. [Workflow và gates](WORKFLOW.md): authority, DoR/DoD, sync3 repo và quality gate ownership.
3. [Skill research](SKILLS-RESEARCH.md): nguồn đã đọc, chọn/lược bỏ, reuse local skills và external candidates.
4. [Rule templates](rule-templates/AGENTS.shared.md) + supplements [backend](rule-templates/AGENTS.backend.md), [CMS](rule-templates/AGENTS.cms.md), [Web](rule-templates/AGENTS.web.md).
5. Skill drafts: [content](skills/arc-content-pipeline/SKILL.md), [graphics](skills/arc-lecture-graphics/SKILL.md), [classroom](skills/arc-ai-classroom/SKILL.md), [contracts](skills/arc-backend-contracts/SKILL.md), [frontend](skills/arc-frontend-workspaces/SKILL.md).

Rule templates hiện chỉ là Markdown, không tên AGENTS.md active trong source tree. Skill drafts nằm trong docs, không `.agents/skills`/global skills. Sau duyệt mới copy vào từng repo đúng scope và điều chỉnh reference paths. Không có hook/CI script/config executable được tạo ở S00.

[Báo cáo kiểm tra tài liệu/skill](VALIDATION.md) ghi rõ checks đã chạy và giới hạn validator.

## Ownership và cách áp dụng sau duyệt

Tech lead giữ shared rules/skill version trong hồ sơ, mỗi repo có bản sao kèm source version/hash; PR chạm rule chung cần kiểm3 repo, không phụ thuộc fourth repo. Backend nhận content/contracts/classroom specs; CMS nhận content/graphics/frontend; Web nhận graphics/classroom/frontend. Skill nào có reference tới hồ sơ phải được copy cùng supporting reference hoặc sửa thành repo-local link và validate lại, không để link sang máy cá nhân.

Precedence: chỉ đạo ĐẠI CA trong phiên → applicable repo rules → skill task-specific; skill không tự mở quyền setup/code/commit/deploy. Required rule có rationale và gate; guideline thẩm mỹ không biến thành linter giả. Root AGENTS ngắn, chi tiết trong docs/rules và skill đúng phạm vi.
