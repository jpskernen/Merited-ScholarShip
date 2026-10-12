// Scholarships created before the date picker (task 4.2) have `deadline` as
// free text (e.g. "January 31, 2027"); ones created since store a real
// `YYYY-MM-DD` date. Both need to read the same everywhere the deadline is
// shown, so this formats the real dates and leaves old free text untouched.
export function formatDeadline(deadline: string | undefined | null): string {
  if (!deadline) return '—';
  if (!/^\d{4}-\d{2}-\d{2}$/.test(deadline)) return deadline;
  const [year, month, day] = deadline.split('-').map(Number);
  const parsed = new Date(year, month - 1, day);
  if (Number.isNaN(parsed.getTime())) return deadline;
  return parsed.toLocaleDateString(undefined, { year: 'numeric', month: 'long', day: 'numeric' });
}
