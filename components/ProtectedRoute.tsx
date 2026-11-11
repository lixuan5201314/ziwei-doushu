import type { ReactNode } from 'react';
import { redirect } from 'next/navigation';
import { getCurrentUser } from '@/lib/auth/session';

export default async function ProtectedRoute({
  children,
  returnTo,
}: {
  children: ReactNode;
  returnTo: string;
}) {
  const user = await getCurrentUser();
  if (!user) redirect(`/auth?returnTo=${encodeURIComponent(returnTo)}`);
  return <>{children}</>;
}
