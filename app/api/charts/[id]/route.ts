import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth/session';
import { deleteSavedChart } from '@/lib/auth/store';
import { isSameOrigin } from '@/lib/auth/validation';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!isSameOrigin(request)) return NextResponse.json({ message: '请求来源无效' }, { status: 403 });
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ message: '请先登录' }, { status: 401 });
  const { id } = await params;
  const deleted = await deleteSavedChart(user.id, id);
  if (!deleted) return NextResponse.json({ message: '保存记录不存在' }, { status: 404 });
  return NextResponse.json({ ok: true });
}
