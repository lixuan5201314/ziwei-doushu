'use client';

import { useEffect, useState } from 'react';
import styles from './ScrollIntro.module.css';

interface ScrollIntroProps {
  onComplete: () => void;
  skipLabel?: string;
}

export default function ScrollIntro({ onComplete, skipLabel = '跳过' }: ScrollIntroProps) {
  const [leaving, setLeaving] = useState(false);

  useEffect(() => {
    const fadeTimer = setTimeout(() => setLeaving(true), 1000);
    const completeTimer = setTimeout(onComplete, 1250);
    return () => { clearTimeout(fadeTimer); clearTimeout(completeTimer); };
  }, [onComplete]);

  const handleSkip = () => {
    setLeaving(true);
    setTimeout(onComplete, 180);
  };

  return (
    <div className={`${styles.overlay} ${leaving ? styles.leaving : ''}`}>
      <div className={styles.content}>
        <span className={styles.mark}>紫微</span>
        <p>紫微斗数研究工具</p>
        <h1>排盘与研读</h1>
      </div>
      <button type="button" onClick={handleSkip}>{skipLabel}</button>
    </div>
  );
}
