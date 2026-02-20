import type { Slot, SlotRow, Venue } from "./types";
import { formatTimeLabel, parseTimeLabelToMinutes } from "./time";

export function shortVenueName(name: string) {
  const s = String(name || "").trim();
  if (!s) return s;
  return s.toLowerCase().includes("mullum") ? "Mullum" : s;
}

export function buildSlotList(venues: Venue[], timeslots: string[]): Slot[] {
  const slots: Slot[] = [];

  for (const v of venues) {
    const venue = shortVenueName(v.name);
    const courts = Array.isArray(v.courts) ? v.courts : [];

    for (const c of courts) {
      const courtLabel = String(c || "").trim();
      if (!courtLabel) continue;

      for (const t of timeslots) {
        const timeRaw = String(t);
        slots.push({ venue, court: courtLabel, timeRaw, time: formatTimeLabel(timeRaw) });
        // slots.push({ venue, court: courtLabel, timeRaw, time: timeRaw) });
      }
    }
  }

  // stable ordering: venue -> court -> raw time
  slots.sort((a, b) => {
    const av = String(a.venue).localeCompare(String(b.venue));
    if (av !== 0) return av;
    const ac = String(a.court).localeCompare(String(b.court));
    if (ac !== 0) return ac;
    return String(a.timeRaw).localeCompare(String(b.timeRaw));
  });

  return slots;
}

export function courtSortKey(c: string) {
  const s = String(c || "").trim();
  const m1 = s.match(/^([0-9]+)([A-Za-z]+)$/); // 3A
  if (m1) return { kind: 0, num: Number(m1[1]), str: String(m1[2]).toUpperCase() };
  const m2 = s.match(/^([A-Za-z]+)([0-9]+)$/); // DC1
  if (m2) return { kind: 1, num: Number(m2[2]), str: String(m2[1]).toUpperCase() };
  return { kind: 2, num: 9999, str: s.toUpperCase() };
}

export function venueSortKey(v: string) {
  const s = String(v || "").trim();
  if (s === "Mullum") return 0;
  if (s === "DCC") return 1;
  return 2;
}

export function buildSlotRowsAll(venues: Venue[], timeslots: string[]): SlotRow[] {
  const rows = buildSlotList(venues, timeslots)
    .map((s) => ({
      key: `${s.venue}__${s.court}__${s.time}`,
      venue: s.venue,
      court: s.court,
      time: s.time,
    }))
    .sort((a, b) => {
      const va = venueSortKey(a.venue);
      const vb = venueSortKey(b.venue);
      if (va !== vb) return va - vb;

      const ca = courtSortKey(a.court);
      const cb = courtSortKey(b.court);
      if (ca.kind !== cb.kind) return ca.kind - cb.kind;
      if (ca.num !== cb.num) return ca.num - cb.num;
      const cs = ca.str.localeCompare(cb.str);
      if (cs !== 0) return cs;

      const ta = parseTimeLabelToMinutes(a.time);
      const tb = parseTimeLabelToMinutes(b.time);
      if (ta !== tb) return ta - tb;

      return a.key.localeCompare(b.key);
    });

  return rows;
}
