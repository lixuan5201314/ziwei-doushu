import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth/session';
import { createSavedChart, listSavedCharts } from '@/lib/auth/store';
import { isSameOrigin } from '@/lib/auth/validation';
import type { BirthFormState } from '@/components/BirthForm';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ message: '请先登录' }, { status: 401 });
  return NextResponse.json({ charts: await listSavedCharts(user.id) });
}

export async function POST(request: Request) {
  if (!isSameOrigin(request)) return NextResponse.json({ message: '请求来源无效' }, { status: 403 });
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ message: '请先登录' }, { status: 401 });

  const body = await request.json().catch(() => null) as { birthData?: unknown } | null;
  const birthData = normalizeBirthData(body?.birthData);
  if (!birthData) return NextResponse.json({ message: '命盘资料不完整' }, { status: 400 });
  if ((await listSavedCharts(user.id)).length >= 50) {
    return NextResponse.json({ message: '最多保存 50 条命盘，请先删除旧记录' }, { status: 400 });
  }
  const label = [
    birthData.name.trim(),
    `${birthData.year}年${birthData.month}月${birthData.day}日`,
    birthData.city || birthData.province,
    birthData.gender === 'male' ? '男' : '女',
  ].filter(Boolean).join(' · ');
  const chart = await createSavedChart(user.id, label, birthData);
  return NextResponse.json({ chart }, { status: 201 });
}

function normalizeBirthData(value: unknown): BirthFormState | null {
  if (!value || typeof value !== 'object') return null;
  const item = value as Record<string, unknown>;
  const year = String(item.year ?? '');
  const month = String(item.month ?? '');
  const day = String(item.day ?? '');
  const clockHour = String(item.clockHour ?? '');
  const clockMinute = String(item.clockMinute ?? '');
  const gender = item.gender === 'female' ? 'female' : item.gender === 'male' ? 'male' : null;
  const longitude = Number(item.longitude ?? 120);
  const unknownTime = item.unknownTime === true;
  if (!gender || !/^\d{4}$/.test(year) || !/^\d{1,2}$/.test(month) || !/^\d{1,2}$/.test(day)) return null;
  if (Number(year) < 1900 || Number(year) > 2100 || Number(month) < 1 || Number(month) > 12 || Number(day) < 1 || Number(day) > 31) return null;
  const date = new Date(Number(year), Number(month) - 1, Number(day));
  if (date.getFullYear() !== Number(year) || date.getMonth() !== Number(month) - 1 || date.getDate() !== Number(day)) return null;
  if (!unknownTime && (Number(clockHour) < 0 || Number(clockHour) > 23 || Number(clockMinute) < 0 || Number(clockMinute) > 59)) return null;
  if (!Number.isFinite(longitude) || longitude < -180 || longitude > 180) return null;
  return {
    name: String(item.name ?? '').trim().slice(0, 50),
    year,
    month,
    day,
    clockHour: unknownTime ? '0' : clockHour,
    clockMinute: unknownTime ? '0' : clockMinute,
    unknownTime,
    useTrueSolarTime: item.useTrueSolarTime === true,
    province: String(item.province ?? '').trim().slice(0, 50),
    city: String(item.city ?? '').trim().slice(0, 50),
    longitude,
    gender,
  };
}
