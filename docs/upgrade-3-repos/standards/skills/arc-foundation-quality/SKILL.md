---
name: arc-foundation-quality
description: Harden or review Academy foundation, architecture rules, MCP configuration and quality gates across backend, CMS and learner web. Use before extending an unstable foundation.
---

# Foundation quality

- Read repository AGENTS.md and the current foundation amendment in docs/upgrade/implementation. Current user authorization takes precedence over historical sprint gates. Stay within foundation fixes.
- Inspect actual package scripts, CI and tests before claiming a gate exists. Run `pnpm quality:check`, build, then relevant HTTP/browser checks. Report failed or unrun checks accurately.
- Test meaningful boundaries: invalid input, missing/foreign identity, stale permissions, session isolation, contract audience leakage; UI keyboard labels, loading/error/empty states, mobile overflow and locale retention.
- Frontend is light-only with shared brand tokens, including native controls/toasts/SSR metadata. Reuse shadcn registry components in core/ui; semantic HTML remains appropriate for document/layout structure. Use frontend-design for visual choices and arc-frontend-workspaces for architecture.
- Project MCP is in .codex/config.toml. Run `pnpm mcp:check` to verify initialize, tool inventory and registry lookup; a config file alone is not proof of connectivity. Backend uses lookup only, never frontend runtime dependencies. If client has not loaded changed config, report reload needed separately from transport validation.
- Coverage reports must include untested application files. Generated code can be excluded; business code cannot. Record baseline honestly before setting enforceable thresholds; critical auth remains integration-gated. No fake confidence from mocked tests.
- Keep generated clients untouched, no explicit TypeScript any, no auto commits; branch prefix feat/ or fix/. Preserve existing work.
