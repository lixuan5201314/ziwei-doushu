import 'server-only';

import { randomUUID } from 'node:crypto';
import { mkdirSync } from 'node:fs';
import path from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { Pool } from 'pg';
import type { AuthUserRecord, UserRole, UserStatus } from './types';
import { advancedSchema } from './advanced-schema.mjs';
import type { QueryDetails, QueryFeature, QueryRecord, QueryStatus } from './query-types';

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
      ${advancedSchema}
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
      ${advancedSchema}
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
    isSuperAdmin: row.role === 'admin' && Boolean(row.is_super_admin),
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

export async function findUserByEmail(email: string): Promise<AuthUserRecord | null> {
  if (usePostgres()) {
    await ensurePostgresSchema();
    const result = await getPool().query('SELECT * FROM auth_users WHERE email = $1 LIMIT 1', [email]);
    return result.rows[0] ? fromRow(result.rows[0]) : null;
  }
  const row = getSqlite().prepare('SELECT * FROM auth_users WHERE email = ? LIMIT 1').get(email) as DatabaseRow | undefined;
  return row ? fromRow(row) : null;
}

const adminMembership = 'EXISTS (SELECT 1 FROM auth_super_admins a WHERE a.user_id = u.id) AS is_super_admin';

export async function findUserById(id: string): Promise<AuthUserRecord | null> {
  if (usePostgres()) {
    await ensurePostgresSchema();
    const result = await getPool().query(`SELECT u.*, ${adminMembership} FROM auth_users u WHERE u.id = $1 LIMIT 1`, [id]);
    return result.rows[0] ? fromRow(result.rows[0]) : null;
  }
  const row = getSqlite().prepare(`SELECT u.*, ${adminMembership} FROM auth_users u WHERE u.id = ? LIMIT 1`).get(id) as DatabaseRow | undefined;
  return row ? fromRow(row) : null;
}

export async function createUser(input: { email: string; name: string; passwordHash: string; role: UserRole }): Promise<AuthUserRecord> {
  const now = new Date().toISOString();
  const user: AuthUserRecord = { id: randomUUID(), email: input.email, name: input.name, passwordHash: input.passwordHash, role: input.role, isSuperAdmin: false, status: 'active', createdAt: now, updatedAt: now, lastLoginAt: null };
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
    const result = await getPool().query(`SELECT u.*, ${adminMembership} FROM auth_sessions s JOIN auth_users u ON u.id = s.user_id WHERE s.token_hash = $1 AND s.expires_at > NOW() AND u.status = 'active' LIMIT 1`, [tokenHash]);
    return result.rows[0] ? fromRow(result.rows[0]) : null;
  }
  const row = getSqlite().prepare(`SELECT u.*, ${adminMembership} FROM auth_sessions s JOIN auth_users u ON u.id = s.user_id WHERE s.token_hash = ? AND s.expires_at > ? AND u.status = 'active' LIMIT 1`).get(tokenHash, new Date().toISOString()) as DatabaseRow | undefined;
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
    const result = await getPool().query(`SELECT u.*, ${adminMembership} FROM auth_users u WHERE u.email ILIKE $1 OR u.name ILIKE $1 ORDER BY u.created_at DESC LIMIT 500`, [query]);
    return result.rows.map(fromRow);
  }
  const query = `%${search.toLowerCase()}%`;
  const rows = getSqlite().prepare(`SELECT u.*, ${adminMembership} FROM auth_users u WHERE LOWER(u.email) LIKE ? OR LOWER(u.name) LIKE ? ORDER BY u.created_at DESC LIMIT 500`).all(query, query) as DatabaseRow[];
  return rows.map(fromRow);
}

const protectedAccount = 'NOT EXISTS (SELECT 1 FROM auth_super_admins a WHERE a.user_id = auth_users.id)';

export async function updateUserByAdmin(id: string, changes: { name?: string; role?: UserRole; status?: UserStatus }, allowOwnerSelfEdit = false): Promise<AuthUserRecord | null> {
  const current = await findUserById(id);
  if (!current) return null;
  const updated = { ...current, ...changes, updatedAt: new Date().toISOString() };
  if (usePostgres()) {
    await ensurePostgresSchema();
    const result = await getPool().query(`UPDATE auth_users SET name=$1, role=$2, status=$3, updated_at=$4 WHERE id=$5 AND ($6 OR ${protectedAccount}) RETURNING *`, [updated.name, updated.role, updated.status, updated.updatedAt, id, allowOwnerSelfEdit]);
    if (!result.rows[0]) return null;
    if (updated.status === 'disabled') await getPool().query('DELETE FROM auth_sessions WHERE user_id=$1', [id]);
    return { ...fromRow(result.rows[0]), isSuperAdmin: current.isSuperAdmin };
  }
  const db = getSqlite();
  const result = db.prepare(`UPDATE auth_users SET name=?, role=?, status=?, updated_at=? WHERE id=? AND (? OR ${protectedAccount})`).run(updated.name, updated.role, updated.status, updated.updatedAt, id, Number(allowOwnerSelfEdit));
  if (Number(result.changes) === 0) return null;
  if (updated.status === 'disabled') db.prepare('DELETE FROM auth_sessions WHERE user_id=?').run(id);
  return updated;
}

export async function updateUserPasswordByAdmin(id: string, passwordHash: string, allowOwnerSelfEdit = false): Promise<AuthUserRecord | null> {
  const updatedAt = new Date().toISOString();
  if (usePostgres()) {
    await ensurePostgresSchema();
    const client = await getPool().connect();
    try {
      await client.query('BEGIN');
      const result = await client.query(
        `UPDATE auth_users SET password_hash=$1, updated_at=$2 WHERE id=$3 AND ($4 OR ${protectedAccount}) RETURNING *`,
        [passwordHash, updatedAt, id, allowOwnerSelfEdit],
      );
      if (!result.rows[0]) {
        await client.query('ROLLBACK');
        return null;
      }
      await client.query('DELETE FROM auth_sessions WHERE user_id=$1', [id]);
      await client.query('COMMIT');
      return { ...fromRow(result.rows[0]), isSuperAdmin: allowOwnerSelfEdit };
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
    const result = db.prepare(`UPDATE auth_users SET password_hash=?, updated_at=? WHERE id=? AND (? OR ${protectedAccount})`).run(passwordHash, updatedAt, id, Number(allowOwnerSelfEdit));
    if (Number(result.changes) === 0) {
      db.exec('ROLLBACK');
      return null;
    }
    db.prepare('DELETE FROM auth_sessions WHERE user_id=?').run(id);
    const row = db.prepare('SELECT * FROM auth_users WHERE id=? LIMIT 1').get(id) as DatabaseRow;
    db.exec('COMMIT');
    return { ...fromRow(row), isSuperAdmin: allowOwnerSelfEdit };
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

const queryRetentionDays = 30;

function queryCutoff() {
  return new Date(Date.now() - queryRetentionDays * 86400_000).toISOString();
}

const queryRecordColumns = 'q.id, u.email, q.feature, q.status, q.created_at, q.details IS NOT NULL AS has_details';

function queryRecordFromRow(row: DatabaseRow): QueryRecord {
  return {
    id: String(row.id),
    email: String(row.email),
    feature: row.feature as QueryFeature,
    status: row.status as QueryStatus,
    createdAt: String(row.created_at),
    hasDetails: Boolean(row.has_details),
  };
}

export async function createQueryRecord(userId: string, feature: QueryFeature, status: QueryStatus, details?: QueryDetails) {
  const values = [randomUUID(), userId, feature, status, new Date().toISOString(), details ? JSON.stringify(details) : null];
  if (usePostgres()) {
    await ensurePostgresSchema();
    await getPool().query('INSERT INTO query_records (id, user_id, feature, status, created_at, details) VALUES ($1,$2,$3,$4,$5,$6)', values);
    await getPool().query('DELETE FROM query_records WHERE created_at < $1', [queryCutoff()]);
    return;
  }
  const db = getSqlite();
  db.prepare('INSERT INTO query_records (id, user_id, feature, status, created_at, details) VALUES (?,?,?,?,?,?)').run(...values);
  db.prepare('DELETE FROM query_records WHERE created_at < ?').run(queryCutoff());
}

export async function listQueryRecords(search: string, page: number) {
  const pageSize = 30;
  const offset = (page - 1) * pageSize;
  const values = [queryCutoff(), search.toLowerCase(), pageSize + 1, offset];
  const from = 'FROM query_records q JOIN auth_users u ON u.id = q.user_id';
  const order = 'ORDER BY q.created_at DESC, q.id DESC';
  let rows: DatabaseRow[];
  if (usePostgres()) {
    await ensurePostgresSchema();
    const result = await getPool().query(
      `SELECT ${queryRecordColumns} ${from} WHERE q.created_at >= $1 AND POSITION($2 IN LOWER(u.email)) > 0 ${order} LIMIT $3 OFFSET $4`,
      values,
    );
    rows = result.rows;
  } else {
    rows = getSqlite().prepare(
      `SELECT ${queryRecordColumns} ${from} WHERE q.created_at >= ? AND INSTR(LOWER(u.email), ?) > 0 ${order} LIMIT ? OFFSET ?`,
    ).all(...values) as DatabaseRow[];
  }
  return { records: rows.slice(0, pageSize).map(queryRecordFromRow), hasNextPage: rows.length > pageSize };
}

export async function getQueryRecord(id: string): Promise<(QueryRecord & { details: QueryDetails | null }) | null> {
  const sql = `SELECT ${queryRecordColumns}, q.details FROM query_records q JOIN auth_users u ON u.id = q.user_id`;
  const cutoff = queryCutoff();
  let row: DatabaseRow | undefined;
  if (usePostgres()) {
    await ensurePostgresSchema();
    row = (await getPool().query(`${sql} WHERE q.id = $1 AND q.created_at >= $2`, [id, cutoff])).rows[0];
  } else {
    row = getSqlite().prepare(`${sql} WHERE q.id = ? AND q.created_at >= ?`).get(id, cutoff) as DatabaseRow | undefined;
  }
  return row ? { ...queryRecordFromRow(row), details: typeof row.details === 'string' ? JSON.parse(row.details) as QueryDetails : null } : null;
}
