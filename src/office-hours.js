// Office Hours scheduling: compute the next session from a simple recurrence
// (nth weekday of every month) so the member page and reminder emails always
// show a real date with zero monthly upkeep from Lisa.
//
// Config keys (admin-editable, copy category):
//   office_hours_nth      '1' to '4'            (default 1st)
//   office_hours_weekday  'wednesday' etc.      (default wednesday)
//   office_hours_time     '12:00pm Mountain'    (display label only)
//   office_hours_link     standing Google Meet link (same every month)
//   office_hours_schedule optional free-text override; when set it replaces
//                         the computed date line entirely

const WEEKDAYS = {
  sunday: 0, monday: 1, tuesday: 2, wednesday: 3,
  thursday: 4, friday: 5, saturday: 6,
};
const ORDINALS = { 1: 'first', 2: 'second', 3: 'third', 4: 'fourth' };

// Today's calendar date where Lisa lives, as YYYY-MM-DD.
export function denverToday() {
  return new Date().toLocaleDateString('en-CA', { timeZone: 'America/Denver' });
}

// Next occurrence of the configured session, on or after today (Denver).
// Returns { iso: 'YYYY-MM-DD', label: 'Wednesday, August 6', isToday: bool }.
export function nextOfficeHours(copy = {}, todayStr) {
  const nth = Math.min(4, Math.max(1, parseInt(copy.office_hours_nth, 10) || 1));
  const wd = WEEKDAYS[String(copy.office_hours_weekday || 'wednesday').trim().toLowerCase()] ?? 3;

  const today = todayStr || denverToday();
  const [ty, tm, td] = today.split('-').map(Number);
  const todayUTC = Date.UTC(ty, tm - 1, td);

  const occurrence = (y, m) => {
    const first = new Date(Date.UTC(y, m - 1, 1));
    const offset = (wd - first.getUTCDay() + 7) % 7;
    return new Date(Date.UTC(y, m - 1, 1 + offset + (nth - 1) * 7));
  };

  let d = occurrence(ty, tm);
  if (d.getTime() < todayUTC) {
    d = tm === 12 ? occurrence(ty + 1, 1) : occurrence(ty, tm + 1);
  }

  return {
    iso: d.toISOString().slice(0, 10),
    label: d.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', timeZone: 'UTC' }),
    isToday: d.getTime() === todayUTC,
  };
}

// 'First Wednesday of every month'
export function cadenceLabel(copy = {}) {
  const nth = Math.min(4, Math.max(1, parseInt(copy.office_hours_nth, 10) || 1));
  const wdRaw = String(copy.office_hours_weekday || 'wednesday').trim().toLowerCase();
  const wd = wdRaw.charAt(0).toUpperCase() + wdRaw.slice(1);
  const ord = ORDINALS[nth] || 'first';
  return `${ord.charAt(0).toUpperCase() + ord.slice(1)} ${wd} of every month`;
}
