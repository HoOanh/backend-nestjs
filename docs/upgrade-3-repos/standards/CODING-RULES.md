> Chỉ đạo 28/10/2026: light-only, shadcn registry/MCP, rules/skills và coverage gates theo [Foundation quality](../implementation/FOUNDATION-QUALITY.md). Chưa mở sprint tính năng mới.

# Coding rules — dự thảo chung

DRAFT 0.2 · Review trước setup, enforce trong S01 sau duyệt.

## 1. Ngôn ngữ, types và boundary

- TS strict; cấm `any`. Dữ liệu HTTP/file/DB-JSON/AI/worker là `unknown` rồi runtime validation; không `as T` để bỏ validate. Union discriminated cho visual/event/job states; exhaustiveness có chủ ý khi schema version tăng.
- Không tắt strict/lint/file-wide để làm build xanh. Ngoại lệ bất khả kháng phải nêu file/lý do/phạm vi và được ĐẠI CA duyệt, không tự allowlist.
- Identifier/code tiếng Anh, docs/comment giải thích nghiệp vụ tiếng Việt; giữ Prettier hiện hữu trong repo được duyệt, chưa chốt config mới ở S00. Không format hàng loạt file không thuộc task.
- Source chia theo feature/use case; không giới hạn dòng cứng khiến split vô nghĩa, không mega service trộn content/AI/session. Generated/fixtures không áp heuristic file size như source thủ công.

## 2. Backend/data

- Controller/DTO chỉ boundary, policy/service sở hữu invariant; transaction ngắn, không gọi provider trong DB transaction. Module dùng public interface, không import repository nội bộ module khác.
- Validate ownership/action/module/state trên server. SQL constraints cho unique/FK/version race; Redis lock không thay DB correctness. Revoke quyền phải có negative integration test.
- OpenAPI explicit DTO/error/security, stable operationId,2audience/schema closure; không expose private source/answer keys. Update contract + consumer codegen + API smoke collection cùng feature sau duyệt.
- Mutation quan trọng idempotent; business+audit+outbox transaction; worker at-least-once dedup/retry bounded. Preserve unknown usage khi provider timeout.
- Immutable published package/source revisions, ETag draft; stale412/missing428, state409. Không silently last-write-wins hoặc overwrite legacy input.

## 3. CMS/Web UI

- React functional components, shadcn/Tailwind semantic tokens, lucide-react, clsx/tailwind-merge. Không emoji icon, neon gradient trang trí, raw component CSS mới; global theme/font tokens có owner. Canvas/Three numeric geometry/timing không buộc viết thành Tailwind classes.
- CMS TanStack Router module registry; Query là server-state, query key chứa actor/scope/revision/params; URL state cho filter/page; view không tự gọi raw HTTP. Cache clear khi account/permission đổi.
- Web server/client boundary rõ; private server fetch no-store, cookie forwarding allowlist; không import browser/audio/ONNX vào RSC. Classroom dynamic/lazy, dispose audio/worker/RAF/WebGL theo lifecycle.
- Page/route/button permissions hỗ trợ UX, API vẫn quyết định. Editor nhiều bước có URL, unsaved/saving/offline/conflict/saved state; không toast thành công trước ack.
- A11y focus/keyboard/alt/captions/reduced motion. SSR/student payload không hidden answer/source metadata private. Không copy duplicate renderer vào CMS.

## 4. Content/graphics/AI

- Dùng source revisions/spans thật, citation resolve; không giả page DOCX hoặc đoán nguồn từ model. Lesson objective→plan→visual→checkpoint phải trace được.
- Visual discriminants/schema+renderer version, semantic labels/relations, narrated beat IDs. Không arbitrary executable JS/SVG/HTML từ CMS/AI. Không ép mọi chủ đề vào cùng mindmap.
- AI artifact draft/schema valid/provenance, human apply/approve/publish; không update immutable snapshots. Test injection, cross-course source leakage, stale apply và provider failures.
- Browser playback không xác nhận mastery; server chấm answer. Offline event không ack là pending. Pin phiên bản và single writer session.

## 5. Tests, docs và scope

- Test invariant đáng giá: ownership, citation version, publication pin, ETag, quota race, idempotency, lease/resume, audio clock, cleanup/fallback. Không viết test chỉ assert implementation wording hoặc JSX snapshot toàn màn.
- Backend integration dùng Postgres/Redis có reset isolation; API smoke qua edge; FE unit/component+Playwright core demo, fixture providers và real browser smoke. Không gọi AI tính phí hoặc gửi email thật mặc định trong test.
- Generated code không sửa tay; CI regenerate clean, type/lint/build, contract diff; expand/contract migration, compatibility manifest cross-repo.
- Không thêm domain ngoài core; legacy ngoài scope giữ manifest/archive decision. Không commit/push/deploy hoặc setup khi approval chưa mở.

Nguồn hướng dẫn: xem SKILLS-RESEARCH.md. Các rule domain ở đây do mục tiêu sản phẩm quyết định, không gắn uy tín nguồn như bằng chứng chúng đã phù hợp runtime.


## Foundation rework rules

- Theo [FRONTEND-DESIGN](FRONTEND-DESIGN.md): logo/hash/palette từ MVP, copyright ARC Irobot, không nội bộ sprint/phase hoặc dữ liệu dựng sẵn trong UI.
- CMS `routes` file-based, plugin code split; manifest metadata không chứa view/route factory. Web route adapters vào feature; core không import feature/route/app.
- UI strings chỉ từ resources VI/EN có key/placeholder parity; format số/ngày qua locale. API/email action locale phải được truyền, không hardcode VI.
- `product:check`, lint boundaries, typecheck, unit/integration/browser theo phạm vi sửa. Output generated không sửa tay; ngoại lệ tool-generated casts của TanStack không cho phép application dùng any.
