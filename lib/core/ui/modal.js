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
