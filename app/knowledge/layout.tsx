import type { ReactNode } from 'react';
import ProtectedRoute from '@/components/ProtectedRoute';

export const dynamic = 'force-dynamic';

export default function KnowledgeLayout({ children }: { children: ReactNode }) {
  return <ProtectedRoute returnTo="/knowledge">{children}</ProtectedRoute>;
}
