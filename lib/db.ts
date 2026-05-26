import fs from "node:fs/promises";
import path from "node:path";
import sqlite3 from "sqlite3";
import { open, type Database } from "sqlite";

let databasePromise: Promise<Database> | undefined;

async function migrateAdminCredentials(database: Database) {
  const adminCredentialTable = await database.get<{ name: string }>(
    "SELECT name FROM sqlite_master WHERE type = 'table' AND name = 'admin_credentials'"
  );

  if (!adminCredentialTable) {
    return;
  }

  const columns = await database.all<Array<{ name: string }>>("PRAGMA table_info(admin_credentials)");
  const hasLegacySingletonKey = columns.some((column) => column.name === "singleton_key");

  if (!hasLegacySingletonKey) {
    return;
  }

  await database.exec(`
    CREATE TABLE IF NOT EXISTS admin_credentials_v2 (
      username TEXT PRIMARY KEY,
      password_hash TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    INSERT OR IGNORE INTO admin_credentials_v2 (username, password_hash, updated_at)
    SELECT username, password_hash, updated_at FROM admin_credentials;

    DROP TABLE admin_credentials;

    ALTER TABLE admin_credentials_v2 RENAME TO admin_credentials;
  `);
}

async function ensureSchema(database: Database) {
  await database.exec(`
    CREATE TABLE IF NOT EXISTS subscribers (
      id TEXT PRIMARY KEY,
      email TEXT NOT NULL UNIQUE,
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS scheduled_newsletters (
      id TEXT PRIMARY KEY,
      subject TEXT NOT NULL,
      body TEXT NOT NULL,
      scheduled_for_iso TEXT NOT NULL,
      recipient_ids TEXT NOT NULL,
      status TEXT NOT NULL,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      sent_at TEXT
    );

    CREATE TABLE IF NOT EXISTS site_content (
      singleton_key TEXT PRIMARY KEY,
      published_json TEXT NOT NULL,
      draft_json TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      published_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS admin_credentials (
      username TEXT PRIMARY KEY,
      password_hash TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS password_reset_tokens (
      id TEXT PRIMARY KEY,
      username TEXT NOT NULL,
      token_hash TEXT NOT NULL,
      expires_at TEXT NOT NULL,
      used_at TEXT,
      created_at TEXT NOT NULL
    );
  `);

  await migrateAdminCredentials(database);
}

export async function getDb() {
  if (!databasePromise) {
    databasePromise = (async () => {
      const dataDirectory = path.join(process.cwd(), ".data");
      await fs.mkdir(dataDirectory, { recursive: true });

      const database = await open({
        filename: path.join(dataDirectory, "admin.db"),
        driver: sqlite3.Database
      });

      await ensureSchema(database);
      return database;
    })();
  }

  return databasePromise;
}