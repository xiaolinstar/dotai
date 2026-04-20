# AGENTS.md

This file is rendered by `dotai` from canonical rules.

## Shared Instructions

- Prefer small, reviewable commits.
- Keep changes local and avoid unrelated edits.
- Add brief comments only where logic is non-obvious.
- Run tests relevant to touched files after changes.
- Prefer `rg` for text search.
- Document any migration or rollout risk in pull requests.

## Path-Specific Notes

For files under `apps/web`:

- Preserve the existing design system for user-facing pages.
- Validate desktop and mobile behavior before merging.
