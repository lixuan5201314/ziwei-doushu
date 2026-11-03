'use client';

import { useState } from 'react';
import Link from 'next/link';
import ScrollIntro from '@/components/ScrollIntro';

export default function PreviewPage() {
  const [replayKey, setReplayKey] = useState(0);
  const [done, setDone] = useState(false);

  return (
    <>
      <ScrollIntro key={replayKey} onComplete={() => setDone(true)} />
      {done && (
        <main style={{ minHeight: '100vh', display: 'grid', placeItems: 'center', padding: '48px 24px', background: 'var(--bg-0)', color: 'var(--tx-1)' }}>
          <section style={{ width: 'min(560px, 100%)', border: '1px solid var(--bdr-med)', borderRadius: 'var(--radius-3)', padding: 'clamp(28px, 6vw, 48px)', background: 'var(--bg-card)' }}>
            <p style={{ margin: '0 0 8px', color: 'var(--tx-3)', fontSize: '11px', fontWeight: 650, letterSpacing: '.12em' }}>开场预览</p>
            <h1 style={{ margin: 0, color: 'var(--tx-0)', fontFamily: "ui-serif, 'Songti SC', serif", fontSize: '40px', fontWeight: 600 }}>简洁的品牌进入页</h1>
            <p style={{ margin: '16px 0 0', color: 'var(--tx-2)', fontSize: '14px', lineHeight: 1.8 }}>短暂显示品牌与产品名称，然后进入内容。动画只用于状态过渡，不增加额外装饰。</p>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '12px', marginTop: '32px' }}>
              <button type="button" onClick={() => { setDone(false); setReplayKey((key) => key + 1); }} style={{ minHeight: '42px', padding: '0 18px', border: '1px solid var(--tx-0)', borderRadius: 'var(--radius-2)', background: 'var(--tx-0)', color: 'var(--bg-0)', cursor: 'pointer' }}>再次播放</button>
              <Link href="/" style={{ minHeight: '42px', display: 'inline-flex', alignItems: 'center', padding: '0 18px', border: '1px solid var(--bdr-heavy)', borderRadius: 'var(--radius-2)', color: 'var(--tx-0)', textDecoration: 'none' }}>返回首页</Link>
            </div>
          </section>
        </main>
      )}
    </>
  );
}
