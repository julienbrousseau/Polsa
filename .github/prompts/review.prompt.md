---
description: "Review a branch or set of changes for correctness, security, and conventions"
mode: agent
---

# Code Review

You are reviewing changes in **Polsa**, a personal finance Electron app.

## What to review

Review the current branch's diff against `main`. Run:

```bash
git diff main...HEAD
```

## Checklist

### Correctness
- [ ] Money is stored/computed as integers (cents), never floats
- [ ] Running balances are computed correctly
- [ ] Date handling: stored ISO 8601, displayed `dd/MM/yyyy`
- [ ] Categories respect the two-level hierarchy
- [ ] Edge cases: zero amounts, negative balances, empty descriptions

### Security
- [ ] All SQL uses parameterised queries (no string interpolation)
- [ ] IPC handlers validate and sanitise input on the main-process side
- [ ] No `eval()`, `new Function()`, or `nodeIntegration: true` in renderer
- [ ] File paths for QIF import/export are validated

### Database
- [ ] New migrations are additive — existing migration files unchanged
- [ ] Indexes added for new query patterns
- [ ] Foreign keys maintained

### Performance
- [ ] Transaction queries are paginated
- [ ] No N+1 query patterns
- [ ] Running balance not recomputed from scratch on every render

### Tests
- [ ] New features have corresponding tests
- [ ] Monetary edge cases covered
- [ ] Tests pass: `npm test`

### Style & conventions
- [ ] Verb-prefix commit messages
- [ ] Feature branch (not committing to `main`)
- [ ] Code is consistent with existing patterns

## Output

Provide a summary with:
1. **Pass / Needs changes** verdict
2. List of issues found (with file and line references)
3. Suggestions for improvement (non-blocking)
