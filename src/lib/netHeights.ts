import type { Match, Division } from "./types";

export type NetHeightChangeEvent = {
  week: number;
  venue: string;
  court: string;

  // the transition
  fromTimeslot: string;
  toTimeslot: string;

  fromDivision: string;
  toDivision: string;

  fromHeightM: number;
  toHeightM: number;
};

export function computeNetHeightChanges(params: {
  schedule: Match[];
  divisions: Division[];
  timeslots: string[]; // parsedTimeslots (ordered)
}) {
  const { schedule, divisions, timeslots } = params;

  const heightByDivision = new Map<string, number>();
  for (const d of divisions || []) {
    heightByDivision.set(String(d.code).trim(), Number((d as any).netHeightM));
  }

  const slotIndex = new Map<string, number>();
  (timeslots || []).forEach((t, i) => slotIndex.set(String(t || "").trim(), i));

  // group by week + venue + court
  const groups = new Map<string, Match[]>();
  for (const m of schedule || []) {
    const week = Number((m as any).week);
    const venue = String((m as any).venue || "").trim();
    const court = String((m as any).court || "").trim();
    if (!week || !venue || !court) continue;

    const key = `${week}||${venue}||${court}`;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key)!.push(m);
  }

  const events: NetHeightChangeEvent[] = [];
  const breakdownByWeek: Record<number, number> = {};

  for (const [key, matches] of groups.entries()) {
    matches.sort((a, b) => {
      const ta = slotIndex.get(String((a as any).time || "").trim()) ?? 9999; // ✅ time
      const tb = slotIndex.get(String((b as any).time || "").trim()) ?? 9999; // ✅ time
      return ta - tb;
    });

    const [weekStr, venue, court] = key.split("||");
    const week = Number(weekStr);

    let prev: { time: string; division: string; heightM: number } | null = null;

    for (const m of matches) {
      const time = String((m as any).time || "").trim(); // ✅ time
      const division = String((m as any).division || "").trim();
      const heightM = heightByDivision.get(division);

      if (!time || !division || heightM === undefined || !isFinite(heightM))
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

  events.sort((a, b) => {
    if (a.week !== b.week) return a.week - b.week;
    const vc = (a.venue + "||" + a.court).localeCompare(
      b.venue + "||" + b.court
    );
    if (vc !== 0) return vc;
    const ia = slotIndex.get(String(a.toTimeslot).trim()) ?? 9999;
    const ib = slotIndex.get(String(b.toTimeslot).trim()) ?? 9999;
    return ia - ib;
  });

  return { totalChanges: events.length, breakdownByWeek, events };
}
