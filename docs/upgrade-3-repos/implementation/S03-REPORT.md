> Cập nhật29/10/2026 (US-012): review decision gắn hash, disposition finding, reviewer độc lập và invalidation khi draft đổi đã kiểm chứng local (backend HTTP/Postgres, CMS browser fixture). Chưa human sign-off, chưa commit/push; S03 chưa đóng. Report/spec/evidence chỉ ghi tại nguồn canonical này.

# S03 — Giáo án có cấu trúc

Ngày29/10/2026. ĐẠI CA chỉ đạo “commit rồi merge và thực hiện công việc tiếp theo”. S02 đã commit/fast-forward merge và push main ở cả4 repo. Bước tiếp theo: US-010 (AC-010-01..03), giáo án thủ công + lint + CAS + preview; US-011 AI provider và US-012 human review là bước tiếp nối, chưa kết luận hoàn thành toàn S03.

US-010 không bật provider hoặc gửi nguồn sang AI. US-011 được ĐẠI CA cho phép dùng Gemini/key MVP theo amendment bên dưới; vẫn không tự publish. Giữ20MiB/PDF100trang và author-only default. Nội dung mới chưa được con người ký nghiệm thu.

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

## US-011 — execution contract29/10/2026

ĐẠI CA yêu cầu “commit và làm tiếp theo”, rồi chốt “gemini, như của MVP đó m, có env key luôn r đó m”. Bắt đầu US-011; dùng Gemini API key từ môi trường MVP, giữ server-only, không ghi key vào Git/report/browser. Model mặc định theo MVP hiện hành `gemini-3.5-flash-lite`, configurable phía server; không fallback qua model khác khi lỗi/timeout.

- Input chỉ sourceRef IDs do tác giả chọn từ plan hiện hành (1–80), ready/attached/hash khớp, tối đa32000 UTF-8 bytes context. Source text là untrusted data trong user payload; system prompt cố định/versioned, không tools/network retrieval. Job pin plan version/hash, lesson inputHash, model/prompt/schema và inputHash. Tác giả xác nhận chọn nguồn trước khi gửi.
- POST lessons/id/plan-jobs + If-Match + Idempotency-Key UUID; scope theo actor/lesson/key. Cùng key khác request hash409, cùng key cùng input trả job cũ kể cả sau apply; quota không reserve lặp. Staff editor/admin only, ownership và permission authoritative.
- Daily quota token units UTC, env default100000/account/day; reserve upper bound bytes(prompt+schema+context)+maxOutputTokens8192 trước dispatch. Budget row lock serialize, không thu theo VNĐ. Usage thật từ provider; nếu overage vẫn ghi đúng usage và khoá các reservation tiếp theo khi budget hết.
- Durable DB job queued→dispatching→succeeded/failed/usage_unknown. Claim+lease atomic; provider call ngoài transaction; timeout/network/lease expired không auto retry gửi lại, giữ reservation unknown. Chỉ queued chưa dispatch có thể fail trước gửi và release. Provider response lỗi có usage thì settle theo usage, thiếu usage sau dispatch giữ unknown. Không tự giả reconcile về0.
- Artifact schema/UUID/citation identity/objective identity/size được validate; semantic lint findings được lưu và human_review_required luôn có. Prompt/model/version/provider requestID/inputHash/outputHash/usage provenance immutable. Source ngoài input hoặc nguồn bịa không thành artifact áp dụng được.
- Apply là hành động riêng, diff trước; expected version và base plan content/lesson hash/current sources đều phải khớp. Apply trong cùng transaction CAS + append-only revision + applied marker/audit; lặp apply trả revision đã áp dụng, không double apply. Draft không tự publish.
- CMS chọn nguồn, hiển thị quota/model/job status, artifact diff/nội dung hiện tại/đề xuất và findings. Offline/dirty/conflict không chạy/apply. UI đủ VI/EN; provider/timeout error không lộ raw provider body. Web tiếp tục renderer/preview hiện hành sau apply, không cần AI endpoint ở public contract.

Provider reference: [Gemini structured outputs](https://ai.google.dev/gemini-api/docs/generate-content/structured-output?hl=en). Live smoke chỉ dùng fixture kỹ thuật do em tạo; không lấy tài liệu thật ngoài scope.

## Commit US-010 và gom tài liệu

Đã commit theo chỉ đạo “commit và làm tiếp theo”: backend-nestjs772d69e, backendc3635ac, CMSa7e870b, Web782e31d. Không merge/push các commit này trong lượt chỉ yêu cầu commit. Ba cây docs/upgrade bản sao (~1.7MiB working tree) được thay bằng symlink cùng nguồn chuẩn; report riêng Web được chuyển về canonical và amendment khác biệt được giữ đúng phạm vi. Không rewrite Git history.

US-011 đang thực hiện trên nhánh feat/s03-teaching-plans, chưa commit. Quality backend85 tests PASS (53HTTP/integration), statement83.58%, branches65.18%, functions79.26%, lines85.70%; CMS quality/build PASS. Live Gemini kiểm sau các gate local, evidence ghi duy nhất tại acceptance/2026-10-29-US011.

Worker claim theo model đã pin, không dispatch job model khác; qualification script luôn tắt provider thật và xoá key khỏi môi trường con. Integration dùng model fixture riêng; live smoke có opt-in riêng. Khi đổi model ở cấu hình, queued jobs model cũ cần worker đúng model, không tự fallback. Gemini transport dùng responseFormat JSON Schema; bỏ bớt constraint ở schema gửi provider để tránh schema quá phức tạp, nhưng local Zod/UUID/hash/ownership/citation validation không giảm.

### Ràng buộc đầu ra Gemini

Prompt `arc-plan-authoring-2`: Gemini chỉ trả sections/narration/visual intent/checkpoints và tham chiếu trong enum đã chọn; server sinh UUID section/checkpoint và gắn locale/objectives/source identities từ immutable input. Không “sửa cho qua” UUID/hashes bịa của model. Local wire schema, source/objective allowlist và canonical plan schema vẫn validate trước lưu artifact. Worker từ chối prompt version không còn được hỗ trợ trước dispatch, không ghi provenance version cũ cho prompt mới.

## Kết quả cuối US-011

- Backend quality + build PASS:86 tests (53HTTP/integration), statements83.73%, branches65.45%, functions79.80%, lines85.85%. Controlled provider tests tách khỏi live model và qualification luôn tắt provider thật. OpenAPI public/internal/preview schema closure + export drift PASS, CMS codegen drift PASS;66 Bruno templates (manual collection chưa chạy).
- CMS quality/build PASS:38 unit tests +4 rule checks. Web renderer dùng production build hiện hành; browser harness typecheck/format PASS. Không suy luận coverage frontend cao từ các số test.
- Browser thực:5/5 E2E trong21.3giây,14ảnh; gồm4 US-010 regressions và1 Gemini live flow. Model gemini-3.5-flash-lite, prompt arc-plan-authoring-2, usage780token, version6→7, replay không tăng version. Preview không answerKey, không tự publish.
- DB snapshot read-only xác nhận used780/reserved0, revision7, coursePublication0. UI quota polling5giây; ảnh ngay sau artifact ready có thể còn counter cũ trong khoảng này.
- [Báo cáo/testcase/ảnh US-011](../acceptance/2026-10-29-US011/REPORT.md). Những run trung gian thất bại và thay đổi wire contract/harness đã ghi trong hồ sơ; không đánh dấu chúng PASS.
- Migration plan AI chỉ chạy localhost55432. Gemini key dùng private .local/gemini.env, không đưa vào Git/report/client. Chưa production/deploy; chưa human content sign-off hoặc US-012. US-011 mới đang working tree, chưa commit.

## Nâng cấp UX biên soạn 29/10/2026

ĐẠI CA phản hồi khoá học khó dùng, không thấy cách xem/sửa bài đã soạn, giáo án rườm rà; chốt Outline + Sheet, AI-first, cho thêm API, rồi kéo-thả/mobile/danh sách/docs. Backend thêm `GET courses/:id/teaching-plans` và `GET teaching-plans/coverage` (không migration); CMS làm lại danh sách khoá, editor khoá học (tab, outline, Sheet, dnd-kit), editor giáo án (dàn ý, panel AI chọn tài liệu và tự lưu sourceRefs, lỗi nhảy vị trí, thanh mobile). Không đổi AC; ràng buộc UX ghi tại specs UX-S03-01..06.

Backend e2e teaching-plans 6/6, api/bruno(87)/typecheck/lint PASS; CMS quality/build PASS, 64 unit, 26/26 browser (fixture). Lượt đầu khi máy tải nặng 24/26 do timeout, được giữ log riêng, không tính PASS. Chưa chạy lại với backend/Gemini thật, chưa commit. [Chi tiết](AUTHORING-UX-2026-10-29.md) · [Evidence](../acceptance/AUTHORING-UX-2026-10-29/REPORT.md).

## US-012 — Review giáo án và kiến thức

ĐẠI CA chỉ đạo “check tiến độ và thực hiện công việc tiếp theo”; hạng mục còn lại của S03 là US-012. Đã triển khai local, không commit/push/deploy, không publish giáo án. Contract: `teaching_plan_review` bất biến theo revision/hash/findings, submit idempotent theo revision, decision If-Match + contentHash, reviewer độc lập (không phải chủ khoá/tác giả/người gửi), approve phải disposition đủ mọi finding với note, rule nguồn/lesson không waive, approval invalid ngay khi plan/lesson/source đổi. Audit trong transaction; trigger DB chỉ cho `pending → approved|rejected` một lần. Queue duyệt chỉ trả bản đúng revision hiện hành và không trả bản của chính reviewer.

- Backend: migration `20261029110000_plan_reviews` (local `localhost:55433`), 4 endpoint review, OpenAPI internal 60 paths, 91 Bruno templates. Quality PASS: 116 tests/18 suites, gồm HTTP/Postgres e2e thật, statements 85.17%, branches 67.26%, functions 83.18%, lines 87.42%.
- CMS: panel duyệt trong plan editor (trạng thái, submit, approve/reject, disposition từng finding), route + queue `/reviews` cho `content:lesson:review`, VI/EN. Quality/build PASS, 68 unit tests, 31/31 browser (thêm 5 scenario US-012). Application statements 33.05%, không dùng số test để tuyên bố coverage UI.
- Đã chạy thêm full-stack thật local: editor gửi duyệt bằng mật khẩu thật → reviewer độc lập duyệt sau disposition; DB `approved`, đúng version/contentHash/disposition, audit submit+approve. Ảnh/log trong acceptance. Script full-stack là tạm, không commit.
- Evidence: [acceptance/2026-10-29-US012](../acceptance/2026-10-29-US012/REPORT.md). Browser dùng HTTP fixture, chưa chạy UI với backend thật; chưa có reviewer người thật ký nghiệm thu nội dung. AC-012-03 được enforce bằng approval validity + chặn decision revision mới, không tuyên bố publish vì S03 chưa mở publish.
