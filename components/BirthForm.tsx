'use client';

import { useEffect, useMemo, useState } from 'react';
import type { BirthInfo } from '@/lib/ziwei/types';
import { SHICHEN } from '@/lib/ziwei/constants';
import { PROVINCES } from '@/lib/ziwei/cities';
import { formToBirthInfo } from '@/lib/ziwei/share';
import styles from './BirthForm.module.css';

export interface BirthFormState {
  name: string;
  year: string;
  month: string;
  day: string;
  clockHour: string;
  clockMinute: string;
  unknownTime: boolean;
  useTrueSolarTime: boolean;
  province: string;
  city: string;
  longitude: number;
  gender: 'male' | 'female';
}

interface BirthFormProps {
  onSubmit: (info: BirthInfo) => void;
  loading?: boolean;
  initialData?: Partial<BirthFormState>;
  onFormSave?: (data: BirthFormState) => void;
  hideSubmit?: boolean;
}

const SHICHEN_NAMES = ['子', '丑', '寅', '卯', '辰', '巳', '午', '未', '申', '酉', '戌', '亥'];

function calcTrueSolarBranch(clockHour: number, clockMinute: number, longitude: number): number {
  const clockMins = clockHour * 60 + clockMinute;
  const offset = (longitude - 120) * 4;
  const solar = ((clockMins + offset) % 1440 + 1440) % 1440;
  if (solar >= 1380 || solar < 60) return 0;
  return Math.floor((solar - 60) / 120) + 1;
}

function calcClockBranch(clockHour: number, clockMinute: number): number {
  const minutes = ((clockHour * 60 + clockMinute) % 1440 + 1440) % 1440;
  if (minutes >= 1380 || minutes < 60) return 0;
  return Math.floor((minutes - 60) / 120) + 1;
}

function isValidDate(y: number, m: number, d: number): boolean {
  if (!y || !m || !d) return false;
  const date = new Date(y, m - 1, d);
  return date.getFullYear() === y && date.getMonth() === m - 1 && date.getDate() === d;
}

export default function BirthForm({ onSubmit, loading = false, initialData, onFormSave, hideSubmit }: BirthFormProps) {
  const [form, setForm] = useState<BirthFormState>({
    name: initialData?.name ?? '',
    year: initialData?.year ?? '',
    month: initialData?.month ?? '',
    day: initialData?.day ?? '',
    clockHour: initialData?.clockHour ?? '8',
    clockMinute: initialData?.clockMinute ?? '0',
    unknownTime: initialData?.unknownTime ?? false,
    useTrueSolarTime: initialData?.useTrueSolarTime ?? false,
    province: initialData?.province ?? '',
    city: initialData?.city ?? '',
    longitude: initialData?.longitude ?? 120,
    gender: initialData?.gender ?? 'male',
  });
  const [touched, setTouched] = useState<Record<string, boolean>>({});
  const [submitAttempted, setSubmitAttempted] = useState(false);

  useEffect(() => {
    onFormSave?.({ ...form });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [form]);

  const cityList = useMemo(() => PROVINCES.find((province) => province.name === form.province)?.cities ?? [], [form.province]);
  const branch = useMemo(() => {
    if (form.unknownTime) return 0;
    return form.useTrueSolarTime
      ? calcTrueSolarBranch(Number(form.clockHour), Number(form.clockMinute), form.longitude)
      : calcClockBranch(Number(form.clockHour), Number(form.clockMinute));
  }, [form.clockHour, form.clockMinute, form.longitude, form.unknownTime, form.useTrueSolarTime]);
  const offsetMin = Math.round((form.longitude - 120) * 4);
  const shichenInfo = SHICHEN[branch];
  const y = Number(form.year);
  const m = Number(form.month);
  const d = Number(form.day);
  const errors = {
    year: !form.year ? '请选择出生年份' : y < 1900 || y > 2026 ? '年份范围为 1900 至 2026' : '',
    month: !form.month ? '请选择月份' : '',
    day: !form.day ? '请选择日期' : form.year && form.month && !isValidDate(y, m, d) ? `${m} 月没有 ${d} 日` : '',
  };
  const hasError = Object.values(errors).some(Boolean);
  const dateReady = Boolean(form.year && form.month && form.day && !hasError);
  const timeReady = form.unknownTime || Boolean(form.clockHour && form.clockMinute);
  const summary = dateReady && timeReady
    ? [`${y} 年 ${m} 月 ${d} 日`, form.city || form.province, form.unknownTime ? '时辰不详' : `${SHICHEN_NAMES[branch]}时`, form.gender === 'male' ? '男' : '女'].filter(Boolean).join(' / ')
    : '';

  const update = <K extends keyof BirthFormState>(key: K, value: BirthFormState[K]) => setForm((current) => ({ ...current, [key]: value }));
  const showError = (field: keyof typeof errors) => Boolean((touched[field] || submitAttempted) && errors[field]);

  const handleProvince = (name: string) => {
    const province = PROVINCES.find((item) => item.name === name);
    const firstCity = province?.cities[0];
    setForm((current) => ({ ...current, province: name, city: firstCity?.name ?? '', longitude: firstCity?.longitude ?? 120 }));
  };

  const handleCity = (name: string) => {
    const city = cityList.find((item) => item.name === name);
    setForm((current) => ({ ...current, city: name, longitude: city?.longitude ?? 120 }));
  };

  const handleSubmit = (event: React.FormEvent) => {
    event.preventDefault();
    setSubmitAttempted(true);
    setTouched({ year: true, month: true, day: true });
    if (hasError) return;
    onFormSave?.({ ...form });
    onSubmit(formToBirthInfo(form));
  };

  return (
    <form className={styles.form} onSubmit={handleSubmit} noValidate>
      <div className={styles.formHeader}>
        <div><p className={styles.kicker}>出生信息</p><h2>填写排盘资料</h2></div>
        <p><span>必填</span> 日期、时间、性别</p>
      </div>

      <div className={styles.section}>
        <div className={styles.sectionTitle}><span>01</span><div><h3>基本信息</h3><p>姓名仅用于区分命盘，可不填写。</p></div></div>
        <label className={styles.field}><span>姓名 <small>选填</small></span><input value={form.name} onChange={(event) => update('name', event.target.value)} placeholder="请输入姓名" /></label>
        <fieldset className={styles.fieldset}>
          <legend>性别</legend>
          <div className={styles.segmented}>
            <button type="button" aria-pressed={form.gender === 'male'} onClick={() => update('gender', 'male')}>男</button>
            <button type="button" aria-pressed={form.gender === 'female'} onClick={() => update('gender', 'female')}>女</button>
          </div>
        </fieldset>
      </div>

      <div className={styles.section}>
        <div className={styles.sectionTitle}><span>02</span><div><h3>出生日期</h3><p>使用公历日期。</p></div></div>
        <div className={styles.threeColumns}>
          <label className={styles.field}><span>年份</span><select value={form.year} aria-invalid={showError('year')} onChange={(event) => { update('year', event.target.value); setTouched((current) => ({ ...current, year: true })); }}><option value="">选择年份</option>{Array.from({ length: 127 }, (_, index) => 2026 - index).map((year) => <option key={year} value={year}>{year} 年</option>)}</select>{showError('year') && <small className={styles.error}>{errors.year}</small>}</label>
          <label className={styles.field}><span>月份</span><select value={form.month} aria-invalid={showError('month')} onChange={(event) => { update('month', event.target.value); setTouched((current) => ({ ...current, month: true })); }}><option value="">选择月份</option>{Array.from({ length: 12 }, (_, index) => index + 1).map((month) => <option key={month} value={month}>{month} 月</option>)}</select>{showError('month') && <small className={styles.error}>{errors.month}</small>}</label>
          <label className={styles.field}><span>日期</span><select value={form.day} aria-invalid={showError('day')} onChange={(event) => { update('day', event.target.value); setTouched((current) => ({ ...current, day: true })); }}><option value="">选择日期</option>{Array.from({ length: 31 }, (_, index) => index + 1).map((day) => <option key={day} value={day}>{day} 日</option>)}</select>{showError('day') && <small className={styles.error}>{errors.day}</small>}</label>
        </div>
      </div>

      <div className={styles.section}>
        <div className={styles.sectionTitle}><span>03</span><div><h3>出生时间与地点</h3><p>默认按当时钟表时间排盘，也可选择真太阳时校正。</p></div></div>
        <div className={styles.twoColumns}>
          <label className={styles.field}><span>省份或直辖市 <small>选填</small></span><select value={form.province} onChange={(event) => handleProvince(event.target.value)}><option value="">选择地区</option>{PROVINCES.map((province) => <option key={province.name} value={province.name}>{province.name}</option>)}</select></label>
          <label className={styles.field}><span>城市 <small>选填</small></span><select value={form.city} disabled={!form.province} onChange={(event) => handleCity(event.target.value)}><option value="">{form.province ? '选择城市' : '请先选择地区'}</option>{cityList.map((city) => <option key={city.name} value={city.name}>{city.name}</option>)}</select></label>
        </div>
        {form.province && <p className={styles.meta}>{form.city || '尚未选择城市'} / 经度 {form.longitude.toFixed(1)}°E{form.useTrueSolarTime ? ` / 经度校正 ${offsetMin > 0 ? '+' : ''}${offsetMin} 分钟` : ' / 当前未启用真太阳时校正'}</p>}
        <div className={`${styles.timePanel} ${form.unknownTime ? styles.disabled : ''}`}>
          <div className={styles.twoColumns}>
            <label className={styles.field}><span>小时</span><select disabled={form.unknownTime} value={form.clockHour} onChange={(event) => update('clockHour', event.target.value)}>{Array.from({ length: 24 }, (_, hour) => <option key={hour} value={hour}>{String(hour).padStart(2, '0')} 时</option>)}</select></label>
            <label className={styles.field}><span>分钟</span><select disabled={form.unknownTime} value={form.clockMinute} onChange={(event) => update('clockMinute', event.target.value)}>{Array.from({ length: 60 }, (_, minute) => <option key={minute} value={minute}>{String(minute).padStart(2, '0')} 分</option>)}</select></label>
          </div>
          <p className={styles.result}>{form.useTrueSolarTime ? '真太阳时结果' : '钟表时间结果'} <strong>{SHICHEN_NAMES[branch]}时</strong><span>{shichenInfo ? ` ${shichenInfo.range}` : ''}</span></p>
        </div>
        <label className={styles.checkbox}><input type="checkbox" checked={form.unknownTime} onChange={(event) => update('unknownTime', event.target.checked)} /><span>出生时间不详，以子时起盘</span></label>
        <label className={styles.checkbox}><input type="checkbox" checked={form.useTrueSolarTime} disabled={form.unknownTime} onChange={(event) => update('useTrueSolarTime', event.target.checked)} /><span>采用真太阳时校正（可选）</span></label>
        <p className={styles.methodNote}>真太阳时在不同流派中存在口径争议。临近时辰边界时，建议分别排盘对照。</p>
      </div>

      <div className={styles.formFooter}>
        <div className={styles.summary}><span>当前信息</span><p>{summary || '完成日期与时间后显示摘要'}</p></div>
        {!hideSubmit && <button className={styles.submit} type="submit" disabled={loading}>{loading ? <><span className={styles.spinner} />正在起盘</> : '生成命盘'}</button>}
      </div>
    </form>
  );
}
