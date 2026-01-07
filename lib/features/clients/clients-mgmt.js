// Clients management
const { app } = require('electron');
const fs = require('fs').promises;
const path = require('path');

const USER_DATA_PATH = app.getPath('userData');
const CLIENTS_FILE = path.join(USER_DATA_PATH, 'clients.json');

// Load clients from file
async function loadClients() {
  try {
    const data = await fs.readFile(CLIENTS_FILE, 'utf-8');
    const clients = JSON.parse(data);
    // Convert keyword string to keywords array for backward compatibility
    // Convert targetCities string to array
    return clients.map(client => ({
      ...client,
      keywords: client.keywords || (client.keyword ? client.keyword.split(',').map(k => k.trim()) : []),
      targetCities: client.targetCities ? client.targetCities.split(';').map(c => c.trim()) : []
    }));
  } catch (error) {
    return [];
  }
}

// Save clients to file
async function saveClients(clients) {
  // Convert keywords array back to string for JSON storage
  // Convert targetCities array back to string
  const clientsToSave = clients.map(client => ({
    ...client,
    keyword: client.keywords ? client.keywords.join(', ') : client.keyword || '',
    targetCities: client.targetCities ? client.targetCities.join('; ') : ''
  }));
  await fs.writeFile(CLIENTS_FILE, JSON.stringify(clientsToSave, null, 2));
}

module.exports = { loadClients, saveClients };
