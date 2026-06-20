import Database from "better-sqlite3";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, "..");
const dataDirectory = path.join(projectRoot, "data");
const databasePath = path.join(dataDirectory, "lipcoding.db");

fs.mkdirSync(dataDirectory, { recursive: true });

const db = new Database(databasePath);

db.pragma("journal_mode = WAL");
db.pragma("foreign_keys = ON");

db.exec(`
  CREATE TABLE IF NOT EXISTS inbox_items (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL DEFAULT 'default',
    type TEXT NOT NULL CHECK(type IN ('note','task','event','file')),
    raw TEXT NOT NULL,
    summary TEXT NOT NULL DEFAULT '',
    tags TEXT NOT NULL DEFAULT '[]',
    due_date TEXT,
    scheduled INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS scheduled_events (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL DEFAULT 'default',
    item_id TEXT REFERENCES inbox_items(id),
    title TEXT NOT NULL,
    description TEXT,
    due_at TEXT NOT NULL,
    notified INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL
  );
`);

try {
  db.exec(
    "ALTER TABLE inbox_items ADD COLUMN completed INTEGER NOT NULL DEFAULT 0"
  );
} catch {
  // Column already exists on previously migrated databases.
}

export { db };
