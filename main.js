const { app, BrowserWindow, Tray, globalShortcut, screen, Notification, ipcMain } = require('electron');
const path = require('path');
const axios = require('axios');
let store;
let tray;
let playerWindow;
let tankWindow;
let settingsWindow;
let settingsCogWindow;
let isVisible = false;

async function initializeStore() {
  const Store = await import('electron-store');
  store = new Store.default();
}

async function createWindows() {
  await initializeStore();
 
  const { width, height } = screen.getPrimaryDisplay().workAreaSize;
  const playerConfig = { width: 400, height: 300, x: 0, y: 0 };
  const tankConfig = { width: 200, height: 100, x: width - 200, y: 0 };
  const cogConfig = store.get('settingsCog', { width: 40, height: 40, x: width - 50, y: height - 50 });

  playerWindow = new BrowserWindow({
    ...playerConfig,
    frame: false,
    transparent: true,
    alwaysOnTop: true,
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false
    }
  });

  tankWindow = new BrowserWindow({
    ...tankConfig,
    frame: false,
    transparent: true,
    alwaysOnTop: true,
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false
    }
  });

  settingsCogWindow = new BrowserWindow({
    ...cogConfig,
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
  settingsCogWindow.loadFile('settingsCog.html');

  playerWindow.setAlwaysOnTop(true, 'screen-saver');
  tankWindow.setAlwaysOnTop(true, 'screen-saver');
  settingsCogWindow.setAlwaysOnTop(true, 'screen-saver');

  playerWindow.setVisibleOnAllWorkspaces(true);
  tankWindow.setVisibleOnAllWorkspaces(true);
  settingsCogWindow.setVisibleOnAllWorkspaces(true);

  playerWindow.hide();
  tankWindow.hide();
  settingsCogWindow.hide();

  settingsCogWindow.on('moved', () => {
    const bounds = settingsCogWindow.getBounds();
    store.set('settingsCog', bounds);
  });

  createSettingsWindow();
}

function createSettingsWindow() {
  const { width, height } = screen.getPrimaryDisplay().workAreaSize;
  settingsWindow = new BrowserWindow({
    width: 300,
    height: 200,
    x: Math.round(width / 2 - 150),
    y: Math.round(height / 2 - 100),
    frame: false,
    transparent: true,
    alwaysOnTop: true,
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false
    }
  });

  settingsWindow.loadFile('settings.html');
  settingsWindow.hide();
}

function toggleWindows() {
  isVisible = !isVisible;
  if (isVisible) {
    playerWindow.show();
    tankWindow.show();
    settingsCogWindow.show();
  } else {
    playerWindow.hide();
    tankWindow.hide();
    settingsCogWindow.hide();
    settingsWindow.hide();
  }
}

if (process.platform === 'win32') {
  app.setAppUserModelId("com.yourcompany.TankWatch");
}

app.whenReady().then(async () => {
  await createWindows();

  const username = store.get('username');
  if (username) {
    fetchPlayerData(username);
  }

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
    icon: path.join(__dirname, 'icon.png'),
    silent: true
  }).show();
});

app.on('window-all-closed', function () {
  if (process.platform !== 'darwin') app.quit();
});

ipcMain.on('submit-username', async (event, username) => {
  store.set('username', username);
  await fetchPlayerData(username);
  tankWindow.webContents.send('update-username', username);
});

ipcMain.on('update-username', async (event, newUsername) => {
  store.set('username', newUsername);
  await fetchPlayerData(newUsername);
  tankWindow.webContents.send('update-username', newUsername);
});

ipcMain.on('toggle-settings', () => {
  if (settingsWindow.isVisible()) {
    settingsWindow.hide();
  } else {
    const { width, height } = screen.getPrimaryDisplay().workAreaSize;
    settingsWindow.setPosition(Math.round(width / 2 - 150), Math.round(height / 2 - 100));
    settingsWindow.show();
  }
});

async function fetchPlayerData(username) {
  try {
    const playerId = username.replace('#', '-');
    const response = await axios.get(`https://overfast-api.tekrop.fr/players/${playerId}/summary`);
    playerWindow.webContents.send('player-data', response.data);
  } catch (error) {
    console.error('Error fetching player data:', error);
    playerWindow.webContents.send('player-data-error', 'Failed to fetch player data');
  }
}