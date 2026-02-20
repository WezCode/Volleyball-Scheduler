import type { Match, Division } from "./types";
import { timeIndexMap, toHHMM } from "./time";

export type NetHeightChangeEvent = {
  week: number;
  venue: string;
  court: string;

  fromTimeslot: string; // HH:MM
  toTimeslot: string; // HH:MM

  fromDivision: string;
  toDivision: string;

  fromHeightM: number;
  toHeightM: number;
};

export function computeNetHeightChanges(params: {
  schedule: Match[];
  divisions: Division[];
  timeslots: string[]; // ordered (any format ok)
}) {
  const { schedule, divisions, timeslots } = params;

  // division -> height (meters)
  const heightByDivision = new Map<string, number>();
  for (const d of divisions || []) {
    const code = String(d.code || "").trim();
    const h = Number((d as any).netHeightM);
    if (code && Number.isFinite(h)) heightByDivision.set(code, h);
  }

  // Canonical time ordering map (HH:MM)
  const slotIndex = timeIndexMap(timeslots);
  const timeOrder = (t: string) => slotIndex.get(toHHMM(t)) ?? 9999;

  // group by week + venue + court
  const groups = new Map<string, Match[]>();
  for (const m of schedule || []) {
    const week = Number(m.week);
    const venue = String(m.venue || "").trim();
    const court = String(m.court || "").trim();

    // IMPORTANT: Match uses "time"
    const time = toHHMM(String((m as any).time || "").trim());

    if (!week || !venue || !court || !time) continue;

    const key = `${week}||${venue}||${court}`;
    if (!groups.has(key)) groups.set(key, []);
    // store a shallow copy with canonical time? (optional)
    groups.get(key)!.push({ ...m, time } as any);
  }

  const events: NetHeightChangeEvent[] = [];
  const breakdownByWeek: Record<number, number> = {};

  for (const [key, matches] of groups.entries()) {
    matches.sort(
      (a, b) => timeOrder((a as any).time) - timeOrder((b as any).time)
    );

    const [weekStr, venue, court] = key.split("||");
    const week = Number(weekStr);

    let prev: { time: string; division: string; heightM: number } | null = null;

    for (const m of matches) {
      const time = toHHMM(String((m as any).time || "").trim());
      const division = String(m.division || "").trim();
      const heightM = heightByDivision.get(division);

      if (!time || !division || heightM == null || !Number.isFinite(heightM))
        continue;

      if (prev && prev.heightM !== heightM) {
        events.push({
          week,
          venue,
          court,
          fromTimeslot: prev.time,
          toTimeslot: time,
          fromDivision: prev.division,
          toDivision: division,
          fromHeightM: prev.heightM,
          toHeightM: heightM,
        });

        breakdownByWeek[week] = (breakdownByWeek[week] || 0) + 1;
      }

      prev = { time, division, heightM };
    }
  }

  // sort events nicely (week, venue, court, time)
  events.sort((a, b) => {
    if (a.week !== b.week) return a.week - b.week;

    const vc = (a.venue + "||" + a.court).localeCompare(
      b.venue + "||" + b.court
    );
    if (vc !== 0) return vc;

    return timeOrder(a.toTimeslot) - timeOrder(b.toTimeslot);
  });

  return { totalChanges: events.length, breakdownByWeek, events };
}
