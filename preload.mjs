import { contextBridge, ipcRenderer } from 'electron';

// Expose protected methods that allow the renderer process to use
// the ipcRenderer without exposing the entire object
contextBridge.exposeInMainWorld('novaAPI', {
  // Window management
  minimize: () => ipcRenderer.send('window-minimize'),
  maximize: () => ipcRenderer.send('window-maximize'),
  close: () => ipcRenderer.send('window-close'),
  
  // App information
  getVersion: () => ipcRenderer.invoke('get-version'),
  getPlatform: () => ipcRenderer.invoke('get-platform'),
  
  // Backend communication
  backendHealth: async () => {
    try {
      const response = await fetch('http://localhost:8000/healthz');
      return await response.json();
    } catch (error) {
      return { error: error.message };
    }
  },
  
  // File system access (limited)
  openFile: (filePath) => ipcRenderer.invoke('open-file', filePath),
  saveFile: (filePath, content) => ipcRenderer.invoke('save-file', filePath, content),
  
  // System notifications
  showNotification: (title, body) => ipcRenderer.send('show-notification', title, body),
  
  // App lifecycle
  quit: () => ipcRenderer.send('app-quit'),
  
  // Development helpers
  isDev: process.env.NODE_ENV === 'development',
  
  // Logging (for debugging)
  log: (level, message) => {
    if (process.env.NODE_ENV === 'development') {
      console.log(`[Nova] ${level}:`, message);
    }
  }
});

// Handle window controls
ipcRenderer.on('window-controls', (event, action) => {
  switch (action) {
    case 'minimize':
      // Handle minimize
      break;
    case 'maximize':
      // Handle maximize
      break;
    case 'close':
      // Handle close
      break;
  }
});

// Log preload completion
console.log('🔒 Nova preload script loaded');

