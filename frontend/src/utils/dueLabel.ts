const startOfDay = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();

export type DueTone = 'late' | 'today' | 'soon' | 'later' | 'none';

/** Hạn chót dễ đọc: "Quá hạn 2 ngày", "Hôm nay (15:02)", "Ngày mai", "Còn 3 ngày (04/11/2026)". */
export const dueLabel = (iso?: string | null): { text: string; tone: DueTone } => {
  if (!iso) return { text: 'Chưa đặt hạn', tone: 'none' };
  const due = new Date(iso);
  if (Number.isNaN(due.getTime())) return { text: 'Chưa đặt hạn', tone: 'none' };
  const days = Math.round((startOfDay(due) - startOfDay(new Date())) / 86400000);
  const date = due.toLocaleDateString('vi-VN');
  if (days < 0) return { text: `Quá hạn ${-days} ngày (${date})`, tone: 'late' };
  if (days === 0) return { text: `Hôm nay (${due.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })})`, tone: 'today' };
  if (days === 1) return { text: `Ngày mai (${date})`, tone: 'soon' };
  return { text: `Còn ${days} ngày (${date})`, tone: 'later' };
};

export const DUE_TONE_CLASS: Record<DueTone, string> = {
  late: 'bg-rose-100 text-rose-800 border-rose-200',
  today: 'bg-amber-100 text-amber-800 border-amber-200',
  soon: 'bg-sky-100 text-sky-800 border-sky-200',
  later: 'bg-slate-100 text-slate-700 border-slate-200',
  none: 'bg-slate-100 text-slate-500 border-slate-200',
};
