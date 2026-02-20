// lib/scheduling.ts
import type { Division, DivisionGrid, DivisionStats, Match, Venue } from "./types";
import { pad2 } from "./ids";
import { buildSlotList } from "./slots";

/**
 * If true, prints detailed logs for placement + clash checks.
 * (This can get noisy on bigger schedules.)
 */
const DEBUG_TIME_CLASHES = true;

function mkPairKey(a: string, b: string) {
  const x = String(a || "").trim();
  const y = String(b || "").trim();
  return x < y ? `${x}||${y}` : `${y}||${x}`;
}

/**
 * Generates weekly pairings per division (round-robin-ish via rotation).
 * NOTE: This does NOT enforce clashes, because clashes are "same time" constraints,
 * which must be enforced during slot placement.
 */
export function generatePairings(params: {
  weeks: number;
  divisions: Division[];
}): Match[] {
  const { weeks, divisions } = params;

  const teamsByDiv = new Map<string, string[]>();
  for (const d of divisions) {
    const code = String(d.code || "").trim();
    const count = Number(d.teams || 0);
    const arr: string[] = [];
    for (let i = 1; i <= count; i++) arr.push(`${code}-${pad2(i)}`);
    teamsByDiv.set(code, arr);
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

/**
 * Places games into venue/court/time slots.
 *
 * clashes = array of [teamA, teamB] where teamA and teamB must NOT play at the same time
 * in the same week (across any divisions).
 */
export function placeMatches(
  pairings: Match[],
  venues: Venue[],
  timeslots: string[],
  clashes?: Array<[string, string]>
): Match[] {
  const slots = buildSlotList(venues, timeslots);

  // Build clash set for O(1) lookup
  const clashSet = new Set<string>();
  for (const [a, b] of clashes || []) {
    const aa = String(a || "").trim();
    const bb = String(b || "").trim();
    if (!aa || !bb) continue;
    clashSet.add(mkPairKey(aa, bb));
  }
  const isClashPair = (a: string, b: string) => clashSet.has(mkPairKey(a, b));

  const out: Match[] = [];

  // Group pairings by week
  const byWeek = new Map<number, Match[]>();
  for (const m of pairings) {
    if (!byWeek.has(m.week)) byWeek.set(m.week, []);
    byWeek.get(m.week)!.push(m);
  }

  for (const [week, arr] of byWeek.entries()) {
    const games = arr.filter((x) => x.away !== "BYE");
    const byes = arr.filter((x) => x.away === "BYE");

    // Stable deterministic ordering
    games.sort((a, b) =>
      (a.division + a.home + a.away).localeCompare(b.division + b.home + b.away)
    );

    // NEW: Track which exact venue/court/time slots are already used this week
    const usedSlotKeys = new Set<string>();

    // Track who is already playing at (week,time)
    // time -> Set<teamId>
    const playingAtTime = new Map<string, Set<string>>();

    const ensureSet = (time: string) => {
      const t = String(time || "").trim();
      if (!playingAtTime.has(t)) playingAtTime.set(t, new Set());
      return playingAtTime.get(t)!;
    };

    const canPlaceGameAtTime = (time: string, home: string, away: string) => {
      const t = String(time || "").trim();
      const playing = ensureSet(t);

      // Rule 1: no team double-booked at same time
      if (playing.has(home) || playing.has(away)) {
        if (DEBUG_TIME_CLASHES) {
          // eslint-disable-next-line no-console
          console.log(
            `[week ${week}] [reject] ${home} vs ${away} @ ${t}: team already playing`,
            { homeAlready: playing.has(home), awayAlready: playing.has(away) }
          );
        }
        return false;
      }

      // Rule 2: no clash-pairs at same time
      // If home/away clashes with ANYONE already playing at this time, reject
      for (const other of playing) {
        const clashHome = isClashPair(home, other);
        const clashAway = isClashPair(away, other);
        if (clashHome || clashAway) {
          if (DEBUG_TIME_CLASHES) {
            // eslint-disable-next-line no-console
            console.log(
              `[week ${week}] [reject] ${home} vs ${away} @ ${t}: clash with ${other}`,
              { clashHome, clashAway, other }
            );
          }
          return false;
        }
      }

      if (DEBUG_TIME_CLASHES) {
        // eslint-disable-next-line no-console
        console.log(`[week ${week}] [ok] ${home} vs ${away} @ ${t}`);
      }
      return true;
    };

    const commitPlacement = (time: string, home: string, away: string) => {
      const playing = ensureSet(time);
      playing.add(home);
      playing.add(away);
    };

    // Place each game into the first available slot that passes checks
    for (const g of games) {
      let placed = false;

      for (const s of slots) {
        const time = String(s.time || "").trim();
        if (!time) continue;

        const venue = String(s.venue || "").trim();
        const court = String(s.court || "").trim();

        // NEW: prevent double-booking the same physical court slot
        const slotKey = `${venue}__${court}__${time}`;
        if (usedSlotKeys.has(slotKey)) continue;

        // Check constraints for this week/time
        if (!canPlaceGameAtTime(time, g.home, g.away)) continue;

        // Place it
        out.push({
          week,
          division: g.division,
          home: g.home,
          away: g.away,
          venue,
          court,
          time: s.time,
        });

        commitPlacement(time, g.home, g.away);
        usedSlotKeys.add(slotKey);
        placed = true;
        break;
      }

      if (!placed) {
        // Could not place without violating time-clash constraints
        if (DEBUG_TIME_CLASHES) {
          // eslint-disable-next-line no-console
          console.warn(
            `[week ${week}] [unassigned] ${g.division} ${g.home} vs ${g.away}: no valid slot (time clash constraints)`
          );
        }
        out.push({
          week,
          division: g.division,
          home: g.home,
          away: g.away,
          venue: "",
          court: "",
          time: "",
        });
      }
    }

    // Keep BYEs as artifacts (not real courts)
    for (const b of byes) {
      out.push({
        week,
        division: b.division,
        home: b.home,
        away: "BYE",
        venue: "BYE",
        court: "-",
        time: "",
      });
    }
  }

  // Final sort for display
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