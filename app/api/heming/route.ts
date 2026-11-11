import { NextRequest } from 'next/server';
import { getCurrentUser } from '@/lib/auth/session';
import { isSameOrigin } from '@/lib/auth/validation';
import { STEMS, BRANCHES } from '@/lib/ziwei/constants';
import type { Palace, ZiweiChart } from '@/lib/ziwei/types';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const SYSTEM_PROMPT = `你是紫微斗数双人关系分析助手，参考倪海厦体系中“命宫、夫妻宫、福德宫联参”的方法，对两张命盘进行结构化对照。

必须遵守：
1. 所有判断必须落到输入中真实存在的宫位、星曜、四化或大限，不得臆造。
2. 直话直说，先下明确判断。若两人匹配度低、互相消耗、妨碍事业财务或长期难相处，要直接说明，不要为了好听强行解释成“互补”。
3. 负面结构必须写清楚“谁的什么配置，会让对方承受什么现实问题”。可以使用“相克、拖累、压制、消耗大、矛盾多、不适合长期合作”等具体表达。
4. 不要用“有缘相遇、彼此成长、共同面对就会更好”之类套话冲淡结论。优点和化解条件只有在盘面确有依据时才写。
5. 可以批评关系模式与行为倾向，但禁止辱骂、羞辱、人格贬低或把任何一方定性为坏人。
6. 紫微斗数属于传统文化解释框架，不是科学验证的预测工具。禁止断言离婚、死亡、疾病或灾祸，不替用户作结婚、离婚、投资、医疗等重大决定。
7. 默认从命宫与身宫、夫妻宫、福德宫、事业财务牵制和现实沟通方式六个维度分析。
8. 用 **【小标题】** 分段。首次分析依次写：一句话结论、相互吸引、主要硬伤、长期代价、具体建议。控制在 900 字以内。
9. 若有追问，围绕追问回答，但仍需引用双方具体盘面依据。`;

type RateEntry = { startedAt: number; count: number };
const globalForHeming = globalThis as typeof globalThis & {
  ziweiHemingRate?: Map<string, RateEntry>;
};

function allowRequest(userId: string): boolean {
  const now = Date.now();
  const windowMs = 60_000;
  const limit = 6;
  const rates = globalForHeming.ziweiHemingRate ??= new Map<string, RateEntry>();
  const current = rates.get(userId);
  if (!current || now - current.startedAt >= windowMs) {
    rates.set(userId, { startedAt: now, count: 1 });
    return true;
  }
  if (current.count >= limit) return false;
  current.count += 1;
  return true;
}

function isValidChart(value: unknown): value is ZiweiChart {
  if (!value || typeof value !== 'object') return false;
  const chart = value as Partial<ZiweiChart>;
  const birth = chart.birthInfo;
  return Boolean(
    birth &&
    Number.isInteger(birth.year) &&
    Number.isInteger(birth.month) &&
    Number.isInteger(birth.day) &&
    Number.isInteger(birth.hour) &&
    birth.hour >= 0 && birth.hour <= 11 &&
    (birth.gender === 'male' || birth.gender === 'female') &&
    Array.isArray(chart.palaces) && chart.palaces.length === 12 &&
    chart.palaces.every((palace) => palace && typeof palace.name === 'string' && Array.isArray(palace.stars))
  );
}

function serializePalace(palace: Palace): string {
  const stem = STEMS[palace.stem] ?? '?';
  const branch = BRANCHES[palace.branch] ?? '?';
  const stars = palace.stars.slice(0, 20).map((star) => {
    const details = [star.name];
    if (star.brightnessRaw) details.push(star.brightnessRaw);
    if (star.siHua) details.push(`化${star.siHua}`);
    return details.join('');
  }).join('、') || '空宫';
  const marks: string[] = [];
  if (palace.isMingGong) marks.push('命宫');
  if (palace.isShenGong) marks.push('身宫');
  if (palace.isCurrentDaXian) marks.push('当前大限');
  if (palace.selfSihua?.length) marks.push(`自化${palace.selfSihua.map((item) => `${item.starName}化${item.siHua}`).join('、')}`);
  if (palace.isEmpty && palace.borrowedFromName) marks.push(`借${palace.borrowedFromName}宫${(palace.borrowedStars ?? []).join('、')}`);
  return `${stem}${branch}【${palace.name}宫】${marks.length ? `（${marks.join('；')}）` : ''}：${stars}`;
}

function serializeChart(chart: ZiweiChart, label: '甲方' | '乙方'): string {
  const birth = chart.birthInfo;
  const currentDaXian = chart.daXians?.[chart.currentDaXianIndex];
  const lines = [
    `## ${label}`,
    `出生资料：${birth.year}年${birth.month}月${birth.day}日 ${BRANCHES[birth.hour] ?? '?'}时；${birth.gender === 'male' ? '男' : '女'}；${birth.timeStandard === 'true-solar' ? '真太阳时校正' : '钟表时间'}`,
    `阴阳性别：${chart.yinYangGender ?? '未标注'}；五行局：${chart.wuxingJuName}`,
    `命主：${chart.mingZhu ?? '未标注'}；身主：${chart.shenZhu ?? '未标注'}`,
  ];
  if (chart.lunarInfo?.fourPillars?.length) lines.push(`节气四柱：${chart.lunarInfo.fourPillars.join(' ')}`);
  if (currentDaXian) lines.push(`当前大限：${currentDaXian.startAge}-${currentDaXian.endAge}岁 ${currentDaXian.palaceName}宫`);
  lines.push(...[...chart.palaces].sort((a, b) => a.branch - b.branch).map(serializePalace));
  return lines.join('\n');
}

function providerConfig() {
  const provider = (process.env.AI_PROVIDER || 'deepseek').toLowerCase();
  if (provider === 'mimo') {
    return {
      apiKey: process.env.MIMO_API_KEY,
      baseUrl: (process.env.MIMO_BASE_URL || '').replace(/\/$/, ''),
      model: process.env.MIMO_MODEL || 'mimo',
    };
  }
  return {
    apiKey: process.env.DEEPSEEK_API_KEY,
    baseUrl: (process.env.DEEPSEEK_BASE_URL || 'https://api.deepseek.com').replace(/\/$/, ''),
    model: process.env.DEEPSEEK_MODEL || 'deepseek-chat',
  };
}

function proxyStream(upstream: Response): ReadableStream<Uint8Array> {
  const encoder = new TextEncoder();
  return new ReadableStream({
    async start(controller) {
      const reader = upstream.body!.getReader();
      const decoder = new TextDecoder();
      let buffer = '';
      const emit = (text: string) => controller.enqueue(encoder.encode(`data: ${JSON.stringify({ delta: { text } })}\n\n`));
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
            if (data === '[DONE]') {
              controller.enqueue(encoder.encode('data: [DONE]\n\n'));
              controller.close();
              return;
            }
            if (!data) continue;
            try {
              const text = JSON.parse(data)?.choices?.[0]?.delta?.content;
              if (typeof text === 'string' && text) emit(text);
            } catch {
              // 等待后续完整 SSE 分片。
            }
          }
        }
        controller.enqueue(encoder.encode('data: [DONE]\n\n'));
        controller.close();
      } catch (error) {
        console.error('[heming] stream error', error);
        try {
          emit('\n\n（连接中断，请重试）');
          controller.enqueue(encoder.encode('data: [DONE]\n\n'));
        } catch {
          // 客户端可能已经断开。
        }
        controller.close();
      }
    },
  });
}

export async function POST(request: NextRequest) {
  if (!isSameOrigin(request)) return Response.json({ message: '请求来源无效' }, { status: 403 });
  const user = await getCurrentUser();
  if (!user) return Response.json({ message: '请先登录' }, { status: 401 });
  if (!allowRequest(user.id)) return Response.json({ message: '请求较频繁，请一分钟后再试' }, { status: 429 });

  const contentLength = Number(request.headers.get('content-length') || 0);
  if (contentLength > 500_000) return Response.json({ message: '命盘数据过大' }, { status: 413 });

  const body = await request.json().catch(() => null) as {
    chartA?: unknown;
    chartB?: unknown;
    question?: unknown;
  } | null;
  if (!isValidChart(body?.chartA) || !isValidChart(body?.chartB)) {
    return Response.json({ message: '双方命盘数据不完整' }, { status: 400 });
  }

  const question = String(body?.question ?? '').trim().slice(0, 500);
  const charts = `${serializeChart(body.chartA, '甲方')}\n\n${serializeChart(body.chartB, '乙方')}`;
  const userContent = question
    ? `请针对以下追问分析：${question}\n\n${charts}`
    : `请完成首次双人合盘分析。\n\n${charts}`;

  const { apiKey, baseUrl, model } = providerConfig();
  if (!apiKey || !baseUrl) {
    return Response.json({ message: 'AI 服务尚未配置，请联系管理员' }, { status: 503 });
  }

  let upstream: Response;
  try {
    upstream = await fetch(`${baseUrl}/chat/completions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
      body: JSON.stringify({
        model,
        messages: [
          { role: 'system', content: SYSTEM_PROMPT },
          { role: 'user', content: userContent },
        ],
        stream: true,
        temperature: 0.35,
        max_tokens: 2200,
      }),
    });
  } catch {
    return Response.json({ message: '无法连接 AI 服务，请稍后重试' }, { status: 502 });
  }

  if (!upstream.ok || !upstream.body) {
    const detail = await upstream.text().catch(() => '');
    console.error('[heming] upstream error', upstream.status, detail.slice(0, 300));
    const message = upstream.status === 401
      ? 'AI 服务凭证无效，请联系管理员'
      : upstream.status === 402
        ? 'AI 服务余额不足，请联系管理员'
        : upstream.status === 429
          ? 'AI 服务繁忙，请稍后重试'
          : `AI 服务暂时不可用（${upstream.status}）`;
    return Response.json({ message }, { status: 502 });
  }

  return new Response(proxyStream(upstream), {
    headers: {
      'Content-Type': 'text/event-stream; charset=utf-8',
      'Cache-Control': 'no-cache, no-transform',
      Connection: 'keep-alive',
      'X-Accel-Buffering': 'no',
    },
  });
}
