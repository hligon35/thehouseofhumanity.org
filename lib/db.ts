import fs from "node:fs/promises";
import path from "node:path";
import { getCloudflareContext } from "@opennextjs/cloudflare";
import sqlite3 from "sqlite3";
import { open, type Database } from "sqlite";

type QueryParams = unknown[];

type DatabaseClient = {
  get<T>(sql: string, ...params: QueryParams): Promise<T | undefined>;
  all<T>(sql: string, ...params: QueryParams): Promise<T>;
  run(sql: string, ...params: QueryParams): Promise<void>;
  exec(sql: string): Promise<void>;
};

type D1PreparedStatementLike = {
  bind(...values: QueryParams): D1PreparedStatementLike;
  first<T>(): Promise<T | null>;
  all<T>(): Promise<{ results?: T[] }>;
  run(): Promise<unknown>;
};

type D1DatabaseLike = {
  prepare(query: string): D1PreparedStatementLike;
  exec(query: string): Promise<unknown>;
};

let databasePromise: Promise<DatabaseClient> | undefined;

function createSqliteClient(database: Database): DatabaseClient {
  return {
    async get<T>(sql: string, ...params: QueryParams) {
      const row = await database.get<T>(sql, ...params);
      return row ?? undefined;
    },
    async all<T>(sql: string, ...params: QueryParams) {
      return (await database.all(sql, ...params)) as T;
    },
    async run(sql: string, ...params: QueryParams) {
      await database.run(sql, ...params);
    },
    async exec(sql: string) {
      await database.exec(sql);
    }
  };
}

function createD1Client(database: D1DatabaseLike): DatabaseClient {
  const prepare = (sql: string, params: QueryParams) => {
    const statement = database.prepare(sql);
    return params.length > 0 ? statement.bind(...params) : statement;
  };

  return {
    async get<T>(sql: string, ...params: QueryParams) {
      const row = await prepare(sql, params).first<T>();
      return row ?? undefined;
    },
    async all<T>(sql: string, ...params: QueryParams) {
      const result = await prepare(sql, params).all<unknown>();
      return (result.results ?? []) as T;
    },
    async run(sql: string, ...params: QueryParams) {
      await prepare(sql, params).run();
    },
    async exec(sql: string) {
      await database.exec(sql);
    }
  };
}

async function getCloudflareD1Database() {
  try {
    const { env } = await getCloudflareContext({ async: true });
    const runtimeEnv = env as { DASHBOARD_DB?: D1DatabaseLike };
    return runtimeEnv.DASHBOARD_DB;
  } catch {
    return undefined;
  }
}

async function migrateAdminCredentials(database: DatabaseClient) {
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

async function ensureSchema(database: DatabaseClient) {
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
      const d1Database = await getCloudflareD1Database();
      if (d1Database) {
        const database = createD1Client(d1Database);
        await ensureSchema(database);
        return database;
      }

      const dataDirectory = path.join(process.cwd(), ".data");
      await fs.mkdir(dataDirectory, { recursive: true });

      const sqliteDatabase = await open({
        filename: path.join(dataDirectory, "admin.db"),
        driver: sqlite3.Database
      });

      const database = createSqliteClient(sqliteDatabase);
      await ensureSchema(database);
      return database;
    })();
  }

  return databasePromise;
}