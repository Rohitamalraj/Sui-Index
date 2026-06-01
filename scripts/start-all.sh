#!/usr/bin/env bash
# ─────────────────────────────────────────────────────────────────────────────
# Sui-Index — Start all services in tmux (or plain background mode)
# Usage from WSL: bash start-all.sh
# ─────────────────────────────────────────────────────────────────────────────

ROOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
FRONTEND_DIR="$ROOT_DIR/frontend"
BACKEND_DIR="$ROOT_DIR/backend"

echo "════════════════════════════════════════════════"
echo " SUI-INDEX  —  Starting all services"
echo "════════════════════════════════════════════════"

# ── Check if tmux is available ────────────────────────────────────────────────
if command -v tmux &>/dev/null; then
  SESSION="sui-index"

  # Kill existing session if any
  tmux kill-session -t "$SESSION" 2>/dev/null || true

  # Create new session with backend in pane 0
  tmux new-session -d -s "$SESSION" -x 220 -y 50 \
    "cd '$BACKEND_DIR' && npm run dev; read"

  # Split horizontally for frontend
  tmux split-window -h -t "$SESSION" \
    "cd '$FRONTEND_DIR' && npm run dev; read"

  tmux select-layout -t "$SESSION" even-horizontal

  echo ""
  echo "  Backend  →  http://localhost:3001"
  echo "  Frontend →  http://localhost:3000"
  echo ""
  echo "Attaching to tmux session (Ctrl+B, D to detach)..."
  sleep 1
  tmux attach-session -t "$SESSION"

else
  # No tmux — run both with simple background processes
  echo ""
  echo "[1/2] Starting backend on :3001..."
  cd "$BACKEND_DIR"
  npm run dev &
  BACKEND_PID=$!

  sleep 2

  echo "[2/2] Starting frontend on :3000..."
  cd "$FRONTEND_DIR"
  npm run dev &
  FRONTEND_PID=$!

  echo ""
  echo "════════════════════════════════════════════════"
  echo "  Backend  PID: $BACKEND_PID  →  http://localhost:3001"
  echo "  Frontend PID: $FRONTEND_PID →  http://localhost:3000"
  echo "════════════════════════════════════════════════"
  echo ""
  echo "Press Ctrl+C to stop all services"

  trap "echo 'Stopping...'; kill $BACKEND_PID $FRONTEND_PID 2>/dev/null" INT TERM
  wait
fi
