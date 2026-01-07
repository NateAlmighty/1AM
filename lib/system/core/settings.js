// Settings management
const { app } = require('electron');
const fs = require('fs').promises;
const path = require('path');
const nodemailer = require('nodemailer');
const { log } = require('./logging');


const USER_DATA_PATH = app.getPath('userData');
const SETTINGS_FILE = path.join(USER_DATA_PATH, 'settings.json');

let globalScanEnabled = false;
let scanInterval = null;
let transporter = null;

function getPerformGlobalScan() {
  // Lazy load to avoid circular dependency
  return require('../scan/scanning/global-scan').performGlobalScan;
}

function startGlobalScan() {
  if (scanInterval) {
    clearInterval(scanInterval);
  }
  // ✅ USE THE LAZY-LOADED FUNCTION:
  const performGlobalScan = getPerformGlobalScan();
  scanInterval = setInterval(performGlobalScan, 60 * 60 * 1000); // Every hour
  log('🚀 Global scan started');
}


// Load Settings
async function loadSettings() {
  const defaultSettings = {
    smtp: {
      host: 'smtp.gmail.com',
      port: 587,
      user: '',
      pass: ''
    },
    globalScanEnabled: false,
    dryRunMode: false,
    yelpApiKey: ''
  };

  try {
    const data = await fs.readFile(SETTINGS_FILE, 'utf-8');
    const savedSettings = JSON.parse(data);
    return {
      ...defaultSettings,
      ...savedSettings,
      smtp: { ...defaultSettings.smtp, ...savedSettings.smtp }
    };
  } catch (error) {
    return defaultSettings;
  }
}

// Save settings
async function saveSettings(settings) {
  await fs.writeFile(SETTINGS_FILE, JSON.stringify(settings, null, 2));

  const wasEnabled = globalScanEnabled;
  globalScanEnabled = settings.globalScanEnabled;

  if (settings.smtp.user && settings.smtp.pass) {
    try {
      transporter = nodemailer.createTransporter({
        host: settings.smtp.host,
        port: settings.smtp.port,
        secure: false,
        auth: {
          user: settings.smtp.user,
          pass: settings.smtp.pass
        }
      });
      await log('📧 Email transporter configured successfully');
    } catch (error) {
      await log(`❌ Failed to create email transporter: ${error.message}`);
      transporter = null;
    }
  }

  if (globalScanEnabled && !wasEnabled) {
    if (scanInterval) {
      clearInterval(scanInterval);
      scanInterval = null;
    }
    startGlobalScan();
  } else if (!globalScanEnabled && scanInterval) {
    clearInterval(scanInterval);
    scanInterval = null;
    await log('⏸ Global scan disabled');
  }
}

module.exports = { loadSettings, saveSettings };
