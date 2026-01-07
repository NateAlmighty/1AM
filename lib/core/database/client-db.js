// Client database management
const path = require('path');
const fs = require('fs').promises;
const { DB_FOLDER, getSQL } = require('./db-init');

let clientDatabases = {}; // Store database instances per client

// Get database path for a client
function getClientDbPath(clientEmail) {
  const safeName = clientEmail.replace(/[^a-z0-9]/gi, '_').toLowerCase();
  return path.join(DB_FOLDER, `leads_${safeName}.db`);
}

// Initialize or get database for a client
async function getClientDatabase(clientEmail) {
  if (clientDatabases[clientEmail]) {
    return clientDatabases[clientEmail];
  }

  const SQL = getSQL(); // Get initialized SQL instance
  const dbPath = getClientDbPath(clientEmail);
  let db;

  try {
    // Check if file exists first
    await fs.access(dbPath);
    // File exists, read it
    const buffer = await fs.readFile(dbPath);
    db = new SQL.Database(buffer);
  } catch (error) {
    // File doesn't exist or can't be read, create new database
    db = new SQL.Database();
  }

  // Create leads table
  db.run(`
    CREATE TABLE IF NOT EXISTS leads (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      compositeKey TEXT UNIQUE NOT NULL,
      googlePlaceId TEXT NOT NULL,
      businessName TEXT,
      street TEXT,
      city TEXT,
      zipCode TEXT,
      phone TEXT,
      website TEXT,
      googleMapsUrl TEXT,
      reviewCount INTEGER,
      rating REAL,
      category TEXT,
      searchKeyword TEXT,
      targetCity TEXT,
      foundAt TEXT NOT NULL
    )
  `);

  // Create scan history table
  db.run(`
    CREATE TABLE IF NOT EXISTS scan_history (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      status TEXT NOT NULL,
      leadsFound INTEGER NOT NULL,
      error TEXT,
      scannedAt TEXT NOT NULL
    )
  `);

  // Create indexes
  db.run(`CREATE INDEX IF NOT EXISTS idx_composite_key ON leads(compositeKey)`);
  db.run(`CREATE INDEX IF NOT EXISTS idx_found_at ON leads(foundAt)`);

  await saveDatabase(db, dbPath);

  clientDatabases[clientEmail] = { db, dbPath };
  return clientDatabases[clientEmail];
}

// Save database to file
async function saveDatabase(db, dbPath) {
  if (db) {
    try {
      // Ensure the directory exists
      const dir = path.dirname(dbPath);
      await fs.mkdir(dir, { recursive: true });

      // Save the database
      const data = db.export();
      await fs.writeFile(dbPath, Buffer.from(data));
    } catch (error) {
      console.error('Error saving database:', error);
      throw error;
    }
  }
}

// Close and save all databases
async function closeAllDatabases() {
  for (const clientEmail in clientDatabases) {
    const { db, dbPath } = clientDatabases[clientEmail];
    await saveDatabase(db, dbPath);
    db.close();
  }
  clientDatabases = {};
}

// Force save all databases to disk
async function forceSaveAllDatabases() {
  for (const clientEmail in clientDatabases) {
    const { db, dbPath } = clientDatabases[clientEmail];
    await saveDatabase(db, dbPath);
  }
}

module.exports = {
  getClientDatabase,
  getClientDbPath,
  saveDatabase,
  closeAllDatabases,
  forceSaveAllDatabases
};