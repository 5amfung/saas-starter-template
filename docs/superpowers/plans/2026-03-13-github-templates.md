# GitHub Templates Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add GitHub issue templates, PR template, and community documents to prepare the project for open source.

**Architecture:** All files are static templates (YAML, Markdown) — no application code changes. Seven new files across `.github/` and repo root. No tests required as these are configuration/documentation files.

**Tech Stack:** GitHub YAML issue forms, Markdown, Contributor Covenant v2.1, MIT License

**Spec:** `docs/superpowers/specs/2026-03-13-github-templates-design.md`

---

## Chunk 1: Issue Templates and PR Template

### Task 1: Create issue template config

**Files:**

- Create: `.github/ISSUE_TEMPLATE/config.yml`

- [ ] **Step 1: Create config.yml**

```yaml
blank_issues_enabled: false
contact_links:
  - name: Question / Help
    # TODO: replace <org>/<repo> with the actual GitHub org and repo name before merging.
    url: https://github.com/<org>/<repo>/discussions
    about: Ask questions and get help from the community
```

- [ ] **Step 2: Commit**

```bash
git add .github/ISSUE_TEMPLATE/config.yml
git commit -m "chore: add issue template config with Discussions link"
```

### Task 2: Create bug report issue form

**Files:**

- Create: `.github/ISSUE_TEMPLATE/bug-report.yml`

- [ ] **Step 1: Create bug-report.yml**

```yaml
name: Bug Report
description: Report a bug or unexpected behavior
labels: ['bug']
body:
  - type: textarea
    id: description
    attributes:
      label: Description
      description: What happened? What did you expect to happen?
      placeholder: A clear description of the bug...
    validations:
      required: true

  - type: textarea
    id: steps
    attributes:
      label: Steps to Reproduce
      description: How can we reproduce this?
      placeholder: |
        1. Go to '...'
        2. Click on '...'
        3. See error
    validations:
      required: true

  - type: dropdown
    id: area
    attributes:
      label: Area
      description: Which part of the project is affected?
      options:
        - Auth
        - Workspace
        - Database
        - Routing
        - UI/Components
        - Email
        - Admin
        - Stripe/Billing
        - Other
    validations:
      required: true

  - type: dropdown
    id: environment
    attributes:
      label: Environment
      description: Where are you seeing this?
      options:
        - Development (local)
        - Production build
        - Preview/staging
    validations:
      required: true

  - type: input
    id: node-version
    attributes:
      label: Node version
      description: What version of Node.js are you using?
      placeholder: 'e.g., 22.x'
    validations:
      required: false

  - type: textarea
    id: context
    attributes:
      label: Additional context
      description: Any other details that might help.
      placeholder: Screenshots, logs, error messages, etc.
    validations:
      required: false
```

- [ ] **Step 2: Commit**

```bash
git add .github/ISSUE_TEMPLATE/bug-report.yml
git commit -m "chore: add bug report issue form template"
```

### Task 3: Create feature request issue form

**Files:**

- Create: `.github/ISSUE_TEMPLATE/feature-request.yml`

- [ ] **Step 1: Create feature-request.yml**

```yaml
name: Feature Request
description: Suggest a new feature or improvement
labels: ['enhancement']
body:
  - type: textarea
    id: problem
    attributes:
      label: Problem or motivation
      description: What problem does this solve? Why do you need this?
      placeholder: A clear description of the problem or use case...
    validations:
      required: true

  - type: textarea
    id: solution
    attributes:
      label: Proposed solution
      description: Describe what you'd like to happen.
      placeholder: A clear description of what you want...
    validations:
      required: true

  - type: dropdown
    id: area
    attributes:
      label: Area
      description: Which part of the project does this relate to?
      options:
        - Auth
        - Workspace
        - Database
        - Routing
        - UI/Components
        - Email
        - Admin
        - Stripe/Billing
        - Other
    validations:
      required: false

  - type: textarea
    id: alternatives
    attributes:
      label: Alternatives considered
      description: Other approaches you've thought about.
      placeholder: Any alternative solutions or features you've considered...
    validations:
      required: false

  - type: textarea
    id: context
    attributes:
      label: Additional context
      description: Any other details.
      placeholder: Any additional context, mockups, or examples...
    validations:
      required: false
```

- [ ] **Step 2: Commit**

```bash
git add .github/ISSUE_TEMPLATE/feature-request.yml
git commit -m "chore: add feature request issue form template"
```

### Task 4: Create PR template

**Files:**

- Create: `.github/PULL_REQUEST_TEMPLATE.md`

- [ ] **Step 1: Create PULL_REQUEST_TEMPLATE.md**

```markdown
## Description

<!-- What changed and why? -->

## Type of change

- [ ] Bug fix
- [ ] New feature
- [ ] Breaking change
- [ ] Documentation
- [ ] Refactor/cleanup

## Checklist

- [ ] Ran `pnpm run format`
- [ ] Ran `pnpm check` (typecheck + lint)
- [ ] Ran `pnpm test`
- [ ] Updated documentation if needed
- [ ] Self-reviewed the diff
- [ ] If DB schema changed, ran `pnpm run db:generate` and committed the migration file
```

- [ ] **Step 2: Commit**

```bash
git add .github/PULL_REQUEST_TEMPLATE.md
git commit -m "chore: add pull request template"
```

---

## Chunk 2: Community Documents

### Task 5: Create CONTRIBUTING.md

**Files:**

- Create: `.github/CONTRIBUTING.md`

- [ ] **Step 1: Create CONTRIBUTING.md**

````markdown
# Contributing

Thank you for your interest in contributing! This guide will help you get started.

## Getting Started

1. Fork and clone the repository
2. Install dependencies:
   ```bash
   pnpm install
   ```
````

3. Copy the environment file:
   ```bash
   cp .env.example .env
   ```
4. Configure environment variables in `.env`:

   **Required** (app will not start without these):
   | Variable | Description |
   |----------|-------------|
   | `DATABASE_URL` | Neon PostgreSQL connection string |
   | `BETTER_AUTH_SECRET` | Auth secret — generate with `openssl rand -base64 32` |
   | `BETTER_AUTH_URL` | `http://localhost:3000` for local dev |

   **Optional** (features are disabled when omitted):
   | Variable | Description |
   |----------|-------------|
   | `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` | Google OAuth sign-in |
   | `RESEND_API_KEY` / `RESEND_FROM_EMAIL` / `RESEND_REPLY_TO_EMAIL` | Transactional emails via Resend |
   | `STRIPE_SECRET_KEY` / `STRIPE_WEBHOOK_SECRET` / `STRIPE_PRO_*` | Stripe billing integration |

5. Push the database schema (for local development):
   ```bash
   pnpm run db:push
   ```
   > For production or hosted environments, use `pnpm run db:migrate` instead.
6. Start the dev server:
   ```bash
   pnpm dev
   ```

## Development Workflow

1. Create a branch from `main`
2. Make your changes
3. Before submitting a PR, run:
   ```bash
   pnpm run format
   pnpm check
   pnpm test
   ```
4. Push your branch and open a pull request

## Project Structure

The project follows a domain-driven structure under `src/`. See the project's `CLAUDE.md` for the full directory layout and architectural details.

## Conventions

Follow these key rules (see `CLAUDE.md` for the complete list):

- **pnpm only** — do not use npm, yarn, or bun
- **Path alias** — use `@/*` for imports from `src/`
- **File naming** — `kebab-case.tsx` for files, `PascalCase` for component exports
- **No `any` types** — use `unknown` with type guards instead
- **Never manually edit `src/components/ui/`** — use `pnpx shadcn@latest add <component>` to add or update shadcn components
- **Never edit `src/routeTree.gen.ts`** — it is auto-generated by the TanStack Router plugin

## Server Function Boundaries

This project splits server-side code by responsibility:

| Suffix             | Role                                                                                                      |
| ------------------ | --------------------------------------------------------------------------------------------------------- |
| `*.functions.ts`   | `createServerFn` wrappers — safe to import anywhere; only the handler runs on the server                  |
| `*.server.ts`      | Server-only helpers (DB queries, secrets). Import only from `*.functions.ts` or other `*.server.ts` files |
| `*.ts` (no suffix) | Client-safe shared code (types, schemas, constants, utilities)                                            |

```ts
// ✅ Route imports server function wrapper
import { updateUserRole } from '@/utils/users.functions';

// ❌ Route importing server-only module directly
import { updateUserRoleInDb } from '@/utils/users.server';
```

## Submitting a PR

- Fill out the pull request template completely
- Keep PRs focused on a single change
- Expect code review — we may request changes before merging

````

- [ ] **Step 2: Commit**

```bash
git add .github/CONTRIBUTING.md
git commit -m "docs: add contributing guide"
````

### Task 6: Create LICENSE

**Files:**

- Create: `LICENSE`

- [ ] **Step 1: Create LICENSE**

Standard MIT License text. Replace `[fullname]` with the project author's name.

```text
MIT License

Copyright (c) 2026 [fullname]

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
```

> **Note:** Replace `[fullname]` with your name before merging.

- [ ] **Step 2: Commit**

```bash
git add LICENSE
git commit -m "docs: add MIT license"
```

### Task 7: Create CODE_OF_CONDUCT.md

**Files:**

- Create: `CODE_OF_CONDUCT.md`

- [ ] **Step 1: Create CODE_OF_CONDUCT.md**

Use the full Contributor Covenant v2.1 text. Fetch the official markdown from:
https://www.contributor-covenant.org/version/2/1/code_of_conduct/code_of_conduct.md

The file has one required placeholder substitution: replace `[INSERT CONTACT METHOD]` in the Enforcement section with a placeholder email `conduct@example.com`.

> **Note:** Replace `conduct@example.com` with a real contact email before merging. The enforcement section is not functional without a valid contact method.

- [ ] **Step 2: Commit**

```bash
git add CODE_OF_CONDUCT.md
git commit -m "docs: add Contributor Covenant v2.1 code of conduct"
```
