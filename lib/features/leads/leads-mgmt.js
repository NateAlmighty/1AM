// Leads management functions
const { getClientDatabase, saveDatabase } = require('../../core/database/client-db');

// Check if lead exists
function checkLeadExists(db, googlePlaceId, keyword, targetCity) {
  const compositeKey = `${googlePlaceId}_${keyword}_${targetCity}`;
  const result = db.exec('SELECT id FROM leads WHERE compositeKey = ?', [compositeKey]);
  return result.length > 0 && result[0].values.length > 0;
}

// Save lead to database
async function saveLead(clientEmail, lead) {
  const { db, dbPath } = await getClientDatabase(clientEmail);
  const compositeKey = `${lead.googlePlaceId}_${lead.searchKeyword}_${lead.targetCity}`;

  const cleanText = (text) => {
    if (!text) return text;
    return text
      .replace(/[\u200B-\u200D\uFEFF\u00A0]/g, '')
      .replace(/[^\x20-\x7E]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
  };

  try {
    db.run(`
      INSERT INTO leads (
        compositeKey, googlePlaceId, businessName,
        street, city, zipCode, phone, website, googleMapsUrl, reviewCount,
        rating, category, searchKeyword, targetCity, foundAt
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, [
      compositeKey,
      lead.googlePlaceId || '',
      cleanText(lead.businessName) || 'Unknown',
      cleanText(lead.street) || '',
      cleanText(lead.city) || '',
      cleanText(lead.zipCode) || '',
      cleanText(lead.phone) || '',
      lead.website || '',
      lead.googleMapsUrl || '',
      lead.reviewCount || 0,
      lead.rating || 0,
      cleanText(lead.category) || '',
      lead.searchKeyword || '',
      lead.targetCity || '',
      new Date().toISOString()
    ]);
    await saveDatabase(db, dbPath);
    return true;
  } catch (error) {
    if (error && error.message && error.message.includes('UNIQUE constraint')) {
      return false;
    }
    console.error('Error saving lead:', error);
    throw error;
  }
}

// Save scan history
async function saveScanHistory(clientEmail, status, leadsFound, error = null) {
  const { db, dbPath } = await getClientDatabase(clientEmail);
  db.run(`
    INSERT INTO scan_history (status, leadsFound, error, scannedAt)
    VALUES (?, ?, ?, ?)
  `, [
    status,
    leadsFound,
    error,
    new Date().toISOString()
  ]);
  await saveDatabase(db, dbPath);
}

module.exports = { checkLeadExists, saveLead, saveScanHistory };