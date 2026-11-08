#!/usr/bin/env bash
set -e

DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
export PATH="$HOME/.local/node24/bin:$PATH"

# Configuration for Agent-First IDE (Development ESM & Software Compositing on Wayland)
export NODE_ENV=development
export VSCODE_DEV=1
export VSCODE_CLI=1
export VSCODE_SKIP_PRELAUNCH=1
unset ELECTRON_RUN_AS_NODE

TARGET="${1:-$DIR}"
BINARY="$DIR/vscode/.build/electron/multi-agent-ide"
APP_ROOT="$DIR/vscode"

if [ ! -f "$BINARY" ]; then
    echo "Error: Binary not found at $BINARY"
    exit 1
fi

echo "Launching Multi Agent IDE on target: $TARGET..."
cd "$APP_ROOT"
setsid -f "$BINARY" . \
  --disable-gpu \
  --disable-workspace-trust \
  --disable-extension=vscode.vscode-api-tests \
  "$TARGET" >/dev/null 2>&1
echo "Multi Agent IDE launched successfully in background."
