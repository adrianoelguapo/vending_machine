const { app, BrowserWindow } = require('electron');
const path = require('node:path');

const createWindow = () => {
  const win = new BrowserWindow({
    width: 850,
    height: 1080,
    resizable: false,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js')
    }
  });

  win.loadFile('./html/index.html');
};

app.whenReady().then(() => {
  createWindow();
});