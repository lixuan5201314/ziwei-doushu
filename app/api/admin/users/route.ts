import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth/session';
import { listUsers } from '@/lib/auth/store';
import { toPublicUser } from '@/lib/auth/types';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  const currentUser = await getCurrentUser();
  if (!currentUser || currentUser.role !== 'admin') return NextResponse.json({ message: '无权访问' }, { status: 403 });
  const search = new URL(request.url).searchParams.get('search')?.trim().slice(0, 100) ?? '';
  const users = (await listUsers(search)).map(toPublicUser);
  return NextResponse.json({ users });
}
