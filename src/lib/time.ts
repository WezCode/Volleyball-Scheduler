export function formatTimeLabel(hhmm: string) {
  const s = String(hhmm || "").trim();
  const parts = s.split(":");
  if (parts.length !== 2) return s;

  const hh = Number(parts[0]);
  const mm = parts[1];
  if (!isFinite(hh)) return s;
  if (mm.length !== 2) return s;

  const ampm = hh >= 12 ? "pm" : "am";
  let h = hh % 12;
  if (h === 0) h = 12;
  return String(h) + ":" + mm + ampm;
}

export function parseTimeLabelToMinutes(t: string) {
  const s = String(t || "").trim().toLowerCase();
  const m = s.match(/^([0-9]{1,2}):([0-9]{2})(am|pm)$/);
  if (!m) return 99999;

  let h = Number(m[1]);
  const mins = Number(m[2]);
  const ap = m[3];

  if (!isFinite(h) || !isFinite(mins)) return 99999;
  if (h === 12) h = 0;

  let base = h * 60 + mins;
  if (ap === "pm") base += 12 * 60;
  return base;
}
