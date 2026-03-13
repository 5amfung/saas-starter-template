# GitHub Templates for Open-Sourcing

## Overview

Design for GitHub issue templates, PR template, and community documents needed to open-source the SaaS starter template project.

## Audience

- **Template users**: developers cloning the project to build their own SaaS, reporting bugs and requesting features
- **Code contributors**: developers submitting PRs to improve the template itself

## Decisions

| Decision               | Choice                         | Rationale                                                    |
| ---------------------- | ------------------------------ | ------------------------------------------------------------ |
| Issue template format  | YAML issue forms               | Structured fields, required validation, dropdowns for triage |
| Question/help handling | Redirect to GitHub Discussions | Keeps issue tracker focused on actionable bugs and features  |
| PR template style      | Lightweight markdown           | Low friction: description, type checkboxes, checklist        |
| License                | MIT                            | Permissive, standard for starter templates                   |
| Code of conduct        | Contributor Covenant v2.1      | Industry standard                                            |

## File Structure

```
.github/
  ISSUE_TEMPLATE/
    config.yml
    bug-report.yml
    feature-request.yml
  PULL_REQUEST_TEMPLATE.md
  CONTRIBUTING.md
  workflows/             (existing, unchanged)
  dependabot.yml         (existing, unchanged)

(repo root)
  LICENSE
  CODE_OF_CONDUCT.md
```

## Issue Templates

### config.yml

- `blank_issues_enabled: false` to force contributors through templates.
- External link entry: label "Question / Help", url pointing to GitHub Discussions.

### bug-report.yml

Name: "Bug Report"
Description: "Report a bug or unexpected behavior"
Labels: `bug`

Fields:

| Field              | Type     | Required | Details                                                                                         |
| ------------------ | -------- | -------- | ----------------------------------------------------------------------------------------------- |
| Description        | textarea | yes      | Placeholder: "What happened? What did you expect to happen?"                                    |
| Steps to Reproduce | textarea | yes      | Placeholder with numbered step format (1. Go to... 2. Click...)                                 |
| Area               | dropdown | yes      | Options: Auth, Workspace, Database, Routing, UI/Components, Email, Admin, Stripe/Billing, Other |
| Environment        | dropdown | yes      | Options: Development (local), Production build, Preview/staging                                 |
| Node version       | input    | no       | Placeholder: "e.g., 22.x"                                                                       |
| Additional context | textarea | no       | Placeholder: "Screenshots, logs, error messages, etc."                                          |

### feature-request.yml

Name: "Feature Request"
Description: "Suggest a new feature or improvement"
Labels: `enhancement`

Fields:

| Field                   | Type     | Required | Details                                                            |
| ----------------------- | -------- | -------- | ------------------------------------------------------------------ |
| Problem or motivation   | textarea | yes      | Placeholder: "What problem does this solve? Why do you need this?" |
| Proposed solution       | textarea | yes      | Placeholder: "Describe what you'd like to happen"                  |
| Area                    | dropdown | no       | Options: same as bug report                                        |
| Alternatives considered | textarea | no       | Placeholder: "Other approaches you've thought about"               |
| Additional context      | textarea | no       | Placeholder: "Any additional context, mockups, or examples"        |

## PR Template

File: `.github/PULL_REQUEST_TEMPLATE.md`

Sections:

1. **Description** — freeform, what changed and why
2. **Type of change** — checkboxes:
   - Bug fix
   - New feature
   - Breaking change
   - Documentation
   - Refactor/cleanup
3. **Checklist** — reminders:
   - Ran `pnpm check` (typecheck + lint)
   - Ran `pnpm test`
   - Updated documentation if needed
   - Self-reviewed the diff

## CONTRIBUTING.md

File: `.github/CONTRIBUTING.md`

Sections:

1. **Getting started** — clone, `pnpm install`, copy `.env.example` to `.env`, configure environment variables, `pnpm dev`
2. **Development workflow** — branch from `main`, make changes, run `pnpm check` and `pnpm test` before submitting a PR
3. **Project structure** — brief overview with pointer to CLAUDE.md for full details (avoid duplicating structure docs)
4. **Conventions** — highlight key rules with link to CLAUDE.md for the complete list:
   - pnpm only (no npm/yarn/bun)
   - `@/*` path alias for imports
   - kebab-case filenames, PascalCase exports
   - No `any` types
5. **Server function boundaries** — explain the `*.functions.ts` / `*.server.ts` / `*.ts` split with examples:
   - `*.functions.ts`: `createServerFn` wrappers, safe to import anywhere
   - `*.server.ts`: server-only helpers, import only from server contexts
   - `*.ts`: client-safe shared code
   - Include the same import rule examples from CLAUDE.md
6. **Submitting a PR** — fill out the PR template, keep PRs focused on one change, expect code review

## LICENSE

MIT License with the project author's name and current year.

## CODE_OF_CONDUCT.md

Contributor Covenant v2.1, unmodified. Standard enforcement section pointing to a contact email or method chosen by the project author.
