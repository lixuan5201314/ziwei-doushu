import { NextRequest } from 'next/server';
import { getCurrentUser } from '@/lib/auth/session';
import { STEMS, BRANCHES } from '@/lib/ziwei/constants';
import type { ZiweiChart, Palace } from '@/lib/ziwei/types';

// Node runtime：需要读环境变量、发起外部 HTTP 请求
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const SYSTEM_PROMPT = `你是紫微斗数命理分析师，严格依据倪海厦《天纪》体系解读命盘。

回答要求：
1. 术语用中文，结论要落到具体宫位、星曜、四化上，不做无依据的玄谈。
2. 直话直说。盘面有明显短板时先讲短板、现实表现和可能代价，不要先铺垫安慰，也不要为了“平衡”硬凑优点。
3. 可以明确使用“不讨喜、容易得罪人、判断失误、关系消耗、守不住钱、执行力差”等负面但具体的表达；禁止辱骂、羞辱、贴人格标签或攻击用户本人。
4. 少用“你很有潜力、只要努力就会更好、这是成长机会”等空泛鼓励。吉就是吉，凶就是凶；有条件才能化解时，要把条件说清楚。
5. 结构清晰，用 **【小标题】** 分段。先给一句明确结论，再讲盘面证据、现实影响和可操作建议。
6. 不用绝对宿命论口吻，不断言死亡、疾病或灾祸；不涉及医疗诊断、投资具体标的、违法内容。
7. 长度适中，除非用户要求展开，否则控制在 600 字以内。
8. 六亲（父母/兄弟/子女）相关判断要注明斗数在此项上的局限，仅供参考。`;

/** 把命盘结构化成紧凑文本，供模型理解 */
function serializeChart(chart: ZiweiChart): string {
  if (!chart || !Array.isArray(chart.palaces)) return '（无命盘数据）';

  const b = chart.birthInfo ?? ({} as ZiweiChart['birthInfo']);
  const li = chart.lunarInfo ?? ({} as ZiweiChart['lunarInfo']);
  const lines: string[] = [];

  lines.push('## 基本信息');
  const gender = b.gender === 'male' ? '男' : '女';
  const where = [b.province, b.city].filter(Boolean).join('');
  lines.push(`公历：${b.year}年${b.month}月${b.day}日 ${BRANCHES[b.hour] ?? '?'}时　性别：${gender}${where ? '　出生地：' + where : ''}`);
  if (chart.yinYangGender) lines.push(`阴阳性别：${chart.yinYangGender}`);
  if (li.fourPillars?.length) lines.push(`节气四柱：${li.fourPillars.join(' ')}`);
  lines.push(`五行局：${chart.wuxingJuName}`);
  if (chart.mingZhu) lines.push(`命主：${chart.mingZhu}　身主：${chart.shenZhu ?? '-'}`);
  lines.push(`命宫地支：${BRANCHES[chart.mingGongBranch]}　身宫地支：${BRANCHES[chart.shenGongBranch]}`);

  const cd = chart.daXians?.[chart.currentDaXianIndex];
  if (cd) {
    lines.push(`当前大限：${cd.startAge}-${cd.endAge}岁 · ${cd.palaceName}宫`);
    if (cd.siHua) {
      lines.push(`大限四化：禄=${cd.siHua.lu} 权=${cd.siHua.quan} 科=${cd.siHua.ke} 忌=${cd.siHua.ji}`);
    }
  }
  if (typeof chart.currentAge === 'number') lines.push(`当前年龄：${chart.currentAge} 岁`);

  lines.push('');
  lines.push('## 十二宫');
  const sorted: Palace[] = [...chart.palaces].sort((x, y) => x.branch - y.branch);
  for (const p of sorted) {
    const gan = STEMS[p.stem] ?? '?';
    const zhi = BRANCHES[p.branch] ?? '?';
    const tags: string[] = [];
    if (p.isMingGong) tags.push('命宫');
    if (p.isShenGong) tags.push('身宫');
    if (p.isCurrentDaXian) tags.push('当前大限');

    const stars = (p.stars ?? [])
      .map((s) => {
        const parts = [s.name];
        if (s.brightnessRaw) parts.push(s.brightnessRaw);
        if (s.siHua) parts.push('化' + s.siHua);
        return parts.join('');
      })
      .join(' ');

    let line = `${gan}${zhi}【${p.name}宫】${tags.length ? '（' + tags.join('/') + '）' : ''}：${stars || '（空宫）'}`;

    if (p.isEmpty && p.borrowedFromName) {
      line += `　空宫，借对宫${p.borrowedFromName}宫的星：${(p.borrowedStars ?? []).join(' ')}`;
    }
    if (p.selfSihua?.length) {
      line += `　自化：${p.selfSihua.map((s) => s.starName + '化' + s.siHua).join('、')}`;
    }
    if (p.daXianAge) line += `　大限${p.daXianAge[0]}-${p.daXianAge[1]}岁`;

    lines.push(line);
  }

  return lines.join('\n');
}

export async function POST(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) {
    return Response.json({ message: '请先登录' }, { status: 401 });
  }

  // ── 1. 读配置 ──
  const provider = (process.env.AI_PROVIDER || 'deepseek').toLowerCase();
  const apiKey =
    provider === 'mimo' ? process.env.MIMO_API_KEY : process.env.DEEPSEEK_API_KEY;
  const baseUrl = (
    provider === 'mimo'
      ? process.env.MIMO_BASE_URL || ''
      : process.env.DEEPSEEK_BASE_URL || 'https://api.deepseek.com'
  ).replace(/\/$/, '');
  const model =
    provider === 'mimo'
      ? process.env.MIMO_MODEL || 'mimo'
      : process.env.DEEPSEEK_MODEL || 'deepseek-chat';

  if (!apiKey) {
    return new Response(
      JSON.stringify({
        error: 'missing-api-key',
        message: '未配置 API Key。请在 .env.local 中设置 DEEPSEEK_API_KEY 后重启服务。',
      }),
      { status: 500, headers: { 'Content-Type': 'application/json; charset=utf-8' } }
    );
  }

  // ── 2. 解析请求 ──
  let body: {
    chart?: ZiweiChart;
    messages?: { role: 'user' | 'assistant'; content: string }[];
  };
  try {
    body = await req.json();
  } catch {
    return new Response(JSON.stringify({ error: 'bad-request' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json; charset=utf-8' },
    });
  }

  const history = Array.isArray(body.messages) ? body.messages : [];
  if (history.length === 0) {
    return new Response(JSON.stringify({ error: 'empty-messages' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json; charset=utf-8' },
    });
  }

  // ── 3. 组装 messages ──
  const chartText = serializeChart(body.chart as ZiweiChart);
  const systemContent = `${SYSTEM_PROMPT}

以下是当前命盘的排盘数据，回答时必须严格基于这份数据，不要臆造未出现的星曜或宫位：

${chartText}`;

  // 限制携带的历史长度，避免超出上下文
  const trimmed = history.slice(-20).map((m) => ({
    role: m.role === 'assistant' ? 'assistant' : 'user',
    content: String(m.content ?? ''),
  }));

  const payload = {
    model,
    messages: [{ role: 'system', content: systemContent }, ...trimmed],
    stream: true,
    temperature: 0.45,
    max_tokens: 2000,
  };

  // ── 4. 调上游 ──
  let upstream: Response;
  try {
    upstream = await fetch(`${baseUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify(payload),
    });
  } catch (e) {
    return new Response(
      JSON.stringify({
        error: 'upstream-unreachable',
        message: '无法连接 AI 服务，请检查网络。',
      }),
      { status: 502, headers: { 'Content-Type': 'application/json; charset=utf-8' } }
    );
  }

  if (!upstream.ok || !upstream.body) {
    const errText = await upstream.text().catch(() => '');
    console.error('[interpret] upstream error', upstream.status, errText.slice(0, 500));
    const msg =
      upstream.status === 401
        ? 'API Key 无效或已失效，请检查 .env.local 中的 DEEPSEEK_API_KEY。'
        : upstream.status === 402
          ? 'AI 账户余额不足。'
          : upstream.status === 429
            ? '请求过于频繁，请稍后再试。'
            : `AI 服务返回错误（${upstream.status}）。`;
    return new Response(JSON.stringify({ error: 'upstream-error', message: msg }), {
      status: 502,
      headers: { 'Content-Type': 'application/json; charset=utf-8' },
    });
  }

  // ── 5. 转换上游 SSE → 前端约定的 SSE 格式 ──
  // 上游：data: {"choices":[{"delta":{"content":"..."}}]}
  // 前端：data: {"delta":{"text":"..."}}
  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      const reader = upstream.body!.getReader();
      const decoder = new TextDecoder();
      let buffer = '';

      const emit = (obj: unknown) =>
        controller.enqueue(encoder.encode(`data: ${JSON.stringify(obj)}\n\n`));

      try {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split('\n');
          buffer = lines.pop() ?? '';

          for (const raw of lines) {
            const line = raw.trim();
            if (!line.startsWith('data:')) continue;
            const data = line.slice(5).trim();
            if (!data) continue;
            if (data === '[DONE]') {
              controller.enqueue(encoder.encode('data: [DONE]\n\n'));
              controller.close();
              return;
            }
            try {
              const parsed = JSON.parse(data);
              const text = parsed?.choices?.[0]?.delta?.content;
              if (typeof text === 'string' && text.length > 0) {
                emit({ delta: { text } });
              }
            } catch {
              /* 跳过不完整的分片 */
            }
          }
        }
        controller.enqueue(encoder.encode('data: [DONE]\n\n'));
        controller.close();
      } catch (e) {
        console.error('[interpret] stream error', e);
        try {
          emit({ delta: { text: '\n\n（连接中断，请重试）' } });
          controller.enqueue(encoder.encode('data: [DONE]\n\n'));
        } catch { /* 忽略 */ }
        controller.close();
      }
    },
  });

  return new Response(stream, {
    status: 200,
    headers: {
      'Content-Type': 'text/event-stream; charset=utf-8',
      'Cache-Control': 'no-cache, no-transform',
      Connection: 'keep-alive',
      'X-Accel-Buffering': 'no',
    },
  });
}
