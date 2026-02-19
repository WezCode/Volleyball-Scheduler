import type { Division, DivisionGrid, DivisionStats, Match, Venue } from "./types";
import { pad2 } from "./ids";
import { buildSlotList } from "./slots";

export function generatePairings(params: { weeks: number; divisions: Division[] }): Match[] {
  const { weeks, divisions } = params;

  const teamsByDiv = new Map<string, string[]>();
  for (const d of divisions) {
    const arr: string[] = [];
    for (let i = 1; i <= Number(d.teams || 0); i++) arr.push(`${d.code}-${pad2(i)}`);
    teamsByDiv.set(d.code, arr);
  }

  const matches: Match[] = [];
  for (let w = 1; w <= weeks; w++) {
    for (const [div, divTeams] of teamsByDiv.entries()) {
      const rot = divTeams.slice(w - 1).concat(divTeams.slice(0, w - 1));

      for (let i = 0; i < rot.length - 1; i += 2) {
        matches.push({ week: w, division: div, home: rot[i], away: rot[i + 1] });
      }
      if (rot.length % 2 === 1) {
        matches.push({ week: w, division: div, home: rot[rot.length - 1], away: "BYE" });
      }
    }
  }

  return matches;
}

export function placeMatches(pairings: Match[], venues: Venue[], timeslots: string[]): Match[] {
  const slots = buildSlotList(venues, timeslots);
  const out: Match[] = [];

  const byWeek = new Map<number, Match[]>();
  for (const m of pairings) {
    if (!byWeek.has(m.week)) byWeek.set(m.week, []);
    byWeek.get(m.week)!.push(m);
  }

  for (const [week, arr] of byWeek.entries()) {
    const games = arr.filter((x) => x.away !== "BYE");
    const byes = arr.filter((x) => x.away === "BYE");

    games.sort((a, b) => (a.division + a.home + a.away).localeCompare(b.division + b.home + b.away));

    for (let gi = 0; gi < games.length; gi++) {
      const s = slots[gi];
      const g = games[gi];

      if (!s) out.push({ week, division: g.division, home: g.home, away: g.away, venue: "", court: "", time: "" });
      else out.push({ week, division: g.division, home: g.home, away: g.away, venue: s.venue, court: s.court, time: s.time });
    }

    for (const b of byes) {
      out.push({ week, division: b.division, home: b.home, away: "BYE", venue: "BYE", court: "-", time: "" });
    }
  }

  out.sort((a, b) => {
    if (a.week !== b.week) return a.week - b.week;
    const d = a.division.localeCompare(b.division);
    if (d !== 0) return d;
    const v = String(a.venue || "").localeCompare(String(b.venue || ""));
    if (v !== 0) return v;
    const t = String(a.time || "").localeCompare(String(b.time || ""));
    if (t !== 0) return t;
    return (a.home + a.away).localeCompare(b.home + b.away);
  });

  return out;
}

export function buildDivisionGrid(schedule: Match[]): DivisionGrid {
  const byDiv = new Map<string, Map<number, any>>();
  const unassigned = new Map<string, Map<number, { home: string; away: string }[]>>();

  for (const m of schedule) {
    if (!byDiv.has(m.division)) byDiv.set(m.division, new Map());
    if (!unassigned.has(m.division)) unassigned.set(m.division, new Map());

    const byWeek = byDiv.get(m.division)!;
    if (!byWeek.has(m.week)) byWeek.set(m.week, { bySlot: new Map(), bye: null });
    const cell = byWeek.get(m.week)!;

    if (m.away === "BYE") {
      cell.bye = m.home;
      continue;
    }

    const venue = String(m.venue || "");
    const court = String(m.court || "");
    const time = String(m.time || "");

    if (!venue || !court || !time) {
      const uw = unassigned.get(m.division)!;
      if (!uw.has(m.week)) uw.set(m.week, []);
      uw.get(m.week)!.push({ home: m.home, away: m.away });
      continue;
    }

    const slotKey = venue + "__" + court + "__" + time;
    cell.bySlot.set(slotKey, { home: m.home, away: m.away, venue, court, time });
  }

  return { byDiv, unassigned };
}

export function buildDivisionStats(schedule: Match[]): Map<string, DivisionStats> {
  const map = new Map<string, DivisionStats>();

  for (const m of schedule) {
    if (!map.has(m.division)) map.set(m.division, { games: 0, byes: 0, unassigned: 0 });
    const s = map.get(m.division)!;

    if (m.away === "BYE") s.byes += 1;
    else {
      s.games += 1;
      if (!m.venue || !m.court || !m.time) s.unassigned += 1;
    }
  }

  return map;
}
