const fs = require('fs');
const path = require('path');

class Database {
  constructor() {
    this.dataDir = path.join(__dirname, 'data');
    this.accountsFile = path.join(this.dataDir, 'accounts.json');
    this.licensesFile = path.join(this.dataDir, 'licenses.json');
    this.subscriptionsFile = path.join(this.dataDir, 'subscriptions.json');
    this.logsFile = path.join(this.dataDir, 'logs.json');

    // Create data directory if it doesn't exist
    if (!fs.existsSync(this.dataDir)) {
      fs.mkdirSync(this.dataDir, { recursive: true });
    }

    // Initialize files
    this.initializeFiles();
    console.log('✅ JSON database initialized');
  }

  initializeFiles() {
    const files = [
      { path: this.accountsFile, default: [] },
      { path: this.licensesFile, default: [] },
      { path: this.subscriptionsFile, default: [] },
      { path: this.logsFile, default: [] },
    ];

    files.forEach(file => {
      if (!fs.existsSync(file.path)) {
        fs.writeFileSync(file.path, JSON.stringify(file.default, null, 2));
      }
    });
  }

  // Read file safely
  readFile(filePath) {
    try {
      return JSON.parse(fs.readFileSync(filePath, 'utf8'));
    } catch (err) {
      console.error(`Error reading ${filePath}:`, err);
      return [];
    }
  }

  // Write file safely
  writeFile(filePath, data) {
    try {
      fs.writeFileSync(filePath, JSON.stringify(data, null, 2));
    } catch (err) {
      console.error(`Error writing to ${filePath}:`, err);
    }
  }

  // License operations
  generateLicense(days, ownerId) {
    const license = `VASCO-${Math.random().toString(36).substr(2, 15).toUpperCase()}`;
    const licenses = this.readFile(this.licensesFile);
    const expiresAt = new Date(Date.now() + days * 24 * 60 * 60 * 1000).toISOString();

    licenses.push({
      id: Date.now(),
      license_key: license,
      days,
      owner_id: ownerId,
      created_at: new Date().toISOString(),
      redeemed_by: null,
      redeemed_at: null,
      expires_at: expiresAt,
    });

    this.writeFile(this.licensesFile, licenses);
    return license;
  }

  redeemLicense(licenseKey, userId) {
    const licenses = this.readFile(this.licensesFile);
    const license = licenses.find(l => l.license_key === licenseKey && !l.redeemed_by);

    if (!license) return null;

    license.redeemed_by = userId;
    license.redeemed_at = new Date().toISOString();
    this.writeFile(this.licensesFile, licenses);

    // Create subscription
    const subscriptions = this.readFile(this.subscriptionsFile);
    const expiresAt = new Date(Date.now() + license.days * 24 * 60 * 60 * 1000).toISOString();

    const existingIndex = subscriptions.findIndex(s => s.user_id === userId);
    if (existingIndex > -1) {
      subscriptions[existingIndex].expires_at = expiresAt;
      subscriptions[existingIndex].days_remaining = license.days;
    } else {
      subscriptions.push({
        id: Date.now(),
        user_id: userId,
        days_remaining: license.days,
        expires_at: expiresAt,
        created_at: new Date().toISOString(),
        accounts_claimed: 0,
      });
    }

    this.writeFile(this.subscriptionsFile, subscriptions);
    return license;
  }

  // Subscription operations
  getSubscription(userId) {
    const subscriptions = this.readFile(this.subscriptionsFile);
    const sub = subscriptions.find(
      s => s.user_id === userId && new Date(s.expires_at) > new Date()
    );
    return sub || null;
  }

  updateAccountsClaimed(userId) {
    const subscriptions = this.readFile(this.subscriptionsFile);
    const sub = subscriptions.find(s => s.user_id === userId);
    if (sub) {
      sub.accounts_claimed++;
      this.writeFile(this.subscriptionsFile, subscriptions);
    }
  }

  // Account operations
  claimAccount(accountId, userId, username, email, recoveryCode, password, secretKey, rank, capes, messageId) {
    const accounts = this.readFile(this.accountsFile);
    const account = {
      id: accountId,
      account_id: accountId,
      claimed_by: userId,
      username,
      email,
      recovery_code: recoveryCode,
      password,
      secret_key: secretKey,
      rank,
      capes,
      claimed_at: new Date().toISOString(),
      message_id: messageId,
      status: 'claimed',
    };
    accounts.push(account);
    this.writeFile(this.accountsFile, accounts);
    return account;
  }

  getAccountByMessageId(messageId) {
    const accounts = this.readFile(this.accountsFile);
    return accounts.find(a => a.message_id === messageId) || null;
  }

  getUserAccounts(userId) {
    const accounts = this.readFile(this.accountsFile);
    return accounts.filter(a => a.claimed_by === userId);
  }

  sellAccount(accountId, price) {
    const accounts = this.readFile(this.accountsFile);
    const account = accounts.find(a => a.account_id === accountId);
    if (account) {
      account.status = 'selling';
      account.price = price;
      account.sold_at = new Date().toISOString();
      this.writeFile(this.accountsFile, accounts);
    }
    return account;
  }

  getAccountById(accountId) {
    const accounts = this.readFile(this.accountsFile);
    return accounts.find(a => a.account_id === accountId) || null;
  }

  // Logs
  addLog(action, userId, details) {
    const logs = this.readFile(this.logsFile);
    logs.push({
      id: Date.now(),
      action,
      user_id: userId,
      details,
      timestamp: new Date().toISOString(),
    });
    this.writeFile(this.logsFile, logs);
  }
}

module.exports = Database;