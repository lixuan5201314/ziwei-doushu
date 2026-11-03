'use client';

import { useState } from 'react';

export default function LogoutButton({ className }: { className?: string }) {
  const [loading, setLoading] = useState(false);
  const logout = async () => {
    setLoading(true);
    await fetch('/api/auth/logout', { method: 'POST' }).catch(() => null);
    window.location.assign('/');
  };
  return <button type="button" className={className} onClick={logout} disabled={loading}>{loading ? '正在退出' : '退出登录'}</button>;
}
