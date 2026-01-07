// Scan management (FRONTEND)

// Toggle global scan
async function toggleGlobalScan() {
  const settings = await window.electronAPI.getSettings();
  settings.globalScanEnabled = !settings.globalScanEnabled;
  await window.electronAPI.saveSettings(settings);
  updateGlobalScanButton(settings.globalScanEnabled);
  updateScanStatus();
}

// Update global scan button appearance
function updateGlobalScanButton(isEnabled) {
  const button = document.getElementById('global-scan-button');
  if (!button) return;

  if (isEnabled) {
    button.textContent = 'Disable Global Scan';
    button.classList.remove('bg-gray-600', 'hover:bg-gray-700');
    button.classList.add('bg-red-600', 'hover:bg-red-700');
  } else {
    button.textContent = 'Enable Global Scan';
    button.classList.remove('bg-red-600', 'hover:bg-red-700');
    button.classList.add('bg-green-600', 'hover:bg-green-700');
  }
}

// Update scan status
async function updateScanStatus() {
  const status = await window.electronAPI.getScanStatus();
  const indicator = document.getElementById('scan-status-indicator');
  const text = document.getElementById('scan-status-text');

  if (!indicator || !text) return;

  indicator.className = 'status-indicator';

  if (status.isScanning) {
    indicator.classList.add('status-scanning');
    text.textContent = 'Scanning in Progress...';
  } else if (status.globalScanEnabled) {
    indicator.classList.add('status-active');
    text.textContent = 'Scan Active (Next cycle in progress)';
  } else {
    indicator.classList.add('status-inactive');
    text.textContent = 'Scan Inactive';
  }
}

// Scan single client
async function scanSingleClient(clientIndex) {
  const clients = await window.electronAPI.getClients();
  const client = clients[clientIndex];

  if (!client) {
    alert('Client not found');
    return;
  }

  if (confirm(`Start manual scan for ${client.businessName} (${client.keywords.join(', ')} in ${client.targetCities.join('; ')})?`)) {
    const result = await window.electronAPI.scanClient(clientIndex);

    if (result.success) {
      alert(`Scan completed! ${result.leadsFound} new lead(s) found.`);
      const leadsTab = document.getElementById('leads-tab');
      if (leadsTab && leadsTab.classList.contains('active')) {
        await loadLeads();
      }
    } else {
      alert(`Scan failed: ${result.error}`);
    }
  }
}