// Database initialization and management
const { app } = require('electron');
const initSqlJs = require('sql.js');
const path = require('path');
const fs = require('fs').promises;

let SQL = null; // Initialize as null

const USER_DATA_PATH = app.getPath('userData');
const DB_FOLDER = path.join(USER_DATA_PATH, 'databases');

// Ensure database folder exists
async function ensureDatabaseFolder() {
  try {
    await fs.mkdir(DB_FOLDER, { recursive: true });
  } catch (error) {
    console.error('Error creating database folder:', error);
  }
}

// Initialize SQL.js
async function initDatabase() {
  if (!SQL) {
    SQL = await initSqlJs();
  }
  await ensureDatabaseFolder();
  return SQL;
}

// Get SQL instance
function getSQL() {
  if (!SQL) {
    throw new Error('SQL.js not initialized. Call initDatabase() first.');
  }
  return SQL;
}

module.exports = { 
  initDatabase, 
  getSQL, // Export getter function
  DB_FOLDER,
  get SQL() { return SQL; } // Also export as getter property
};