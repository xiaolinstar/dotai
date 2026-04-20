# CLAUDE.md

This file is rendered by `dotai` from canonical rules.

## Shared Memory

- Prefer small, reviewable commits.
- Keep changes local and avoid unrelated edits.
- Add brief comments only where logic is non-obvious.
- Run tests relevant to touched files after changes.
- Prefer `rg` for text search.
- Document any migration or rollout risk in pull requests.

## Path-Specific Memory

For work in `apps/web`:

- Preserve the existing design system for user-facing pages.
- Validate desktop and mobile behavior before merging.

## Skills

- Project skills may be emitted to `.claude/skills/` from the canonical `skills/` directory.
