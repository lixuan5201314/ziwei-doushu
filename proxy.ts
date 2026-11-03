import { NextResponse, type NextRequest } from 'next/server';
import { getUserFromRawToken, SESSION_COOKIE } from '@/lib/auth/session';

export async function proxy(request: NextRequest) {
  const user = await getUserFromRawToken(request.cookies.get(SESSION_COOKIE)?.value);
  const isApi = request.nextUrl.pathname.startsWith('/api/');

  if (!user) {
    if (isApi) return NextResponse.json({ message: '请先登录' }, { status: 401 });
    const authUrl = new URL('/auth', request.url);
    authUrl.searchParams.set('returnTo', `${request.nextUrl.pathname}${request.nextUrl.search}`);
    return NextResponse.redirect(authUrl);
  }

  if (request.nextUrl.pathname.startsWith('/admin') && user.role !== 'admin') {
    return NextResponse.redirect(new URL('/account?error=forbidden', request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    '/chart/:path*',
    '/heming/:path*',
    '/library/:path*',
    '/knowledge/:path*',
    '/account/:path*',
    '/admin/:path*',
    '/api/interpret/:path*',
  ],
};
