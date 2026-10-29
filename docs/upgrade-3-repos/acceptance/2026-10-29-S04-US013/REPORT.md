# US-013 — Đồ hoạ giảng dạy typed: bằng chứng local

Ngày29/10/2026, tiếp chỉ đạo hoàn tất S04 slice đầu. Phạm vi đã làm: backend typed visual revision, CMS visual editor, Web renderer/preview cho 8 kind. Chưa làm US-014 narration beats và US-015 lecture package/publish.

## Evidence

- [backend-quality.log](backend-quality.log): 123 tests/20 suites, statements85.17%, branches66.94%, functions83.49%, lines87.53%; OpenAPI internal64 paths,97 Bruno templates, export reproducible.
- [cms-quality.log](cms-quality.log): 70 unit tests, 15 files; product 844 bilingual messages; generated client reproducible.
- [cms-browser.log](cms-browser.log): 33/33 browser tests, gồm2 scenario visual editor (autosave If-Match, mobile390px).
- [cms-build.log](cms-build.log), [web-build.log](web-build.log): production build PASS.
- [web-quality.log](web-quality.log): 42 unit tests; preview transport chỉ cho teaching-plan/visual preview; generated contract reproducible.
- Ảnh: [cms-visual-editor.png](cms-visual-editor.png), [cms-visual-editor-mobile.png](cms-visual-editor-mobile.png).

## Test mới

- Backend: `src/modules/visuals/visual.schema.spec.ts` (3), `test/visuals.e2e-spec.ts` (4, gồm preview projection).
- CMS: `src/modules/visuals/services/visual.service.test.ts` (2), `e2e/visual-editor.spec.ts` (2).
- Web: preview transport test (2, thêm visual path).

## AC status

| AC | Trạng thái | Bằng chứng |
|---|---|---|
| AC-013-01 | PASS local | Backend validate labels/relations/source/alt/rendererVersion; CMS typed editor cho8 kind; browser autosave payload đúng |
| AC-013-02 | PASS local | Backend từ chối script/SVG/unknown kind trước khi ghi; Web renderer dùng React text nodes, không `dangerouslySetInnerHTML`, không execute nội dung |
| AC-013-03 | Partial | Revision immutable + rendererVersion pin; lecture package cũ chưa có nên chưa test render package pinned (US-015) |

## Giới hạn

- Browser CMS dùng HTTP fixture, không phải backend/Postgres thật trong luồng visual editor.
- Web renderer chưa có browser screenshot/regression; chưa resolve asset URL cho image-annotation (hiển thị semantic fallback + nhãn, ghi rõ học liệu ảnh chưa xuất bản).
- Web unit coverage toàn app9.7% — không suy luận chất lượng renderer từ số test pass.
- Chưa có US-014 focus clock, US-015 preview exchange/publish/outbox; S04 chưa thể đóng.

## Bổ sung US-014 backend (partial)

Beat schema/lint/plan-segment validation đã thêm, backend125 tests; chưa có CMS beat editor và Web narration clock player nên AC-014-01/03 chưa đạt. Chi tiết trong implementation/S04-REPORT.md.
