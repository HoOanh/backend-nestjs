# Arc Irobot Academy — kế hoạch theo phase và sprint

**DRAFT 0.2 · 27/10/2026 · G0 đóng, chưa được setup hoặc code.**

Ba repo đích: **arc-academy-backend · arc-academy-cms · arc-academy-web**. Đây là tên thiết kế; chưa rename/tạo/chỉnh repo thật.

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

ĐẠI CA duyệt BRD, kiến trúc, SRS, stories, specs và bộ chuẩn trước G0. Thiết kế chi tiết bổ sung cho sprint nào cũng phải được duyệt trước code sprint đó. Không tự install skill/dependency, scaffold, codegen, đổi cấu hình repo, migrate hay deploy từ yêu cầu chỉnh tài liệu này. Không commit/push tự động.

Nguồn nội bộ: MVP `/Users/hominhoanh/Documents/source/backend-nestjs`, khảo sát HEAD `25eae35`; kế hoạch đính kèm và phản hồi scope của ĐẠI CA. Nguồn kỹ thuật/skill chính thức được ghi ở [research](standards/SKILLS-RESEARCH.md).
