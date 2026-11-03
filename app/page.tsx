'use client';

import Link from 'next/link';
import { useTheme } from '@/components/ThemeProvider';
import AccountMenu from '@/components/AccountMenu';
import styles from './home.module.css';

type IconName = 'arrow' | 'book' | 'calendar' | 'chart' | 'chevron' | 'compare' | 'moon' | 'search' | 'sun';

function Icon({ name, size = 18 }: { name: IconName; size?: number }) {
  const paths: Record<IconName, React.ReactNode> = {
    arrow: <><path d="M5 12h14" /><path d="m13 6 6 6-6 6" /></>,
    book: <><path d="M4 5.5A2.5 2.5 0 0 1 6.5 3H11v16H6.5A2.5 2.5 0 0 0 4 21.5z" /><path d="M20 5.5A2.5 2.5 0 0 0 17.5 3H13v16h4.5a2.5 2.5 0 0 1 2.5 2.5z" /></>,
    calendar: <><rect x="3" y="5" width="18" height="16" rx="2" /><path d="M16 3v4M8 3v4M3 10h18" /></>,
    chart: <><path d="M4 19V9M10 19V5M16 19v-7M22 19H2" /></>,
    chevron: <path d="m9 18 6-6-6-6" />,
    compare: <><path d="M7 3 3 7l4 4" /><path d="M3 7h12a4 4 0 0 1 4 4v1" /><path d="m17 21 4-4-4-4" /><path d="M21 17H9a4 4 0 0 1-4-4v-1" /></>,
    moon: <path d="M20.5 14.2A8 8 0 0 1 9.8 3.5 9 9 0 1 0 20.5 14.2Z" />,
    search: <><circle cx="11" cy="11" r="7" /><path d="m20 20-4-4" /></>,
    sun: <><circle cx="12" cy="12" r="4" /><path d="M12 2v2M12 20v2M4.93 4.93l1.42 1.42M17.66 17.66l1.41 1.41M2 12h2M20 12h2M4.93 19.07l1.42-1.42M17.66 6.34l1.41-1.41" /></>,
  };
  return <svg aria-hidden="true" width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">{paths[name]}</svg>;
}

const tools: Array<{ href: string; icon: IconName; title: string; description: string; action: string }> = [
  { href: '/chart', icon: 'chart', title: '紫微排盘', description: '输入出生信息，生成完整十二宫命盘与四化信息。', action: '开始排盘' },
  { href: '/heming', icon: 'compare', title: '双人合盘', description: '并列查看双方命盘，梳理关系中的结构与差异。', action: '进入合盘' },
  { href: '/library', icon: 'book', title: '古籍资料库', description: '按书目和章节查阅紫微斗数原典与整理资料。', action: '查阅古籍' },
  { href: '/knowledge', icon: 'search', title: '星曜知识库', description: '按星曜、宫位与主题快速检索对应知识。', action: '检索知识' },
];

const principles = [
  ['起盘依据', '纳音五行局、命身宫与十四主星按规则逐项推演。'],
  ['信息呈现', '主星、辅星、煞星与四化同屏显示，层级明确。'],
  ['结果复核', '命盘结构与古籍资料相互关联，便于逐条查证。'],
];

function ThemeButton() {
  const { theme, toggle } = useTheme();
  const isDark = theme === 'dark';
  return <button className={styles.iconButton} type="button" onClick={toggle} aria-label={isDark ? '切换到浅色模式' : '切换到深色模式'}><Icon name={isDark ? 'sun' : 'moon'} /></button>;
}

export default function HomePage() {
  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <div className={styles.headerInner}>
          <Link className={styles.brand} href="/" aria-label="紫微研究首页"><span className={styles.brandMark}>紫微</span><span>紫微研究</span></Link>
          <nav className={styles.nav} aria-label="主要导航"><Link href="/chart" prefetch={false}>排盘</Link><Link href="/heming" prefetch={false}>合盘</Link><Link href="/library" prefetch={false}>古籍</Link><Link href="/knowledge" prefetch={false}>知识库</Link></nav>
          <div className={styles.headerActions}><AccountMenu /><ThemeButton /></div>
        </div>
      </header>

      <main>
        <section className={styles.hero}>
          <div className={styles.heroCopy}>
            <p className={styles.eyebrow}>紫微斗数研究工具</p>
            <h1>清晰排盘，<br />逐项研读。</h1>
            <p className={styles.heroDescription}>从出生信息到完整命盘，用结构化方式呈现宫位、星曜与四化；同时连接古籍资料，便于查阅和复核。</p>
            <div className={styles.actions}><Link className={styles.primaryButton} href="/chart" prefetch={false}>开始排盘 <Icon name="arrow" /></Link><Link className={styles.secondaryButton} href="/library" prefetch={false}>查阅古籍</Link></div>
            <dl className={styles.stats}><div><dt>14</dt><dd>主星</dd></div><div><dt>12</dt><dd>宫位</dd></div><div><dt>4</dt><dd>四化</dd></div></dl>
          </div>
          <div className={styles.processPanel} aria-label="排盘流程">
            <div className={styles.panelHeader}><span>排盘流程</span><span>约 2 分钟</span></div>
            <ol className={styles.steps}>
              <li><span className={styles.stepNumber}>01</span><div><strong>填写出生信息</strong><p>日期、时间、地点与性别</p></div></li>
              <li><span className={styles.stepNumber}>02</span><div><strong>生成完整命盘</strong><p>十二宫、星曜与四化信息</p></div></li>
              <li><span className={styles.stepNumber}>03</span><div><strong>查看结构说明</strong><p>结合宫位关系逐项研读</p></div></li>
            </ol>
            <Link className={styles.panelLink} href="/chart" prefetch={false}>进入排盘工具 <Icon name="chevron" size={16} /></Link>
          </div>
        </section>

        <section className={styles.section} aria-labelledby="tools-title">
          <div className={styles.sectionHeading}><div><p className={styles.eyebrow}>功能入口</p><h2 id="tools-title">从你的当前任务开始</h2></div><p>工具之间共享同一套资料与排盘逻辑，减少重复查找。</p></div>
          <div className={styles.toolGrid}>{tools.map((tool) => <Link className={styles.toolCard} href={tool.href} prefetch={false} key={tool.href}><span className={styles.toolIcon}><Icon name={tool.icon} /></span><h3>{tool.title}</h3><p>{tool.description}</p><span className={styles.cardAction}>{tool.action} <Icon name="chevron" size={15} /></span></Link>)}</div>
        </section>

        <section className={`${styles.section} ${styles.methodSection}`} aria-labelledby="method-title">
          <div className={styles.methodIntro}><p className={styles.eyebrow}>方法与依据</p><h2 id="method-title">让排盘过程可读、可查、可复核</h2><p>界面只呈现有用的信息层级。重点不是制造神秘感，而是帮助你看清命盘结构与判断依据。</p><Link className={styles.textLink} href="/knowledge" prefetch={false}>查看知识库 <Icon name="arrow" size={16} /></Link></div>
          <div className={styles.principleList}>{principles.map(([title, body], index) => <article key={title}><span>{String(index + 1).padStart(2, '0')}</span><div><h3>{title}</h3><p>{body}</p></div></article>)}</div>
        </section>

        <section className={styles.section} aria-labelledby="library-title">
          <div className={styles.libraryBlock}>
            <div className={styles.libraryCopy}><p className={styles.eyebrow}>古籍资料</p><h2 id="library-title">从原典回到判断依据</h2><p>资料按书目、章节和主题整理，可直接搜索关键词并跳转到相关内容。</p><Link className={styles.secondaryButton} href="/library" prefetch={false}>打开资料库</Link></div>
            <div className={styles.bookList}>{['紫微斗数全书', '紫微斗数全集', '骨髓赋'].map((book, index) => <Link href="/library" prefetch={false} key={book}><span>{String(index + 1).padStart(2, '0')}</span><strong>{book}</strong><Icon name="chevron" /></Link>)}</div>
          </div>
        </section>

        <section className={styles.cta}><div><p className={styles.eyebrow}>开始使用</p><h2>生成你的第一张命盘</h2><p>使用邮箱注册并登录后，即可生成、保存和导出完整命盘。</p></div><Link className={styles.primaryButton} href="/chart" prefetch={false}>开始排盘 <Icon name="arrow" /></Link></section>
      </main>

      <footer className={styles.footer}><div><span className={styles.brandMark}>紫微</span><span>紫微研究</span></div><p>资料仅供传统文化研究与学习参考</p><nav aria-label="页脚导航"><Link href="/privacy">隐私</Link><Link href="/terms">条款</Link></nav></footer>
    </div>
  );
}
