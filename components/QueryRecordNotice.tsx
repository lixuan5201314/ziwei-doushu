import Link from 'next/link';
import styles from './QueryRecordNotice.module.css';

export default function QueryRecordNotice({ checked, onChange, twoPeople = false }: {
  checked: boolean;
  onChange: (checked: boolean) => void;
  twoPeople?: boolean;
}) {
  return (
    <div className={styles.notice}>
      <p>系统记录账号、查询时间、功能和状态。仅高级管理员可查看。<Link href="/privacy">隐私政策</Link></p>
      <label>
        <input type="checkbox" checked={checked} onChange={(event) => onChange(event.target.checked)} />
        <span>{twoPeople ? '双方同意保留出生资料和合盘结果' : '同意保留出生资料和本次结果'}</span>
      </label>
    </div>
  );
}
