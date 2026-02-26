#!/usr/bin/env bash
set -euo pipefail

# PostToolUse hook: runs after EnterWorktree.
# Copies .env from the project root into the new worktree and runs bun install.
#
# Receives a JSON payload on stdin with the shape:
#   { "tool_name": "EnterWorktree", "tool_input": { "name": "..." }, "tool_response": "..." }

if ! command -v jq &>/dev/null; then
  echo "post-enter-worktree: jq is required but not installed (brew install jq)." >&2
  exit 1
fi

PAYLOAD=$(cat)
PROJECT_ROOT=$(pwd)

# Derive worktree path from the name supplied to EnterWorktree.
WORKTREE_NAME=$(echo "$PAYLOAD" | jq -r '.tool_input.name // empty' 2>/dev/null)

if [ -n "$WORKTREE_NAME" ]; then
  WORKTREE_PATH="$PROJECT_ROOT/.claude/worktrees/$WORKTREE_NAME"
else
  # Fall back: scan the response text for a matching path.
  WORKTREE_PATH=$(echo "$PAYLOAD" | jq -r '.tool_response // empty' 2>/dev/null \
    | grep -oE '[^ ]+\.claude/worktrees/[^ ]+' | head -1)
fi

if [ -z "$WORKTREE_PATH" ] || [ ! -d "$WORKTREE_PATH" ]; then
  echo "post-enter-worktree: could not determine worktree path — skipping." >&2
  exit 0
fi

# Copy .env into the worktree.
if [ -f "$PROJECT_ROOT/.env" ]; then
  cp "$PROJECT_ROOT/.env" "$WORKTREE_PATH/.env"
  echo "post-enter-worktree: copied .env → $WORKTREE_PATH/.env"
else
  echo "post-enter-worktree: no .env found at project root — skipping copy." >&2
fi
