// Global scan functionality (BACKEND ONLY)
const { log } = require('../../core/logging');
const { loadClients } = require('../../../features/clients/clients-mgmt');
const { loadSettings } = require('../../core/settings');
const { sendEmailBatch } = require('../../../features/communication/email');
const scrapers = require('./scrapers'); // Import the scrapers module

// Use an object to make these mutable when imported
const scanState = {
  isScanning: false,
  globalScanEnabled: false,
  scanInterval: null,
  saveInterval: null
};

// Modify the performGlobalScan function to collect all leads before sending emails
async function performGlobalScan() {
  if (scanState.isScanning) {
    await log('⏸ Scan already in progress, skipping this cycle');
    return;
  }

  scanState.isScanning = true;
  await log('🚀 Starting global scan cycle');

  try {
    const clients = await loadClients();
    const settings = await loadSettings();
    const activeClients = clients.filter(c => c.isActive);

    await log(`Found ${activeClients.length} active client(s)`);

    for (const client of activeClients) {
      let googleBatches = [];
      let yelpBatches = [];

      try {
        // Iterate through each keyword × city combination
        for (const keyword of client.keywords) {
          for (const targetCity of client.targetCities) {
            // Create a temporary client object with the specific keyword and city
            const tempClient = {
              ...client,
              keyword: keyword,
              targetCity: targetCity
            };

            await log(`🔍 Scanning ${client.businessName} - "${keyword}" in ${targetCity}`);

            try {
              // Scan Google Maps for this combination
              const googleLeadsResult = await scrapers.scrapeGoogleMapsForClientBatch(tempClient, settings.dryRunMode);
              if (googleLeadsResult.leads.length > 0) {
                googleBatches.push({
                  keyword: keyword,
                  targetCity: targetCity,
                  leads: googleLeadsResult.leads
                });
              }
              await new Promise(resolve => setTimeout(resolve, 10000));

              // Scan Yelp for this combination
              const yelpLeadsResult = await scrapers.scrapeYelpForClientBatch(tempClient, settings.dryRunMode);
              if (yelpLeadsResult.leads.length > 0) {
                yelpBatches.push({
                  keyword: keyword,
                  targetCity: targetCity,
                  leads: yelpLeadsResult.leads
                });
              }
              await new Promise(resolve => setTimeout(resolve, 10000));

            } catch (combinationError) {
              await log(`❌ Failed to scan combination "${keyword}" in ${targetCity} for ${client.businessName}: ${combinationError.message}`);
              // Continue to next combination
            }
          }
        }

        // Send batched emails for this client
        if (googleBatches.length > 0 || yelpBatches.length > 0) {
          await sendEmailBatch(client, { google: googleBatches, yelp: yelpBatches }, settings.dryRunMode);

          const totalGoogleLeads = googleBatches.reduce((sum, batch) => sum + batch.leads.length, 0);
          const totalYelpLeads = yelpBatches.reduce((sum, batch) => sum + batch.leads.length, 0);
          await log(`📊 Total leads for ${client.businessName}: ${totalGoogleLeads + totalYelpLeads} (Google: ${totalGoogleLeads}, Yelp: ${totalYelpLeads})`);
        }
      } catch (error) {
        await log(`❌ Failed to scan ${client.businessName}, continuing to next client`);
      }
    }

    await log('✅ Global scan cycle completed');
  } catch (error) {
    await log(`❌ Global scan error: ${error.message}`);
  } finally {
    scanState.isScanning = false;
  }
}

// Export backend functions and state
module.exports = {
  performGlobalScan,
  get isScanning() { return scanState.isScanning; },
  get globalScanEnabled() { return scanState.globalScanEnabled; },
  set globalScanEnabled(value) { scanState.globalScanEnabled = value; }
};