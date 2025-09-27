#!/usr/bin/env node

const puppeteer = require('puppeteer');
const fs = require('fs');
const path = require('path');

// Configuration
const BASE_URL = 'http://localhost:3001';
const API_BASE_URL = 'http://localhost:8001/api';
const SCREENSHOTS_DIR = path.join(__dirname, 'screenshots');
const README_PATH = path.join(__dirname, 'README.md');

// Test user credentials
const TEST_USER = {
  name: 'Test User',
  email: 'test@example.com',
  password: 'testpass123'
};

// Define all routes and their corresponding screenshot names
const ROUTES = [
  { path: '/', filename: 'dashboard.png', title: 'Dashboard' },
  { path: '/accounts', filename: 'accounts.png', title: 'Accounts' },
  { path: '/transactions', filename: 'transactions.png', title: 'Transactions' },
  { path: '/reports', filename: 'reports.png', title: 'Reports' },
  { path: '/payees', filename: 'payees.png', title: 'Payees' },
  { path: '/categories', filename: 'categories.png', title: 'Categories' },
  { path: '/import', filename: 'import.png', title: 'Import Data' },
  { path: '/backup', filename: 'backup.png', title: 'Backup & Export' },
  { path: '/learning', filename: 'learning.png', title: 'Learning Dashboard' },
  { path: '/insights', filename: 'insights.png', title: 'Advanced Insights' }
];

// Utility functions
function ensureDirectoryExists(dirPath) {
  if (!fs.existsSync(dirPath)) {
    fs.mkdirSync(dirPath, { recursive: true });
    console.log(`📁 Created directory: ${dirPath}`);
  }
}

function delay(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function waitForNetworkIdle(page, timeout = 30000) {
  return Promise.race([
    page.waitForLoadState('networkidle', { timeout }),
    delay(timeout)
  ]).catch(() => {
    console.log('⚠️  Network idle timeout, continuing...');
  });
}

async function createTestUserAndData(page) {
  console.log('👤 Setting up test user and data...');

  try {
    // First, create test user and data via API
    const authToken = await createTestUserViaAPI(page);

    if (authToken) {
      // Set the auth token in browser
      await page.goto(BASE_URL, { waitUntil: 'networkidle2' });
      await page.evaluate((token) => {
        localStorage.setItem('token', token);
      }, authToken);

      // Create test data via API
      await createTestDataViaAPI(page, authToken);

      // Refresh to apply the auth token
      await page.reload({ waitUntil: 'networkidle2' });
      await delay(2000);

      console.log('   ✅ Authentication and test data setup completed');
    } else {
      // Fallback to UI-based authentication
      await authenticateViaUI(page);
    }

  } catch (error) {
    console.error('❌ Failed to setup test user:', error.message);
    // Don't throw - try to continue with screenshots even if auth fails
  }
}

async function createTestUserViaAPI(page) {
  try {
    console.log('   → Creating test user via API...');

    const registerResponse = await page.evaluate(async (testUser, apiUrl) => {
      try {
        const response = await fetch(`${apiUrl}/auth/register`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            name: testUser.name,
            email: testUser.email,
            password: testUser.password
          })
        });

        if (response.ok) {
          const result = await response.json();
          return { success: true, token: result.access_token };
        } else {
          return { success: false, status: response.status };
        }
      } catch (error) {
        return { success: false, error: error.message };
      }
    }, TEST_USER, API_BASE_URL);

    if (registerResponse.success) {
      console.log('   → Test user registered successfully via API');
      return registerResponse.token;
    } else {
      // User might already exist, try login
      console.log('   → Registration failed, trying login via API...');

      const loginResponse = await page.evaluate(async (testUser, apiUrl) => {
        try {
          const response = await fetch(`${apiUrl}/auth/login`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              email: testUser.email,
              password: testUser.password
            })
          });

          if (response.ok) {
            const result = await response.json();
            return { success: true, token: result.access_token };
          } else {
            return { success: false, status: response.status };
          }
        } catch (error) {
          return { success: false, error: error.message };
        }
      }, TEST_USER, API_BASE_URL);

      if (loginResponse.success) {
        console.log('   → Test user logged in successfully via API');
        return loginResponse.token;
      }
    }

    return null;
  } catch (error) {
    console.log('   → API authentication failed, will try UI method');
    return null;
  }
}

async function createTestDataViaAPI(page, authToken) {
  console.log('   → Creating test data via API...');

  try {
    const testData = await page.evaluate(async (token, apiUrl) => {
      const headers = {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      };

      const results = { accounts: [], categories: [], payees: [], transactions: [] };

      try {
        // Create test accounts
        const accounts = [
          { name: 'Checking Account', type: 'checking', balance: 2500.00, opening_date: '2024-01-01' },
          { name: 'Savings Account', type: 'savings', balance: 15000.00, opening_date: '2024-01-01' },
          { name: 'Credit Card', type: 'credit', balance: 1200.00, credit_limit: 5000.00, opening_date: '2024-01-01' }
        ];

        for (const account of accounts) {
          try {
            const response = await fetch(`${apiUrl}/accounts`, {
              method: 'POST',
              headers,
              body: JSON.stringify(account)
            });
            if (response.ok) {
              const result = await response.json();
              results.accounts.push(result);
            }
          } catch (e) {}
        }

        // Create test categories
        const categories = [
          { name: 'Groceries', color: '#4CAF50' },
          { name: 'Gas & Transportation', color: '#2196F3' },
          { name: 'Restaurants', color: '#FF9800' },
          { name: 'Entertainment', color: '#9C27B0' },
          { name: 'Utilities', color: '#607D8B' },
          { name: 'Healthcare', color: '#F44336' },
          { name: 'Shopping', color: '#E91E63' },
          { name: 'Income', color: '#8BC34A' }
        ];

        for (const category of categories) {
          try {
            const response = await fetch(`${apiUrl}/categories`, {
              method: 'POST',
              headers,
              body: JSON.stringify(category)
            });
            if (response.ok) {
              const result = await response.json();
              results.categories.push(result);
            }
          } catch (e) {}
        }

        // Create test payees
        const payees = [
          { name: 'Walmart', color: '#FFC107' },
          { name: 'Shell Gas Station', color: '#FF5722' },
          { name: 'Netflix', color: '#E53935' },
          { name: 'Electric Company', color: '#1976D2' },
          { name: 'Target', color: '#D32F2F' },
          { name: 'Amazon', color: '#FF9800' },
          { name: 'Starbucks', color: '#4CAF50' },
          { name: 'ABC Company (Salary)', color: '#9C27B0' }
        ];

        for (const payee of payees) {
          try {
            const response = await fetch(`${apiUrl}/payees`, {
              method: 'POST',
              headers,
              body: JSON.stringify(payee)
            });
            if (response.ok) {
              const result = await response.json();
              results.payees.push(result);
            }
          } catch (e) {}
        }

        // Create test transactions (if we have accounts)
        if (results.accounts.length > 0) {
          const transactions = [
            {
              amount: 3500.00,
              type: 'income',
              description: 'Monthly Salary',
              date: '2024-09-01',
              account_id: results.accounts[0].id,
              payee_id: results.payees.find(p => p.name.includes('ABC Company'))?.id,
              category_id: results.categories.find(c => c.name === 'Income')?.id
            },
            {
              amount: 120.50,
              type: 'expense',
              description: 'Grocery Shopping',
              date: '2024-09-15',
              account_id: results.accounts[0].id,
              payee_id: results.payees.find(p => p.name === 'Walmart')?.id,
              category_id: results.categories.find(c => c.name === 'Groceries')?.id
            },
            {
              amount: 45.00,
              type: 'expense',
              description: 'Gas Fill-up',
              date: '2024-09-20',
              account_id: results.accounts[0].id,
              payee_id: results.payees.find(p => p.name.includes('Shell'))?.id,
              category_id: results.categories.find(c => c.name.includes('Transportation'))?.id
            },
            {
              amount: 15.99,
              type: 'expense',
              description: 'Netflix Subscription',
              date: '2024-09-25',
              account_id: results.accounts[0].id,
              payee_id: results.payees.find(p => p.name === 'Netflix')?.id,
              category_id: results.categories.find(c => c.name === 'Entertainment')?.id
            },
            {
              amount: 89.23,
              type: 'expense',
              description: 'Electric Bill',
              date: '2024-09-26',
              account_id: results.accounts[0].id,
              payee_id: results.payees.find(p => p.name.includes('Electric'))?.id,
              category_id: results.categories.find(c => c.name === 'Utilities')?.id
            }
          ];

          for (const transaction of transactions) {
            try {
              const response = await fetch(`${apiUrl}/transactions`, {
                method: 'POST',
                headers,
                body: JSON.stringify(transaction)
              });
              if (response.ok) {
                const result = await response.json();
                results.transactions.push(result);
              }
            } catch (e) {}
          }
        }

        return results;
      } catch (error) {
        return { error: error.message };
      }
    }, authToken, API_BASE_URL);

    console.log(`   → Created ${testData.accounts?.length || 0} accounts, ${testData.categories?.length || 0} categories, ${testData.payees?.length || 0} payees, ${testData.transactions?.length || 0} transactions`);

  } catch (error) {
    console.log('   ⚠️  Test data creation failed:', error.message);
  }
}

async function authenticateViaUI(page) {
  console.log('   → Attempting UI-based authentication...');

  try {
    await page.goto(BASE_URL, { waitUntil: 'networkidle2' });
    await delay(2000);

    // Check if we're on login page by looking for the email input
    const emailInput = await page.$('input[type="email"]');

    if (emailInput) {
      console.log('   → Found login form, attempting authentication...');

      // Try to register first
      try {
        // Look for "Sign Up" or "Register" text
        const signUpButton = await page.$x("//button[contains(text(), 'Sign Up')]");
        if (signUpButton.length > 0) {
          await signUpButton[0].click();
          await delay(1000);

          // Fill registration form
          await page.waitForSelector('input[type="email"]', { timeout: 5000 });

          // Clear and fill fields
          const nameInput = await page.$('input[type="text"]'); // First text input should be name
          if (nameInput) {
            await nameInput.click({ clickCount: 3 });
            await nameInput.type(TEST_USER.name);
          }

          const emailInputReg = await page.$('input[type="email"]');
          await emailInputReg.click({ clickCount: 3 });
          await emailInputReg.type(TEST_USER.email);

          const passwordInputs = await page.$$('input[type="password"]');
          if (passwordInputs.length >= 2) {
            await passwordInputs[0].click({ clickCount: 3 });
            await passwordInputs[0].type(TEST_USER.password);

            await passwordInputs[1].click({ clickCount: 3 });
            await passwordInputs[1].type(TEST_USER.password);
          }

          // Submit registration
          const createAccountButton = await page.$x("//button[contains(text(), 'Create Account')]");
          if (createAccountButton.length > 0) {
            await createAccountButton[0].click();
            await delay(3000);
            console.log('   → Registration successful');
            return true;
          }
        }
      } catch (regError) {
        console.log('   → Registration failed, trying login...');
      }

      // If registration failed, try login
      await page.goto(BASE_URL, { waitUntil: 'networkidle2' });
      await delay(2000);

      // Look for "Sign In" button if we're on register form
      const signInButton = await page.$x("//button[contains(text(), 'Sign In')]");
      if (signInButton.length > 0) {
        await signInButton[0].click();
        await delay(1000);
      }

      // Fill login form
      const emailInputLogin = await page.$('input[type="email"]');
      const passwordInputLogin = await page.$('input[type="password"]');

      if (emailInputLogin && passwordInputLogin) {
        await emailInputLogin.click({ clickCount: 3 });
        await emailInputLogin.type(TEST_USER.email);

        await passwordInputLogin.click({ clickCount: 3 });
        await passwordInputLogin.type(TEST_USER.password);

        // Submit login
        const loginSubmitButton = await page.$x("//button[contains(text(), 'Sign In')]");
        if (loginSubmitButton.length > 0) {
          await loginSubmitButton[0].click();
          await delay(3000);
          console.log('   → Login successful');
          return true;
        }
      }
    }

    return false;
  } catch (error) {
    console.log('   ⚠️  UI authentication failed:', error.message);
    return false;
  }
}


async function captureScreenshots() {
  console.log('🚀 Starting screenshot capture process...');

  // Ensure screenshots directory exists
  ensureDirectoryExists(SCREENSHOTS_DIR);

  let browser;

  try {
    // Launch browser
    console.log('🌐 Launching browser...');
    browser = await puppeteer.launch({
      headless: 'new',
      defaultViewport: {
        width: 1920,
        height: 1080
      },
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-web-security',
        '--disable-features=VizDisplayCompositor'
      ]
    });

    const page = await browser.newPage();

    // Set viewport and user agent
    await page.setViewport({ width: 1920, height: 1080 });
    await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36');

    // Setup test user and data
    await createTestUserAndData(page);

    console.log(`📸 Capturing screenshots for ${ROUTES.length} routes...\n`);

    const results = [];

    for (const route of ROUTES) {
      try {
        console.log(`📄 Processing: ${route.title} (${route.path})`);

        const url = `${BASE_URL}${route.path}`;
        console.log(`   → Navigating to: ${url}`);

        // Navigate to the page
        await page.goto(url, {
          waitUntil: 'networkidle2',
          timeout: 30000
        });

        // Wait for React to render
        await delay(2000);

        // Wait for any loading states to complete
        try {
          await page.waitForSelector('[data-testid="loading"]', {
            hidden: true,
            timeout: 5000
          });
        } catch (e) {
          // Loading indicator might not exist, continue
        }

        // Additional wait for dynamic content
        await delay(1000);

        // Scroll to top to ensure consistent screenshots
        await page.evaluate(() => {
          window.scrollTo(0, 0);
        });

        await delay(500);

        // Take full page screenshot
        const screenshotPath = path.join(SCREENSHOTS_DIR, route.filename);

        await page.screenshot({
          path: screenshotPath,
          fullPage: true,
          type: 'png'
        });

        console.log(`   ✅ Screenshot saved: ${route.filename}`);

        results.push({
          route,
          success: true,
          path: screenshotPath
        });

      } catch (error) {
        console.error(`   ❌ Failed to capture ${route.path}: ${error.message}`);
        results.push({
          route,
          success: false,
          error: error.message
        });
      }

      // Small delay between screenshots
      await delay(1000);
    }

    console.log('\n📊 Screenshot Results:');
    console.log('==========================================');

    const successful = results.filter(r => r.success);
    const failed = results.filter(r => !r.success);

    console.log(`✅ Successful: ${successful.length}/${ROUTES.length}`);
    console.log(`❌ Failed: ${failed.length}/${ROUTES.length}`);

    if (failed.length > 0) {
      console.log('\nFailed routes:');
      failed.forEach(f => {
        console.log(`   • ${f.route.path}: ${f.error}`);
      });
    }

    return results;

  } catch (error) {
    console.error('💥 Fatal error during screenshot capture:', error);
    throw error;
  } finally {
    if (browser) {
      await browser.close();
      console.log('🔒 Browser closed');
    }
  }
}

async function updateReadme(results) {
  console.log('\n📝 Updating README.md...');

  try {
    let readmeContent = '';

    // Read existing README if it exists
    if (fs.existsSync(README_PATH)) {
      readmeContent = fs.readFileSync(README_PATH, 'utf8');
    }

    // Find existing screenshots section
    const screenshotsRegex = /<!-- SCREENSHOTS START -->[\s\S]*?<!-- SCREENSHOTS END -->/g;

    // Generate new screenshots section with GitHub conventions
    const successful = results.filter(r => r.success);
    const timestamp = new Date().toLocaleString();

    let screenshotsSection = `<!-- SCREENSHOTS START -->\n`;
    screenshotsSection += `## 📸 Application Screenshots\n\n`;
    screenshotsSection += `<div align="center">\n`;
    screenshotsSection += `  <em>Experience the intuitive interface of our comprehensive expense management solution</em>\n`;
    screenshotsSection += `</div>\n\n<br>\n\n`;

    // Define descriptions for each page
    const descriptions = {
      'Dashboard': 'The main dashboard provides a comprehensive view of your financial health with account summaries, recent transactions, and spending insights.',
      'Accounts': 'Manage all your financial accounts including checking, savings, credit cards, and investment accounts with real-time balance tracking.',
      'Transactions': 'Track and categorize all your financial transactions with advanced filtering, search, and bulk editing capabilities.',
      'Reports': 'Generate detailed financial reports with customizable filters and date ranges to understand your spending patterns.',
      'Payees': 'Organize and manage all your payees with color coding and automatic transaction categorization.',
      'Categories': 'Create and manage expense categories with visual color coding for better transaction organization.',
      'Import Data': 'Import transactions from various sources including CSV, Excel, and PDF files with intelligent column mapping.',
      'Backup & Export': 'Export your financial data in multiple formats and manage backups to keep your information secure.',
      'Learning Dashboard': 'AI-powered insights help you learn from your spending patterns and improve your financial decisions.',
      'Advanced Insights': 'Deep analytics and trends provide detailed insights into your financial behavior and spending patterns.'
    };

    // Define emojis for each page
    const emojis = {
      'Dashboard': '🏠',
      'Accounts': '💳',
      'Transactions': '📊',
      'Reports': '📈',
      'Payees': '🏪',
      'Categories': '🏷️',
      'Import Data': '📥',
      'Backup & Export': '💾',
      'Learning Dashboard': '🧠',
      'Advanced Insights': '🔍'
    };

    successful.forEach(result => {
      const { route } = result;
      const emoji = emojis[route.title] || '📱';
      const description = descriptions[route.title] || `View the ${route.title} interface.`;

      screenshotsSection += `### ${emoji} ${route.title}${route.title.includes('Dashboard') ? ' Overview' : route.title.includes('Account') ? ' Management' : route.title.includes('Transaction') ? ' History' : route.title.includes('Report') ? ' & Analytics' : route.title.includes('Payee') ? ' Management' : route.title.includes('Categor') ? ' Organization' : ''}\n`;
      screenshotsSection += `${description}\n\n`;
      screenshotsSection += `<details>\n`;
      screenshotsSection += `<summary>View ${route.title} Screenshot</summary>\n\n`;
      screenshotsSection += `![${route.title}](./screenshots/${route.filename})\n\n`;
      screenshotsSection += `</details>\n\n`;
    });

    screenshotsSection += `---\n\n`;
    screenshotsSection += `<div align="center">\n`;
    screenshotsSection += `  <strong>💡 Tip:</strong> All screenshots are automatically generated using our Puppeteer automation script.<br>\n`;
    screenshotsSection += `  Run <code>npm run screenshot</code> to capture fresh screenshots with real data.\n`;
    screenshotsSection += `</div>\n\n`;
    screenshotsSection += `<!-- SCREENSHOTS END -->`;

    // Update or add screenshots section
    if (screenshotsRegex.test(readmeContent)) {
      readmeContent = readmeContent.replace(screenshotsRegex, screenshotsSection);
    } else {
      // Add screenshots section at the end
      readmeContent += '\n\n' + screenshotsSection + '\n';
    }

    // Write updated README
    fs.writeFileSync(README_PATH, readmeContent);

    console.log('✅ README.md updated successfully');
    console.log(`   → Added ${successful.length} screenshots to documentation`);

  } catch (error) {
    console.error('❌ Failed to update README.md:', error.message);
    throw error;
  }
}

async function checkServerAvailability() {
  console.log(`🔍 Checking if servers are running...`);
  console.log(`   → React app: ${BASE_URL}`);
  console.log(`   → API server: ${API_BASE_URL}`);

  const browser = await puppeteer.launch({ headless: 'new' });
  const page = await browser.newPage();

  try {
    // Check React app
    await page.goto(BASE_URL, { timeout: 10000 });
    console.log('✅ React app is accessible');

    // Check API server by making a simple request
    try {
      const response = await page.evaluate(async (apiUrl) => {
        const res = await fetch(`${apiUrl}/health`);
        return res.ok;
      }, API_BASE_URL);

      if (response) {
        console.log('✅ API server is accessible');
      } else {
        console.log('⚠️  API server health check failed, but continuing...');
      }
    } catch (apiError) {
      console.log('⚠️  API server check failed, but continuing...');
    }

    await browser.close();
    return true;
  } catch (error) {
    await browser.close();
    console.error('❌ React app is not accessible');
    console.error('   Please ensure your React app is running on http://localhost:3001');
    console.error('   Please ensure your API server is running on http://localhost:8001');
    return false;
  }
}

async function main() {
  console.log('🎬 Expense Manager Screenshot Automation');
  console.log('=========================================\n');

  try {
    // Check if server is running
    const serverAvailable = await checkServerAvailability();
    if (!serverAvailable) {
      process.exit(1);
    }

    // Capture screenshots
    const results = await captureScreenshots();

    // Update README
    await updateReadme(results);

    console.log('\n🎉 Screenshot automation completed successfully!');
    console.log(`📁 Screenshots saved in: ${SCREENSHOTS_DIR}`);
    console.log(`📄 README.md updated with screenshot gallery`);

  } catch (error) {
    console.error('\n💥 Automation failed:', error.message);
    process.exit(1);
  }
}

// Handle uncaught errors
process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled Rejection at:', promise, 'reason:', reason);
  process.exit(1);
});

process.on('uncaughtException', (error) => {
  console.error('Uncaught Exception:', error);
  process.exit(1);
});

// Run the script
if (require.main === module) {
  main();
}