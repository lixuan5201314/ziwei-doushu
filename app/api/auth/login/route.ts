import { NextResponse } from 'next/server';
import { verifyPassword } from '@/lib/auth/crypto';
import { findUserByEmail, recordLogin } from '@/lib/auth/store';
import { startUserSession } from '@/lib/auth/session';
import { allowAuthAttempt, requestIp } from '@/lib/auth/rate-limit';
import { isSameOrigin, normalizeEmail } from '@/lib/auth/validation';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
  if (!isSameOrigin(request)) return NextResponse.json({ message: '请求来源无效' }, { status: 403 });
  const ip = requestIp(request);
  if (!allowAuthAttempt(`login:${ip}`, 12)) return NextResponse.json({ message: '登录尝试过多，请稍后再试' }, { status: 429 });
  try {
    const body = await request.json();
    const email = normalizeEmail(body.email);
    const password = String(body.password ?? '');
    const user = await findUserByEmail(email);
    if (!user || !await verifyPassword(password, user.passwordHash)) return NextResponse.json({ message: '邮箱或密码不正确' }, { status: 401 });
    if (user.status !== 'active') return NextResponse.json({ message: '账号已停用，请联系管理员' }, { status: 403 });
    await recordLogin(user.id);
    await startUserSession(user.id);
    return NextResponse.json({ ok: true, user: { id: user.id, email: user.email, name: user.name, role: user.role, status: user.status } });
  } catch (error) {
    console.error('[auth/login]', error);
    return NextResponse.json({ message: '登录失败，请稍后再试' }, { status: 500 });
  }
}
