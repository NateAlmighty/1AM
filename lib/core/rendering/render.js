// Rendering functions
function renderLeadsTable() {
  const tbody = document.getElementById('leads-table-body');
  if (!tbody) return;

  if (filteredLeads.length === 0) {
    tbody.innerHTML = '<tr><td colspan="6" class="px-6 py-4 text-center text-gray-500">No leads found</td></tr>';
    return;
  }

  tbody.innerHTML = filteredLeads.map(lead => {
    const foundDate = new Date(lead.foundAt).toLocaleString();
    const fullAddress = [lead.street, lead.city, lead.zipCode].filter(Boolean).join(', ');
    const formatPhone = (phone) => {
      if (!phone) return '';
      const digits = phone.replace(/\D/g, '');
      if (digits.length === 10) {
        return `(${digits.slice(0,3)}) ${digits.slice(3,6)}-${digits.slice(6)}`;
      }
      return phone;
    };

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
          <a href="${lead.googleMapsUrl}" target="_blank" class="text-purple-600 hover:text-purple-900 font-medium">View Map</a>
          <button onclick="deleteLead(${lead.id})" class="text-red-600 hover:text-red-900 font-medium">Delete</button>
        </td>
      </tr>
    `;
  }).join('');
}

function filterLeads() {
  const filterClient = document.getElementById('filter-client');
  const filterType = document.getElementById('filter-type');
  const clientValue = filterClient ? filterClient.value : '';
  const typeValue = filterType ? filterType.value : '';

  // Start with all leads
  filteredLeads = [...allLeads];

  // Filter by client if selected
  if (clientValue) {
    filteredLeads = filteredLeads.filter(lead => lead.clientEmail === clientValue);
  }

  // Filter by type if selected
  if (typeValue) {
    if (typeValue === 'newly-established') {
      filteredLeads = filteredLeads.filter(lead => !lead.googlePlaceId || !lead.googlePlaceId.startsWith('yelp_api_'));
    } else if (typeValue === 'poaches') {
      filteredLeads = filteredLeads.filter(lead => lead.googlePlaceId && lead.googlePlaceId.startsWith('yelp_api_'));
    }
  }

  renderLeadsTable();
  updateLeadsStats();
}
