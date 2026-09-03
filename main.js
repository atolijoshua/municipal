const { app, BrowserWindow, Menu } = require('electron');
const path = require('path');

// Start the Express & SQLite Backend Server
require('./server.js');

let mainWindow;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 850,
    minWidth: 800,
    minHeight: 600,
    title: 'Daraga ResponD - LGU Daraga Official Application',
    icon: path.join(__dirname, 'public', 'logo.svg'),
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true
    }
  });

  // Remove default menu bar for clean native app feel
  Menu.setApplicationMenu(null);

  // Load local server URL
  mainWindow.loadURL('http://localhost:8000/index.html');

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

app.whenReady().then(() => {
  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});
