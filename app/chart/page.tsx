'use client';
import { useRef, useState } from 'react';
import BirthForm from '@/components/BirthForm';
import ChartBoard from '@/components/ChartBoard';
import InsightPanel from '@/components/InsightPanel';
import TimeNav, { type TimeView } from '@/components/TimeNav';
import { generateChart } from '@/lib/ziwei/algorithm';
import type { BirthInfo, ZiweiChart, Palace } from '@/lib/ziwei/types';
import Link from 'next/link';
import styles from './chart.module.css';

/**
 * 命盘页 —— 开源版「排盘引擎 Demo」
 *
 * 这是一个最小可运行示例：用本仓库的排盘引擎 generateChart() 配合基础 UI
 * 组件，渲染一张完整紫微命盘 + 基础解读，并支持本命 / 大限 / 流年切换。
 *
 * 说明：线上商业版的完整交互界面（重设计的新 UI、AI 流式解读、合盘、分享
 * 卡片等）不在开源范围内；但排盘内核——安星算法、四化、格局识别、古籍库——
 * 完全开放（见 lib/ziwei/*），可自由二次开发出你自己的界面。
 */
export default function ChartPage() {
  const [chart, setChart] = useState<ZiweiChart | null>(null);
  const [selectedPalace, setSelectedPalace] = useState<Palace | null>(null);
  const [view, setView] = useState<TimeView>('mingpan');
  const [liunianYear, setLiunianYear] = useState(() => new Date().getFullYear());
  const [exporting, setExporting] = useState(false);
  const exportRef = useRef<HTMLDivElement>(null);

  const download = (content: Blob, filename: string) => {
    const url = URL.createObjectURL(content);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = filename;
    anchor.click();
    URL.revokeObjectURL(url);
  };

  const exportName = chart?.birthInfo.name?.trim().replace(/[\\/:*?"<>|]/g, '-') || '紫微命盘';

  const exportJson = () => {
    if (!chart) return;
    download(new Blob([JSON.stringify(chart, null, 2)], { type: 'application/json;charset=utf-8' }), `${exportName}.json`);
  };

  const exportPng = async () => {
    if (!exportRef.current || !chart) return;
    setExporting(true);
    try {
      const html2canvas = (await import('html2canvas')).default;
      const canvas = await html2canvas(exportRef.current, { backgroundColor: getComputedStyle(document.documentElement).getPropertyValue('--bg-0').trim() || '#f7f7f5', scale: Math.min(window.devicePixelRatio || 1, 2), useCORS: true });
      canvas.toBlob((blob) => { if (blob) download(blob, `${exportName}.png`); }, 'image/png');
    } finally {
      setExporting(false);
    }
  };

  // ── 未起盘：展示出生信息表单 ──
  if (!chart) {
    return (
      <main className={styles.entry}>
        <Link className={styles.backLink} href="/">
          <svg aria-hidden="true" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"><path d="m15 18-6-6 6-6" /></svg>
          返回首页
        </Link>
        <header className={styles.intro}>
          <p>紫微斗数排盘</p>
          <h1>建立命盘</h1>
          <span>填写出生日期、时间与地点，系统将按规则生成完整十二宫命盘。</span>
        </header>
        <BirthForm onSubmit={(info: BirthInfo) => setChart(generateChart(info))} />
      </main>
    );
  }

  // ── 已起盘：命盘 + 解读 ──
  return (
    <main className={styles.workspace}>
      <div className={styles.toolbar}>
        <button type="button" onClick={() => { setChart(null); setSelectedPalace(null); }} className={styles.resetButton}>
          <svg aria-hidden="true" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"><path d="m15 18-6-6 6-6" /></svg>
          重新起盘
        </button>
        <div className={styles.exportActions}>
          <button type="button" onClick={exportPng} disabled={exporting}>{exporting ? '正在生成' : '导出图片'}</button>
          <button type="button" onClick={exportJson}>导出数据</button>
          <button type="button" onClick={() => window.print()}>打印或 PDF</button>
        </div>
      </div>

      <TimeNav
        chart={chart}
        view={view}
        liunianYear={liunianYear}
        onViewChange={setView}
        onYearChange={setLiunianYear}
      />

      <div className={styles.chartGrid} ref={exportRef}>
        <ChartBoard chart={chart} onPalaceSelect={setSelectedPalace} />
        <InsightPanel chart={chart} selectedPalace={selectedPalace} />
      </div>
    </main>
  );
}
