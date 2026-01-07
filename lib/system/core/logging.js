// Logging functionality
const { app } = require('electron');
const fs = require('fs').promises;
const path = require('path');

const USER_DATA_PATH = app.getPath('userData');
const LOGS_FILE = path.join(USER_DATA_PATH, 'logs.txt');

let mainWindow = null;

function setMainWindow(window) {
  mainWindow = window;
}

async function log(message) {
  const timestamp = new Date().toISOString();
  const logMessage = `[${timestamp}] ${message}\n`;

  try {
    await fs.appendFile(LOGS_FILE, logMessage);
    if (mainWindow && !mainWindow.isDestroyed()) {
      try {
        mainWindow.webContents.send('log-update', { timestamp, message });
      } catch (err) {
        // Ignore
      }
    }
  } catch (error) {
    console.error('Failed to write log:', error);
  }
}

module.exports = { log, setMainWindow, LOGS_FILE };