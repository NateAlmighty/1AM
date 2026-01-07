// Initialization
let clients = [];
let settings = {};

// Initialize
async function init() {
  await loadClients();
  settings = await window.electronAPI.getSettings();
  await loadLogs();
  updateScanStatus();

  // Poll scan status every 5 seconds
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
      <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-600">${client.contactName}</td>
      <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-600">${client.email}</td>
      <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-600">${client.targetCities.join('; ')}</td>
      <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-600">${client.keywords.join(', ')}</td>
      <td class="px-6 py-4 whitespace-nowrap text-sm space-x-2">
        <button type="button" onclick="scanSingleClient(${index})" class="text-purple-600 hover:text-purple-900 font-medium">Scan Now</button>
        <button type="button" onclick="editClient(${index})" class="text-blue-600 hover:text-blue-900 font-medium">Edit</button>
        <button type="button" onclick="deleteClient(${index})" class="text-red-600 hover:text-red-900 font-medium">Delete</button>
      </td>
    </tr>
  `).join('');
}

// Initialize on load
init();
