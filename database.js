const sqlite3 = require('sqlite3').verbose();
const path = require('path');

class Database {
  constructor() {
    this.db = new sqlite3.Database(path.join(__dirname, 'database.sqlite'), (err) => {
      if (err) console.error(err);
      else console.log('✅ SQLite database connected');
    });
    this.initializeDatabase();
  }

  initializeDatabase() {
    this.db.serialize(() => {
      // Licenses table
      this.db.run(`
        CREATE TABLE IF NOT EXISTS licenses (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          license_key TEXT UNIQUE NOT NULL,
          days INTEGER NOT NULL,
          owner_id TEXT NOT NULL,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          redeemed_by TEXT,
          redeemed_at DATETIME,
          expires_at DATETIME
        )
      `);

      // Subscriptions table
      this.db.run(`
        CREATE TABLE IF NOT EXISTS subscriptions (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          user_id TEXT UNIQUE NOT NULL,
          days_remaining INTEGER NOT NULL,
          expires_at DATETIME NOT NULL,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          accounts_claimed INTEGER DEFAULT 0
        )
      `);

      // Claimed accounts table
      this.db.run(`
        CREATE TABLE IF NOT EXISTS claimed_accounts (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          account_id TEXT UNIQUE NOT NULL,
          claimed_by TEXT NOT NULL,
          username TEXT NOT NULL,
          email TEXT NOT NULL,
          recovery_code TEXT NOT NULL,
          password TEXT NOT NULL,
          secret_key TEXT NOT NULL,
          rank TEXT,
          capes TEXT,
          claimed_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          message_id TEXT
        )
      `);

      // Logs table
      this.db.run(`
        CREATE TABLE IF NOT EXISTS logs (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          action TEXT NOT NULL,
          user_id TEXT NOT NULL,
          details TEXT,
          timestamp DATETIME DEFAULT CURRENT_TIMESTAMP
        )
      `);
    });
  }

  // License operations
  generateLicense(days, ownerId) {
    return new Promise((resolve, reject) => {
      const license = `VASCO-${Math.random().toString(36).substr(2, 15).toUpperCase()}`;
      const expiresAt = new Date(Date.now() + days * 24 * 60 * 60 * 1000).toISOString();

      this.db.run(
        `INSERT INTO licenses (license_key, days, owner_id, expires_at) VALUES (?, ?, ?, ?)`,
        [license, days, ownerId, expiresAt],
        function (err) {
          if (err) reject(err);
          else resolve(license);
        }
      );
    });
  }

  redeemLicense(licenseKey, userId) {
    return new Promise((resolve, reject) => {
      this.db.get(
        `SELECT * FROM licenses WHERE license_key = ? AND redeemed_by IS NULL`,
        [licenseKey],
        (err, row) => {
          if (err) reject(err);
          else if (!row) resolve(null);
          else {
            const expiresAt = new Date(Date.now() + row.days * 24 * 60 * 60 * 1000).toISOString();
            this.db.run(
              `UPDATE licenses SET redeemed_by = ?, redeemed_at = ? WHERE license_key = ?`,
              [userId, new Date().toISOString(), licenseKey],
              (err) => {
                if (err) reject(err);
                else {
                  this.db.run(
                    `INSERT OR REPLACE INTO subscriptions (user_id, days_remaining, expires_at) VALUES (?, ?, ?)`,
                    [userId, row.days, expiresAt],
                    (err) => {
                      if (err) reject(err);
                      else resolve(row);
                    }
                  );
                }
              }
            );
          }
        }
      );
    });
  }

  // Subscription operations
  getSubscription(userId) {
    return new Promise((resolve, reject) => {
      this.db.get(
        `SELECT * FROM subscriptions WHERE user_id = ? AND expires_at > datetime('now')`,
        [userId],
        (err, row) => {
          if (err) reject(err);
          else resolve(row);
        }
      );
    });
  }

  updateAccountsClaimed(userId) {
    return new Promise((resolve, reject) => {
      this.db.run(
        `UPDATE subscriptions SET accounts_claimed = accounts_claimed + 1 WHERE user_id = ?`,
        [userId],
        (err) => {
          if (err) reject(err);
          else resolve();
        }
      );
    });
  }

  // Account operations
  claimAccount(accountId, userId, username, email, recoveryCode, password, secretKey, rank, capes, messageId) {
    return new Promise((resolve, reject) => {
      this.db.run(
        `INSERT INTO claimed_accounts (account_id, claimed_by, username, email, recovery_code, password, secret_key, rank, capes, message_id)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [accountId, userId, username, email, recoveryCode, password, secretKey, rank, capes, messageId],
        function (err) {
          if (err) reject(err);
          else resolve(this.lastID);
        }
      );
    });
  }

  getAccountByMessageId(messageId) {
    return new Promise((resolve, reject) => {
      this.db.get(
        `SELECT * FROM claimed_accounts WHERE message_id = ?`,
        [messageId],
        (err, row) => {
          if (err) reject(err);
          else resolve(row);
        }
      );
    });
  }

  // Logs
  addLog(action, userId, details) {
    return new Promise((resolve, reject) => {
      this.db.run(
        `INSERT INTO logs (action, user_id, details) VALUES (?, ?, ?)`,
        [action, userId, details],
        (err) => {
          if (err) reject(err);
          else resolve();
        }
      );
    });
  }

  close() {
    this.db.close();
  }
}

module.exports = Database;
