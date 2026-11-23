import { getCurrentUser } from '@/lib/auth/session';
import { isSameOrigin } from '@/lib/auth/validation';
import { allowAuthAttempt } from '@/lib/auth/rate-limit';
import { queryBirthDetails, recordQuery } from '@/lib/auth/query-audit';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
  if (!isSameOrigin(request)) return Response.json({ message: '请求来源无效' }, { status: 403 });
  const user = await getCurrentUser();
  if (!user) return Response.json({ message: '请先登录' }, { status: 401 });
  const body = await request.json().catch(() => null) as {
    status?: unknown;
    birth?: unknown;
    result?: unknown;
    retainDetails?: boolean;
  } | null;
  if (body?.status !== 'success' && body?.status !== 'failed') return Response.json({ message: '记录状态无效' }, { status: 400 });
  if (!allowAuthAttempt(`chart-record:${user.id}`, 40, 60_000)) return new Response(null, { status: 429 });
  const birth = body.retainDetails === true ? queryBirthDetails(body.birth) : null;
  await recordQuery(user.id, 'chart', body.status, birth ? {
    births: [birth],
    result: body.status === 'success' && typeof body.result === 'string' ? body.result.trim().slice(0, 200) : undefined,
  } : undefined);
  return new Response(null, { status: 204 });
}
