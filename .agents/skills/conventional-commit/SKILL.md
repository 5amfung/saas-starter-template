---
name: conventional-commit
description: Generate commit messages following the Conventional Commits specification. Analyzes staged changes (git diff) and produces structured commit messages with type, optional scope, subject, and body. Use when the user asks to commit, write a commit message, or create a git commit.
---

# Conventional Commit Messages

## Workflow

1. Run `git diff --cached` (or `git diff` if nothing is staged) to analyze changes.
2. Run `git log --oneline -10` to match the repository's existing style.
3. Determine the commit type and optional scope from the diff.
4. Write a subject line and, for non-trivial changes, a body.
5. Commit using a HEREDOC to preserve formatting.

## Format

```
<type>[(scope)]: <subject>

[body]

[BREAKING CHANGE: <description>]
```

### Subject line rules

- **Type**: Required. One of the allowed types below.
- **Scope**: Optional. A noun describing the affected area (e.g., `auth`, `api`, `ui`, `router`). Include when it adds clarity.
- **Subject**: Required. Imperative mood, lowercase, no period, max 72 characters.
- Total subject line (type + scope + subject) must not exceed 72 characters.

### Body rules

- Separated from subject by a blank line.
- Explain **what** and **why**, not how.
- Wrap at 72 characters.
- Include only for non-trivial changes. Skip for simple renames, typo fixes, or single-line changes.

### Breaking changes

- Add `!` after type/scope: `feat(api)!: remove v1 endpoints`
- Add `BREAKING CHANGE:` footer with migration details.

## Allowed Types

| Type | When to use |
|------|-------------|
| `feat` | New feature or capability |
| `fix` | Bug fix |
| `docs` | Documentation only |
| `style` | Formatting, whitespace, semicolons (no logic change) |
| `refactor` | Code change that neither fixes a bug nor adds a feature |
| `perf` | Performance improvement |
| `test` | Adding or updating tests |
| `build` | Build system or dependencies |
| `ci` | CI/CD configuration |
| `chore` | Maintenance tasks, tooling, config |
| `revert` | Reverting a previous commit |

## Choosing the right type

- Adding a wholly new feature or route -> `feat`
- Enhancing an existing feature -> `feat` (if user-facing) or `refactor` (if internal)
- Fixing broken behavior -> `fix`
- Restructuring code without behavior change -> `refactor`
- Updating a dependency -> `build`
- Adding or updating tests -> `test`

## Examples

**Single file, trivial change:**
```
fix(auth): correct token expiration check
```

**Multi-file feature with body:**
```
feat(dashboard): add interactive usage chart

Integrate Recharts area chart with date range selector.
Data is fetched via TanStack Query with 5-minute cache.
```

**Dependency update:**
```
build: upgrade TanStack Router to v1.95
```

**Breaking change:**
```
feat(api)!: require authentication for all endpoints

BREAKING CHANGE: All API routes now require a valid session token.
Unauthenticated requests return 401 instead of public data.
```

**Revert:**
```
revert: revert "feat(auth): add OAuth provider"

This reverts commit abc1234. OAuth integration caused
session conflicts with existing JWT auth flow.
```

## Commit command

Always pass the message via HEREDOC for proper formatting:

```bash
git commit -m "$(cat <<'EOF'
type(scope): subject line here

Optional body explaining what and why.
EOF
)"
```

## Multiple changes in one commit

If staged changes span unrelated concerns, suggest splitting into separate commits. Prefer small, focused commits over large mixed ones.
