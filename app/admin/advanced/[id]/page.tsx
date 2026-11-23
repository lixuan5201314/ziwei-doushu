import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { getCurrentUser } from '@/lib/auth/session';
import { getQueryRecord } from '@/lib/auth/store';
import { queryFeatureLabels, queryStatusLabels } from '@/lib/auth/query-types';
import styles from '../advanced.module.css';

export const dynamic = 'force-dynamic';

export default async function QueryDetailsPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser();
  const { id } = await params;
  if (!user) redirect('/auth?returnTo=' + encodeURIComponent('/admin/advanced/' + id));
  if (!user.isSuperAdmin) redirect('/account?error=forbidden');
  const record = await getQueryRecord(id);
  if (!record) notFound();
  const { details } = record;

  return (
    <main className={styles.page}>
      <Link className={styles.back} href="/admin/advanced">返回查询记录</Link>
      <h1>{queryFeatureLabels[record.feature]}详情</h1>
      <p className={styles.description}>{record.email} · {new Date(record.createdAt).toLocaleString('zh-CN', { timeZone: 'Asia/Shanghai' })} · {queryStatusLabels[record.status]}</p>
      {details ? <>
        {details.births.map((birth, index) => (
          <section className={styles.section} key={index}>
            <h2>{record.feature === 'heming' ? [ '甲方出生资料', '乙方出生资料' ][index] : '出生资料'}</h2>
            <dl className={styles.fields}>
              <div><dt>日期</dt><dd>{birth.date}</dd></div>
              <div><dt>时间</dt><dd>{birth.time}</dd></div>
              <div><dt>性别</dt><dd>{birth.gender}</dd></div>
              <div><dt>地点</dt><dd>{birth.location || '未填写'}</dd></div>
              <div><dt>时间口径</dt><dd>{birth.method}</dd></div>
            </dl>
          </section>
        ))}
        {details.result && <section className={styles.section}><h2>查询结果</h2><p className={styles.result}>{details.result}</p></section>}
      </> : <p className={styles.description}>这条记录没有保留详情。</p>}
    </main>
  );
}
