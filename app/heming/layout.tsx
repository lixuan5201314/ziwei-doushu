import type { ReactNode } from 'react';
import ProtectedRoute from '@/components/ProtectedRoute';

export const dynamic = 'force-dynamic';

export default function HemingLayout({ children }: { children: ReactNode }) {
  return <ProtectedRoute returnTo="/heming">{children}</ProtectedRoute>;
}
