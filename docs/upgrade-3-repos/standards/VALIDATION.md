> Chỉ đạo 28/10/2026: light-only, shadcn registry/MCP, rules/skills và coverage gates theo [Foundation quality](../implementation/FOUNDATION-QUALITY.md). Chưa mở sprint tính năng mới.

> Update28/10/2026: validator gốc đã pass9installed copies sau khi chuẩn bị venv local. [Execution evidence](../implementation/S01-REPORT.md). Phần bên dưới là lịch sử kiểm tra tài liệu trước setup.

# Kiểm tra bộ tài liệu 0.2

Ngày 27/10/2026 · Chỉ document/static checks, không implementation hoặc behavioral agent trial.

## Đã kiểm

- JSON parse: canonical stories, sprint index và 12 bản stories theo sprint.
- 36 FR → 36 stories → 108 AC ID duy nhất, đủ Given/When/Then; 6 phase/12 sprint có đường dẫn tồn tại.
- Story dependency DAG không vòng; không có dependency từ release sớm sang release muộn.
- Per-sprint stories bằng đúng subset canonical JSON; IDs và sprint index khớp.
- Markdown local links tồn tại; skill supporting references resolve đúng trong hồ sơ hiện tại.
- Không còn thuật ngữ domain tham chiếu hoặc tên repo backend cũ trong hồ sơ; không có story thực hiện thanh toán.
- Mọi story còn draft/not_started/pending approval; implementation_authorized=false; G0 đóng.
- 5 skill drafts: name khớp folder, lowercase-hyphen/max64, description nonempty/max1024, chỉ supported frontmatter fields, không TODO scaffold. Frontmatter dùng quoted scalar là JSON string hợp lệ trong YAML.

## Validator skill và giới hạn

Đã thử `skill-creator/scripts/quick_validate.py`; cả Python hiện tại và bundled runtime đều thiếu module PyYAML, nên validator gốc **chưa chạy thành công**. Không install dependency. Đã dùng strict scalar-frontmatter fallback kiểm format/name/description/placeholder và link integrity cho cả 5 skill. Kết quả fallback không được ghi thành official validator passed; trước activate ở repo thật cần chạy lại validator gốc trong environment đã chuẩn bị sau duyệt.

## Scenario review tĩnh của skill drafts

| Skill | Scenario đánh giá | Hướng dẫn cần có / kết quả review tĩnh |
|---|---|---|
| arc-content-pipeline |DOCX không có page ổn định, source author-only |Dùng section/paragraph thật, chặn cross-scope learner context; đã có |
| arc-lecture-graphics |Giơ tay khi visual đang vẽ |Beat/narration clock và resume, semantic fallback; đã có |
| arc-ai-classroom |Hai thiết bị cùng ghi và stream bị ngắt |Single writer/CAS/lastAck/dedup, không duplicate provider run; đã có |
| arc-backend-contracts |Response DTO đổi trong feature |Audience/private fields/spec/codegen/compatibility+API boundary test; đã có |
| arc-frontend-workspaces |Autosave stale và account switch |Giữ local buffer/ETag conflict, clear scoped private cache; đã có |

Đây là review nội dung chỉ dẫn, chưa chứng minh agent sẽ làm đúng qua một task thực tế. Chưa chạy ứng dụng, CI/source tests, browser UAT, benchmark, migration, provider request hoặc activate skill/rules. Không tạo code/config/script executable; chỉ Markdown/JSON trong docs/upgrade-3-repos.
