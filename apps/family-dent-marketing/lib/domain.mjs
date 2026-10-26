export const MANAGERS = new Set(['marketer', 'leadership']);
export const canManage = profile => profile?.active === true && MANAGERS.has(profile.role);
export const canConnect = profile => profile?.active === true && ['marketer','leadership','it'].includes(profile.role);
export function approved(planId, approvals, profiles) {
  return new Set(approvals.filter(a => a.plan_id === planId && a.decision === 'approved' && profiles.some(p => p.id === a.reviewer_id && p.role === 'leadership' && p.active)).map(a => a.reviewer_id)).size >= 2;
}
export function safeMediaUrl(value) {
  try {
    const u = new URL(value);
    if (u.protocol !== 'https:' || u.username || u.password || u.port || /(^localhost$|\.local$|\.internal$|:|^\d+\.)/i.test(u.hostname)) return null;
    if (u.hostname === 'drive.google.com') {
      const id = u.pathname.match(/\/file\/d\/([a-zA-Z0-9_-]+)/)?.[1] || u.searchParams.get('id');
      return id ? `https://drive.google.com/uc?export=download&id=${encodeURIComponent(id)}` : null;
    }
    return u.href;
  } catch { return null; }
}
export function monday(value) {
  const date = new Date(`${value}T00:00:00Z`);
  return !isNaN(date) && date.toISOString().slice(0,10) === value && date.getUTCDay() === 1;
}
export function validateWeekly(payload, receipt) {
  if (!monday(payload.week_start)) throw new Error('Выберите понедельник отчётной недели.');
  for (const key of ['branch_id','direction_id','source_id']) if (!/^[0-9a-f-]{36}$/i.test(payload[key] || '')) throw new Error('Выберите филиал, направление и источник.');
  for (const key of ['inquiries','bookings','first_visits','registrations','orders','participants']) {
    const n = payload[key];
    if (n !== null && n !== undefined && (!Number.isSafeInteger(n) || n < 0)) throw new Error('Количество должно быть целым неотрицательным числом.');
  }
  if (!Number.isFinite(receipt) || receipt < 0 || receipt > 999999999999.99 || Math.abs(receipt * 100 - Math.round(receipt * 100)) > 0.001) throw new Error('Проверьте сумму оплат в сомони (до двух знаков после запятой).');
}
export function summarize(reports, receipts, expenses) {
  const sum = (rows,key) => rows.reduce((v,r) => v + (Number(r[key]) || 0),0);
  const spend = sum(expenses.filter(e=>e.type !== 'budget'),'amount');
  return { inquiries:sum(reports,'inquiries'),bookings:sum(reports,'bookings'),first_visits:sum(reports,'first_visits'),receipts:sum(receipts,'amount'),spend,
    conversion: sum(reports,'bookings') ? sum(reports,'first_visits') / sum(reports,'bookings') : null };
}
