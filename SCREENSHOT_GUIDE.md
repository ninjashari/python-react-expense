# 📸 Screenshot Automation Guide

This guide explains how to use the automated screenshot capture script for the Expense Manager React application.

> ⚠️ **Authentication Required**: This script automatically handles user authentication by creating a test user and logging in. Make sure both your React app (http://localhost:3001) and API server (http://localhost:8001) are running.

## Quick Start

### Prerequisites
1. Make sure your **React app** is running on `http://localhost:3001`
2. Make sure your **API server** is running on `http://localhost:8001`
3. Puppeteer is installed (automatically done with `npm install`)

The script will automatically:
- Create a test user account (email: test@example.com, password: testpass123)
- Log in with the test credentials
- Attempt to create sample data (accounts, categories, payees, transactions)
- Capture authenticated screenshots of all app pages

### Running the Script

**Option 1: Using npm script**
```bash
npm run screenshot
```

**Option 2: Direct node execution**
```bash
node capture-screens.js
```

## What the Script Does

1. **🔍 Checks Server Availability**: Verifies your React app is running on localhost:3001
2. **📁 Creates Screenshots Directory**: Automatically creates `screenshots/` folder if it doesn't exist
3. **🌐 Launches Browser**: Opens headless Chrome with optimized settings
4. **📄 Visits All Routes**: Navigates to each page of your application:
   - `/` → `dashboard.png`
   - `/accounts` → `accounts.png`
   - `/transactions` → `transactions.png`
   - `/reports` → `reports.png`
   - `/payees` → `payees.png`
   - `/categories` → `categories.png`
   - `/import` → `import.png`
   - `/backup` → `backup.png`
   - `/learning` → `learning.png`
   - `/insights` → `insights.png`

5. **📸 Captures Full-Page Screenshots**: Takes high-quality PNG screenshots of each page
6. **📝 Updates README.md**: Automatically adds/updates a screenshot gallery section

## Output

### Screenshots
- All screenshots are saved in the `screenshots/` folder
- Each screenshot is a full-page capture in PNG format
- Screenshots are taken at 1920x1080 viewport resolution

### README.md Updates
The script automatically adds or updates a section in your README.md file:

```markdown
## 📸 Application Screenshots

*Last updated: [timestamp]*

### Dashboard
![Dashboard](./screenshots/dashboard.png)

### Accounts
![Accounts](./screenshots/accounts.png)

[... and so on for all routes]
```

## Configuration

You can modify the script behavior by editing `capture-screens.js`:

### Change Base URL
```javascript
const BASE_URL = 'http://localhost:3001'; // Change this to your server URL
```

### Add/Remove Routes
```javascript
const ROUTES = [
  { path: '/', filename: 'dashboard.png', title: 'Dashboard' },
  { path: '/new-page', filename: 'new-page.png', title: 'New Page' }, // Add new routes
  // ... existing routes
];
```

### Adjust Screenshot Settings
```javascript
await page.screenshot({
  path: screenshotPath,
  fullPage: true,        // Set to false for viewport-only screenshots
  type: 'png'           // Change to 'jpeg' if needed
});
```

### Change Viewport Size
```javascript
defaultViewport: {
  width: 1920,           // Change width
  height: 1080          // Change height
}
```

## Troubleshooting

### Common Issues

**❌ "React app is not accessible"**
- Ensure your React development server is running
- Check if the app is accessible at `http://localhost:3001` in your browser
- Make sure no firewall is blocking the connection

**❌ "Failed to capture [route]"**
- The page might be taking too long to load
- Check browser console for JavaScript errors
- Increase timeout values in the script if needed

**❌ "Permission denied" when creating screenshots**
- Check write permissions for the project directory
- Run the script from the project root directory

### Debug Mode
To see more detailed output, you can modify the script to run in non-headless mode:

```javascript
browser = await puppeteer.launch({
  headless: false,  // Change from 'new' to false
  // ... other options
});
```

## Advanced Usage

### Custom Screenshot Names
If you want different naming conventions, modify the `ROUTES` array:

```javascript
{ path: '/', filename: 'home-page.png', title: 'Home' },
{ path: '/about', filename: '_about.png', title: 'About Us' },
```

### Authentication Required Routes
If your app requires login, you can add authentication logic:

```javascript
// After page creation, before route navigation
await page.goto(`${BASE_URL}/login`);
await page.type('#username', 'your-username');
await page.type('#password', 'your-password');
await page.click('#login-button');
await page.waitForNavigation();
```

### Mobile Screenshots
To capture mobile views, change the viewport:

```javascript
defaultViewport: {
  width: 375,
  height: 667
}
```

## File Structure After Running

```
your-project/
├── screenshots/
│   ├── dashboard.png
│   ├── accounts.png
│   ├── transactions.png
│   ├── ... (all route screenshots)
├── capture-screens.js
├── package.json
├── README.md (updated with screenshots)
└── SCREENSHOT_GUIDE.md
```

## Automation Ideas

### CI/CD Integration
Add the screenshot script to your CI/CD pipeline:

```yaml
# GitHub Actions example
- name: Capture Screenshots
  run: |
    npm start &
    sleep 10
    npm run screenshot
    git add screenshots/
    git commit -m "Update screenshots" || exit 0
```

### Scheduled Updates
Set up a cron job to automatically update screenshots:

```bash
# Update screenshots daily at 2 AM
0 2 * * * cd /path/to/project && npm run screenshot
```

---

**Happy Screenshot Automation! 📸✨**