#!/usr/bin/env bash
# ==========================================================
# 🧠 Atlas Mini-Launcher – Safe & Colorized Edition
# ----------------------------------------------------------
# ✅ Uses existing backend/server.mjs  (port 8000)
# ✅ Uses existing frontend (Vite 5174)
# ✅ Auto-detects local IP for mobile preview
# ✅ Cleans old Node/Vite sessions
# ✅ Graceful shutdown (Ctrl + C)
# ==========================================================

set -e

# ----- Colors -----
GREEN="\033[0;32m"
YELLOW="\033[1;33m"
RED="\033[0;31m"
BLUE="\033[0;34m"
RESET="\033[0m"

echo -e "\n${BLUE}=========================================="
echo -e " 🚀  Starting Atlas Development Environment"
echo -e "==========================================${RESET}\n"

# ----------------------------------------------------------
# STEP 1 – Clean old processes
# ----------------------------------------------------------
echo -e "${BLUE}🧹  Cleaning up old Node/Vite processes...${RESET}"
pkill -f "vite|node|atlas-backend" 2>/dev/null || true
sleep 1
echo -e "${GREEN}✅  Cleanup complete${RESET}"

# ----------------------------------------------------------
# STEP 2 – Detect local IP for mobile testing
# ----------------------------------------------------------
PLATFORM=$(uname | tr '[:upper:]' '[:lower:]')

if [[ "$PLATFORM" == "darwin" ]]; then
  IP=$(ipconfig getifaddr en0 2>/dev/null || ipconfig getifaddr en1 2>/dev/null)
elif [[ "$PLATFORM" == "linux" ]]; then
  IP=$(hostname -I | awk '{print $1}')
else
  IP=$(ipconfig | grep -E "IPv4" | grep -v "127.0.0.1" | awk '{print $NF}' | head -n1)
fi

if [ -z "$IP" ]; then
  IP="localhost"
  echo -e "${YELLOW}⚠️  Could not detect network IP — using localhost only.${RESET}"
else
  echo -e "${GREEN}🌐  Network IP detected: $IP${RESET}"
fi

# ----------------------------------------------------------
# STEP 3 – Start Backend (8000)
# ----------------------------------------------------------
echo -e "\n${BLUE}🧠  Starting Backend (API) on port 8000...${RESET}"
if [ -f "backend/server.mjs" ]; then
  mkdir -p logs
  cd backend
  node server.mjs > ../logs/backend.log 2>&1 &
  BACKEND_PID=$!
  cd ..
  echo -e "${GREEN}✅  Backend started (PID: $BACKEND_PID)${RESET}"
else
  echo -e "${YELLOW}⚠️  backend/server.mjs not found — skipping backend start.${RESET}"
fi

# ----------------------------------------------------------
# STEP 4 – Start Frontend (5174)
# ----------------------------------------------------------
echo -e "\n${BLUE}💻  Starting Frontend (Vite) on port 5174...${RESET}"
npm run dev -- --port 5174 --host > logs/frontend.log 2>&1 &
FRONTEND_PID=$!
sleep 3
echo -e "${GREEN}✅ Frontend started (PID: $FRONTEND_PID)${RESET}"

# ----------------------------------------------------------
# STEP 5 – Display Access Information
# ----------------------------------------------------------
echo -e "\n${BLUE}=========================================="
echo -e " 🌐 Frontend:  ${GREEN}http://localhost:5174${RESET}"
echo -e " 📱 Mobile:    ${GREEN}http://$IP:5174${RESET}"
echo -e "------------------------------------------"
echo -e " 🔗 Backend:   ${GREEN}http://localhost:8000${RESET}"
echo -e " 🧩 Logs:      ${YELLOW}logs/backend.log  logs/frontend.log${RESET}"
echo -e "==========================================${RESET}\n"

# ----------------------------------------------------------
# STEP 6 – Graceful Shutdown (Ctrl + C)
# ----------------------------------------------------------
trap 'echo -e "\n${RED}🛑 Stopping Atlas stack...${RESET}";
kill -9 $BACKEND_PID $FRONTEND_PID 2>/dev/null || true;
echo -e "${GREEN}✅ All processes stopped.${RESET}";
exit 0' INT

wait $FRONTEND_PID

