// Email functionality
const nodemailer = require('nodemailer');
const { log } = require('../../system/core/logging');
const { loadSettings } = require('../../system/core/settings');
const { createCSVFile } = require('./csv-generator');

let transporter = null;

// Initialize transporter
async function initializeTransporter() {
  const settings = await loadSettings();
  
  if (settings.smtp.user && settings.smtp.pass) {
    try {
      transporter = nodemailer.createTransport({
        host: settings.smtp.host,
        port: settings.smtp.port,
        secure: false,
        auth: {
          user: settings.smtp.user,
          pass: settings.smtp.pass
        }
      });
      await log('📧 Email transporter configured successfully');
    } catch (error) {
      await log(`❌ Failed to create email transporter: ${error.message}`);
      transporter = null;
    }
  }
}

async function sendEmailBatch(client, leadsBySource, dryRun = false) {
  if (!transporter) {
    await initializeTransporter();
  }
  
  if (!transporter && !dryRun) {
    await log(`⚠️ Cannot send email - transporter not configured`);
    return;
  }

  // Separate into New Businesses (Google Maps with "New" badge) and Established Businesses (Yelp)
  const newBusinessBatches = leadsBySource.google || [];
  const establishedBusinessBatches = leadsBySource.yelp || [];
  
  const totalNewLeads = newBusinessBatches.reduce((sum, batch) => sum + batch.leads.length, 0);
  const totalEstablishedLeads = establishedBusinessBatches.reduce((sum, batch) => sum + batch.leads.length, 0);
  const totalLeads = totalNewLeads + totalEstablishedLeads;

  if (totalLeads === 0) {
    await log(`📧 No leads to send for ${client.businessName}`);
    return;
  }

  let emailBody = `<h2>New Leads Found for ${client.businessName}</h2>`;
  emailBody += `<p>Total: <strong>${totalLeads}</strong> new leads</p>`;
  emailBody += `<ul><li><strong>${totalNewLeads}</strong> New Businesses</li><li><strong>${totalEstablishedLeads}</strong> Established Businesses</li></ul>`;

  // Prepare attachments
  let attachments = [];

  // Format New Businesses section
  if (newBusinessBatches.length > 0) {
    emailBody += '<h3>🆕 New Businesses</h3>';
    for (const batch of newBusinessBatches) {
      emailBody += `<h4>${batch.keyword} in ${batch.targetCity} (${batch.leads.length} leads)</h4>`;
      
      // Create CSV for this batch - ALWAYS create it, even in dry run
      try {
        const csvPath = await createCSVFile('NewBusinesses', batch.keyword, batch.targetCity, batch.leads);
        attachments.push({
          filename: `NewBusinesses_${batch.keyword.replace(/[^a-z0-9]/gi, '_')}_${batch.targetCity.replace(/[^a-z0-9]/gi, '_')}_${new Date().toISOString().split('T')[0]}.csv`,
          path: csvPath
        });
        await log(`📎 Created CSV: NewBusinesses_${batch.keyword}_${batch.targetCity} (${batch.leads.length} leads)`);
      } catch (error) {
        await log(`❌ Failed to create CSV for new businesses: ${error.message}`);
      }
      
      emailBody += '<ul>';
      for (const lead of batch.leads) {
        emailBody += `<li><strong>${lead.businessName}</strong><br>`;
        if (lead.phone) emailBody += `📞 ${lead.phone}<br>`;
        if (lead.website) emailBody += `🌐 <a href="${lead.website}">${lead.website}</a><br>`;
        emailBody += `📍 ${lead.city || lead.targetCity}<br>`;
        emailBody += `<a href="${lead.googleMapsUrl}">View on Google Maps</a></li>`;
      }
      emailBody += '</ul>';
    }
  }

  // Format Established Businesses section
  if (establishedBusinessBatches.length > 0) {
    emailBody += '<h3>🏢 Established Businesses</h3>';
    for (const batch of establishedBusinessBatches) {
      emailBody += `<h4>${batch.keyword} in ${batch.targetCity} (${batch.leads.length} leads)</h4>`;
      
      // Create CSV for this batch - ALWAYS create it, even in dry run
      try {
        const csvPath = await createCSVFile('EstablishedBusinesses', batch.keyword, batch.targetCity, batch.leads);
        attachments.push({
          filename: `EstablishedBusinesses_${batch.keyword.replace(/[^a-z0-9]/gi, '_')}_${batch.targetCity.replace(/[^a-z0-9]/gi, '_')}_${new Date().toISOString().split('T')[0]}.csv`,
          path: csvPath
        });
        await log(`📎 Created CSV: EstablishedBusinesses_${batch.keyword}_${batch.targetCity} (${batch.leads.length} leads)`);
      } catch (error) {
        await log(`❌ Failed to create CSV for established businesses: ${error.message}`);
      }
      
      emailBody += '<ul>';
      for (const lead of batch.leads) {
        emailBody += `<li><strong>${lead.businessName}</strong><br>`;
        if (lead.phone) emailBody += `📞 ${lead.phone}<br>`;
        if (lead.website) emailBody += `🌐 <a href="${lead.website}">${lead.website}</a><br>`;
        emailBody += `📍 ${lead.city || lead.targetCity}<br>`;
        emailBody += `⭐ ${lead.rating} (${lead.reviewCount} reviews)</li>`;
      }
      emailBody += '</ul>';
    }
  }

  if (dryRun) {
    await log(`📧 [DRY RUN] Would send email to ${client.email} with ${totalLeads} leads and ${attachments.length} CSV attachments`);
    await log(`📧 [DRY RUN] CSV files created and saved in csv_exports folder`);
    return;
  }

  try {
    await transporter.sendMail({
      from: (await loadSettings()).smtp.user,
      to: client.email,
      subject: `${totalLeads} New Leads for ${client.businessName}`,
      html: emailBody,
      attachments: attachments
    });
    await log(`📧 Email sent to ${client.email} with ${totalLeads} leads and ${attachments.length} CSV files`);
  } catch (error) {
    await log(`❌ Failed to send email to ${client.email}: ${error.message}`);
  }
}

module.exports = { sendEmailBatch };