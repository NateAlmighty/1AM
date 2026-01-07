// Tab switching functionality
function switchTab(tabName) {
  // Hide all tabs
  document.querySelectorAll('.tab-content').forEach(tab => {
    tab.classList.remove('active');
  });

  // Remove active state from all buttons
  document.querySelectorAll('.tab-btn').forEach(btn => {
    btn.classList.remove('border-purple-600', 'text-purple-600', 'font-semibold');
    btn.classList.add('border-transparent', 'text-gray-600');
  });

  // Show selected tab
  const selectedTab = document.getElementById(`${tabName}-tab`);
  if (selectedTab) {
    selectedTab.classList.add('active');
  }

  // Highlight selected button
  if (event && event.target) {
    event.target.classList.remove('border-transparent', 'text-gray-600');
    event.target.classList.add('border-purple-600', 'text-purple-600', 'font-semibold');
  }

  // Load data based on tab
  if (tabName === 'logs') {
    loadLogs();
  } else if (tabName === 'leads') {
    loadLeads();
  }
}

// Load logs
async function loadLogs() {
  const logs = await window.electronAPI.getLogs();
  const logsContainer = document.getElementById('logs-container');
  if (logsContainer) {
    logsContainer.textContent = logs;
  }
}

// Modal management
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
