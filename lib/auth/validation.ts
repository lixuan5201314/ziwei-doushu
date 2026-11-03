export function normalizeEmail(value: unknown): string {
  return String(value ?? '').trim().toLowerCase();
}

export function isValidEmail(email: string): boolean {
  return email.length <= 254 && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

export function validatePassword(password: string): string | null {
  if (password.length < 8) return '密码至少需要 8 个字符';
  if (password.length > 128) return '密码不能超过 128 个字符';
  if (!/[A-Za-z]/.test(password) || !/\d/.test(password)) return '密码需要同时包含字母和数字';
  return null;
}

export function safeReturnTo(value: unknown): string {
  const target = String(value ?? '/chart');
  if (!target.startsWith('/') || target.startsWith('//') || target.startsWith('/api/')) return '/chart';
  return target;
}

export function isSameOrigin(request: Request): boolean {
  const origin = request.headers.get('origin');
  if (!origin) return true;
  return origin === new URL(request.url).origin;
}
