// Global variables
let clients = [];
let allLeads = [];
let filteredLeads = [];
let settings = {};

// Initialize app
async function init() {
  await loadClients();
  await updateDashboardStats();
  settings = await window.electronAPI.getSettings();
  await loadSettings();
  await loadLogs();
  updateScanStatus();
  setInterval(updateScanStatus, 5000);
}

// Load clients
async function loadClients() {
  clients = await window.electronAPI.getClients();
  renderClientsTable();
}

// Render clients table
function renderClientsTable() {
  const tbody = document.getElementById('clients-table-body');
  if (!tbody) return;
  if (clients.length === 0) {
    tbody.innerHTML = '<tr><td colspan="7" class="px-6 py-4 text-center text-gray-500">No clients added yet</td></tr>';
    return;
  }
  tbody.innerHTML = clients.map((client, index) => `
    <tr class="hover:bg-gray-50">
      <td class="px-6 py-4 whitespace-nowrap">
        <span class="status-indicator ${client.isActive ? 'status-active' : 'status-inactive'}"></span>
        <span class="text-sm ${client.isActive ? 'text-green-600 font-medium' : 'text-gray-500'}">${client.isActive ? 'Active' : 'Inactive'}</span>
      </td>
      <td class="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">${client.businessName}</td>
      <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-600">${client.contactName || 'N/A'}</td>
      <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-600">${client.email}</td>
      <td class="px-6 py-4 text-sm text-gray-600">${client.targetCities.join('; ')}</td>
      <td class="px-6 py-4 text-sm text-gray-600">${client.keywords.join(', ')}</td>
      <td class="px-6 py-4 whitespace-nowrap text-sm space-x-2">
        <button onclick="scanSingleClient(${index})" class="text-purple-600 hover:text-purple-900 font-medium">Scan</button>
        <button onclick="editClient(${index})" class="text-blue-600 hover:text-blue-900 font-medium">Edit</button>
        <button onclick="deleteClient(${index})" class="text-red-600 hover:text-red-900 font-medium">Delete</button>
      </td>
    </tr>
  `).join('');
}

// Modal functions
function showAddClientModal() {
  document.getElementById('modal-title').textContent = 'Add New Client';
  document.getElementById('client-form').reset();
  document.getElementById('edit-index').value = '';
  document.getElementById('client-active').checked = true;
  document.getElementById('client-modal').classList.remove('hidden');
}

function closeModal() {
  document.getElementById('client-modal').classList.add('hidden');
}

function editClient(index) {
  const client = clients[index];
  document.getElementById('modal-title').textContent = 'Edit Client';
  document.getElementById('edit-index').value = index;
  document.getElementById('client-business-name').value = client.businessName;
  document.getElementById('client-contact-name').value = client.contactName || '';
  document.getElementById('client-email').value = client.email;
  document.getElementById('client-target-cities').value = client.targetCities.join('; ');
  document.getElementById('client-keywords').value = client.keywords.join(', ');
  document.getElementById('client-active').checked = client.isActive;
  document.getElementById('client-modal').classList.remove('hidden');
}

async function deleteClient(index) {
  if (confirm('Are you sure you want to delete this client?')) {
    const result = await window.electronAPI.deleteClient(index);
    if (result.success) {
      await loadClients();
      await updateDashboardStats();
    } else {
      alert('Failed to delete client: ' + result.error);
    }
  }
}

async function saveClientForm(event) {
  event.preventDefault();
  const editIndex = document.getElementById('edit-index').value;
  const client = {
    businessName: document.getElementById('client-business-name').value,
    contactName: document.getElementById('client-contact-name').value,
    email: document.getElementById('client-email').value,
    keywords: document.getElementById('client-keywords').value.split(',').map(k => k.trim()).filter(k => k),
    targetCities: document.getElementById('client-target-cities').value.split(';').map(c => c.trim()).filter(c => c),
    isActive: document.getElementById('client-active').checked
  };
  if (editIndex !== '') {
    clients[parseInt(editIndex)] = client;
  } else {
    clients.push(client);
  }
  await window.electronAPI.saveClients(clients);
  await loadClients();
  await updateDashboardStats();
  closeModal();
}

// Leads functions
async function loadLeads() {
  const filterClient = document.getElementById('filter-client');
  const filterValue = filterClient ? filterClient.value : '';
  allLeads = await window.electronAPI.getLeads(filterValue || null);
  filteredLeads = allLeads;
  renderLeadsTable();
  updateLeadsStats();
  populateClientFilter();
}

function populateClientFilter() {
  const filter = document.getElementById('filter-client');
  if (!filter) return;
  const currentValue = filter.value;
  const uniqueClients = [...new Set(allLeads.map(lead => lead.clientEmail))];
  filter.innerHTML = '<option value="">All Clients</option>';
  uniqueClients.forEach(email => {
    const option = document.createElement('option');
    option.value = email;
    option.textContent = email;
    filter.appendChild(option);
  });
  filter.value = currentValue;
}

function filterLeads() {
  const filterClient = document.getElementById('filter-client');
  const filterType = document.getElementById('filter-type');
  const clientValue = filterClient ? filterClient.value : '';
  const typeValue = filterType ? filterType.value : '';
  filteredLeads = [...allLeads];
  if (clientValue) {
    filteredLeads = filteredLeads.filter(lead => lead.clientEmail === clientValue);
  }
  if (typeValue) {
    if (typeValue === 'newly-established') {
      filteredLeads = filteredLeads.filter(lead => !lead.googlePlaceId || !lead.googlePlaceId.startsWith('yelp_api_'));
    } else if (typeValue === 'poaches') {
      filteredLeads = filteredLeads.filter(lead => lead.googlePlaceId && lead.googlePlaceId.startsWith('yelp_api_'));
    }
  }
  renderLeadsTable();
}

function renderLeadsTable() {
  const tbody = document.getElementById('leads-table-body');
  if (!tbody) return;
  if (filteredLeads.length === 0) {
    tbody.innerHTML = '<tr><td colspan="6" class="px-6 py-4 text-center text-gray-500">No leads found</td></tr>';
    return;
  }
  const formatPhone = (phone) => {
    if (!phone) return '';
    const digits = phone.replace(/\D/g, '');
    if (digits.length === 10) return `(${digits.slice(0,3)}) ${digits.slice(3,6)}-${digits.slice(6)}`;
    return phone;
  };
  tbody.innerHTML = filteredLeads.map(lead => {
    const foundDate = new Date(lead.foundAt).toLocaleString();
    const fullAddress = [lead.street, lead.city, lead.zipCode].filter(Boolean).join(', ');
    return `
      <tr class="hover:bg-gray-50">
        <td class="px-6 py-4">
          <div class="font-medium text-gray-900">${lead.businessName}</div>
          <div class="text-sm text-gray-500">${lead.category || lead.searchKeyword} • ${lead.rating || 'N/A'}⭐ (${lead.reviewCount || 0} reviews)</div>
        </td>
        <td class="px-6 py-4 text-sm text-gray-600">${lead.clientEmail}</td>
        <td class="px-6 py-4 text-sm">
          ${lead.phone ? `<div>📞 ${formatPhone(lead.phone)}</div>` : ''}
          ${lead.website ? `<div class="truncate max-w-xs"><a href="${lead.website}" target="_blank" class="text-purple-600 hover:underline">🌐 Website</a></div>` : ''}
        </td>
        <td class="px-6 py-4 text-sm text-gray-600">
          <div class="font-medium">${lead.city || lead.targetCity}</div>
          ${fullAddress ? `<div class="text-xs text-gray-500 mt-1">${fullAddress}</div>` : ''}
        </td>
        <td class="px-6 py-4 text-sm text-gray-600 whitespace-nowrap">${foundDate}</td>
        <td class="px-6 py-4 text-sm space-x-2 whitespace-nowrap">
          <a href="${lead.googleMapsUrl}" target="_blank" class="text-purple-600 hover:text-purple-900 font-medium">View</a>
          <button onclick="deleteLead(${lead.id})" class="text-red-600 hover:text-red-900 font-medium">Delete</button>
        </td>
      </tr>
    `;
  }).join('');
}

async function updateLeadsStats() {
  const stats = await window.electronAPI.getLeadsStats();
  const statsContainer = document.getElementById('leads-stats');
  if (!statsContainer) return;
  statsContainer.innerHTML = `
    <div class="bg-gradient-to-br from-purple-500 to-purple-600 text-white p-4 rounded-lg">
      <div class="text-3xl font-bold">${stats.total}</div>
      <div class="text-sm opacity-90">Total Leads</div>
    </div>
    <div class="bg-gradient-to-br from-blue-500 to-blue-600 text-white p-4 rounded-lg">
      <div class="text-3xl font-bold">${stats.totalClients}</div>
      <div class="text-sm opacity-90">Active Clients</div>
    </div>
    <div class="bg-gradient-to-br from-green-500 to-green-600 text-white p-4 rounded-lg">
      <div class="text-3xl font-bold">${stats.today}</div>
      <div class="text-sm opacity-90">Today</div>
    </div>
    <div class="bg-gradient-to-br from-orange-500 to-orange-600 text-white p-4 rounded-lg">
      <div class="text-3xl font-bold">${stats.thisWeek}</div>
      <div class="text-sm opacity-90">This Week</div>
    </div>
  `;
}

async function updateDashboardStats() {
  const stats = await window.electronAPI.getLeadsStats();
  document.getElementById('stat-clients').textContent = stats.totalClients;
  document.getElementById('stat-total').textContent = stats.total;
  document.getElementById('stat-today').textContent = stats.today;
  document.getElementById('stat-week').textContent = stats.thisWeek;
}

async function deleteLead(leadId) {
  if (confirm('Are you sure you want to delete this lead?')) {
    const result = await window.electronAPI.deleteLead(leadId);
    if (result.success) {
      await loadLeads();
      await updateDashboardStats();
    }
  }
}

// Scan functions
async function scanSingleClient(clientIndex) {
  const client = clients[clientIndex];
  if (!client) {
    alert('Client not found');
    return;
  }
  if (confirm(`Start manual scan for ${client.businessName}?`)) {
    const result = await window.electronAPI.scanClient(clientIndex);
    if (result.success) {
      alert(`Scan completed! ${result.leadsFound} new lead(s) found.`);
      await loadLeads();
      await updateDashboardStats();
    } else {
      alert(`Scan failed: ${result.error}`);
    }
  }
}

async function toggleGlobalScan() {
  const settings = await window.electronAPI.getSettings();
  settings.globalScanEnabled = !settings.globalScanEnabled;
  await window.electronAPI.saveSettings(settings);
  updateGlobalScanButton(settings.globalScanEnabled);
  updateScanStatus();
}

function updateGlobalScanButton(isEnabled) {
  const button = document.getElementById('global-scan-button');
  if (!button) return;
  if (isEnabled) {
    button.textContent = 'Disable Global Scan';
    button.classList.remove('bg-green-600', 'hover:bg-green-700');
    button.classList.add('bg-red-600', 'hover:bg-red-700');
  } else {
    button.textContent = 'Enable Global Scan';
    button.classList.remove('bg-red-600', 'hover:bg-red-700');
    button.classList.add('bg-green-600', 'hover:bg-green-700');
  }
}

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
    text.textContent = 'Scan Active';
  } else {
    indicator.classList.add('status-inactive');
    text.textContent = 'Scan Inactive';
  }
}

// Settings functions
async function loadSettings() {
  const settings = await window.electronAPI.getSettings();
  document.getElementById('smtp-host').value = settings.smtp.host || 'smtp.gmail.com';
  document.getElementById('smtp-port').value = settings.smtp.port || 587;
  document.getElementById('smtp-user').value = settings.smtp.user || '';
  document.getElementById('smtp-pass').value = settings.smtp.pass || '';
  document.getElementById('yelp-api-key').value = settings.yelpApiKey || '';
  document.getElementById('dry-run-mode').checked = settings.dryRunMode || false;
  updateGlobalScanButton(settings.globalScanEnabled);
}

async function saveSettingsForm(event) {
  event.preventDefault();
  const settings = {
    smtp: {
      host: document.getElementById('smtp-host').value,
      port: parseInt(document.getElementById('smtp-port').value),
      user: document.getElementById('smtp-user').value,
      pass: document.getElementById('smtp-pass').value
    },
    yelpApiKey: document.getElementById('yelp-api-key').value,
    dryRunMode: document.getElementById('dry-run-mode').checked,
    globalScanEnabled: (await window.electronAPI.getSettings()).globalScanEnabled
  };
  await window.electronAPI.saveSettings(settings);
  alert('Settings saved successfully!');
}

// Tab switching
function switchTab(tabName) {
  document.querySelectorAll('.tab-content').forEach(tab => tab.classList.remove('active'));
  document.querySelectorAll('.tab-btn').forEach(btn => {
    btn.classList.remove('border-purple-600', 'text-purple-600', 'font-semibold');
    btn.classList.add('border-transparent', 'text-gray-600');
  });
  const selectedTab = document.getElementById(`${tabName}-tab`);
  if (selectedTab) selectedTab.classList.add('active');
  if (event && event.target) {
    event.target.classList.remove('border-transparent', 'text-gray-600');
    event.target.classList.add('border-purple-600', 'text-purple-600', 'font-semibold');
  }
  if (tabName === 'logs') loadLogs();
  else if (tabName === 'leads') loadLeads();
}

// Logs functions
async function loadLogs() {
  const logs = await window.electronAPI.getLogs();
  const logsContainer = document.getElementById('logs-container');
  if (logsContainer) logsContainer.textContent = logs;
}

async function clearLogs() {
  if (confirm('Are you sure you want to clear all logs?')) {
    await window.electronAPI.clearLogs();
    await loadLogs();
  }
}

// Initialize on load
init();