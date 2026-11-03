import { NextResponse } from 'next/server';
import { endUserSession } from '@/lib/auth/session';
import { isSameOrigin } from '@/lib/auth/validation';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
  if (!isSameOrigin(request)) return NextResponse.json({ message: '请求来源无效' }, { status: 403 });
  await endUserSession();
  return NextResponse.json({ ok: true });
}
