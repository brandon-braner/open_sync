#!/usr/bin/env bash
# OpenSync – Start both backend and frontend dev servers
set -e

DIR="$(cd "$(dirname "$0")" && pwd)"

echo "🔄 OpenSync – starting dev servers..."

# Backend (FastAPI via uv – run from backend/ where pyproject.toml lives)
echo "→ Starting backend on http://localhost:8001"
(cd "$DIR/backend" && uv run python -m opensync.main) &
BACKEND_PID=$!

# Frontend (Vite)
echo "→ Starting frontend on http://localhost:5173"
(cd "$DIR/frontend" && npm run dev) &
FRONTEND_PID=$!

# Clean up on exit
trap 'kill $BACKEND_PID $FRONTEND_PID 2>/dev/null; exit' INT TERM

echo ""
echo "✅ Open http://localhost:5173 in your browser"
echo "   Press Ctrl+C to stop both servers."
echo ""

wait
