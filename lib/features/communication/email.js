// Email functionality
const nodemailer = require('nodemailer');
const { log } = require('../../system/core/logging');
const { loadSettings } = require('../../system/core/settings');

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
  // Initialize transporter if not already done
  if (!transporter) {
    await initializeTransporter();
  }
  
  if (!transporter && !dryRun) {
    await log(`⚠️ Cannot send email - transporter not configured`);
    return;
  }

  // Add this code:
  const googleLeads = leadsBySource.google || [];
  const yelpLeads = leadsBySource.yelp || [];
  const totalLeads = googleLeads.reduce((sum, batch) => sum + batch.leads.length, 0) + 
                     yelpLeads.reduce((sum, batch) => sum + batch.leads.length, 0);

  if (totalLeads === 0) {
    await log(`📧 No leads to send for ${client.businessName}`);
    return;
  }

  let emailBody = `<h2>New Leads Found for ${client.businessName}</h2>`;
  emailBody += `<p>Total: <strong>${totalLeads}</strong> new leads</p>`;

  // Format Google Maps leads
  if (googleLeads.length > 0) {
    emailBody += '<h3>🗺️ Google Maps Leads</h3>';
    for (const batch of googleLeads) {
      emailBody += `<h4>${batch.keyword} in ${batch.targetCity} (${batch.leads.length} leads)</h4><ul>`;
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

  // Format Yelp leads
  if (yelpLeads.length > 0) {
    emailBody += '<h3>⭐ Yelp Leads</h3>';
    for (const batch of yelpLeads) {
      emailBody += `<h4>${batch.keyword} in ${batch.targetCity} (${batch.leads.length} leads)</h4><ul>`;
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
    await log(`📧 [DRY RUN] Would send email to ${client.email} with ${totalLeads} leads`);
    return;
  }

  try {
    await transporter.sendMail({
      from: (await loadSettings()).smtp.user,
      to: client.email,
      subject: `${totalLeads} New Leads for ${client.businessName}`,
      html: emailBody
    });
    await log(`📧 Email sent to ${client.email} with ${totalLeads} leads`);
  } catch (error) {
    await log(`❌ Failed to send email to ${client.email}: ${error.message}`);
  }
};

module.exports = { sendEmailBatch };