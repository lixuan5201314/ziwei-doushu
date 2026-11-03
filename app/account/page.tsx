import Link from 'next/link';
import { redirect } from 'next/navigation';
import { getCurrentUser } from '@/lib/auth/session';
import LogoutButton from '@/components/LogoutButton';
import styles from './account.module.css';

export const dynamic = 'force-dynamic';

export default async function AccountPage() {
  const user = await getCurrentUser();
  if (!user) redirect('/auth?returnTo=/account');
  return (
    <main className={styles.page}>
      <nav className={styles.nav}><Link href="/">紫微研究</Link><div><Link href="/chart">排盘</Link>{user.role === 'admin' && <Link href="/admin">管理后台</Link>}</div></nav>
      <section className={styles.content}>
        <p className={styles.kicker}>账号信息</p>
        <h1>{user.name}</h1>
        <dl>
          <div><dt>邮箱</dt><dd>{user.email}</dd></div>
          <div><dt>账号权限</dt><dd>{user.role === 'admin' ? '管理员' : '普通用户'}</dd></div>
          <div><dt>账号状态</dt><dd>{user.status === 'active' ? '正常' : '已停用'}</dd></div>
          <div><dt>注册时间</dt><dd>{new Date(user.createdAt).toLocaleString('zh-CN', { timeZone: 'Asia/Shanghai' })}</dd></div>
          <div><dt>最近登录</dt><dd>{user.lastLoginAt ? new Date(user.lastLoginAt).toLocaleString('zh-CN', { timeZone: 'Asia/Shanghai' }) : '首次登录'}</dd></div>
        </dl>
        <LogoutButton className={styles.logout} />
      </section>
    </main>
  );
}
