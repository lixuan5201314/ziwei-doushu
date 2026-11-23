import Link from 'next/link';
import styles from './QueryRecordNotice.module.css';

export default function QueryRecordNotice() {
  return (
    <p className={styles.notice}>
      查询所用的出生资料和生成的结果会记录到高级后台。<Link href="/privacy">隐私政策</Link>
    </p>
  );
}
