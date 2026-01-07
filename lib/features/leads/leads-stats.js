// Leads stats functions
async function updateLeadsStats() {
  const stats = await ipcRenderer.invoke('get-leads-stats');
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
