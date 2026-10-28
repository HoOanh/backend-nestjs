# Shared rules template — Arc Irobot Academy

DRAFT 0.2, không active. Sau duyệt copy vào AGENTS.md repo đích với links repo-local.

- Giao tiếp tiếng Việt, gọi user ĐẠI CA và xưng em; đưa kết quả/code/evidence cụ thể.
- Core: content/tài liệu→giáo án→đồ hoạ→AI 1-1→hội thoại/progress. Chỉ làm scope sprint được duyệt.
- Chưa approved baseline+rules+specs thì không setup/code. Skill không mở quyền implementation. Không tự commit/push/deploy.
- Nhánh feature `feat/`, bugfix `fix/`; cấm branch chứa `code/` hoặc `codex/`. Giữ thay đổi người khác.
- TS strict, cấm any; runtime input unknown→validate. Không cast để bỏ kiểm tra. Theo Prettier của repo.
- CodeGraph trước tìm/đọc code nếu index khả dụng; không tự index; search hẹp, bỏ dependencies/build.
- Backend enforce permission/ownership/state; published/source immutable; UI không xác nhận verified progress.
- Mọi tác vụ thay data contract/content/visual/session phải đọc spec đúng sprint và cập nhật schema/AC có liên quan.
- Chạy checks phù hợp, báo rõ đã/chưa chạy và giới hạn; không giả evidence từ mock thành production verified.
- Source/citation/visual/AI artifacts không được tự publish; private data/credential không vào client/log/fixture.

## Foundation amendment 28/10/2026

- CMS/Web light-only, kể cả OS dark; tokens/HTML/metadata/toast thống nhất.
- UI dùng frontend-design upstream snapshot + arc-frontend-workspaces; core/ui chứa primitives từ shadcn registry, không tự dựng native controls ở feature.
- MCP pin theo .codex/config.toml và chạy pnpm mcp:check; config tồn tại chưa chứng minh server chạy. Backend chỉ lookup UI contract, không cài UI runtime.
- Đọc arc-foundation-quality cho foundation/tooling. Chạy pnpm quality:check (coverage thresholds), build và browser/HTTP gates phù hợp; báo global coverage thật, không gộp fixture thành integration.
