---
name: frontend-ui-engineering
description: Enforce production-grade Frontend UI/UX engineering standards with Tailwind CSS v4, lucide-react, clsx, and tailwind-merge, eliminating raw CSS bloat and AI-slop aesthetics across Arc Irobot Academy. Use this skill whenever creating, refactoring, or styling React components, layouts, dashboards, or interactive workspaces in src/components/.
---

# Frontend UI/UX Engineering & Anti-AI-Slop Skill

## 1. Core Mandate: Eliminate Raw CSS Bloat & AI-Slop Aesthetics
All UI/UX work in this repository MUST adhere to a **Linear / Vercel / Raycast / JetBrains IDE** engineering aesthetic using **Tailwind CSS v4 (`@tailwindcss/vite`)**.

### Strictly Forbidden (AI Slop & Raw CSS Anti-Patterns)
- **NO New Raw `.css` Files for Components**: Use **Tailwind CSS v4** utilities mapped via `@theme inline` in `src/index.css` (`bg-app`, `bg-surface`, `bg-surface-elevated`, `bg-surface-subtle`, `border-subtle`, `border-strong`, `text-primary`, `text-secondary`, `text-muted`, `bg-accent`, `text-accent`).
- **NO Neon Purple/Pink Gradients**: Never use `linear-gradient(135deg, #8b5cf6, #ec4899)` or arbitrary glowing shadows (`box-shadow: 0 0 20px #ec4899`).
- **NO Emoji or Unicode Hacks as UI Icons**: Never use `✦`, `🎤`, `🔊`, `🔈`, `⊞`, `●` as icons. Always import crisp vector icons from **`lucide-react`**.
- **NO Context-Blind Sidebars or Topbars**:
  - When on the **Academy Hub (`/courses`, `/roadmaps`)**, the Sidebar must show **Academy Hub Navigation & Enrolled Courses**, NEVER a single course's chapter/lesson tree.
  - Lesson-specific tools (`Học 1-1 Với AI`, `Trợ Giảng AI`) must ONLY appear in the Topbar when studying inside a Lesson Workspace (`route.type === 'lesson'`).

---

## 2. Standard Frontend Stack
Always use the installed packages in `package.json`:
1. **`tailwindcss` + `@tailwindcss/vite`**: Utility-first styling with semantic dark/light theme tokens (`bg-surface`, `border-subtle`, `text-primary`, `text-secondary`, `bg-accent`).
2. **`lucide-react`**: Standardized 1.75px–2px stroke icons (`size={14}` to `size={18}`).
3. **`clsx` / `tailwind-merge`**: Clean conditional class composition.
