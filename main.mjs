import { app, BrowserWindow, Tray, Menu, nativeImage, shell } from 'electron';
import { spawn } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

let mainWindow;
let tray;
let backendProcess;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, 'preload.mjs')
    },
    icon: path.join(__dirname, 'public', 'vite.svg'),
    show: false,
    titleBarStyle: 'hiddenInset',
    vibrancy: 'under-window',
    visualEffectState: 'active'
  });

  // Load the Nova app
  const isDev = process.env.NODE_ENV === 'development';
  if (isDev) {
    mainWindow.loadURL('http://localhost:8000');
  } else {
    mainWindow.loadFile('index.html');
  }

  // Open DevTools in development
  if (isDev) {
    mainWindow.webContents.openDevTools();
  }

  mainWindow.once('ready-to-show', () => {
    mainWindow.show();
  });

  mainWindow.on('closed', () => {
    mainWindow = null;
  });

  // Handle external links
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url);
    return { action: 'deny' };
  });
}

async function createTray() {
  // Create tray icon (fallback to default if custom icon doesn't exist)
  let iconPath = path.join(__dirname, 'public', 'vite.svg');
  
  try {
    const fs = await import('node:fs');
    if (!fs.existsSync(iconPath)) {
      iconPath = nativeImage.createFromDataURL('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMzIiIGhlaWdodD0iMzIiIHZpZXdCb3g9IjAgMCAzMiAzMiIgZmlsbD0ibm9uZSIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj4KPGNpcmNsZSBjeD0iMTYiIGN5PSIxNiIgcj0iMTYiIGZpbGw9IiM2NjdFRUEiLz4KPHN2ZyB4PSI4IiB5PSI4IiB3aWR0aD0iMTYiIGhlaWdodD0iMTYiIHZpZXdCb3g9IjAgMCAxNiAxNiIgZmlsbD0id2hpdGUiPgo8cGF0aCBkPSJNOCA0aDZ2Mkg4VjR6bTAgNGg2djJIOFY4em0wIDRoNnYySDh2LTJ6Ii8+Cjwvc3ZnPgo8L3N2Zz4K');
    }
  } catch (error) {
    console.warn('Could not load tray icon:', error);
  }
  
  const icon = nativeImage.createFromPath(iconPath);
  tray = new Tray(icon);
  
  const contextMenu = Menu.buildFromTemplate([
    {
      label: 'Show Nova',
      click: () => {
        if (mainWindow) {
          mainWindow.show();
          mainWindow.focus();
        }
      }
    },
    {
      label: 'Hide Nova',
      click: () => {
        if (mainWindow) {
          mainWindow.hide();
        }
      }
    },
    { type: 'separator' },
    {
      label: 'Backend Status',
      submenu: [
        {
          label: 'Restart Backend',
          click: () => {
            restartBackend();
          }
        },
        {
          label: 'Check Health',
          click: async () => {
            try {
              const response = await fetch('http://localhost:8000/healthz');
              const data = await response.json();
              console.log('Backend health:', data);
            } catch (error) {
              console.error('Backend health check failed:', error);
            }
          }
        }
      ]
    },
    { type: 'separator' },
    {
      label: 'Quit Nova',
      click: () => {
        app.quit();
      }
    }
  ]);
  
  tray.setToolTip('Nova Voice Assistant');
  tray.setContextMenu(contextMenu);
  
  // Tray click toggles window visibility
  tray.on('click', () => {
    if (mainWindow) {
      if (mainWindow.isVisible()) {
        mainWindow.hide();
      } else {
        mainWindow.show();
        mainWindow.focus();
      }
    }
  });
}

function startBackend() {
  console.log('🚀 Starting Nova backend...');
  
  const backendPath = path.join(__dirname, 'backend', 'server.mjs');
  backendProcess = spawn('node', [backendPath], {
    stdio: 'inherit',
    cwd: __dirname,
    env: { ...process.env, NODE_ENV: 'development' }
  });
  
  backendProcess.on('error', (error) => {
    console.error('❌ Failed to start backend:', error);
  });
  
  backendProcess.on('exit', (code) => {
    console.log(`🛑 Backend exited with code ${code}`);
  });
}

function restartBackend() {
  if (backendProcess) {
    console.log('🔄 Restarting backend...');
    backendProcess.kill('SIGTERM');
    setTimeout(() => {
      startBackend();
    }, 1000);
  }
}

app.whenReady().then(() => {
  // Start backend first
  startBackend();
  
  // Wait a bit for backend to start, then create window and tray
  setTimeout(() => {
    createWindow();
    createTray();
  }, 2000);
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow();
  }
});

app.on('before-quit', () => {
  console.log('🛑 Shutting down Nova...');
  
  if (tray) {
    tray.destroy();
  }
  
  if (backendProcess) {
    console.log('🛑 Terminating backend...');
    backendProcess.kill('SIGTERM');
  }
});

// Handle app quit
app.on('quit', () => {
  console.log('👋 Nova shutdown complete');
});
