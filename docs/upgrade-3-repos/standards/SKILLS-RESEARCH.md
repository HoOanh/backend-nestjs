# Skill/rule research và quyết định áp dụng

DRAFT 0.2 · Đã đọc nguồn ngày27/10/2026; chưa install external skill. Ref upstream chưa pin commit nên không coi đã approved dependency.

## 1. Đã có trong MVP

| Skill | Dùng lại | Cần đổi cho3 repo |
|---|---|---|
| `.agents/skills/curriculum-authoring/SKILL.md` |Objective, kiến thức đúng, quiz/challenge quality, diagram hợp chủ đề, rubric |Không bê path `src/data/...` hay luật1lesson=1TSfile sang CMS/database; không bắt mọi khoá8quiz/3code challenges nếu chủ đề không phù hợp; giữ rubric chuyên môn ở content template đúng loại |
| `.agents/skills/frontend-ui-engineering/SKILL.md` |shadcn/Tailwind semantic tokens/lucide, tránh UI trang trí vô nghĩa, context-aware navigation |Bỏ hardcoded SPA route/type/path; phân scope CMS/Web, cho Canvas/Three timing/geometry khác CSS utilities |
| System `skill-creator` |Soạn skill ngắn, activation đúng task, references cần thiết, validate |Chỉ dùng để tạo skill docs; không tự sinh script/template implementation hoặc activate runtime |

Đây là đánh giá khả năng tái sử dụng, không sửa2skill đang active của MVP trong phiên này.

## 2. Nguồn bên ngoài đã xem

| Nguồn | Quyết định | Áp vào |
|---|---|---|
| Official OpenAI documentation: skills/customization |AGENTS cho durable rules, skill cho repeatable task; metadata trước/full instruction khi cần |Bộ rule/skill được soạn trước setup |
| Agent Skills specification |Dùng SKILL.md frontmatter name/description và progressive references |5 skill draft, validate syntax |
| Vercel Labs agent-skills |Candidate performance/composition review cho CMS/Web; chọn rules đúng React/Next, không cài deploy workflows |S01review source/license/ref trước copy; không cài ngay |
| NestJS testing docs |Dùng module/service/integration/E2E theo risk; không lấy tên skill cộng đồng chưa review làm chuẩn backend |Backend testing rules + API smoke |
| TanStack Query query keys |Actor/scope/resource/params/revision rõ và invalidation nhất quán |Generated adapters và private cache |
| Playwright best practices |User-visible flows, isolated tests, stable locators và traces |Demo core từ authoring tới classroom/resume |

Không cài bộ “all skills”, không thêm agent workflow có quyền commit/deploy/install trái chỉ đạo. Rule từ external skill không tự ưu tiên hơn sản phẩm/ĐẠI CA. External candidate chưa pin/ref/license-reviewed chưa có trạng thái accepted-for-install.

## 3. Skills nội bộ đã soạn (draft)

- `arc-content-pipeline`: setup course/content/doc sources, extract, giáo án và citation/review.
- `arc-lecture-graphics`: semantic diagrams/storyboard/narration/preview/publication integrity.
- `arc-ai-classroom`: session pin/single writer/voice+conversation/checkpoint/resume.
- `arc-backend-contracts`: feature API/permission/DTO/OpenAPI/outbox/consumer compatibility.
- `arc-frontend-workspaces`: CMS/Web boundaries, shadcn/editor states/Query keys/a11y.

Mỗi skill có5–8 hướng dẫn tác vụ tập trung, không chép toàn coding rules, không buộc đọc mọi tài liệu cho bug nhỏ. Skill draft phải passed format validation và scenario review nội dung trước activate. Không gọi agent phụ trong đợt tài liệu này.

## 4. Kích hoạt sau duyệt

Copy skill được chọn vào `.agents/skills/<name>/SKILL.md` của repo phù hợp sau G0, cùng references cần thiết; không dùng absolute path máy cá nhân. Copy rule template thành AGENTS.md và bổ sung links repo-local. Ghi version/hash/ref/license metadata, validate links/frontmatter, review1scenario phù hợp từng skill. Hook/ESLint/CI implementation thuộc S01, chưa có file executable ở đây.

## Nguồn chính thức

- [Official OpenAI — Build skills](https://learn.chatgpt.com/docs/build-skills).
- [Official OpenAI — Customization](https://learn.chatgpt.com/docs/customization/overview).
- [Agent Skills specification](https://agentskills.io/specification).
- [Vercel Labs agent-skills](https://github.com/vercel-labs/agent-skills).
- [NestJS testing](https://docs.nestjs.com/fundamentals/testing).
- [TanStack Query keys](https://tanstack.com/query/latest/docs/framework/react/guides/query-keys).
- [Playwright best practices](https://playwright.dev/docs/best-practices).
