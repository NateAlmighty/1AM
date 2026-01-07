// Client deletion functions
async function deleteClient(index) {
  if (confirm('Are you sure you want to delete this client? This will also delete their separate database.')) {
    const result = await ipcRenderer.invoke('delete-client', index);
    if (result.success) {
      await loadClients();
    } else {
      alert('Failed to delete client: ' + result.error);
    }
  }
}
