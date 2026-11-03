import 'server-only';

import { cookies } from 'next/headers';
import { createSessionToken, hashSessionToken } from './crypto';
import { createSession, deleteSession, findUserBySessionHash } from './store';
import { toPublicUser, type PublicUser } from './types';

export const SESSION_COOKIE = 'ziwei_session';

function sessionDays() {
  const parsed = Number(process.env.AUTH_SESSION_DAYS ?? 30);
  return Number.isFinite(parsed) && parsed > 0 ? Math.min(parsed, 90) : 30;
}

function secureCookie() {
  if (process.env.AUTH_COOKIE_SECURE === 'false') return false;
  if (process.env.AUTH_COOKIE_SECURE === 'true') return true;
  return process.env.NODE_ENV === 'production';
}

export async function startUserSession(userId: string) {
  const token = createSessionToken();
  const maxAge = sessionDays() * 24 * 60 * 60;
  const expiresAt = new Date(Date.now() + maxAge * 1000);
  await createSession(userId, hashSessionToken(token), expiresAt.toISOString());
  const cookieStore = await cookies();
  cookieStore.set(SESSION_COOKIE, token, { httpOnly: true, sameSite: 'strict', secure: secureCookie(), path: '/', maxAge, priority: 'high' });
}

export async function endUserSession() {
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE)?.value;
  if (token) await deleteSession(hashSessionToken(token));
  cookieStore.set(SESSION_COOKIE, '', { httpOnly: true, sameSite: 'strict', secure: secureCookie(), path: '/', maxAge: 0 });
}

export async function getCurrentUser(): Promise<PublicUser | null> {
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  if (!token) return null;
  const user = await findUserBySessionHash(hashSessionToken(token));
  return user ? toPublicUser(user) : null;
}

export async function getUserFromRawToken(token: string | undefined): Promise<PublicUser | null> {
  if (!token) return null;
  const user = await findUserBySessionHash(hashSessionToken(token));
  return user ? toPublicUser(user) : null;
}
