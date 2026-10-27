# Backend supplement — arc-academy-backend

DRAFT 0.2, dùng kèm shared template sau duyệt.

- NestJS modular monolith, DB/metadata/source refs/AI quota/session là nguồn sự thật; API là interface, không tên repo.
- Controller/DTO→policy/use case→repository, context khác chỉ qua public interface; transaction ngắn, audit/outbox atomic.
- Source/plan/visual/package schema có version, citation resolve, ETag/CAS/idempotency theo spec.
- Hai OpenAPI audience, stable DTO/error/security, student không chứa private schemas/answer keys.
- Backend contract change kèm spec/export/consumer codegen/drift/API smoke; generated files không sửa tay.
- Jobs có durable state/retry/dedup; provider timeout usage unknown; no arbitrary document network fetch.
- Integration Postgres/Redis và negative ownership/permission/version tests; model mocks cho determinism, provider smoke riêng có duyệt.
