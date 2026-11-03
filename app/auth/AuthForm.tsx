'use client';

import { useState } from 'react';
import Link from 'next/link';
import styles from './auth.module.css';

export default function AuthForm({ returnTo }: { returnTo: string }) {
  const [mode, setMode] = useState<'login' | 'register'>('login');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(false);

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setMessage('');
    if (mode === 'register' && password !== confirmPassword) {
      setMessage('两次输入的密码不一致');
      return;
    }
    setLoading(true);
    try {
      const response = await fetch(`/api/auth/${mode}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, email, password }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.message || '操作失败');
      window.location.assign(returnTo);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : '操作失败');
    } finally {
      setLoading(false);
    }
  };

  const changeMode = (nextMode: 'login' | 'register') => {
    setMode(nextMode);
    setMessage('');
  };

  return (
    <main className={styles.page}>
      <section className={styles.panel}>
        <Link className={styles.brand} href="/"><span>紫微</span>紫微研究</Link>
        <div className={styles.heading}>
          <p>账号访问</p>
          <h1>{mode === 'login' ? '登录后继续' : '创建账号'}</h1>
          <span>{mode === 'login' ? '排盘、合盘与资料库仅向登录用户开放。' : '使用邮箱注册，即可保存访问权限并使用导出功能。'}</span>
        </div>

        <div className={styles.tabs} role="tablist" aria-label="账号操作">
          <button type="button" role="tab" aria-selected={mode === 'login'} onClick={() => changeMode('login')}>登录</button>
          <button type="button" role="tab" aria-selected={mode === 'register'} onClick={() => changeMode('register')}>邮箱注册</button>
        </div>

        <form onSubmit={submit} className={styles.form}>
          {mode === 'register' && <label><span>称呼</span><input autoComplete="name" value={name} onChange={(event) => setName(event.target.value)} placeholder="请输入称呼" maxLength={50} /></label>}
          <label><span>邮箱</span><input type="email" autoComplete="email" value={email} onChange={(event) => setEmail(event.target.value)} placeholder="name@example.com" required /></label>
          <label><span>密码</span><input type="password" autoComplete={mode === 'login' ? 'current-password' : 'new-password'} value={password} onChange={(event) => setPassword(event.target.value)} placeholder={mode === 'register' ? '至少 8 位，包含字母和数字' : '请输入密码'} required minLength={8} maxLength={128} /></label>
          {mode === 'register' && <label><span>确认密码</span><input type="password" autoComplete="new-password" value={confirmPassword} onChange={(event) => setConfirmPassword(event.target.value)} placeholder="再次输入密码" required minLength={8} maxLength={128} /></label>}
          {message && <p className={styles.error} role="alert">{message}</p>}
          <button className={styles.submit} type="submit" disabled={loading}>{loading ? '正在处理' : mode === 'login' ? '登录' : '注册并登录'}</button>
        </form>

        <p className={styles.note}>登录状态采用安全 Cookie 保存，密码只以哈希形式存储。</p>
      </section>
      <aside className={styles.aside}>
        <p>登录后可用</p>
        <ul><li>生成紫微命盘与双人合盘</li><li>导出命盘图片和 JSON 数据</li><li>访问古籍与星曜知识库</li></ul>
      </aside>
    </main>
  );
}
