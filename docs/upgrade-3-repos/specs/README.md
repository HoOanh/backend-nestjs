# Specs xuyên sprint

DRAFT 0.2 · Dùng chung cho cả Backend/CMS/Web; thiết kế lát cắt ở `../phases/Pxx-*/sprints/Sxx-*/specs.md`.

| ID | Spec | Phạm vi |
|---|---|---|
| SPEC-01 |[Content/tài liệu/giáo án](01-CONTENT-DOCUMENTS.md)|Khoá/bài/source revisions/extract/AI authoring/review |
| SPEC-02 |[Bài giảng đồ hoạ](02-GRAPHICS-LECTURES.md)|Visual grammar/storyboard/narration/preview/publish |
| SPEC-03 |[Lớp AI 1-1](03-CLASSROOM-AI.md)|Room/session/conversation/checkpoints/progress/cohort |
| SPEC-04 |[Platform/contracts](04-PLATFORM-CONTRACTS.md)|Identity/access/modules/OpenAPI/queue/quota |
| SPEC-05 |[Migration/chất lượng/ops](05-MIGRATION-QUALITY.md)|Legacy scope/tests/privacy/restore/cutover |

Không có spec thi/chứng chỉ nâng cao hay domain ngoài core. Spec API dùng alias `P=/api/p/v1`, `I=/api/i/v1`; từ API chỉ giao diện backend, không tên repo. Các payload được mô tả bằng fields/constraints, chưa phải code/DTO đã sinh. Field-level DTO catalog được refine và duyệt cùng sprint trước implementation.
