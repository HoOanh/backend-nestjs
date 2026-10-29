# Web learner UI + mật khẩu 8 ký tự — 28/10/2026

Phạm vi: chỉ giao diện learner-facing của `arc-academy-web`. CMS không sửa theo chỉ đạo. Backend chỉ sửa DTO mật khẩu tối thiểu để FE và API cùng contract 8 ký tự.

## Thay đổi

- Landing `/` được làm lại theo hướng "learning atlas": hero bất đối xứng, `LearningAtlas` tương tác (5 điểm trên đường đi, `aria-pressed`, caption `aria-live`, có bản mobile dạng danh sách), section 3 lớp học, minh hoạ cấu trúc bài học, FAQ native `<details>`, CTA và footer đầy đủ. Minh hoạ được ghi rõ "MINH HOẠ", không giả khoá học/KPI/chứng chỉ.
- Auth: `AuthFrame` mới có panel giới thiệu phương pháp, form card rõ hierarchy; thêm trạng thái thành công, token thiếu/hết hạn, nút Google theo env, link quay lại. Giữ `noValidate`, lỗi dịch VI/EN, focus lỗi đầu, show/hide password.
- Dashboard/learn shell: empty state trung thực, danh sách năng lực sẽ xuất hiện, header có người dùng và link về học viện; không bịa khoá học hay tiến độ.
- Mật khẩu: schema FE còn `8–128`; hint/validation VI/EN cập nhật "ít nhất 8 ký tự"; unit test biên 8/7; e2e đổi assertion. Backend `auth.dto.ts` hạ `MinLength(12)` → `8` cho Login/Reset để 8 ký tự thực sự qua API. `AUTH-UI-REVIEW.md` ở cả hai repo đã ghi nhận contract mới.
- VI/EN parity 199 message key; light-only; logo, palette, token hash không đổi. Không thêm dependency hay component registry mới; tái dùng `src/core/ui`.

## Bằng chứng

- `pnpm quality:check` exit 0: foundation, format, lint, typecheck, coverage, product, api, rules.
- `pnpm build` pass.
- Playwright 6/6 pass trên production build: smoke (3), auth-ux (1), light-theme (2); desktop 1280 và mobile 390 trong test, screenshot bổ sung 1024/1440; VI/EN; OS light và dark.
- Backend `pnpm typecheck` pass; `jest` 12/12 pass; kiểm DTO bằng `class-validator`: 8 ký tự pass, 7 ký tự bị chặn ở `password`, `ResetDto` 8 ký tự pass.
- Coverage tổng 16.05% lines / 55% functions. Phần UI mới chủ yếu được kiểm bằng browser flow; không gọi số test pass là coverage.
- Screenshot: `.local/screenshots/final-home-vi.png`, `final-home-mobile-vi.png`, `final-home-1024b.png`, `final-register.png`, `final-register-mobile.png`.

## Giới hạn / việc còn lại

- Chưa chạy `ARC_FULL_STACK_TEST=1` vì backend/worker/CMS/Mailpit local không bật; do đó đăng ký 8 ký tự qua API thật chưa được chứng minh end-to-end, mới kiểm contract + typecheck + browser validation.
- CMS vẫn dùng hint/schema 12 ký tự (không sửa theo chỉ đạo). Nếu nhân sự đặt mật khẩu 8–11 ký tự qua backend mới, CMS sẽ cần đồng bộ sau.
- Không commit/push/deploy.
