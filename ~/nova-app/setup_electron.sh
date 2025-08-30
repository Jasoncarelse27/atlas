#!/usr/bin/env bash
set -euo pipefail

cd ~/nova-app

# 0) deps
npm pkg set scripts.start="electron ."
npm pkg set scripts.dist="electron-builder"
npm i -D electron-builder
npm i dotenv

# 1) package.json build config
node - <<'NODE'
const fs=require('fs');
const p=JSON.parse(fs.readFileSync('package.json','utf8'));
p.name='nova';
p.productName='Nova Voice Assistant';
p.version=p.version||'0.1.0';
p.main='main.js';
p.build = Object.assign({}, p.build, {
  appId: "com.nova.voice",
  asar: true,
  files: ["**/*", "!dist/**", "!node_modules/.cache/**"],
  mac: {
    category: "public.app-category.productivity",
    target: ["dmg","zip"],
    icon: "assets/icon.icns"
  }
});
fs.writeFileSync('package.json', JSON.stringify(p,null,2));
console.log('✅ package.json updated');
NODE

# 2) preload.js (safe, minimal bridge)
cat > preload.js <<'JS'
const { contextBridge, ipcRenderer } = require("electron");
contextBridge.exposeInMainWorld("nova", {
  ping: () => ipcRenderer.invoke("ping")
});
JS

# 3) main.js — dockless tray app with popover + backend lifecycle + health
cat > main.js <<'JS'
const { app, BrowserWindow, Tray, Menu, dialog, nativeImage, shell, screen } = require("electron");
const path = require("path");
const os = require("os");
const fs = require("fs");
const cp = require("child_process");
const dotenv = require("dotenv");

// ---- config / paths
const BACKEND_DIR = path.join(os.homedir(), "atlas");
const ENV_PATH    = path.join(BACKEND_DIR, ".env");
const LOG_PATH    = path.join(os.homedir(), "nova-backend.log");

dotenv.config({ path: ENV_PATH });
const PORT = process.env.PORT || "8000";
const API  = `http://127.0.0.1:${PORT}`;

let tray = null;
let pop = null;
let backendProc = null;

// macOS: hide Dock / app switcher
app.dock?.hide?.();

// single instance
if (!app.requestSingleInstanceLock()) app.quit();

// ---- backend control
function startBackend() {
  stopBackend(); // clean start
  const env = { ...process.env };
  if (fs.existsSync(ENV_PATH)) {
    const lines = fs.readFileSync(ENV_PATH, "utf8").split(/\r?\n/).filter(Boolean);
    for (const line of lines) {
      const i = line.indexOf("=");
      if (i > 0) env[line.slice(0,i)] = line.slice(i+1);
    }
  }
  const venvPy = path.join(os.homedir(), "venvs", "atlas", "bin", "python");
  const cwd = BACKEND_DIR;
  const args = ["-m", "uvicorn", "server:app", "--port", PORT];
  const cmd  = fs.existsSync(venvPy) ? venvPy : "uvicorn";
  const cmdArgs = fs.existsSync(venvPy) ? args : ["server:app", "--port", PORT];

  backendProc = cp.spawn(cmd, cmdArgs, { cwd, env, stdio: "ignore", detached: false });
}

function stopBackend() {
  if (backendProc && !backendProc.killed) {
    try { backendProc.kill("SIGTERM"); } catch {}
  }
  backendProc = null;
}

async function fetchJSON(url, timeoutMs=3000) {
  const ac = new AbortController();
  const t = setTimeout(()=>ac.abort(), timeoutMs);
  try {
    const r = await fetch(url, { signal: ac.signal, cache: "no-store" });
    clearTimeout(t);
    if (!r.ok) throw new Error("HTTP " + r.status);
    return await r.json();
  } catch (e) {
    clearTimeout(t);
    throw e;
  }
}

async function waitForHealth(timeoutMs=20000) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    try {
      const j = await fetchJSON(`${API}/health`, 2000);
      const ok = j?.lm_studio?.ok && j?.whisper?.ok && j?.piper?.ok;
      return { ok, status: j };
    } catch {}
    await new Promise(r=>setTimeout(r, 500));
  }
  return { ok:false, status:null };
}

function healthSummary(j) {
  if (!j) return "Backend not reachable.";
  const rows = [
    `LM Studio:  ${j.lm_studio?.ok ? "✅" : "❌"}  ${j.lm_studio?.url || ""}  model=${j.lm_studio?.default_model || ""}`,
    `Whisper:    ${j.whisper?.ok ? "✅" : "❌"}  model=${j.whisper?.model || ""} (${j.whisper?.compute || ""})`,
    `Piper TTS:  ${j.piper?.ok ? "✅" : "❌"}  voice=${(j.piper?.voice||"").split("/").pop() || "-"}`,
  ];
  return rows.join("\n");
}

// ---- tray + popover window
function getTrayIcon() {
  const candidates = [
    path.join(__dirname, "nova_icons", "iconTemplate.png"),
    path.join(__dirname, "assets", "icon.icns")
  ];
  for (const p of candidates) if (fs.existsSync(p)) return nativeImage.createFromPath(p);
  return nativeImage.createEmpty();
}

function positionPopover(win) {
  const tb = tray.getBounds();
  const { width: w, height: h } = win.getBounds();
  const x = Math.round(tb.x + tb.width/2 - w/2);
  // below menubar (works on multi-display; y is near the bar)
  const y = Math.round(tb.y + tb.height + 4);
  win.setBounds({ x, y, width: w, height: h });
}

function createPopover() {
  if (pop && !pop.isDestroyed()) return pop;
  pop = new BrowserWindow({
    width: 360,
    height: 480,
    frame: false,
    resizable: false,
    fullscreenable: false,
    skipTaskbar: true,
    alwaysOnTop: true,
    show: false,
    transparent: false,
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true
    }
  });
  pop.loadFile("index.html");
  pop.on("blur", () => { if (pop?.isVisible()) pop.hide(); });
  return pop;
}

function togglePopover() {
  const w = createPopover();
  if (w.isVisible()) w.hide();
  else { positionPopover(w); w.show(); w.focus(); }
}

function buildTray() {
  tray = new Tray(getTrayIcon());
  tray.setToolTip("Nova Voice Assistant");

  const menu = Menu.buildFromTemplate([
    { label: "Open Nova", click: () => togglePopover() },
    { label: "Check Health", click: async () => {
        try {
          const j = await fetchJSON(`${API}/health`, 3000);
          dialog.showMessageBox({ type:"info", title:"Nova Health", message: healthSummary(j) });
        } catch {
          dialog.showMessageBox({ type:"warning", title:"Nova Health", message:"Backend not reachable.\nTry Restart Backend or check ~/nova-backend.log" });
        }
      }
    },
    { label: "Open Logs", click: () => shell.openPath(LOG_PATH) },
    { type: "separator" },
    { label: "Restart Backend", click: async () => {
        stopBackend(); startBackend();
        const r = await waitForHealth(8000);
        if (!r.ok) dialog.showMessageBox({
          type:"warning", title:"Nova Backend",
          message:"Backend restarted but health not green yet.\nOpen LM Studio (Start Server) and ensure Piper voice is configured in .env."
        });
      }
    },
    { type: "separator" },
    { label: "Quit & Stop Backend", click: () => { stopBackend(); app.quit(); } }
  ]);
  tray.setContextMenu(menu);
  tray.on("click", () => togglePopover());

  // Reposition popover when display layout changes or resolution changes
  screen.on("display-metrics-changed", () => { if (pop?.isVisible()) positionPopover(pop); });
}

// ---- app lifecycle
app.whenReady().then(async () => {
  startBackend();
  buildTray();

  const res = await waitForHealth(20000);
  if (!res.ok) {
    dialog.showMessageBox({
      type:"warning",
      title:"Nova Health",
      message: [
        "Nova backend started, but health checks are not fully green.",
        "• Open LM Studio and click 'Start Server' for your model (default http://127.0.0.1:1234).",
        "• Ensure Piper is installed and PIPER_VOICE points to a *.onnx voice in ~/piper/voices.",
        "",
        healthSummary(res.status)
      ].join("\n")
    });
  }
  // Don't show a main window; tray-only app
});

app.on("window-all-closed", () => { /* tray-only; ignore */ });
app.on("before-quit", () => { stopBackend(); });
JS

# 4) icons
mkdir -p assets
[ -f assets/icon.icns ] || echo "⚠️  Place your ICNS at assets/icon.icns for a proper app icon."
# (Optional tray icon PNG: nova_icons/iconTemplate.png — otherwise ICNS will be used)

# 5) build & install
npm run dist
APP="dist/mac/Nova Voice Assistant.app"
if [ -d "$APP" ]; then
  echo "📦 Moving to /Applications…"
  rm -rf "/Applications/Nova.app" || true
  mv "$APP" "/Applications/Nova.app"
  echo "✅ Installed: /Applications/Nova.app"
  echo "Use the menu-bar icon to open the popover. Logs: ~/nova-backend.log"
else
  echo "❌ Build failed — check electron-builder output."
fi

