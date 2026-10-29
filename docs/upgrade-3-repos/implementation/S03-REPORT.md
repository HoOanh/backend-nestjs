# S03 — Giáo án có cấu trúc

Ngày29/10/2026. ĐẠI CA chỉ đạo “commit rồi merge và thực hiện công việc tiếp theo”. S02 đã commit/fast-forward merge và push main ở cả4 repo. Bước tiếp theo: US-010 (AC-010-01..03), giáo án thủ công + lint + CAS + preview; US-011 AI provider và US-012 human review là bước tiếp nối, chưa kết luận hoàn thành toàn S03.

Không bật provider, gửi nguồn sang AI hay tự publish. Giữ20MiB/PDF100trang và author-only default. Nội dung mới chưa được con người ký nghiệm thu.

## Execution contract US-010

- Mỗi lesson có1 working plan, version nguyên dương; save tạo revision append-only, audit atomic. Snapshot lesson gồm title/objectives/duration; hash SHA256 canonical theo schema. Không chỉnh sửa source/existing revision.
- schemaVersion1; locale vi/en; objectives tối đa20 mục, sections40, citations80; checkpoint tối đa10/section. IDs UUID duy nhất; text có giới hạn, payload tối đa100000 UTF-8 bytes.
- Objective có id/text; section có id/title/objectiveIds/narration/visualIntent/sourceRefIds/checkpoints; checkpoint có id/question/answerKey/explanation/sourceRefIds. Không HTML execution.
- SourceRef có id/revisionId/spanId/textHash. Save giữ semantic lỗi để editor sửa, nhưng không nhận nguồn ngoài quyền/lesson, revision chưa ready hoặc hash giả. Lint trả rule/path/ref cụ thể cho dangling mapping, empty content, objective chưa có explanation/visual/checkpoint/source, checkpoint thiếu đáp án/nguồn, lesson đã đổi.
- GET lesson/teaching-plan trả plan hoặc null; POST tạo rỗng idempotent theo lesson; PATCH teaching-plans/id yêu cầu If-Match, 428 thiếu/400 sai/412 stale, tuyệt đối không last-writer-wins. Reviewer read-only; editor/admin có write nhưng vẫn kiểm ownership.
- Preview là internal staff read model, không answerKey/explanation đáp án; Web server-only fetch chỉ endpoint preview với staff cookie/no-store. Không đưa internal contract vào browser/student API. Preview hiển thị citation section/page thật và dẫn tới source, vẫn chưa phải bài được publish.
- Form autosave chỉ khi online, valid shape và dirty; conflict giữ buffer/export; beforeunload/router blocker. VI/EN, light-only, shadcn primitives sẵn có. Renderer duy nhất ở Web.

## Evidence

- Backend quality PASS: 74 tests; 46 HTTP/integration tests; coverage statements82.77%, branches64.19%, functions78.94%, lines84.63%. OpenAPI public/internal/preview reproducible/schema closure; preview contract không answer keys/private authoring schema. Bruno61 operation templates, manual collection chưa chạy.
- CMS quality + build PASS, 38 unit tests + rules; Web quality + production build PASS, 43 unit tests + rules. Frontend statement coverage vẫn thấp (CMS23.26%, Web16.31%); không dùng tổng test để nói toàn bộ UI đã coverage.
- US-010 browser real password/TOTP, không inject session/mock HTTP:4/4 nhóm PASS, 10 ảnh desktop/mobile/VI/EN; actual source upload/extraction/citation, readonly reviewer, student preview deny, offline và stale412 giữ/export draft.
- Local migration `20261029030000_teaching_plans` đã chạy trên localhost55432; không production migration/deploy. US-010 được chuẩn bị commit trên nhánh feat/s03-teaching-plans theo chỉ đạo29/10/2026; chưa merge main phần S03.
- [Hồ sơ AC và ảnh](../acceptance/2026-10-29-US010/REPORT.md). Human content/UAT sign-off chưa thực hiện.

## Bước tiếp nối trong S03

US-011: durable AI plan jobs, prompt/provenance/input hashes, scoped context, quota reservation/usage-unknown reconciliation, diff/apply If-Match. Provider disabled mặc định; chưa gửi tài liệu ra ngoài. US-012: human findings/disposition, submit/reject/approve gắn content hash, independent reviewer và invalidation khi draft đổi; chưa có publish giáo án. Không đánh dấu exit S03 chỉ từ US-010.

## Merges đã đẩy remote

| Repo | main sau merge S02 |
|---|---|
| backend-nestjs | d9a5a3d |
| arc-academy-backend | 103f96b |
| arc-academy-cms | 5fba9bd |
| arc-academy-web | 26232e2 |


## Quy tắc lưu hồ sơ

Theo chỉ đạo mới29/10/2026: shared docs/specs/stories/report/evidence chỉ tồn tại tại backend-nestjs/docs/upgrade-3-repos. `docs/upgrade` trong ba repo Academy là symlink đọc tương thích; không viết script sao chép report. Hồ sơ US-010 là evidence trước commit; SHA nền và working fingerprint trong hồ sơ được giữ nguyên để không sửa lịch sử nghiệm thu.
