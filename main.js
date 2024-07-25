const { app, BrowserWindow, Tray, globalShortcut, screen, Notification, ipcMain, Menu } = require('electron');
const path = require('path');
const axios = require('axios');
const fs = require('fs');
let store;
let tray;
let playerWindow;
let tankWindow;
let tankSelectorWindow;
let settingsWindow;
let settingsCogWindow;
let isVisible = false;

async function initializeStore() {
  const Store = await import('electron-store');
  store = new Store.default();
  
  // Initialize store with default values if not set
  if (!store.get('windowPositions')) {
    const { width, height } = screen.getPrimaryDisplay().workAreaSize;
    store.set('windowPositions', {
      player: { width: 400, height: 300, x: 0, y: 0 },
      tank: { width: 400, height: 300, x: width - 400, y: 0 },
      tankSelector: { width: width - 800, height: 200, x: 400, y: 0 },
      settingsCog: { width: 40, height: 40, x: width - 60, y: height - 60 }
    });
  }
  if (!store.get('isVisible')) {
    store.set('isVisible', false);
  }
  if (!store.get('selectedTank')) {
    store.set('selectedTank', 'Dva');
  }
}

async function createWindows() {
  await initializeStore();
 
  const windowPositions = store.get('windowPositions');
  isVisible = store.get('isVisible');

  playerWindow = new BrowserWindow({
    ...windowPositions.player,
    frame: false,
    transparent: true,
    alwaysOnTop: true,
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false
    }
  });

  tankWindow = new BrowserWindow({
    ...windowPositions.tank,
    frame: false,
    transparent: true,
    alwaysOnTop: true,
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false
    }
  });

  tankSelectorWindow = new BrowserWindow({
    ...windowPositions.tankSelector,
    frame: false,
    transparent: true,
    alwaysOnTop: true,
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false
    }
  });

  settingsCogWindow = new BrowserWindow({
    ...windowPositions.settingsCog,
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
  tankSelectorWindow.loadFile('tankSelector.html');
  settingsCogWindow.loadFile('settingsCog.html');

  playerWindow.setAlwaysOnTop(true, 'screen-saver');
  tankWindow.setAlwaysOnTop(true, 'screen-saver');
  tankSelectorWindow.setAlwaysOnTop(true, 'screen-saver');
  settingsCogWindow.setAlwaysOnTop(true, 'screen-saver');

  playerWindow.setVisibleOnAllWorkspaces(true);
  tankWindow.setVisibleOnAllWorkspaces(true);
  tankSelectorWindow.setVisibleOnAllWorkspaces(true);
  settingsCogWindow.setVisibleOnAllWorkspaces(true);

  if (!isVisible) {
    playerWindow.hide();
    tankWindow.hide();
    tankSelectorWindow.hide();
    settingsCogWindow.hide();
  }

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

function saveWindowPositions() {
  const positions = {};
  
  if (playerWindow && !playerWindow.isDestroyed()) {
    positions.player = playerWindow.getBounds();
  }
  
  if (tankWindow && !tankWindow.isDestroyed()) {
    positions.tank = tankWindow.getBounds();
  }
  
  if (tankSelectorWindow && !tankSelectorWindow.isDestroyed()) {
    positions.tankSelector = tankSelectorWindow.getBounds();
  }
  
  if (settingsCogWindow && !settingsCogWindow.isDestroyed()) {
    positions.settingsCog = settingsCogWindow.getBounds();
  }
  
  if (Object.keys(positions).length > 0) {
    store.set('windowPositions', positions);
  }
}

function toggleWindows() {
  isVisible = !isVisible;
  store.set('isVisible', isVisible);
  if (isVisible) {
    playerWindow.show();
    tankWindow.show();
    tankSelectorWindow.show();
    settingsCogWindow.show();
  } else {
    playerWindow.hide();
    tankWindow.hide();
    tankSelectorWindow.hide();
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
    settingsCogWindow.webContents.send('update-username', username);
  }

  tray = new Tray(path.join(__dirname, 'icon.png'));
  tray.setToolTip('TankWatch');

  const contextMenu = Menu.buildFromTemplate([
    { label: 'Toggle', click: toggleWindows },
    { label: 'Save', click: saveWindowPositions },
    { label: 'Quit', click: () => {
      saveWindowPositions();
      app.quit();
    }}
  ]);

  tray.setContextMenu(contextMenu);
  tray.on('click', toggleWindows);

  globalShortcut.register('Alt+T', toggleWindows);

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

  // Fetch tank data and send to tankSelectorWindow
  fetchTankData();

  // Load and set the previously selected tank
  const selectedTank = store.get('selectedTank');
  tankSelectorWindow.webContents.send('update-selected-tank', selectedTank);
  tankWindow.webContents.send('update-selected-tank', selectedTank);
});

app.on('window-all-closed', function () {
  if (process.platform !== 'darwin') app.quit();
});

app.on('will-quit', () => {
  saveWindowPositions();
});

ipcMain.on('submit-username', async (event, username) => {
  store.set('username', username);
  await fetchPlayerData(username);
  tankWindow.webContents.send('update-username', username);
  settingsCogWindow.webContents.send('update-username', username);
});

ipcMain.on('update-username', async (event, newUsername) => {
  store.set('username', newUsername);
  await fetchPlayerData(newUsername);
  tankWindow.webContents.send('update-username', newUsername);
  settingsCogWindow.webContents.send('update-username', newUsername);
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

async function fetchTankData() {
  try {
    const response = await axios.get('https://overfast-api.tekrop.fr/heroes?role=tank');
    const tankMatchups = JSON.parse(fs.readFileSync('tank_matchups.json', 'utf8'));
    tankWindow.webContents.send('tank-data', { heroes: response.data, matchups: tankMatchups });
    tankSelectorWindow.webContents.send('tank-data', { heroes: response.data, matchups: tankMatchups });
  } catch (error) {
    console.error('Error fetching tank data:', error);
    tankWindow.webContents.send('tank-data-error', 'Failed to fetch tank data');
    tankSelectorWindow.webContents.send('tank-data-error', 'Failed to fetch tank data');
  }
}

ipcMain.on('select-tank', (event, tankName) => {
  store.set('selectedTank', tankName);
  tankSelectorWindow.webContents.send('update-selected-tank', tankName);
  tankWindow.webContents.send('update-selected-tank', tankName);
});

app.on('before-quit', () => {
  saveWindowPositions();
});

app.on('will-quit', () => {
  globalShortcut.unregisterAll();
});