# ARC Irobot — thiết kế giao diện và nhận diện

Chỉ đạo bổ sung của ĐẠI CA ngày 28/10/2026, áp dụng ngay cho foundation. Áp dụng nội dung skill `frontend-design` ĐẠI CA cung cấp; không dùng mặc định generic dashboard làm thiết kế sản phẩm.

## Hướng thiết kế

- CMS: content studio kỹ thuật, tinh gọn; nội dung và quy trình biên soạn là trọng tâm. Sidebar có ngữ cảnh, bố cục đậm nhạt rõ, danh sách/table khi cần mật độ dữ liệu; không biến mọi thứ thành card.
- Web: learning atlas, typography tiếng Việt rõ, bố cục bất đối xứng giữa thông điệp và sơ đồ phương pháp học. Sơ đồ minh hoạ phải được ghi rõ là minh hoạ, không giả là lớp học live.
- Giữ nguyên logo MVP `public/logo.png` theo byte. Mỗi repo giữ asset ở `public/brand/arc-irobot.png`; không vẽ logo khác, không dùng icon GraduationCap làm logo.
- **Light mode duy nhất** cho CMS/Web, độc lập OS preference/cookie cũ. App `#f1f5f9`, surface `#ffffff`, elevated `#f8fafc`, fg `#0f172a`, secondary `#475569`, muted `#64748b`, border `#e2e8f0`/`#cbd5e1`. Action blue `#0369a1`, hover `#075985`, chữ trắng; tăng contrast từ MVP `#0284c7`. Xanh lá logo giữ nguyên, không recolor.
- Không dark palette, `dark:` variants, theme toggle hay auto system theme. HTML, CSS color-scheme, Next viewport metadata và Sonner cùng light từ render đầu. Kiểm browser với cả OS light và dark, reload và switch VI/EN.
- Font self-host qua Fontsource, không request font CDN: Be Vietnam Pro (400/500/600, Latin + Vietnamese) cho nội dung; Space Grotesk cho nhãn/chi tiết đồ hoạ. Không thay font bằng Inter/system chỉ vì default template.
- Copyright hiển thị đúng `ARC Irobot`, năm hiện hành và bản dịch quyền tương ứng.
- Không P0/P1, S00/S01, scaffold, trạng thái sprint/roadmap nội bộ trong UI. Trạng thái nghiệp vụ thực như module hoạt động/chưa kích hoạt được hiển thị đúng.
- Không bịa khoá học, số chương/bài, KPI, room live, chứng chỉ, nút giả khi dữ liệu/chức năng chưa tồn tại. Empty state phải chỉ rõ thực trạng, không đẩy người học vào chức năng demo chưa có.
- Chuyển động có chủ đích, nhẹ, tôn trọng prefers-reduced-motion. Không neon/purple gradient, emoji icon, cards đồng loạt chỉ để lấp chỗ.
- Dùng component **từ registry shadcn thật**, không chỉ gọi wrapper tự viết là “shadcn-style”. `components.json` khai báo aliases và global CSS; `src/core/ui` sở hữu adaptations. MCP search → view/example → pinned CLI add → review diff → integrate/test. Tailwind semantic tokens, lucide-react, clsx/tailwind-merge. CSS global chỉ cho font, tokens, reset và motion nền tảng. SVG minh hoạ là code ngữ nghĩa, không logo mới.

## Ownership và kiểm tra

CMS `src/core/brand` sở hữu thiết kế UI; Web giữ snapshot cùng version, độc lập backend. `brand.manifest.json` pin SHA-256 logo/tokens. Không nhét palette vào package API contracts. Thay đổi brand cần cập nhật có chủ đích cả hai snapshot + manifest + tài liệu nguồn.

`pnpm product:check` chạy trên CI: kiểm tra hash, parity toàn bộ keys VI/EN và placeholders, cấm internal status/unrelated domain trong source UI. ESLint kiểm tra core không import ngược feature/route; typed route files sở hữu URL, không register component trong module manifest.

Kiểm tra browser gồm desktop/mobile 390px, logo, bản quyền, overflow, chuyển VI/EN và reload, link token giữ nguyên, private redirect, email/MFA/session thật. Screenshot review bổ sung cho test chức năng, không thay thế integration evidence.

## Nguồn tham khảo

- [frontend-design do ĐẠI CA chỉ định](https://github.com/anthropics/skills/blob/main/skills/frontend-design/SKILL.md).
- [TanStack file-based routing](https://tanstack.com/router/latest/docs/framework/react/routing/file-based-routing).
- [next-intl locale routing](https://next-intl.dev/docs/routing/setup).
- Logo/palette: source MVP local, không lấy bộ nhận diện từ dự án khác.

## Skill thiết kế đã chọn

Chọn bản gốc `anthropics/skills/skills/frontend-design` thay vì bản rút gọn dán trong chat. Snapshot commit `41bbe19d1a1a7eaab5e7bb9050a417e5c6cffc8f`, giữ license và hash trong `.agents/skills/frontend-design/upstream.json` trên CMS/Web. Bản hiện tại không còn giống nguyên văn bản rút gọn; đã tải và đọc source thật trước khi chọn.

Skill định hướng thiết kế; `arc-frontend-workspaces` quy định engineering; `arc-foundation-quality` quy định bằng chứng/gates. Academy giữ nhận diện thống nhất giữa các trang, light-only và nội dung đọc dễ; không đổi font/palette mỗi trang để tạo khác biệt. Tuân thủ ràng buộc Academy khi gợi ý aesthetic chung khác brief. Không bổ sung feature/screen chỉ để phô diễn component.

Button, Input, Label, NativeSelect, Card được lấy từ registry ngày 28/10/2026 bằng CLI 4.23.0; provenance và adaptations ở `ui-registry.manifest.json`. Language switch dùng shadcn DropdownMenu radio items, có keyboard navigation, selected state và focus return. HTML semantic cho article/section/form/layout được phép; native controls ở feature bị ESLint chặn.


Review UI auth: form noValidate + React Hook Form/Zod; lỗi dịch VI/EN cạnh trường, aria-invalid/aria-describedby và focus trường lỗi đầu tiên. Có password hint, show/hide password; auth layout giới hạn max-width, form trắng rõ ràng, không chia đôi trống toàn viewport. Kiểm cả empty submit, invalid email/password, menu mở, Escape và mobile trước kết luận UI đạt.

## Radix Themes — chỉ đạo thay thế 29/10/2026

ĐẠI CA xác nhận danh sách component tại Radix Themes docs là chuẩn UI duy nhất cho CMS và Web; thay thế các đoạn shadcn/registry ở trên. Dùng trực tiếp `@radix-ui/themes` và `Theme` light; không giữ shadcn wrappers, NativeSelect, Sonner hoặc các UI primitive tự dựng. Dùng Dialog/AlertDialog, Select, Tabs, Callout và các component được Radix Themes liệt kê. Semantic HTML và input file phục vụ chọn file vẫn cần thiết. Giữ brand, VI/EN, quyền, focus, mobile và kiểm thử browser.

## Shadcn theo Saora — chỉ đạo mới 29/10/2026

ĐẠI CA chỉ định `saora-web` làm tham chiếu setup shadcn, thay thế mục Radix Themes ngay trước. Dùng shadcn components trong `src/components/ui`, `cn` tại `src/lib/utils`, Radix Primitives và Sonner; giữ token/brand ARC, light-only. Không dùng `@radix-ui/themes` hoặc NativeSelect. Sidebar CMS dùng SidebarProvider/Sidebar/SidebarInset, kiểm keyboard, mobile và session/API; không copy nghiệp vụ của Saora. Các mục Radix Themes phía trên là lịch sử, không phải quy tắc hiện hành.

## Mẫu màn biên soạn — 29/10/2026

Rút ra từ nâng cấp [AUTHORING-UX](../implementation/AUTHORING-UX-2026-10-29.md); áp dụng cho các màn biên soạn CMS sau này (đồ hoạ S04, review US-012).

- Danh sách cấu trúc (chương/bài, phần giảng) là outline gọn: mỗi mục một dòng, trạng thái bằng Badge, hành động phụ trong menu ⋯. Không render toàn bộ form của mọi mục cùng lúc.
- Chi tiết một mục mở bằng Sheet bên phải (desktop/mobile) hoặc cột nội dung khi có dàn ý; luôn có đường xem/sửa lại mục đã lưu, không chỉ nút Thêm.
- Thêm nhanh bằng ô nhập inline + Enter. Thao tác phá huỷ dùng AlertDialog; thao tác bị nghiệp vụ chặn hiển thị disabled kèm lý do thay vì để API trả lỗi chung.
- Sắp xếp bằng `@dnd-kit` với tay nắm riêng, DragOverlay, KeyboardSensor và announcements i18n; commit một lần khi thả; giữ Lên/Xuống trong menu.
- Màn trống hướng vào hành động chính (vd. Tạo bằng AI / Tự soạn), không liệt kê mọi thiết lập. Thiết lập ít dùng (ngôn ngữ, xuất/nhập JSON, kiểm tra lại) gom vào menu ⋯.
- Panel phụ (AI, nguồn, kết quả kiểm tra) dùng Sheet; giữ nội dung trong lúc animation đóng.
- Mobile: danh sách chính dùng card/list thay table cuộn ngang; editor nhiều phần có thanh dính điều hướng trước/sau và dàn ý dạng Sheet; tiêu đề dài xuống dòng (line-clamp) thay vì cắt.
- Autosave hiển thị trạng thái bằng component dùng chung `SaveStatus`; điều hướng chủ động phải chờ lượt lưu đang chạy, không dựa vào closure render cũ.
