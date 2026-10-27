---
name: "arc-frontend-workspaces"
description: "Build or review approved Academy CMS authoring screens and Next.js learner workspaces with shadcn, typed generated clients and correct private state boundaries. Use for feature UI work, not document-only planning."
---

# Academy frontend workspace workflow

DRAFT 0.2; staged only. Apply [coding rules](../../CODING-RULES.md) and the affected approved sprint; preserve the approval boundary. Copy referenced guidance locally when installing.

- Distinguish CMS authoring from Web learning and server from browser code. Keep feature composition outside core and use known module manifests for routes/navigation.
- Use shadcn, semantic Tailwind tokens, lucide and existing form primitives. Keep large editors addressable with a URL and show unsaved/saving/offline/conflict states accurately.
- Use generated adapters and scoped Query keys; clear private state on identity change. Preserve ETag conflicts and do not display success before a durable acknowledgment.
- Enforce route/page/button capabilities for UX while relying on backend authorization; direct links and stale permission state require failure handling.
- Reuse the Web lecture renderer for CMS preview. Browser Canvas/Three/audio/ONNX is lazy/client-only with cleanup, not forced into generic CSS rules.
- Check the core task flow, keyboard/focus/alt/captions and relevant loading/error/permission/conflict states. Avoid implementation-mirroring tests and decorative complexity unrelated to the learning task.
