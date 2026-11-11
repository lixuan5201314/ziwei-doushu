import { mkdir, readFile } from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';

const url = process.env.DATABASE_URL?.trim();
if (!url) {
  console.error('缺少 DATABASE_URL，无法初始化账号数据库。');
  process.exit(1);
}

if (url.startsWith('sqlite:')) {
  const { DatabaseSync } = await import('node:sqlite');
  const value = url.slice('sqlite:'.length);
  const filename = path.isAbsolute(value) ? value : path.join(process.cwd(), '.data', path.basename(value));
  await mkdir(path.dirname(filename), { recursive: true });
  const db = new DatabaseSync(filename);
  db.exec('PRAGMA journal_mode = WAL; PRAGMA foreign_keys = ON;');
  db.exec(`
    CREATE TABLE IF NOT EXISTS auth_users (
      id TEXT PRIMARY KEY,
      email TEXT NOT NULL UNIQUE,
      name TEXT NOT NULL,
      password_hash TEXT NOT NULL,
      role TEXT NOT NULL CHECK (role IN ('user', 'admin')),
      status TEXT NOT NULL CHECK (status IN ('active', 'disabled')),
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      last_login_at TEXT
    );
    CREATE TABLE IF NOT EXISTS auth_sessions (
      id TEXT PRIMARY KEY,
      token_hash TEXT NOT NULL UNIQUE,
      user_id TEXT NOT NULL REFERENCES auth_users(id) ON DELETE CASCADE,
      expires_at TEXT NOT NULL,
      created_at TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS auth_sessions_user_id_idx ON auth_sessions(user_id);
    CREATE INDEX IF NOT EXISTS auth_sessions_expires_at_idx ON auth_sessions(expires_at);
    CREATE TABLE IF NOT EXISTS saved_charts (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL REFERENCES auth_users(id) ON DELETE CASCADE,
      label TEXT NOT NULL,
      birth_data TEXT NOT NULL,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS saved_charts_user_id_updated_at_idx ON saved_charts(user_id, updated_at DESC);
  `);
  db.close();
  console.log(`SQLite 账号数据库初始化完成：${filename}`);
  process.exit(0);
}

if (!/^postgres(?:ql)?:\/\//i.test(url)) {
  console.error('DATABASE_URL 必须是 sqlite: 路径或 PostgreSQL 连接串。');
  process.exit(1);
}

const { default: pg } = await import('pg');
const schema = await readFile(new URL('../db/auth-schema.sql', import.meta.url), 'utf8');
const pool = new pg.Pool({ connectionString: url, ssl: process.env.DATABASE_SSL === 'false' ? false : process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : undefined, max: 1 });
try {
  await pool.query(schema);
  console.log('PostgreSQL 账号数据库初始化完成。');
} finally {
  await pool.end();
}
