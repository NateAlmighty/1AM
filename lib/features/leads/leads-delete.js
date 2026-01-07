// Leads deletion functions
async function deleteLead(leadId) {
  if (confirm('Are you sure you want to delete this lead?')) {
    const result = await ipcRenderer.invoke('delete-lead', leadId);
    if (result.success) {
      await loadLeads();
    } else {
      alert('Failed to delete lead: ' + result.error);
    }
  }
}
