import type { ReactNode } from 'react';
import ProtectedRoute from '@/components/ProtectedRoute';

export const dynamic = 'force-dynamic';

export default function ChartLayout({ children }: { children: ReactNode }) {
  return <ProtectedRoute returnTo="/chart">{children}</ProtectedRoute>;
}
