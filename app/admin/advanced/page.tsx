import Link from 'next/link';
import { redirect } from 'next/navigation';
import { getCurrentUser } from '@/lib/auth/session';
import { listQueryRecords } from '@/lib/auth/store';
import { queryFeatureLabels, queryStatusLabels } from '@/lib/auth/query-types';
import admin from '../admin.module.css';
import styles from './advanced.module.css';

export const dynamic = 'force-dynamic';

export default async function AdvancedAdminPage({ searchParams }: { searchParams: Promise<{ email?: string; page?: string }> }) {
  const user = await getCurrentUser();
  if (!user) redirect('/auth?returnTo=/admin/advanced');
  if (!user.isSuperAdmin) redirect('/account?error=forbidden');
  const params = await searchParams;
  const email = typeof params.email === 'string' ? params.email.trim().slice(0, 100) : '';
  const requestedPage = Number(params.page);
  const page = Number.isSafeInteger(requestedPage) && requestedPage > 0 ? Math.min(requestedPage, 10000) : 1;
  const { records, hasNextPage } = await listQueryRecords(email, page);
  const pageLink = (nextPage: number) => '/admin/advanced?' + new URLSearchParams({ email, page: String(nextPage) });

  return (
    <main className={styles.page}>
      <Link className={styles.back} href="/admin">返回账号管理</Link>
      <h1>查询记录</h1>
      <p className={styles.description}>查看近 30 天的排盘、单盘解读和双人合盘。打开单条记录可查看出生资料与查询结果。</p>
      <form className={admin.search}>
        <input name="email" defaultValue={email} aria-label="搜索账号邮箱" placeholder="搜索账号邮箱" maxLength={100} />
        <button type="submit">搜索</button>
      </form>
      <div className={`${admin.tableWrap} ${styles.table}`}>
        <table>
          <thead><tr><th scope="col">账号</th><th scope="col">时间</th><th scope="col">功能</th><th scope="col">状态</th><th scope="col">详情</th></tr></thead>
          <tbody>
            {records.map((record) => (
              <tr key={record.id}>
                <td><strong>{record.email}</strong></td>
                <td>{new Date(record.createdAt).toLocaleString('zh-CN', { timeZone: 'Asia/Shanghai' })}</td>
                <td>{queryFeatureLabels[record.feature]}</td>
                <td>{queryStatusLabels[record.status]}</td>
                <td>{record.hasDetails ? <Link href={`/admin/advanced/${record.id}`} prefetch={false}>查看详情</Link> : '未保留'}</td>
              </tr>
            ))}
            {records.length === 0 && <tr><td colSpan={5} className={admin.empty}>没有查询记录</td></tr>}
          </tbody>
        </table>
      </div>
      {(page > 1 || hasNextPage) && <nav className={styles.pagination} aria-label="查询记录分页">
        {page > 1 && <Link href={pageLink(page - 1)}>上一页</Link>}
        <span>第 {page} 页</span>
        {hasNextPage && page < 10000 && <Link href={pageLink(page + 1)}>下一页</Link>}
      </nav>}
    </main>
  );
}
