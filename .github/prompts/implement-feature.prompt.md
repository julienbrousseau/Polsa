---
description: "Implement a feature from the spec, with DB migration, tests, and UI"
mode: agent
---

# Implement Feature

You are implementing a feature for **Polsa**, a personal finance Electron app.

## Steps

1. **Read the spec** — Open [spec.md](../../spec.md) and identify the exact requirements for the feature described by the user.
2. **Check the current phase** — Only implement features from the current development phase unless explicitly told otherwise.
3. **Create a feature branch** — `git checkout -b feat/<feature-name>` from `main`.
4. **Plan the implementation** — Before writing code, outline:
   - DB schema changes needed (new migration file)
   - IPC handlers (main process)
   - UI components (renderer process)
   - Shared types
5. **Implement** — Write the code following AGENTS.md conventions. Key reminders:
   - Money as integers (cents)
   - Parameterised SQL queries
   - Validate IPC inputs on the main-process side
   - Paginate transaction queries
6. **Write tests** — Unit tests for business logic, especially monetary calculations.
7. **Run tests** — `npm test` must pass before considering the feature done.
8. **Commit** — Use verb-prefix messages: `Add …`, `Fix …`, etc.

## Constraints

- Do not modify existing migration files — create new ones
- Keep the UI consistent with the dark cybernetic theme
- Dates stored as ISO 8601, displayed as `dd/MM/yyyy`
