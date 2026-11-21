const { app, BrowserWindow, Menu, shell } = require('electron');

const gameUrl = process.env.GAME_URL || 'http://124.223.17.50:3101/original.html';

function createWindow() {
  const window = new BrowserWindow({
    width: 1440,
    height: 900,
    minWidth: 1024,
    minHeight: 640,
    title: '裂隙回收队',
    backgroundColor: '#07131d',
    webPreferences: { contextIsolation: true, nodeIntegration: false }
  });
  window.loadURL(gameUrl);
  window.webContents.setWindowOpenHandler(({ url }) => { shell.openExternal(url); return { action: 'deny' }; });
  Menu.setApplicationMenu(null);
}

app.whenReady().then(() => {
  createWindow();
  app.on('activate', () => { if (BrowserWindow.getAllWindows().length === 0) createWindow(); });
});
app.on('window-all-closed', () => { if (process.platform !== 'darwin') app.quit(); });
