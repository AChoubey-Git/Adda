const { app, BrowserWindow, Notification, ipcMain, shell } = require('electron');
const path = require('path');
const isDev = process.env.NODE_ENV === "development" ||
  process.env.ELECTRON_DEV === "true" ||
  Boolean(process.defaultApp) ||
  /[\\/]electron[\\/]/.test(process.execPath);

let mainWindow;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 800,
    minWidth: 900,
    minHeight: 600,
    titleBarStyle: 'hiddenInset',
    frame: false,
    backgroundColor: '#0f1117',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
    icon: path.join(__dirname, '../public/icon.png'),
    title: 'Adda',
  });

  const url = isDev
    ? 'http://localhost:3000'
    : `file://${path.join(__dirname, 'index.html')}`;

  mainWindow.loadURL(url);
  if (isDev) mainWindow.webContents.openDevTools({ mode: 'detach' });
  mainWindow.on('closed', () => { mainWindow = null; });
}

app.whenReady().then(createWindow);
app.on('window-all-closed', () => { if (process.platform !== 'darwin') app.quit(); });
app.on('activate', () => { if (BrowserWindow.getAllWindows().length === 0) createWindow(); });

// ─── Desktop Notifications ────────────────────────────────────────────────────
ipcMain.on('notify', (event, { title, body, icon }) => {
  if (Notification.isSupported()) {
    const notif = new Notification({
      title: `Adda • ${title}`,
      body,
      icon,
    });
    notif.show();
    notif.on('click', () => {
      if (mainWindow) { mainWindow.show(); mainWindow.focus(); }
    });
  }
});

// ─── Window controls ──────────────────────────────────────────────────────────
ipcMain.on('window:minimize', () => mainWindow?.minimize());
ipcMain.on('window:maximize', () => {
  if (mainWindow?.isMaximized()) mainWindow.unmaximize();
  else mainWindow?.maximize();
});
ipcMain.on('window:close', () => mainWindow?.close());
ipcMain.on('open:external', (event, url) => shell.openExternal(url));

// ─── Badge ────────────────────────────────────────────────────────────────────
ipcMain.on('badge:set', (event, count) => {
  if (process.platform === 'darwin') {
    app.dock.setBadge(count > 0 ? String(count) : '');
  }
});
