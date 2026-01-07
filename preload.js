const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  // Clients
  getClients: () => ipcRenderer.invoke('get-clients'),
  saveClients: (clients) => ipcRenderer.invoke('save-clients', clients),
  deleteClient: (clientIndex) => ipcRenderer.invoke('delete-client', clientIndex),

  // Settings
  getSettings: () => ipcRenderer.invoke('get-settings'),
  saveSettings: (settings) => ipcRenderer.invoke('save-settings', settings),

  // Leads
  getLeads: (filterClient) => ipcRenderer.invoke('get-leads', filterClient),
  getLeadsStats: () => ipcRenderer.invoke('get-leads-stats'),
  deleteLead: (leadId) => ipcRenderer.invoke('delete-lead', leadId),

  // Scan
  getScanStatus: () => ipcRenderer.invoke('get-scan-status'),
  scanClient: (clientIndex) => ipcRenderer.invoke('scan-client', clientIndex),

  // Logs
  getLogs: () => ipcRenderer.invoke('get-logs'),
  clearLogs: () => ipcRenderer.invoke('clear-logs'),
  onLogUpdate: (callback) => ipcRenderer.on('log-update', (event, data) => callback(data))
});