---
name: verify-check-test
description: Verify repository changes by running the root validation loop for this monorepo, fixing failures, and repeating until verification is clean. Use when finishing non-trivial work in this repo, when a user asks to "run check and test", "fix CI", "verify output", or phrases verification as `pnpm run check test` and expects the repo-native `pnpm run check:boundaries`, `pnpm run lint`, `pnpm run typecheck`, `pnpm run build`, `pnpm test`, and `pnpm test:e2e` workflow.
---

# Verify Check Test

Run the repository verification loop from the repo root, fix failures, and do not stop until the requested checks pass or you hit a real blocker.

## Core rules

- Anchor work to the repository root with `git rev-parse --show-toplevel`.
- Use `pnpm` only.
- Treat `pnpm run check test` as shorthand for the repo-native root verification sequence in this repo:
  ```bash
  pnpm run check:boundaries
  pnpm run lint
  pnpm run typecheck
  pnpm run build
  pnpm test
  pnpm test:e2e
  ```
- Inspect `git status --short` before making fixes so you do not trample unrelated user changes.
- Prefer the smallest relevant rerun after each fix, then rerun the full root verification sequence before declaring success.

## Verification loop

1. Confirm the repo root and switch command execution to that directory.
2. Inspect local changes with `git status --short`.
3. Run:
   ```bash
   pnpm run check:boundaries
   ```
4. If `pnpm run check:boundaries` fails, fix the owning import or boundary issue at the root cause, rerun `pnpm run check:boundaries`, and continue only once it passes.
5. Run:
   ```bash
   pnpm run lint
   ```
6. If `pnpm run lint` fails, fix the lint issue at the root cause, rerun the narrowest affected lint command if obvious, otherwise rerun `pnpm run lint`, and continue only once it passes.
7. Run:
   ```bash
   pnpm run typecheck
   ```
8. If `pnpm run typecheck` fails, fix the type error at the root cause, rerun the narrowest affected `pnpm --filter ... typecheck` when known, otherwise rerun `pnpm run typecheck`, and continue only once it passes.
9. Once the boundary, lint, and typecheck steps pass, run:
   ```bash
   pnpm run build
   ```
10. If `pnpm run build` fails, fix the build issue at the root cause, rerun the narrowest relevant build command if obvious, otherwise rerun `pnpm run build`, and continue only once it passes.
11. Once the check and build steps pass, run:
    ```bash
    pnpm test
    ```
12. If `pnpm test` fails, identify the owning app or package, fix the problem, rerun the smallest relevant test scope first, then rerun `pnpm test`.
13. Once unit and integration coverage pass, run:
    ```bash
    pnpm test:e2e
    ```
14. If `pnpm test:e2e` fails, fix the end-to-end issue at the root cause, rerun the narrowest relevant E2E scope when known, otherwise rerun `pnpm test:e2e`.
15. Finish only after `pnpm run check:boundaries`, `pnpm run lint`, `pnpm run typecheck`, `pnpm run build`, `pnpm test`, and `pnpm test:e2e` all pass in the current workspace state.

## Failure-handling guidance

- Read the first actionable error before editing. Do not shotgun-change multiple files based only on secondary stack traces.
- Keep fixes inside the correct owner:
  - `apps/web`, `apps/admin`, `apps/api-server` for app behavior
  - `packages/*` for shared logic
  - `packages/db-schema` for schema ownership
- If a failure comes from generated or managed files, regenerate them with the repo-native command instead of hand-editing generated output.
- If you uncover a user change that conflicts with the requested fix, stop and ask how to proceed instead of reverting it.

## Rerun strategy

- After a focused fix, run the smallest meaningful command first.
- If imports, public exports, or package boundaries changed, include `pnpm run check:boundaries`.
- If lint-related files changed, include `pnpm run lint`.
- If shared types changed, include the relevant package/app typecheck before rerunning the full root sequence.
- If route generation, bundling, or app/package integration changed, include `pnpm run build`.
- If user flows, route protection, auth redirects, or browser-visible behavior changed, include `pnpm test:e2e`.
- Always end with:
  ```bash
  pnpm run check:boundaries
  pnpm run lint
  pnpm run typecheck
  pnpm run build
  pnpm test
  pnpm test:e2e
  ```

## Completion report

When reporting back:

- state whether `pnpm run check:boundaries` passed
- state whether `pnpm run lint` passed
- state whether `pnpm run typecheck` passed
- state whether `pnpm run build` passed
- state whether `pnpm test` passed
- state whether `pnpm test:e2e` passed
- summarize the root-cause fixes briefly
- call out any verification gaps if you could not complete the loop

## Example trigger phrases

- "Use $verify-check-test to verify this branch and fix anything failing."
- "Run check and test, then clean up the issues."
- "CI is red. Fix the repo until check and test pass."
