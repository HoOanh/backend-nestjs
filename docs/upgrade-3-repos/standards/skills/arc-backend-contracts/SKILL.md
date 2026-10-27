---
name: "arc-backend-contracts"
description: "Design or implement an approved Academy backend feature touching DTOs, authorization, content schemas, OpenAPI or generated clients. Use for contract changes; excludes unrelated repository chores."
---

# Backend feature and contract workflow

DRAFT 0.2; staged only. Do not implement before approval. Consult [platform spec](../../../specs/04-PLATFORM-CONTRACTS.md) and the relevant domain/sprint spec; keep references local after install.

- Identify the business invariant, owning module and staff/student audience. Actor comes from session; enforce action, ownership/assignment, module and resource state at the server.
- Validate external input from unknown, preserve strict types and immutable revision semantics. Do not leak private source/answer fields through DTOs or generated schema closure.
- Keep business state, critical audit and outbox atomic; asynchronous side effects are at-least-once with durable deduplication. Do not hold DB transactions across AI calls.
- Update explicit response/error DTOs and stable operation IDs; export/review the audience specs and regenerate affected consumer clients rather than manually editing generated code.
- Test the meaningful invariant/race/permission cases plus a request through the real API boundary. A mocked service call is not proof that cookie, DTO and authorization integration work.
- Record compatible backend/contracts/CMS/Web versions and migration expand/contract needs. Do not silently widen scope or auto-commit to complete the workflow.
