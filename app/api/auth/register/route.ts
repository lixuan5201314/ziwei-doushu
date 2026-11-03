import { NextResponse } from 'next/server';
import { hashPassword } from '@/lib/auth/crypto';
import { countUsers, createUser, findUserByEmail } from '@/lib/auth/store';
import { startUserSession } from '@/lib/auth/session';
import { allowAuthAttempt, requestIp } from '@/lib/auth/rate-limit';
import { isSameOrigin, isValidEmail, normalizeEmail, validatePassword } from '@/lib/auth/validation';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
  if (!isSameOrigin(request)) return NextResponse.json({ message: '请求来源无效' }, { status: 403 });
  if (!allowAuthAttempt(`register:${requestIp(request)}`, 6)) return NextResponse.json({ message: '操作过于频繁，请稍后再试' }, { status: 429 });

  try {
    const body = await request.json();
    const email = normalizeEmail(body.email);
    const name = String(body.name ?? '').trim().slice(0, 50);
    const password = String(body.password ?? '');
    if (!isValidEmail(email)) return NextResponse.json({ message: '请输入有效的邮箱地址' }, { status: 400 });
    const passwordError = validatePassword(password);
    if (passwordError) return NextResponse.json({ message: passwordError }, { status: 400 });
    if (await findUserByEmail(email)) return NextResponse.json({ message: '该邮箱已经注册' }, { status: 409 });

    const configuredAdmins = (process.env.ADMIN_EMAILS ?? '').split(',').map((item) => item.trim().toLowerCase()).filter(Boolean);
    const isDevelopmentBootstrap = process.env.NODE_ENV !== 'production' && configuredAdmins.length === 0 && await countUsers() === 0;
    const role = configuredAdmins.includes(email) || isDevelopmentBootstrap ? 'admin' : 'user';
    const user = await createUser({ email, name: name || email.split('@')[0], passwordHash: await hashPassword(password), role });
    await startUserSession(user.id);
    return NextResponse.json({ ok: true, user: { id: user.id, email: user.email, name: user.name, role: user.role, status: user.status } }, { status: 201 });
  } catch (error) {
    console.error('[auth/register]', error);
    const message = error instanceof Error && error.message.includes('生产环境必须配置') ? error.message : '注册失败，请稍后再试';
    return NextResponse.json({ message }, { status: 500 });
  }
}
