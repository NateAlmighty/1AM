const { app, BrowserWindow, ipcMain } = require('electron');
const path = require('path');

// Import all modules
const { initDatabase } = require('./lib/core/database/db-init');
const { getClientDatabase, closeAllDatabases, forceSaveAllDatabases } = require('./lib/core/database/client-db');
const { log, setMainWindow } = require('./lib/system/core/logging');
const { loadClients, saveClients } = require('./lib/features/clients/clients-mgmt');
const { loadSettings, saveSettings } = require('./lib/system/core/settings');
const { checkLeadExists, saveLead, saveScanHistory } = require('./lib/features/leads/leads-mgmt');
const { sendEmailBatch } = require('./lib/features/communication/email');
const { performGlobalScan, isScanning, globalScanEnabled, scanInterval } = require('./lib/system/scan/scanning/global-scan');
const { scrapeGoogleMapsForClientBatch, scrapeYelpForClientBatch } = require('./lib/system/scan/scanning/scrapers');

// Import IPC handlers
require('./lib/features/communication/ipc-handlers');

let mainWindow;
let transporter = null;
let saveInterval = null;

// Application initialization
async function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      enableRemoteModule: false,
      preload: path.join(__dirname, 'preload.js')
    },
    icon: path.join(__dirname, 'assets', 'icon.png'),
    show: false
  });

  // Set the main window reference for logging
  setMainWindow(mainWindow);

  mainWindow.loadFile('index.html');

  mainWindow.once('ready-to-show', () => {
    mainWindow.show();
  });

  mainWindow.on('closed', () => {
    mainWindow = null;
  });

  // Set up periodic save interval
  saveInterval = setInterval(async () => {
    try {
      await forceSaveAllDatabases();
    } catch (error) {
      console.error('Error during periodic save:', error);
    }
  }, 30000); // Save every 30 seconds
}

// App event handlers
app.whenReady().then(async () => {
  await initDatabase();
  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on('window-all-closed', async () => {
  if (saveInterval) {
    clearInterval(saveInterval);
  }
  if (process.platform !== 'darwin') {
    await closeAllDatabases();
    app.quit();
  }
});

app.on('before-quit', async (event) => {
  event.preventDefault();
  if (saveInterval) {
    clearInterval(saveInterval);
  }
  await closeAllDatabases();
  app.exit();
});