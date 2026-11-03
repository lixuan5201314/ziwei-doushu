import { redirect } from 'next/navigation';
import { getCurrentUser } from '@/lib/auth/session';
import AdminUsers from './AdminUsers';

export const dynamic = 'force-dynamic';

export default async function AdminPage() {
  const user = await getCurrentUser();
  if (!user) redirect('/auth?returnTo=/admin');
  if (user.role !== 'admin') redirect('/account?error=forbidden');
  return <AdminUsers currentUserId={user.id} currentUserName={user.name} />;
}
