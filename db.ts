import path from 'path';

const Database = require('better-sqlite3');

const dbPath = path.join(__dirname, 'database.db');

const db = new Database(dbPath);

const createUsersTable = `
CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  email TEXT UNIQUE,
  password TEXT
);
`;

db.prepare(createUsersTable).run();

const createEmailsTable = `
CREATE TABLE IF NOT EXISTS emails (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER,
  subject TEXT,
  body TEXT,
  recipients TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id)
);
`;

db.prepare(createEmailsTable).run();

export default db;
