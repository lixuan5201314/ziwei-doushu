import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth/session';
import { updateUserByAdmin } from '@/lib/auth/store';
import { toPublicUser, type UserRole, type UserStatus } from '@/lib/auth/types';
import { isSameOrigin } from '@/lib/auth/validation';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!isSameOrigin(request)) return NextResponse.json({ message: '请求来源无效' }, { status: 403 });
  const currentUser = await getCurrentUser();
  if (!currentUser || currentUser.role !== 'admin') return NextResponse.json({ message: '无权操作' }, { status: 403 });
  const { id } = await params;
  const body = await request.json();
  const changes: { name?: string; role?: UserRole; status?: UserStatus } = {};
  if (typeof body.name === 'string') changes.name = body.name.trim().slice(0, 50);
  if (body.role === 'user' || body.role === 'admin') changes.role = body.role;
  if (body.status === 'active' || body.status === 'disabled') changes.status = body.status;
  if (id === currentUser.id && (changes.role === 'user' || changes.status === 'disabled')) return NextResponse.json({ message: '不能降低或停用当前登录的管理员账号' }, { status: 400 });
  const updated = await updateUserByAdmin(id, changes);
  if (!updated) return NextResponse.json({ message: '账号不存在' }, { status: 404 });
  return NextResponse.json({ user: toPublicUser(updated) });
}
