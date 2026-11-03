'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import styles from './AccountMenu.module.css';

interface UserSummary { name: string; email: string; role: 'user' | 'admin' }

export default function AccountMenu() {
  const [user, setUser] = useState<UserSummary | null | undefined>(undefined);

  useEffect(() => {
    fetch('/api/auth/me', { cache: 'no-store' })
      .then(async (response) => response.ok ? (await response.json()).user : null)
      .then(setUser)
      .catch(() => setUser(null));
  }, []);

  if (user === undefined) return <span className={styles.placeholder} aria-hidden="true" />;
  if (!user) return <Link className={styles.login} href="/auth">登录</Link>;

  return (
    <div className={styles.links}>
      {user.role === 'admin' && <Link href="/admin">后台</Link>}
      <Link className={styles.account} href="/account">{user.name || user.email}</Link>
    </div>
  );
}
