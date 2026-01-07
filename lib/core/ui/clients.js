// Client management functions
function editClient(index) {
  const client = clients[index];
  document.getElementById('modal-title').textContent = 'Edit Client';
  document.getElementById('edit-index').value = index;
  document.getElementById('client-business-name').value = client.businessName;
  document.getElementById('client-contact-name').value = client.contactName;
  document.getElementById('client-email').value = client.email;
  document.getElementById('client-cities').value = client.targetCities.join('; ');
  document.getElementById('client-keyword').value = client.keywords.join(', ');
  document.getElementById('client-active').checked = client.isActive;
  document.getElementById('client-modal').classList.remove('hidden');
}

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

async function scanSingleClient(clientIndex) {
  const client = clients[clientIndex];

  if (!client) {
    alert('Client not found');
    return;
  }

  if (confirm(`Start manual scan for ${client.businessName} (${client.keywords.join(', ')} in ${client.targetCities.join('; ')})?`)) {
    const result = await ipcRenderer.invoke('scan-client', clientIndex);

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
