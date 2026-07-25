---
description: Worthlog project rules
alwaysApply: true
---

# Worthlog project rules

- Worthlog is a small self-hosted investment value logging application.
- Keep the architecture simple and maintainable.
- Do not add authentication.
- Do not add cloud services.
- Do not add external financial APIs.
- Use React, TypeScript, Vite, Express and SQLite.
- Use npm workspaces with `client` and `server`.
- Store monetary values as integer cents.
- Use ISO date strings in `YYYY-MM-DD` format.
- Use strict TypeScript.
- Validate all API input with Zod.
- Use parameterized SQL statements.
- Do not use mock data after the database layer is implemented.
- Preserve historical data when categories are archived.
- The UI language must be English.
- The default currency is EUR.
- The UI is desktop-first and does not need full mobile support.
- Use accessible buttons, labels, dialogs and focus states.
- Use CSS variables for light and dark themes.
- Do not introduce a component framework unless strictly necessary.
- Keep dependencies limited.
- Every completed phase must pass linting, type checking, tests and builds.
- Never silently ignore errors.
- Add helpful empty states and validation messages.