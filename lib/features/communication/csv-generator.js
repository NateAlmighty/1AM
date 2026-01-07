// CSV generation for lead attachments
const fs = require('fs').promises;
const path = require('path');
const { app } = require('electron');

const USER_DATA_PATH = app.getPath('userData');
const CSV_FOLDER = path.join(USER_DATA_PATH, 'csv_exports');

// Ensure CSV folder exists
async function ensureCSVFolder() {
  try {
    await fs.mkdir(CSV_FOLDER, { recursive: true });
  } catch (error) {
    console.error('Error creating CSV folder:', error);
  }
}

// Format phone number
function formatPhone(phone) {
  if (!phone) return '';
  const digits = phone.replace(/\D/g, '');
  if (digits.length === 10) {
    return `(${digits.slice(0,3)}) ${digits.slice(3,6)}-${digits.slice(6)}`;
  }
  return phone;
}

// Generate CSV content from leads
function generateCSVContent(leads) {
  const headers = [
    'Business Name',
    'Phone Number',
    'Street',
    'City',
    'Zip Code',
    'Category/Niche',
    'Website URL',
    'Source URL',
    'Date Discovered',
    'Review Count',
    'Rating',
    'Owner/Manager Name'
  ];

  let csv = headers.join(',') + '\n';

  for (const lead of leads) {
    const row = [
      `"${(lead.businessName || '').replace(/"/g, '""')}"`,
      `"${formatPhone(lead.phone)}"`,
      `"${(lead.street || '').replace(/"/g, '""')}"`,
      `"${(lead.city || '').replace(/"/g, '""')}"`,
      `"${lead.zipCode || ''}"`,
      `"${(lead.category || '').replace(/"/g, '""')}"`,
      `"${lead.website || ''}"`,
      `"${lead.googleMapsUrl || ''}"`,
      `"${new Date(lead.foundAt).toLocaleDateString()}"`,
      `"${lead.reviewCount || 0}"`,
      `"${lead.rating || 0}"`,
      `""` // Owner/Manager Name - always blank
    ];
    csv += row.join(',') + '\n';
  }

  return csv;
}

// Create CSV file for a batch of leads
async function createCSVFile(businessType, keyword, city, leads) {
  await ensureCSVFolder();
  
  const date = new Date().toISOString().split('T')[0]; // YYYY-MM-DD
  const sanitizedKeyword = keyword.replace(/[^a-z0-9]/gi, '_');
  const sanitizedCity = city.replace(/[^a-z0-9]/gi, '_');
  const filename = `${businessType}_${sanitizedKeyword}_${sanitizedCity}_${date}.csv`;
  const filepath = path.join(CSV_FOLDER, filename);

  const csvContent = generateCSVContent(leads);
  await fs.writeFile(filepath, csvContent, 'utf-8');

  return filepath;
}

module.exports = {
  createCSVFile,
  generateCSVContent
};