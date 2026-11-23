import 'server-only';

import { createQueryRecord } from './store';
import type { QueryBirthDetails, QueryDetails, QueryFeature, QueryStatus } from './query-types';
import { BRANCHES } from '@/lib/ziwei/constants';
import { isValidGregorianDate } from '@/lib/ziwei/true-solar-time';

const textLimit = 16_000;

export function queryBirthDetails(value: unknown): QueryBirthDetails | null {
  if (!value || typeof value !== 'object') return null;
  const birth = value as Record<string, unknown>;
  if (birth.gender !== 'male' && birth.gender !== 'female') return null;
  if (typeof birth.hour !== 'number' || !Number.isInteger(birth.hour) || birth.hour < 0 || birth.hour > 11) return null;
  if (!validDate(birth)) return null;

  const original = birth.origInput;
  const location = [birth.province, birth.city]
    .filter((part): part is string => typeof part === 'string' && part.trim().length > 0)
    .map((part) => part.trim().slice(0, 40)).join(' ');
  const result: QueryBirthDetails = {
    date: `${birth.year}-${birth.month}-${birth.day}`,
    time: `${BRANCHES[birth.hour]}时`,
    gender: birth.gender === 'male' ? '男' : '女',
    location: location || undefined,
    method: birth.timeStandard === 'true-solar' ? '真太阳时' : '钟表时间',
  };
  if (original && typeof original === 'object') {
    const clock = original as Record<string, unknown>;
    const { clockHour, clockMinute } = clock;
    if (validDate(clock) && typeof clockHour === 'number' && Number.isInteger(clockHour) && clockHour >= 0 && clockHour < 24
        && typeof clockMinute === 'number' && Number.isInteger(clockMinute) && clockMinute >= 0 && clockMinute < 60) {
      result.date = `${clock.year}-${clock.month}-${clock.day}`;
      result.time = `${String(clockHour).padStart(2, '0')}:${String(clockMinute).padStart(2, '0')}（排盘为${BRANCHES[birth.hour]}时）`;
    }
  } else if (birth.unknownTime === true) {
    result.time = '出生时间不详，按子时排盘';
  }
  return result;
}

function validDate(value: Record<string, unknown>) {
  const { year, month, day } = value;
  return typeof year === 'number' && year >= 1899 && year <= 2101 && typeof month === 'number'
    && typeof day === 'number' && isValidGregorianDate(year, month, day);
}

export async function recordQuery(userId: string, feature: QueryFeature, status: QueryStatus, details?: QueryDetails) {
  try {
    await createQueryRecord(userId, feature, status, details);
  } catch {
    console.error('[query-audit] record write failed', feature);
  }
}

export type AnalysisAudit = {
  setBirths: (...values: unknown[]) => void;
  finish: (status: QueryStatus, output?: string) => Promise<void>;
};

export async function withAnalysisAudit(
  userId: string, feature: 'interpret' | 'heming', execute: (audit: AnalysisAudit) => Promise<Response>,
) {
  let births: QueryBirthDetails[] | undefined;
  let recorded = false;
  const audit: AnalysisAudit = {
    setBirths: (...values) => { births = values.map(queryBirthDetails).filter((birth) => birth !== null); },
    finish: async (status, output) => {
      if (recorded) return;
      recorded = true;
      const details = births ? { births, result: output?.trim().slice(0, textLimit) || undefined } : undefined;
      await recordQuery(userId, feature, status, details);
    },
  };
  try {
    const response = await execute(audit);
    if (!response.ok) await audit.finish('failed');
    return response;
  } catch (error) {
    await audit.finish('failed');
    throw error;
  }
}

export function auditedAnalysisStream(upstream: ReadableStream<Uint8Array>, audit: AnalysisAudit) {
  const reader = upstream.getReader();
  const encoder = new TextEncoder();
  let cancelled = false;

  return new ReadableStream<Uint8Array>({
    async start(controller) {
      const decoder = new TextDecoder();
      let buffer = '';
      let text = '';
      let completed = false;
      const emit = (delta: string) => controller.enqueue(encoder.encode(`data: ${JSON.stringify({ delta: { text: delta } })}\n\n`));

      try {
        while (!completed && !cancelled) {
          const { done, value } = await reader.read();
          if (done || cancelled) break;
          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split('\n');
          buffer = lines.pop() ?? '';
          for (const raw of lines) {
            const line = raw.trim();
            if (!line.startsWith('data:')) continue;
            const data = line.slice(5).trim();
            if (data === '[DONE]') { completed = true; break; }
            let delta: unknown;
            try { delta = JSON.parse(data)?.choices?.[0]?.delta?.content; } catch { continue; }
            if (typeof delta === 'string' && delta) {
              text = (text + delta).slice(0, textLimit);
              emit(delta);
            }
          }
        }
      } catch {
        // 网络中断也要结束前端状态并记录失败。
      }
      if (cancelled) return;
      const success = completed && Boolean(text.trim());
      await audit.finish(success ? 'success' : 'failed', success ? text : undefined);
      if (cancelled) return;
      if (!success) emit('\n\n（分析未完成，请重试）');
      controller.enqueue(encoder.encode('data: [DONE]\n\n'));
      controller.close();
      if (completed) await reader.cancel().catch(() => {});
    },
    async cancel() {
      cancelled = true;
      await Promise.allSettled([reader.cancel(), audit.finish('failed')]);
    },
  });
}
