> Chỉ đạo 28/10/2026: light-only, shadcn registry/MCP, rules/skills và coverage gates theo [Foundation quality](implementation/FOUNDATION-QUALITY.md). Chưa mở sprint tính năng mới.

# Arc Irobot Academy — kế hoạch theo phase và sprint

**Baseline 0.2 · S00/S01 đã được ĐẠI CA cho phép thực hiện; cập nhật28/10/2026.**

[Đọc báo cáo S00/S01 và evidence](implementation/S01-REPORT.md). Phần mô tả chưa setup dưới đây thuộc baseline trước triển khai; trạng thái hiện hành theo báo cáo execution, không suy ra đã hoàn thành các sprint tiếp theo.

Ba repo đích: **arc-academy-backend · arc-academy-cms · arc-academy-web**. Ba repo local đã được khởi tạo trên feat/foundation; chưa commit/push/remote.

Trục sản phẩm: **content/tài liệu → khoá học → giáo án → bài giảng có đồ hoạ → lớp AI 1-1 → trao đổi với AI → tiến trình và cải thiện bài giảng**.

## Điểm bắt đầu

1. [Roadmap các phase/sprint](ROADMAP.md): thứ tự, dependency, phạm vi 3 release và effort.
2. [Baseline sản phẩm](baseline/02-BRD.md), [kiến trúc](baseline/03-ARCHITECTURE.md), [SRS](baseline/04-SRS.md): phần dùng chung, không sao chép vào từng sprint.
3. [Phase 00 — chuẩn hoá trước setup](phases/P00-definition/README.md): tài liệu, rule, skill và approval.
4. [Bộ chuẩn/rule/skill](standards/README.md): bản dự thảo để duyệt, chưa cài vào repo mới.
5. [Stories toàn dự án](user-stories.json), [ma trận truy vết](TRACEABILITY.md), [specs dùng chung](specs/README.md).
6. [Sổ quyết định và duyệt](baseline/06-DECISIONS-APPROVAL.md).

## Tổ chức hồ sơ

- `baseline/`: BRD, kiến trúc, SRS, hiện trạng và quyết định chung.
- `phases/Pxx-*/README.md`: mục tiêu phase, đầu vào/đầu ra và gate.
- `phases/Pxx-*/sprints/Sxx-*/README.md`: mục tiêu sprint, Backend/CMS/Web tasks, dependencies, effort và demo.
- Mỗi sprint có `specs.md` thiết kế lát cắt và `user-stories.json` chứa đầy đủ story/AC của sprint. `user-stories.json` gốc là nguồn chuẩn; bản theo sprint phải đồng bộ cùng phiên bản.
- `specs/`: invariant/schema/protocol xuyên nhiều sprint; sprint specs tham chiếu và bổ sung phần riêng.
- `standards/`: coding rules, rule templates và skills draft, nguồn nghiên cứu.

## Phạm vi ba release

| Release | Giá trị sản phẩm | Sprints |
|---|---|---|
| R1 | Một luồng hoàn chỉnh từ tài liệu đến bài giảng đồ hoạ và phiên AI 1-1 có hỏi đáp/resume | S01–S06 |
| R2 | Tăng chất lượng đồ hoạ/giáo án, cá nhân hoá tương tác, quản lý lớp và theo dõi từng học viên | S07–S09 |
| R3 | Chuyển đổi dữ liệu đủ scope, chuẩn hoá chất lượng, hiệu năng và vận hành production | S10–S11 |

S00 là chuẩn bị/duyệt, nằm trước mọi release implementation. Thanh toán không thuộc cả R1/R2/R3 và không có backlog thực hiện trong hồ sơ này.

Bản 0.2 thay baseline 0.1; release assignment, story IDs và effort của 0.1 không còn dùng lập kế hoạch. Chưa bản nào được duyệt; mọi story mới vẫn draft/not_started. Không giữ bản cũ cạnh kế hoạch mới để tránh triển khai nhầm scope.

## Ràng buộc trước khi làm

ĐẠI CA duyệt BRD, kiến trúc, SRS, stories, specs và bộ chuẩn trước G0. Thiết kế chi tiết bổ sung cho sprint nào cũng phải được duyệt trước code sprint đó. Quyền thực hiện S00/S01 đã được cấp bằng chỉ đạo tiếp theo trong chat; không tự mở rộng thành production deployment hoặc thay scope đã chốt. Không commit/push tự động.

Nguồn nội bộ: MVP `/Users/hominhoanh/Documents/source/backend-nestjs`, khảo sát HEAD `25eae35`; kế hoạch đính kèm và phản hồi scope của ĐẠI CA. Nguồn kỹ thuật/skill chính thức được ghi ở [research](standards/SKILLS-RESEARCH.md).


Review bổ sung của ĐẠI CA: [Foundation rework — kiến trúc/i18n/brand/UI](implementation/FOUNDATION-REWORK.md).

## Nguồn duy nhất cho shared docs/report

Chỉ lưu specs/stories/report/ảnh/evidence của chương trình tại thư mục này. Ba repo Academy dùng symlink `docs/upgrade` trỏ về đây trong workspace; không copy hoặc đồng bộ report ra từng repo. Khi checkout độc lập, đọc bản chuẩn trên GitHub. Không rewrite lịch sử Git để xoá các bản sao cũ. Tài liệu riêng Web đã chuyển vào implementation/WEB-MARKETING-UI.md, các amendment riêng được hợp nhất có ghi phạm vi.
