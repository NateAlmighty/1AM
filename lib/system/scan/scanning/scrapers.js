// Scraping functions
const { chromium } = require('playwright');
const { getClientDatabase, saveDatabase } = require('../../../core/database/client-db');
const { checkLeadExists, saveLead, saveScanHistory } = require('../../../features/leads/leads-mgmt');
const { loadSettings } = require('../../core/settings');
const { log } = require('../../core/logging');

// Create new batch versions of scraping functions that return leads instead of sending emails
async function scrapeGoogleMapsForClientBatch(client, dryRun = false, retryCount = 0) {
  const MAX_RETRIES = 2;
  const MAX_NEW_LEADS = 20;
  let browser = null;

  if (!client.targetCity) {
    await log(`   No target city specified, skipping`);
    return { leads: [] };
  }

  try {
    await log(`🔍 Starting scan for ${client.businessName} (${client.contactName}) - ${client.keyword} in ${client.targetCity}`);

    browser = await chromium.launch({
      headless: true,
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-blink-features=AutomationControlled',
        '--disable-features=IsolateOrigins,site-per-process'
      ]
    });

    const context = await browser.newContext({
      userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      viewport: { width: 1920, height: 1080 },
      locale: 'en-US',
      timezoneId: 'America/New_York'
    });

    const page = await context.newPage();
    page.setDefaultTimeout(30000); // Increase timeout to 30 seconds

    // Navigate directly to search URL instead of filling in the search box
    const searchQuery = encodeURIComponent(`${client.keyword} ${client.targetCity}`);
    const directSearchURL = `https://www.google.com/maps/search/${searchQuery}`;
    
    await log(`   Navigating to: ${directSearchURL}`);
    
    try {
      await page.goto(directSearchURL, {
        waitUntil: 'networkidle',
        timeout: 30000
      });
    } catch (error) {
      await log(`   ⚠️ Navigation warning: ${error.message}, continuing...`);
      // Continue anyway - sometimes the page loads but throws a timeout
    }

    // Wait a bit for the page to settle
    await page.waitForTimeout(5000);

    // Check for CAPTCHA
    const captchaPresent = await page.locator('text=/captcha|unusual traffic/i').count() > 0;
    if (captchaPresent) {
      await log(`⚠️ CAPTCHA detected for ${client.businessName}, skipping client`);
      await saveScanHistory(client.email, 'skipped', 0, 'CAPTCHA detected');
      await browser.close();
      return { leads: [] };
    }

    // Wait for results to load
    try {
      await page.waitForSelector('[role="feed"]', { timeout: 20000 });
    } catch (error) {
      await log(`⚠️ No results found for ${client.businessName} - ${client.keyword} in ${client.targetCity}`);
      await saveScanHistory(client.email, 'success', 0);
      await browser.close();
      return { leads: [] };
    }

    const resultsPane = page.locator('[role="feed"]').first();
    await resultsPane.scrollIntoViewIfNeeded();
    await page.waitForTimeout(3000);

    // Get all business listings
    const businessElements = await page.locator('[role="feed"] > div > div > a').all();

    if (businessElements.length === 0) {
      await log(`⚠️ No businesses found for ${client.businessName}`);
      await saveScanHistory(client.email, 'success', 0);
      await browser.close();
      return { leads: [] };
    }

    await log(`   Found ${businessElements.length} total businesses, scanning for NEW ones...`);

    let newLeads = [];
    let processedCount = 0;
    let totalScanned = 0;

    const { db } = await getClientDatabase(client.email);

    for (const businessElement of businessElements) {
      if (newLeads.length >= MAX_NEW_LEADS) {
        await log(`   ✅ Found maximum ${MAX_NEW_LEADS} new leads, stopping scan`);
        break;
      }

      totalScanned++;
      let shouldContinue = false;

      let businessName = 'Unknown Business';
      let hasNewBadge = false;
      let street = null;
      let city = null;
      let zipCode = null;
      let phone = null;
      let website = null;
      let googleMapsUrl = '';
      let googlePlaceId = '';
      let reviewCount = 0;
      let rating = 0;
      let category = client.keyword;

      try {
        await businessElement.click({ timeout: 5000 });
        await page.waitForTimeout(3000);

        try {
          businessName = await page.locator('h1.DUwDvf').first().textContent({ timeout: 3000 });
          if (businessName) businessName = businessName.trim();
        } catch (e) {
          try {
            businessName = await page.locator('h1').first().textContent({ timeout: 3000 });
            if (businessName) businessName = businessName.trim();
          } catch (e2) {
            businessName = 'Unknown Business';
          }
        }

        if (!businessName || businessName === '') {
          businessName = 'Unknown Business';
        }

        hasNewBadge = await page.locator('span:has-text("New")').count() > 0;

        if (!hasNewBadge) {
          await log(`   [${totalScanned}/${businessElements.length}] ⭕️ ${businessName} - Not new`);
          processedCount++;
          shouldContinue = true;
        }

      } catch (error) {
        await log(`   ⚠️ Error processing business: ${error.message}`);
        processedCount++;
        shouldContinue = true;
      }

      if (shouldContinue) {
        continue;
      }

      await log(`   [${totalScanned}/${businessElements.length}] ✨ ${businessName} - NEW!`);

      // Extract address
      try {
        const addressText = await page.locator('button[data-item-id*="address"]').first().textContent({ timeout: 3000 });
        if (addressText) {
          const trimmedAddress = addressText
            .replace(/[\u200B-\u200D\uFEFF\u00A0]/g, ' ')
            .replace(/[^\x20-\x7E]/g, ' ')
            .replace(/\s+/g, ' ')
            .trim();

          const addressParts = trimmedAddress.split(',').map(p => p.trim());
          if (addressParts.length >= 3) {
            street = addressParts[0];
            city = addressParts[1];
            const lastPart = addressParts[addressParts.length - 1];
            const stateZipMatch = lastPart.match(/([A-Z]{2})\s*(\d{5})/);
            if (stateZipMatch) {
              const stateAbbr = stateZipMatch[1];
              zipCode = stateZipMatch[2];
              city = `${city}, ${stateAbbr}`;
            }
          } else if (addressParts.length === 2) {
            street = addressParts[0];
            const lastPart = addressParts[addressParts.length - 1];
            const zipMatch = lastPart.match(/\b\d{5}\b/);
            if (zipMatch) {
              zipCode = zipMatch[0];
              city = lastPart.replace(zipMatch[0], '').trim();
            } else {
              city = lastPart;
            }
          }
        }
      } catch (e) {
        street = null;
        city = null;
        zipCode = null;
      }

      // Extract phone
      try {
        let phoneElement = await page.locator('button[data-item-id*="phone"]').first();
        let phoneCount = await phoneElement.count();

        if (phoneCount === 0) {
          phoneElement = await page.locator('button[aria-label*="Phone"]').first();
          phoneCount = await phoneElement.count();
        }

        if (phoneCount === 0) {
          phoneElement = await page.locator('button[data-tooltip*="Copy phone"]').first();
          phoneCount = await phoneElement.count();
        }

        if (phoneCount > 0) {
          phone = await phoneElement.textContent({ timeout: 3000 });
          if (phone) {
            phone = phone.trim();
            phone = phone.replace(/Copy phone number|Phone:/gi, '').trim();
          }
        } else {
          phone = null;
        }
      } catch (e) {
        phone = null;
      }

      // Extract website
      try {
        website = await page.locator('a[data-item-id*="authority"]').first().getAttribute('href', { timeout: 3000 });
        if (website) website = website.trim();
      } catch (e) {
        website = null;
      }

      googleMapsUrl = page.url();

      const placeIdMatch = googleMapsUrl.match(/!1s(0x[a-f0-9:]+)/);
      googlePlaceId = placeIdMatch ? placeIdMatch[1] : `generated_${Date.now()}_${Math.random()}`;

      // Extract reviews and rating
      try {
        const reviewText = await page.locator('button[aria-label*="review"]').first().textContent({ timeout: 3000 });
        reviewCount = parseInt(reviewText?.match(/\d+/)?.[0] || '0');
        const ratingText = await page.locator('span[aria-label*="star"]').first().getAttribute('aria-label', { timeout: 3000 });
        const ratingMatch = ratingText?.match(/(\d+(\.\d+)?)/);
        if (ratingMatch) {
          rating = parseFloat(ratingMatch[1]);
        }
      } catch (e) {
        reviewCount = 0;
        rating = 0;
      }

      // Extract category
      try {
        const categoryText = await page.locator('button[jsaction*="category"]').first().textContent({ timeout: 3000 });
        if (categoryText && categoryText.trim()) {
          category = categoryText.trim();
        }
      } catch (e) {
        category = client.keyword;
      }

      // Verify city matches
      const normalizeCity = (cityStr) => {
        if (!cityStr) return '';
        return cityStr.toLowerCase().trim().replace(/[^a-z0-9\s,]/g, '');
      };

      const targetCityNormalized = normalizeCity(client.targetCity);
      const extractedCityNormalized = normalizeCity(city);

      const cityMatches = extractedCityNormalized.includes(targetCityNormalized) ||
                         targetCityNormalized.includes(extractedCityNormalized) ||
                         extractedCityNormalized === targetCityNormalized.split(',')[0].toLowerCase().trim();

      if (!cityMatches) {
        await log(`   ⭕️ ${businessName} - City ${city || 'unknown'} does not match target ${client.targetCity}`);
        processedCount++;
        continue;
      }

      // Check if already exists
      const exists = checkLeadExists(db, googlePlaceId, client.keyword, client.targetCity);

      if (!exists) {
        const lead = {
          businessName: businessName,
          street: street,
          city: city || client.targetCity,
          zipCode: zipCode,
          phone: phone,
          website: website,
          googleMapsUrl: googleMapsUrl,
          googlePlaceId: googlePlaceId,
          reviewCount: reviewCount,
          rating: rating,
          category: category,
          searchKeyword: client.keyword,
          targetCity: client.targetCity
        };

        await saveLead(client.email, lead);
        newLeads.push(lead);

        await log(`   ✅ Lead ${newLeads.length}/${MAX_NEW_LEADS} collected: ${businessName}`);
      } else {
        await log(`   ⭕️ ${businessName} - Already in database`);
      }

      processedCount++;
    }

    await browser.close();
    await saveScanHistory(client.email, 'success', newLeads.length);
    await log(`✅ Scan completed for ${client.businessName}: ${newLeads.length} new lead(s) found`);

    return { leads: newLeads };
  } catch (error) {
    if (browser) {
      try {
        await browser.close();
      } catch (e) {
        // Ignore close errors
      }
    }
    await log(`❌ Error scanning for ${client.businessName}: ${error.message}`);

    if (retryCount < MAX_RETRIES) {
      await log(`🔄 Retrying scan for ${client.businessName} (Attempt ${retryCount + 2}/${MAX_RETRIES + 1})`);
      await new Promise(resolve => setTimeout(resolve, 5000));
      return await scrapeGoogleMapsForClientBatch(client, dryRun, retryCount + 1);
    }

    await saveScanHistory(client.email, 'failed', 0, error.message);
    return { leads: [] };
  }
}

async function scrapeYelpForClientBatch(client, dryRun = false) {
  return await searchYelpAPIBatch(client);
}

async function searchYelpAPIBatch(client) {
  const settings = await loadSettings();
  if (!settings.yelpApiKey) {
    await log(`   [YELP API] No API key configured, skipping`);
    return { leads: [] };
  }
  if (!client.targetCity) {
    await log(`   [YELP API] No target city specified, skipping`);
    return { leads: [] };
  }
  try {
    await log(`🔍 [YELP API] Starting search for ${client.businessName} - ${client.keyword} in ${client.targetCity}`);
    const fetch = require('node-fetch');

    const params = new URLSearchParams({
      term: client.keyword,
      location: client.targetCity,
      radius: '1609', // 1 mile = 1609 meters
      limit: '50'
    });

    const searchUrl = `https://api.yelp.com/v3/businesses/search?${params.toString()}`;
    await log(`   [YELP API] Request URL: ${searchUrl}`);

    const response = await fetch(searchUrl, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${settings.yelpApiKey.trim()}`,
        'Accept': 'application/json'
      }
    });

    if (!response.ok) {
      const errorBody = await response.text();
      await log(`   [YELP API] ❌ API error: ${response.status} ${response.statusText}`);
      await log(`   [YELP API] Error details: ${errorBody}`);
      return { leads: [] };
    }

    const data = await response.json();
    const businesses = data.businesses || [];

    await log(`   [YELP API] Found ${businesses.length} businesses within 1 mile`);

    if (businesses.length === 0) {
      return { leads: [] };
    }

    let newLeads = [];
    const { db } = await getClientDatabase(client.email);

    // Get current date for checking if business is "established" (listed yesterday or earlier)
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    yesterday.setHours(23, 59, 59, 999);

    for (const business of businesses) {
      const normalizeCity = (cityStr) => {
        if (!cityStr) return '';
        return cityStr.toLowerCase().trim().replace(/[^a-z0-9\s,]/g, '');
      };

      const targetCityNormalized = normalizeCity(client.targetCity);
      const extractedCityNormalized = normalizeCity(business.location?.city);

      const cityMatches = extractedCityNormalized.includes(targetCityNormalized) ||
                         targetCityNormalized.includes(extractedCityNormalized) ||
                         extractedCityNormalized === targetCityNormalized.split(',')[0].toLowerCase().trim();

      const category = business.categories?.[0]?.title || client.keyword;

      if (!cityMatches) {
        await log(`   ⭕️ [YELP API] ${business.name} - City ${business.location?.city || 'unknown'} does not match target ${client.targetCity}`);
        continue;
      }

      // Check if business is established (we can't get exact listing date from Yelp API, so we'll treat all Yelp results as established)
      // In practice, if a business has reviews and has been on Yelp, it's established

      const isDuplicate = await checkForDuplicate(
        db,
        business.name,
        business.phone,
        business.location?.address1,
        client.keyword,
        client.targetCity
      );

      if (!isDuplicate) {
        const lead = {
          businessName: business.name,
          street: business.location?.address1 || '',
          city: business.location?.city ? `${business.location.city}, ${business.location.state}` : client.targetCity,
          zipCode: business.location?.zip_code || '',
          phone: business.phone || business.display_phone || '',
          website: business.url || '',
          googleMapsUrl: business.url || `https://www.yelp.com/biz/${business.id}`,
          googlePlaceId: `yelp_api_${business.id}`,
          reviewCount: business.review_count || 0,
          rating: business.rating || 0,
          category: category,
          searchKeyword: client.keyword,
          targetCity: client.targetCity,
          isEstablished: true // Mark Yelp leads as established
        };

        await saveLead(client.email, lead);
        newLeads.push(lead);
        await log(`   ✅ [YELP API] Lead ${newLeads.length}: ${business.name}`);
      }
    }

    await log(`✅ [YELP API] Completed: ${newLeads.length} new lead(s) found`);
    return { leads: newLeads };
  } catch (error) {
    await log(`❌ [YELP API] Error: ${error.message}`);
    return { leads: [] };
  }
}

// Helper function for duplicate checking
async function checkForDuplicate(db, businessName, phone, street, keyword, targetCity) {
  try {
    const result = db.exec(`
      SELECT id FROM leads
      WHERE (businessName = ? OR phone = ? OR street = ?)
      AND searchKeyword = ?
      AND targetCity = ?
    `, [businessName, phone || '', street || '', keyword, targetCity]);

    return result.length > 0 && result[0].values.length > 0;
  } catch (error) {
    console.error('Error checking for duplicate:', error);
    return false;
  }
}

module.exports = {
  scrapeGoogleMapsForClientBatch,
  scrapeYelpForClientBatch,
  searchYelpAPIBatch,
  checkForDuplicate
};