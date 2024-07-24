const { app, BrowserWindow, Tray, globalShortcut, screen, Notification } = require('electron');
const path = require('path');

let tray;
let playerWindow;
let tankWindow;
let isVisible = false;

function createWindows() {
  const { width, height } = screen.getPrimaryDisplay().workAreaSize;

  playerWindow = new BrowserWindow({
    width: 200,
    height: 100,
    x: 0,
    y: 0,
    frame: false,
    transparent: true,
    alwaysOnTop: true,
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false
    }
  });

  tankWindow = new BrowserWindow({
    width: 200,
    height: 100,
    x: width - 200,
    y: 0,
    frame: false,
    transparent: true,
    alwaysOnTop: true,
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false
    }
  });

  playerWindow.loadFile('player.html');
  tankWindow.loadFile('tank.html');

  playerWindow.setAlwaysOnTop(true, 'screen-saver');
  tankWindow.setAlwaysOnTop(true, 'screen-saver');

  playerWindow.setVisibleOnAllWorkspaces(true);
  tankWindow.setVisibleOnAllWorkspaces(true);

  playerWindow.hide();
  tankWindow.hide();
}

function toggleWindows() {
  isVisible = !isVisible;
  if (isVisible) {
    playerWindow.show();
    tankWindow.show();
  } else {
    playerWindow.hide();
    tankWindow.hide();
  }
}

app.whenReady().then(() => {
  createWindows();

  tray = new Tray(path.join(__dirname, 'icon.png'));
  tray.setToolTip('TankWatch');

  tray.on('click', toggleWindows);

  globalShortcut.register('CommandOrControl+Shift+T', toggleWindows);

  app.on('activate', function () {
    if (BrowserWindow.getAllWindows().length === 0) createWindows();
  });

  // Show notification
  new Notification({ 
    title: 'TankWatch', 
    body: 'Started',
    silent: true // This prevents the default notification sound
  }).show();
});

app.on('window-all-closed', function () {
  if (process.platform !== 'darwin') app.quit();
});
