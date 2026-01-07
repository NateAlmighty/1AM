// IPC handlers
const { ipcMain } = require('electron');
const fs = require('fs').promises;
const path = require('path');
const { getClientDatabase, getClientDbPath, saveDatabase } = require('../../core/database/client-db');
const { log, LOGS_FILE } = require('../../system/core/logging');
const { loadClients, saveClients } = require('../clients/clients-mgmt');
const { loadSettings, saveSettings } = require('../../system/core/settings');
const { checkLeadExists, saveLead } = require('../leads/leads-mgmt');
const { sendEmailBatch } = require('./email');
const globalScan = require('../../system/scan/scanning/global-scan');
const scrapers = require('../../system/scan/scanning/scrapers');

// Local scanning state
let localIsScanning = false;

// IPC handlers for main process
ipcMain.handle('get-clients', async () => {
  return await loadClients();
});

ipcMain.handle('save-clients', async (event, clients) => {
  await saveClients(clients);
});

ipcMain.handle('delete-client', async (event, clientIndex) => {
  const clients = await loadClients();
  if (clientIndex >= 0 && clientIndex < clients.length) {
    const clientEmail = clients[clientIndex].email;
    clients.splice(clientIndex, 1);
    await saveClients(clients);

    // Delete the client's database file
    const dbPath = getClientDbPath(clientEmail);
    try {
      await fs.unlink(dbPath);
      await log(`🗑️ Deleted database for client: ${clientEmail}`);
    } catch (error) {
      await log(`⚠️ Could not delete database file for ${clientEmail}: ${error.message}`);
    }

    return { success: true };
  }
  return { success: false, error: 'Client not found' };
});

ipcMain.handle('get-settings', async () => {
  return await loadSettings();
});

ipcMain.handle('save-settings', async (event, settings) => {
  await saveSettings(settings);
});

ipcMain.handle('get-leads', async (event, filterClient) => {
  if (!filterClient) {
    // Return all leads from all clients
    const clients = await loadClients();
    let allLeads = [];

    for (const client of clients) {
      try {
        const { db } = await getClientDatabase(client.email);
        const result = db.exec(`
          SELECT l.*, sh.status as scanStatus, sh.error as scanError, sh.scannedAt
          FROM leads l
          LEFT JOIN scan_history sh ON sh.id = (
            SELECT id FROM scan_history
            WHERE status IN ('success', 'failed')
            ORDER BY scannedAt DESC LIMIT 1
          )
          ORDER BY l.foundAt DESC
        `);

        if (result.length > 0 && result[0].values.length > 0) {
          const columns = result[0].columns;
          const values = result[0].values;

          for (const row of values) {
            const lead = {};
            columns.forEach((col, index) => {
              lead[col] = row[index];
            });
            lead.clientEmail = client.email;
            allLeads.push(lead);
          }
        }
      } catch (error) {
        console.error(`Error loading leads for ${client.email}:`, error);
      }
    }

    return allLeads;
  } else {
    // Return leads for specific client
    try {
      const { db } = await getClientDatabase(filterClient);
      const result = db.exec(`
        SELECT l.*, sh.status as scanStatus, sh.error as scanError, sh.scannedAt
        FROM leads l
        LEFT JOIN scan_history sh ON sh.id = (
          SELECT id FROM scan_history
          WHERE status IN ('success', 'failed')
          ORDER BY scannedAt DESC LIMIT 1
        )
        ORDER BY l.foundAt DESC
      `);

      if (result.length > 0 && result[0].values.length > 0) {
        const columns = result[0].columns;
        const values = result[0].values;

        const leads = values.map(row => {
          const lead = {};
          columns.forEach((col, index) => {
            lead[col] = row[index];
          });
          lead.clientEmail = filterClient;
          return lead;
        });

        return leads;
      }
    } catch (error) {
      console.error(`Error loading leads for ${filterClient}:`, error);
    }
    return [];
  }
});

ipcMain.handle('get-leads-stats', async () => {
  const clients = await loadClients();
  const totalClients = clients.filter(c => c.isActive).length;

  let total = 0;
  let today = 0;
  let thisWeek = 0;

  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);

  const weekStart = new Date();
  weekStart.setDate(weekStart.getDate() - 7);

  for (const client of clients) {
    try {
      const { db } = await getClientDatabase(client.email);
      const result = db.exec('SELECT COUNT(*) as count FROM leads');
      if (result.length > 0 && result[0].values.length > 0) {
        total += result[0].values[0][0];
      }

      const todayResult = db.exec('SELECT COUNT(*) as count FROM leads WHERE foundAt >= ?', [todayStart.toISOString()]);
      if (todayResult.length > 0 && todayResult[0].values.length > 0) {
        today += todayResult[0].values[0][0];
      }

      const weekResult = db.exec('SELECT COUNT(*) as count FROM leads WHERE foundAt >= ?', [weekStart.toISOString()]);
      if (weekResult.length > 0 && weekResult[0].values.length > 0) {
        thisWeek += weekResult[0].values[0][0];
      }
    } catch (error) {
      console.error(`Error getting stats for ${client.email}:`, error);
    }
  }

  return { total, totalClients, today, thisWeek };
});

ipcMain.handle('delete-lead', async (event, leadId) => {
  const clients = await loadClients();

  for (const client of clients) {
    try {
      const { db, dbPath } = await getClientDatabase(client.email);
      db.run('DELETE FROM leads WHERE id = ?', [leadId]);
      await saveDatabase(db, dbPath);
      return { success: true };
    } catch (error) {
      console.error(`Error deleting lead ${leadId} for ${client.email}:`, error);
    }
  }

  return { success: false, error: 'Lead not found' };
});

ipcMain.handle('get-scan-status', async () => {
  return {
    isScanning: localIsScanning || globalScan.isScanning,
    globalScanEnabled: globalScan.globalScanEnabled
  };
});

ipcMain.handle('get-logs', async () => {
  try {
    const logs = await fs.readFile(LOGS_FILE, 'utf-8');
    return logs;
  } catch (error) {
    return '';
  }
});

ipcMain.handle('clear-logs', async () => {
  try {
    await fs.writeFile(LOGS_FILE, '');
  } catch (error) {
    console.error('Error clearing logs:', error);
  }
});

// Manual scan handler
ipcMain.handle('scan-client', async (event, clientIndex) => {
  const clients = await loadClients();
  const client = clients[clientIndex];
  if (!client) {
    return { success: false, error: 'Client not found' };
  }
  if (localIsScanning) {
    return { success: false, error: 'A scan is already in progress. Please wait.' };
  }
  localIsScanning = true;
  try {
    const settings = await loadSettings();
    let googleBatches = [];
    let yelpBatches = [];
    for (const keyword of client.keywords) {
      for (const targetCity of client.targetCities) {
        const tempClient = {
          ...client,
          keyword: keyword,
          targetCity: targetCity
        };

        try {
          const googleLeadsResult = await scrapers.scrapeGoogleMapsForClientBatch(tempClient, settings.dryRunMode);
          if (googleLeadsResult.leads.length > 0) {
            googleBatches.push({
              keyword: keyword,
              targetCity: targetCity,
              leads: googleLeadsResult.leads
            });
          }
          await new Promise(resolve => setTimeout(resolve, 5000));

          const yelpLeadsResult = await scrapers.scrapeYelpForClientBatch(tempClient, settings.dryRunMode);
          if (yelpLeadsResult.leads.length > 0) {
            yelpBatches.push({
              keyword: keyword,
              targetCity: targetCity,
              leads: yelpLeadsResult.leads
            });
          }
          await new Promise(resolve => setTimeout(resolve, 5000));

        } catch (combinationError) {
          await log(`❌ Failed to scan combination "${keyword}" in ${targetCity} for ${client.businessName}: ${combinationError.message}`);
        }
      }
    }

    if (googleBatches.length > 0 || yelpBatches.length > 0) {
      await sendEmailBatch(client, { google: googleBatches, yelp: yelpBatches }, settings.dryRunMode);
    }

    const totalGoogleLeads = googleBatches.reduce((sum, batch) => sum + batch.leads.length, 0);
    const totalYelpLeads = yelpBatches.reduce((sum, batch) => sum + batch.leads.length, 0);
    const totalLeads = totalGoogleLeads + totalYelpLeads;

    return { success: true, leadsFound: totalLeads };
  } catch (error) {
    return { success: false, error: error.message };
  } finally {
    localIsScanning = false;
  }
});
