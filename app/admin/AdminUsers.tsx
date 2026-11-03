'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import styles from './admin.module.css';

interface UserItem {
  id: string;
  email: string;
  name: string;
  role: 'user' | 'admin';
  status: 'active' | 'disabled';
  createdAt: string;
  lastLoginAt: string | null;
}

export default function AdminUsers({ currentUserId, currentUserName }: { currentUserId: string; currentUserName: string }) {
  const [users, setUsers] = useState<UserItem[]>([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState('');
  const [savingId, setSavingId] = useState('');

  const loadUsers = useCallback(async (query = '') => {
    setLoading(true);
    const response = await fetch(`/api/admin/users?search=${encodeURIComponent(query)}`, { cache: 'no-store' });
    const result = await response.json();
    if (response.ok) setUsers(result.users);
    else setMessage(result.message || '加载失败');
    setLoading(false);
  }, []);

  useEffect(() => { void loadUsers(); }, [loadUsers]);

  const counts = useMemo(() => ({ total: users.length, admins: users.filter((user) => user.role === 'admin').length, disabled: users.filter((user) => user.status === 'disabled').length }), [users]);
  const updateLocal = (id: string, change: Partial<UserItem>) => setUsers((items) => items.map((item) => item.id === id ? { ...item, ...change } : item));

  const save = async (user: UserItem) => {
    setSavingId(user.id);
    setMessage('');
    const response = await fetch(`/api/admin/users/${user.id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name: user.name, role: user.role, status: user.status }) });
    const result = await response.json();
    if (!response.ok) setMessage(result.message || '保存失败');
    else { updateLocal(user.id, result.user); setMessage('账号信息已更新'); }
    setSavingId('');
  };

  return (
    <main className={styles.page}>
      <aside className={styles.sidebar}>
        <Link className={styles.brand} href="/">紫微研究</Link>
        <nav><Link className={styles.active} href="/admin">账号管理</Link><Link href="/chart">排盘工具</Link><Link href="/account">我的账号</Link></nav>
        <p>{currentUserName}</p>
      </aside>
      <section className={styles.main}>
        <header><div><p>管理后台</p><h1>账号管理</h1></div><Link href="/">返回网站</Link></header>
        <div className={styles.stats}><div><span>账号总数</span><strong>{counts.total}</strong></div><div><span>管理员</span><strong>{counts.admins}</strong></div><div><span>已停用</span><strong>{counts.disabled}</strong></div></div>
        <form className={styles.search} onSubmit={(event) => { event.preventDefault(); void loadUsers(search); }}><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="搜索邮箱或称呼" /><button type="submit">搜索</button></form>
        {message && <p className={styles.message}>{message}</p>}
        <div className={styles.tableWrap}>
          <table>
            <thead><tr><th>账号</th><th>称呼</th><th>权限</th><th>状态</th><th>注册时间</th><th>最近登录</th><th /></tr></thead>
            <tbody>
              {users.map((user) => <tr key={user.id}>
                <td><strong>{user.email}</strong>{user.id === currentUserId && <small>当前账号</small>}</td>
                <td><input value={user.name} maxLength={50} onChange={(event) => updateLocal(user.id, { name: event.target.value })} /></td>
                <td><select value={user.role} disabled={user.id === currentUserId} onChange={(event) => updateLocal(user.id, { role: event.target.value as UserItem['role'] })}><option value="user">普通用户</option><option value="admin">管理员</option></select></td>
                <td><select value={user.status} disabled={user.id === currentUserId} onChange={(event) => updateLocal(user.id, { status: event.target.value as UserItem['status'] })}><option value="active">正常</option><option value="disabled">停用</option></select></td>
                <td>{new Date(user.createdAt).toLocaleDateString('zh-CN')}</td>
                <td>{user.lastLoginAt ? new Date(user.lastLoginAt).toLocaleDateString('zh-CN') : '未登录'}</td>
                <td><button type="button" onClick={() => void save(user)} disabled={savingId === user.id}>{savingId === user.id ? '保存中' : '保存'}</button></td>
              </tr>)}
              {!loading && users.length === 0 && <tr><td colSpan={7} className={styles.empty}>没有匹配的账号</td></tr>}
            </tbody>
          </table>
          {loading && <p className={styles.loading}>正在加载账号</p>}
        </div>
      </section>
    </main>
  );
}
