import AuthForm from './AuthForm';
import { safeReturnTo } from '@/lib/auth/validation';

export const dynamic = 'force-dynamic';

export default async function AuthPage({ searchParams }: { searchParams: Promise<{ returnTo?: string }> }) {
  const query = await searchParams;
  return <AuthForm returnTo={safeReturnTo(query.returnTo)} />;
}
