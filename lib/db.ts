import fs from "node:fs/promises";
import path from "node:path";
import { getCloudflareContext } from "@opennextjs/cloudflare";

type QueryParams = unknown[];
type LocalDatabase = {
  get<T>(sql: string, ...params: QueryParams): Promise<T | undefined>;
  all<T>(sql: string, ...params: QueryParams): Promise<T>;
  run(sql: string, ...params: QueryParams): Promise<unknown>;
  exec(sql: string): Promise<unknown>;
};
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
type D1DatabaseLike = { prepare(query: string): D1PreparedStatementLike; exec(query: string): Promise<unknown> };

let databasePromise: Promise<DatabaseClient> | undefined;

function createSqliteClient(database: LocalDatabase): DatabaseClient {
  return {
    async get<T>(sql: string, ...params: QueryParams) { return (await database.get<T>(sql, ...params)) ?? undefined; },
    async all<T>(sql: string, ...params: QueryParams) { return (await database.all(sql, ...params)) as T; },
    async run(sql, ...params) { await database.run(sql, ...params); },
    async exec(sql) { await database.exec(sql); }
  };
}

function createD1Client(database: D1DatabaseLike): DatabaseClient {
  const prepare = (sql: string, params: QueryParams) => {
    const statement = database.prepare(sql);
    return params.length ? statement.bind(...params) : statement;
  };
  return {
    async get<T>(sql: string, ...params: QueryParams) { return (await prepare(sql, params).first<T>()) ?? undefined; },
    async all<T>(sql: string, ...params: QueryParams) {
      const result = await prepare(sql, params).all<unknown>();
      return (result.results ?? []) as T;
    },
    async run(sql, ...params) { await prepare(sql, params).run(); },
    async exec(sql) { await database.exec(sql); }
  };
}

async function getCloudflareD1Database() {
  try {
    const { env } = await getCloudflareContext({ async: true });
    return (env as { DASHBOARD_DB?: D1DatabaseLike }).DASHBOARD_DB;
  } catch {
    return undefined;
  }
}

async function ensureLocalSchema(database: DatabaseClient) {
  await database.exec(
    "CREATE TABLE IF NOT EXISTS subscribers (id TEXT PRIMARY KEY, email TEXT NOT NULL UNIQUE, created_at TEXT NOT NULL);" +
    "CREATE TABLE IF NOT EXISTS scheduled_newsletters (id TEXT PRIMARY KEY, subject TEXT NOT NULL, body TEXT NOT NULL, scheduled_for_iso TEXT NOT NULL, recipient_ids TEXT NOT NULL, status TEXT NOT NULL, created_at TEXT NOT NULL, updated_at TEXT NOT NULL, sent_at TEXT);" +
    "CREATE TABLE IF NOT EXISTS site_content (singleton_key TEXT PRIMARY KEY, published_json TEXT NOT NULL, draft_json TEXT NOT NULL, updated_at TEXT NOT NULL, published_at TEXT NOT NULL);" +
    "CREATE TABLE IF NOT EXISTS admin_credentials (username TEXT PRIMARY KEY, password_hash TEXT NOT NULL, updated_at TEXT NOT NULL);" +
    "CREATE TABLE IF NOT EXISTS password_reset_tokens (id TEXT PRIMARY KEY, username TEXT NOT NULL, token_hash TEXT NOT NULL, expires_at TEXT NOT NULL, used_at TEXT, created_at TEXT NOT NULL);" +
    "CREATE TABLE IF NOT EXISTS contact_submissions (id TEXT PRIMARY KEY, name TEXT NOT NULL, email TEXT NOT NULL, phone TEXT, topic TEXT NOT NULL, message TEXT NOT NULL, page_url TEXT, status TEXT NOT NULL DEFAULT 'new', created_at TEXT NOT NULL, read_at TEXT, archived_at TEXT);" +
    "CREATE TABLE IF NOT EXISTS activity_log (id TEXT PRIMARY KEY, actor TEXT NOT NULL, action TEXT NOT NULL, entity_type TEXT NOT NULL, entity_id TEXT, metadata_json TEXT, created_at TEXT NOT NULL);" +
    "CREATE TABLE IF NOT EXISTS analytics_events (id TEXT PRIMARY KEY, event_type TEXT NOT NULL, path TEXT NOT NULL, referrer TEXT, browser TEXT, device TEXT, visitor_id TEXT, metadata_json TEXT, created_at TEXT NOT NULL);" +
    "CREATE TABLE IF NOT EXISTS contact_rate_limits (bucket_key TEXT PRIMARY KEY, window_started_at INTEGER NOT NULL, request_count INTEGER NOT NULL DEFAULT 0);" +
    "CREATE INDEX IF NOT EXISTS idx_contact_submissions_status_created ON contact_submissions(status, created_at DESC);" +
    "CREATE INDEX IF NOT EXISTS idx_activity_log_created ON activity_log(created_at DESC);" +
    "CREATE INDEX IF NOT EXISTS idx_analytics_events_created ON analytics_events(created_at DESC);" +
    "CREATE INDEX IF NOT EXISTS idx_contact_rate_limits_window ON contact_rate_limits(window_started_at);"
  );
}

export async function getDb() {
  if (!databasePromise) {
    databasePromise = (async () => {
      const d1 = await getCloudflareD1Database();
      if (d1) return createD1Client(d1);
      const dataDirectory = path.join(process.cwd(), ".data");
      await fs.mkdir(dataDirectory, { recursive: true });
      const [{ default: sqlite3 }, { open }] = await Promise.all([import("sqlite3"), import("sqlite")]);
      const sqliteDatabase = await open({ filename: path.join(dataDirectory, "admin.db"), driver: sqlite3.Database });
      const database = createSqliteClient(sqliteDatabase);
      await ensureLocalSchema(database);
      return database;
    })();
  }
  return databasePromise;
}
