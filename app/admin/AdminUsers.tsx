'use client';

import { Fragment, useCallback, useEffect, useMemo, useState } from 'react';
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
  const [passwordUserId, setPasswordUserId] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

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

  const openPasswordEditor = (userId: string) => {
    setPasswordUserId((current) => current === userId ? '' : userId);
    setNewPassword('');
    setConfirmPassword('');
    setMessage('');
  };

  const changePassword = async (user: UserItem) => {
    if (newPassword !== confirmPassword) {
      setMessage('两次输入的密码不一致');
      return;
    }
    if (newPassword.length < 8 || !/[A-Za-z]/.test(newPassword) || !/\d/.test(newPassword)) {
      setMessage('密码至少 8 位，并同时包含字母和数字');
      return;
    }
    setSavingId(user.id);
    setMessage('');
    const response = await fetch(`/api/admin/users/${user.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ password: newPassword }),
    });
    const result = await response.json();
    if (!response.ok) {
      setMessage(result.message || '密码修改失败');
      setSavingId('');
      return;
    }
    setNewPassword('');
    setConfirmPassword('');
    setPasswordUserId('');
    if (user.id === currentUserId) {
      window.location.assign('/auth?returnTo=/admin');
      return;
    }
    setMessage(`已修改 ${user.email} 的密码，并注销该账号的现有登录`);
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
              {users.map((user) => <Fragment key={user.id}>
                <tr>
                  <td><strong>{user.email}</strong>{user.id === currentUserId && <small>当前账号</small>}</td>
                  <td><input value={user.name} maxLength={50} onChange={(event) => updateLocal(user.id, { name: event.target.value })} /></td>
                  <td><select value={user.role} disabled={user.id === currentUserId} onChange={(event) => updateLocal(user.id, { role: event.target.value as UserItem['role'] })}><option value="user">普通用户</option><option value="admin">管理员</option></select></td>
                  <td><select value={user.status} disabled={user.id === currentUserId} onChange={(event) => updateLocal(user.id, { status: event.target.value as UserItem['status'] })}><option value="active">正常</option><option value="disabled">停用</option></select></td>
                  <td>{new Date(user.createdAt).toLocaleDateString('zh-CN')}</td>
                  <td>{user.lastLoginAt ? new Date(user.lastLoginAt).toLocaleDateString('zh-CN') : '未登录'}</td>
                  <td><div className={styles.actions}><button type="button" onClick={() => void save(user)} disabled={savingId === user.id}>{savingId === user.id ? '保存中' : '保存'}</button><button className={styles.secondaryButton} type="button" onClick={() => openPasswordEditor(user.id)}>修改密码</button></div></td>
                </tr>
                {passwordUserId === user.id && <tr className={styles.passwordRow}>
                  <td colSpan={7}>
                    <form className={styles.passwordForm} onSubmit={(event) => { event.preventDefault(); void changePassword(user); }}>
                      <div><strong>修改密码</strong><span>{user.email}</span></div>
                      <label><span>新密码</span><input type="password" autoComplete="new-password" value={newPassword} onChange={(event) => setNewPassword(event.target.value)} minLength={8} maxLength={128} placeholder="至少 8 位，包含字母和数字" required /></label>
                      <label><span>确认密码</span><input type="password" autoComplete="new-password" value={confirmPassword} onChange={(event) => setConfirmPassword(event.target.value)} minLength={8} maxLength={128} placeholder="再次输入新密码" required /></label>
                      <div className={styles.passwordActions}><button type="button" className={styles.secondaryButton} onClick={() => openPasswordEditor(user.id)}>取消</button><button type="submit" disabled={savingId === user.id}>{savingId === user.id ? '修改中' : '确认修改'}</button></div>
                    </form>
                  </td>
                </tr>}
              </Fragment>)}
              {!loading && users.length === 0 && <tr><td colSpan={7} className={styles.empty}>没有匹配的账号</td></tr>}
            </tbody>
          </table>
          {loading && <p className={styles.loading}>正在加载账号</p>}
        </div>
      </section>
    </main>
  );
}
