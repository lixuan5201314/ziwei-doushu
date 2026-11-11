import 'server-only';

import { randomUUID } from 'node:crypto';
import { mkdirSync } from 'node:fs';
import path from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { Pool } from 'pg';
import type { AuthUserRecord, UserRole, UserStatus } from './types';

type DatabaseRow = Record<string, unknown>;

export interface SavedChartRecord {
  id: string;
  userId: string;
  label: string;
  birthData: unknown;
  createdAt: string;
  updatedAt: string;
}

const globalForAuth = globalThis as typeof globalThis & {
  ziweiAuthPool?: Pool;
  ziweiAuthSchema?: Promise<void>;
  ziweiAuthSqlite?: DatabaseSync;
};

function databaseUrl() {
  return process.env.DATABASE_URL?.trim() || (process.env.NODE_ENV === 'production' ? '' : 'sqlite:./.data/ziwei.db');
}

function usePostgres() {
  return /^postgres(?:ql)?:\/\//i.test(databaseUrl());
}

function getPool() {
  const url = databaseUrl();
  if (!url) throw new Error('生产环境必须配置 DATABASE_URL');
  if (!globalForAuth.ziweiAuthPool) {
    globalForAuth.ziweiAuthPool = new Pool({
      connectionString: url,
      ssl: process.env.DATABASE_SSL === 'false' ? false : process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : undefined,
      max: 5,
    });
  }
  return globalForAuth.ziweiAuthPool;
}

async function ensurePostgresSchema() {
  if (!globalForAuth.ziweiAuthSchema) {
    globalForAuth.ziweiAuthSchema = getPool().query(`
      CREATE TABLE IF NOT EXISTS auth_users (
        id TEXT PRIMARY KEY,
        email TEXT NOT NULL UNIQUE,
        name TEXT NOT NULL,
        password_hash TEXT NOT NULL,
        role TEXT NOT NULL CHECK (role IN ('user', 'admin')),
        status TEXT NOT NULL CHECK (status IN ('active', 'disabled')),
        created_at TIMESTAMPTZ NOT NULL,
        updated_at TIMESTAMPTZ NOT NULL,
        last_login_at TIMESTAMPTZ
      );
      CREATE TABLE IF NOT EXISTS auth_sessions (
        id TEXT PRIMARY KEY,
        token_hash TEXT NOT NULL UNIQUE,
        user_id TEXT NOT NULL REFERENCES auth_users(id) ON DELETE CASCADE,
        expires_at TIMESTAMPTZ NOT NULL,
        created_at TIMESTAMPTZ NOT NULL
      );
      CREATE INDEX IF NOT EXISTS auth_sessions_user_id_idx ON auth_sessions(user_id);
      CREATE INDEX IF NOT EXISTS auth_sessions_expires_at_idx ON auth_sessions(expires_at);
      CREATE TABLE IF NOT EXISTS saved_charts (
        id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL REFERENCES auth_users(id) ON DELETE CASCADE,
        label TEXT NOT NULL,
        birth_data JSONB NOT NULL,
        created_at TIMESTAMPTZ NOT NULL,
        updated_at TIMESTAMPTZ NOT NULL
      );
      CREATE INDEX IF NOT EXISTS saved_charts_user_id_updated_at_idx ON saved_charts(user_id, updated_at DESC);
    `).then(() => undefined);
  }
  await globalForAuth.ziweiAuthSchema;
}

function sqlitePath() {
  const url = databaseUrl();
  if (!url) throw new Error('生产环境必须配置 DATABASE_URL');
  if (!url.startsWith('sqlite:')) throw new Error('DATABASE_URL 必须是 postgresql:// 或 sqlite: 路径');
  const value = url.slice('sqlite:'.length);
  if (!value) throw new Error('SQLite 数据库路径不能为空');
  return path.isAbsolute(value) ? value : path.join(process.cwd(), '.data', path.basename(value));
}

function getSqlite() {
  if (!globalForAuth.ziweiAuthSqlite) {
    const filename = sqlitePath();
    mkdirSync(path.dirname(filename), { recursive: true });
    const db = new DatabaseSync(filename);
    db.exec('PRAGMA journal_mode = WAL; PRAGMA foreign_keys = ON; PRAGMA busy_timeout = 5000;');
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
    globalForAuth.ziweiAuthSqlite = db;
  }
  return globalForAuth.ziweiAuthSqlite;
}

function fromRow(row: DatabaseRow): AuthUserRecord {
  return {
    id: String(row.id),
    email: String(row.email),
    name: String(row.name),
    passwordHash: String(row.password_hash),
    role: row.role as UserRole,
    status: row.status as UserStatus,
    createdAt: new Date(String(row.created_at)).toISOString(),
    updatedAt: new Date(String(row.updated_at)).toISOString(),
    lastLoginAt: row.last_login_at ? new Date(String(row.last_login_at)).toISOString() : null,
  };
}

function savedChartFromRow(row: DatabaseRow): SavedChartRecord {
  const rawBirthData = row.birth_data;
  return {
    id: String(row.id),
    userId: String(row.user_id),
    label: String(row.label),
    birthData: typeof rawBirthData === 'string' ? JSON.parse(rawBirthData) : rawBirthData,
    createdAt: new Date(String(row.created_at)).toISOString(),
    updatedAt: new Date(String(row.updated_at)).toISOString(),
  };
}

export async function countUsers(): Promise<number> {
  if (usePostgres()) {
    await ensurePostgresSchema();
    const result = await getPool().query('SELECT COUNT(*)::int AS count FROM auth_users');
    return Number(result.rows[0].count);
  }
  const row = getSqlite().prepare('SELECT COUNT(*) AS count FROM auth_users').get() as DatabaseRow;
  return Number(row.count);
}

export async function findUserByEmail(email: string): Promise<AuthUserRecord | null> {
  if (usePostgres()) {
    await ensurePostgresSchema();
    const result = await getPool().query('SELECT * FROM auth_users WHERE email = $1 LIMIT 1', [email]);
    return result.rows[0] ? fromRow(result.rows[0]) : null;
  }
  const row = getSqlite().prepare('SELECT * FROM auth_users WHERE email = ? LIMIT 1').get(email) as DatabaseRow | undefined;
  return row ? fromRow(row) : null;
}

export async function findUserById(id: string): Promise<AuthUserRecord | null> {
  if (usePostgres()) {
    await ensurePostgresSchema();
    const result = await getPool().query('SELECT * FROM auth_users WHERE id = $1 LIMIT 1', [id]);
    return result.rows[0] ? fromRow(result.rows[0]) : null;
  }
  const row = getSqlite().prepare('SELECT * FROM auth_users WHERE id = ? LIMIT 1').get(id) as DatabaseRow | undefined;
  return row ? fromRow(row) : null;
}

export async function createUser(input: { email: string; name: string; passwordHash: string; role: UserRole }): Promise<AuthUserRecord> {
  const now = new Date().toISOString();
  const user: AuthUserRecord = { id: randomUUID(), email: input.email, name: input.name, passwordHash: input.passwordHash, role: input.role, status: 'active', createdAt: now, updatedAt: now, lastLoginAt: null };
  if (usePostgres()) {
    await ensurePostgresSchema();
    const result = await getPool().query(
      `INSERT INTO auth_users (id, email, name, password_hash, role, status, created_at, updated_at, last_login_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING *`,
      [user.id, user.email, user.name, user.passwordHash, user.role, user.status, user.createdAt, user.updatedAt, null],
    );
    return fromRow(result.rows[0]);
  }
  getSqlite().prepare(`INSERT INTO auth_users (id,email,name,password_hash,role,status,created_at,updated_at,last_login_at) VALUES (?,?,?,?,?,?,?,?,?)`).run(user.id, user.email, user.name, user.passwordHash, user.role, user.status, user.createdAt, user.updatedAt, null);
  return user;
}

export async function recordLogin(userId: string) {
  const now = new Date().toISOString();
  if (usePostgres()) {
    await ensurePostgresSchema();
    await getPool().query('UPDATE auth_users SET last_login_at = $1, updated_at = $1 WHERE id = $2', [now, userId]);
    return;
  }
  getSqlite().prepare('UPDATE auth_users SET last_login_at = ?, updated_at = ? WHERE id = ?').run(now, now, userId);
}

export async function createSession(userId: string, tokenHash: string, expiresAt: string) {
  const id = randomUUID();
  const createdAt = new Date().toISOString();
  if (usePostgres()) {
    await ensurePostgresSchema();
    await getPool().query('DELETE FROM auth_sessions WHERE expires_at <= NOW()');
    await getPool().query('INSERT INTO auth_sessions (id, token_hash, user_id, expires_at, created_at) VALUES ($1,$2,$3,$4,$5)', [id, tokenHash, userId, expiresAt, createdAt]);
    return;
  }
  const db = getSqlite();
  db.prepare('DELETE FROM auth_sessions WHERE expires_at <= ?').run(new Date().toISOString());
  db.prepare('INSERT INTO auth_sessions (id,token_hash,user_id,expires_at,created_at) VALUES (?,?,?,?,?)').run(id, tokenHash, userId, expiresAt, createdAt);
}

export async function findUserBySessionHash(tokenHash: string): Promise<AuthUserRecord | null> {
  if (usePostgres()) {
    await ensurePostgresSchema();
    const result = await getPool().query(`SELECT u.* FROM auth_sessions s JOIN auth_users u ON u.id = s.user_id WHERE s.token_hash = $1 AND s.expires_at > NOW() AND u.status = 'active' LIMIT 1`, [tokenHash]);
    return result.rows[0] ? fromRow(result.rows[0]) : null;
  }
  const row = getSqlite().prepare(`SELECT u.* FROM auth_sessions s JOIN auth_users u ON u.id = s.user_id WHERE s.token_hash = ? AND s.expires_at > ? AND u.status = 'active' LIMIT 1`).get(tokenHash, new Date().toISOString()) as DatabaseRow | undefined;
  return row ? fromRow(row) : null;
}

export async function deleteSession(tokenHash: string) {
  if (usePostgres()) {
    await ensurePostgresSchema();
    await getPool().query('DELETE FROM auth_sessions WHERE token_hash = $1', [tokenHash]);
    return;
  }
  getSqlite().prepare('DELETE FROM auth_sessions WHERE token_hash = ?').run(tokenHash);
}

export async function listUsers(search = ''): Promise<AuthUserRecord[]> {
  if (usePostgres()) {
    await ensurePostgresSchema();
    const query = `%${search}%`;
    const result = await getPool().query('SELECT * FROM auth_users WHERE email ILIKE $1 OR name ILIKE $1 ORDER BY created_at DESC LIMIT 500', [query]);
    return result.rows.map(fromRow);
  }
  const query = `%${search.toLowerCase()}%`;
  const rows = getSqlite().prepare('SELECT * FROM auth_users WHERE LOWER(email) LIKE ? OR LOWER(name) LIKE ? ORDER BY created_at DESC LIMIT 500').all(query, query) as DatabaseRow[];
  return rows.map(fromRow);
}

export async function updateUserByAdmin(id: string, changes: { name?: string; role?: UserRole; status?: UserStatus }): Promise<AuthUserRecord | null> {
  const current = await findUserById(id);
  if (!current) return null;
  const updated = { ...current, ...changes, updatedAt: new Date().toISOString() };
  if (usePostgres()) {
    await ensurePostgresSchema();
    const result = await getPool().query('UPDATE auth_users SET name=$1, role=$2, status=$3, updated_at=$4 WHERE id=$5 RETURNING *', [updated.name, updated.role, updated.status, updated.updatedAt, id]);
    if (updated.status === 'disabled') await getPool().query('DELETE FROM auth_sessions WHERE user_id=$1', [id]);
    return result.rows[0] ? fromRow(result.rows[0]) : null;
  }
  const db = getSqlite();
  db.prepare('UPDATE auth_users SET name=?, role=?, status=?, updated_at=? WHERE id=?').run(updated.name, updated.role, updated.status, updated.updatedAt, id);
  if (updated.status === 'disabled') db.prepare('DELETE FROM auth_sessions WHERE user_id=?').run(id);
  return updated;
}

export async function updateUserPasswordByAdmin(id: string, passwordHash: string): Promise<AuthUserRecord | null> {
  const updatedAt = new Date().toISOString();
  if (usePostgres()) {
    await ensurePostgresSchema();
    const client = await getPool().connect();
    try {
      await client.query('BEGIN');
      const result = await client.query(
        'UPDATE auth_users SET password_hash=$1, updated_at=$2 WHERE id=$3 RETURNING *',
        [passwordHash, updatedAt, id],
      );
      if (!result.rows[0]) {
        await client.query('ROLLBACK');
        return null;
      }
      await client.query('DELETE FROM auth_sessions WHERE user_id=$1', [id]);
      await client.query('COMMIT');
      return fromRow(result.rows[0]);
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  const db = getSqlite();
  db.exec('BEGIN IMMEDIATE');
  try {
    const result = db.prepare('UPDATE auth_users SET password_hash=?, updated_at=? WHERE id=?').run(passwordHash, updatedAt, id);
    if (Number(result.changes) === 0) {
      db.exec('ROLLBACK');
      return null;
    }
    db.prepare('DELETE FROM auth_sessions WHERE user_id=?').run(id);
    const row = db.prepare('SELECT * FROM auth_users WHERE id=? LIMIT 1').get(id) as DatabaseRow;
    db.exec('COMMIT');
    return fromRow(row);
  } catch (error) {
    db.exec('ROLLBACK');
    throw error;
  }
}

export async function listSavedCharts(userId: string): Promise<SavedChartRecord[]> {
  if (usePostgres()) {
    await ensurePostgresSchema();
    const result = await getPool().query(
      'SELECT * FROM saved_charts WHERE user_id=$1 ORDER BY updated_at DESC LIMIT 50',
      [userId],
    );
    return result.rows.map(savedChartFromRow);
  }
  const rows = getSqlite().prepare('SELECT * FROM saved_charts WHERE user_id=? ORDER BY updated_at DESC LIMIT 50').all(userId) as DatabaseRow[];
  return rows.map(savedChartFromRow);
}

export async function createSavedChart(userId: string, label: string, birthData: unknown): Promise<SavedChartRecord> {
  const now = new Date().toISOString();
  const id = randomUUID();
  const serialized = JSON.stringify(birthData);
  if (usePostgres()) {
    await ensurePostgresSchema();
    const result = await getPool().query(
      `INSERT INTO saved_charts (id, user_id, label, birth_data, created_at, updated_at)
       VALUES ($1,$2,$3,$4::jsonb,$5,$6) RETURNING *`,
      [id, userId, label, serialized, now, now],
    );
    return savedChartFromRow(result.rows[0]);
  }
  getSqlite().prepare(
    'INSERT INTO saved_charts (id, user_id, label, birth_data, created_at, updated_at) VALUES (?,?,?,?,?,?)',
  ).run(id, userId, label, serialized, now, now);
  return { id, userId, label, birthData, createdAt: now, updatedAt: now };
}

export async function deleteSavedChart(userId: string, id: string): Promise<boolean> {
  if (usePostgres()) {
    await ensurePostgresSchema();
    const result = await getPool().query('DELETE FROM saved_charts WHERE id=$1 AND user_id=$2', [id, userId]);
    return Boolean(result.rowCount);
  }
  const result = getSqlite().prepare('DELETE FROM saved_charts WHERE id=? AND user_id=?').run(id, userId);
  return Number(result.changes) > 0;
}
