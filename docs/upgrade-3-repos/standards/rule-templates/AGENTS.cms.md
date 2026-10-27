# CMS supplement — arc-academy-cms

DRAFT 0.2, dùng kèm shared template sau duyệt.

- Authoring workspace phục vụ course/content/document/plan/visual/review/room; không thêm CRUD ngoài core tự phát.
- Feature modules trên core, TanStack Router registry/Query/generated services, shadcn/Tailwind/lucide.
- Editor autosave có unsaved/saving/saved/offline/conflict; If-Match stale không overwrite; apply AI cần diff/review.
- Preview renderer thuộc Web; không dựng bản engine/grammar thứ hai ở CMS.
- Permission page/route/button và private Query cache scope, API server vẫn authoritative.
- Test create→attach/extract→plan→visual→preview/review/publish và direct URL unauthorized, accessibility editor.
