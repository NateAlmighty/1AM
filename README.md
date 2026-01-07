# Lead Broker Hub

Lead Broker Hub is an Electron-based desktop application for automated lead generation and client management. It scrapes business listings from Google Maps and Yelp, manages client relationships, and automates email outreach campaigns.

## Features

### 🔍 Lead Generation

- **Google Maps Scraping**: Automatically discover new businesses based on keywords and target cities
- **Yelp API Integration**: Access additional business data and reviews
- **Smart Filtering**: Distinguish between newly established businesses and poaching opportunities
- **Automated Scanning**: Schedule periodic global scans or run manual scans per client

### 👥 Client Management

- **Multi-Client Support**: Manage multiple clients with different targeting criteria
- **Custom Keywords**: Define unique keywords for each client's target businesses
- **Geographic Targeting**: Specify cities and regions to search within
- **Status Tracking**: Monitor active/inactive client status

### 📧 Email Communication

- **SMTP Integration**: Send emails through configured SMTP servers
- **Bulk Email Support**: Queue and send emails to multiple leads
- **Dry Run Mode**: Test email campaigns without actually sending messages

### 📊 Dashboard & Analytics

- **Real-time Stats**: View total leads, active clients, today/week counts
- **Scan Status Monitor**: Track ongoing scanning operations
- **Filter & Search**: Filter leads by client, type, and other criteria
- **System Logs**: Access detailed logs for debugging and monitoring

### 💾 Data Management

- **SQLite Database**: Persistent storage using sql.js
- **Auto-Save**: Automatic periodic saving (every 30 seconds)
- **Manual Export**: View and manage all lead data

## Tech Stack

- **Framework**: Electron
- **Database**: sql.js (SQLite)
- **Scraping**: Playwright, Google Maps scraping
- **Email**: Nodemailer
- **API**: Yelp Fusion API
- **UI**: Tailwind CSS, Vanilla JavaScript
- **Build**: electron-builder

## Installation

### Prerequisites

- Node.js 16+ and npm
- Modern browser (Chrome/Chromium for Playwright)

### Setup

1. **Clone the repository**

   ```bash
   git clone <repository-url>
   cd lead-broker-hub
   ```

2. **Install dependencies**

   ```bash
   npm install
   ```

3. **Configure settings**
   - Open the app and navigate to Settings
   - Configure SMTP settings for email sending
   - Add your Yelp API key
   - Adjust other settings as needed

4. **Run the application**

   ```bash
   npm start
   ```

   For development mode:

   ```bash
   npm run dev
   ```

## Usage Guide

### Adding a Client

1. Click "**+ Add Client**" button
2. Fill in the client details:
   - **Business Name**: Your client's business name
   - **Contact Name**: Primary contact person
   - **Email**: Client's email for lead assignment
   - **Keywords**: Comma-separated keywords for lead search
   - **Target Cities**: Semicolon-separated cities to search in
   - **Active**: Enable/disable scanning for this client

### Managing Leads

- **View Leads**: Switch to the "Leads" tab to view all collected leads
- **Filter**: Use dropdowns to filter by client or lead type
- **Delete**: Remove unwanted leads
- **View**: Click to open Google Maps listing

### Running Scans

- **Single Client**: Click "Scan" next to a client to scan specifically for them
- **Global Scan**: Enable "Global Scan" toggle for automatic periodic scanning
- **Status**: Monitor scan progress in the top status bar

### Email Campaigns

1. Configure SMTP settings in the Settings tab
2. Select leads to email
3. Use the email feature to send personalized messages

## Project Structure

``
lead-broker-hub/
├── main.js                 # Electron main process
├── app.js                  # Frontend application logic
├── index.html              # Main UI template
├── preload.js              # Electron preload script
├── package.json            # Dependencies and scripts
├── README.md               # This file
├── lib/
│   ├── core/
│   │   ├── database/       # Database management (sql.js)
│   │   ├── rendering/      # UI rendering utilities
│   │   └── ui/             # UI components and modals
│   ├── features/
│   │   ├── clients/        # Client CRUD operations
│   │   ├── leads/          # Lead management
│   │   └── communication/  # Email and IPC handlers
│   └── system/
│       ├── core/           # App initialization and settings
│       └── scan/           # Scanning engine and scrapers
└── assets/                 # App icons and resources
``

## Configuration

### Settings Options

| Setting | Description |
| SMTP Host | Email server hostname (default: smtp.gmail.com) |
| SMTP Port | Email server port (default: 587) |
| SMTP User | Email address for sending |
| SMTP Pass | App password for email account |
| Yelp API Key | Yelp Fusion API key for business data |
| Dry Run Mode | Test mode (emails not actually sent) |
| Global Scan | Enable automatic periodic scanning |

### Environment Variables

Create a `.env` file for sensitive configuration:

```env
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=your-email@gmail.com
SMTP_PASS=your-app-password
YELP_API_KEY=your-yelp-api-key
```

## Building for Distribution

Build platform-specific installers:

```bash
# Windows
npm run build -- --win

# macOS
npm run build -- --mac

# Linux
npm run build -- --linux
```

Or use electron-builder directly:

```bash
npx electron-builder --win --x64
```

## Development

### Running in Dev Mode

```bash
npm run dev
```

This enables additional debugging tools and reloads on file changes.

### Debugging

1. Open DevTools: `View → Toggle Developer Tools`
2. Check system logs in the "Logs" tab
3. Review console output for errors

## Troubleshooting

### Scanning Issues

- Ensure Playwright browsers are installed: `npx playwright install`
- Check internet connectivity
- Review logs for specific error messages

### Email Not Sending

- Verify SMTP credentials
- Enable "Less secure app access" or use app passwords
- Check spam folder
- Try dry run mode first

### Database Errors

- Close the app properly (don't force quit)
- Check disk space availability
- Review database logs

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Submit a pull request

## License

MIT License - see LICENSE file for details.

## Support

For issues and feature requests, please open a GitHub issue.

---

**Note**: This tool is for legitimate business purposes only. Ensure compliance with applicable laws and terms of service when scraping data.
