import React, { useEffect, useMemo, useState } from "react";

// In-chat mini app (runs in the ChatGPT preview) to iteratively build/validate inputs
// and generate a starter 5-week schedule.
//
// Iteration 1 rules implemented:
// - Teams only play within their division
// - Pairing rotation per week
// - BYE for odd team counts
//
// Next iteration (we'll add together):
// - Place matches into venue/court/timeslot grid
// - Enforce "no same-timeslot" clashes across all divisions

const DEFAULT = {
  weeks: 5,
  timeslots: ["19:00", "20:00", "21:00"],
  venues: [
    { name: "Mullum Mullum", courts: ["3A", "3B", "4A", "4B", "5A", "5B"] },
    { name: "DCC", courts: ["DC1", "DC2"] },
  ],
  divisions: [
    { code: "D0", teams: 9 },
    { code: "D1", teams: 9 },
    { code: "D1R", teams: 11 },
    { code: "D2", teams: 15 },
    { code: "D3", teams: 9 },
  ],
  clashesRows: [{ teams: [] }],
};

// Preset team display names (IDs remain stable, names are editable in the Teams tab).
const PRESET_TEAM_NAMES = {
  // Division 0
  "D0-01": "Spicy Boys",
  "D0-02": "Yummy Le Set II",
  "D0-03": "Minus Tempo",
  "D0-04": "Southern Cross Legends",
  "D0-05": "Kaos",
  "D0-06": "Family Mart",
  "D0-07": "New Spike",
  "D0-08": "Old Spike",
  "D0-09": "SSS",

  // Division 1
  "D1-01": "YMA",
  "D1-02": "Schmovement",
  "D1-03": "Glass Cannons",
  "D1-04": "Wasabi",
  "D1-05": "James Labubu",
  "D1-06": "Big Dig Energy",
  "D1-07": "Jimmyz Jaguars",
  "D1-08": "Notorious D.I.G",
  "D1-09": "Vertically Challenged",

  // Division 1R
  "D1R-01": "Squid Squad",
  "D1R-02": "Goon Squad",
  "D1R-03": "LRGN",
  "D1R-04": "nomadic",
  "D1R-05": "The Bums",
  "D1R-06": "ACES",
  "D1R-07": "Hit Happens",
  "D1R-08": "Chance Ball",
  "D1R-09": "Wicked Wings",
  "D1R-10": "Hungry Hippos",
  "D1R-11": "Cookies and Cream",

  // Division 2
  "D2-01": "Pocari",
  "D2-02": "Fruit Ninjas",
  "D2-03": "DLLM",
  "D2-04": "Team Potato",
  "D2-05": "The Digletts",
  "D2-06": "Fluffers",
  "D2-07": "Kiss My Ace",
  "D2-08": "Kōri",
  "D2-09": "Green fn",
  "D2-10": "Serving Bots",
  "D2-11": "Silicon Volley",
  "D2-12": "Soft Serve",
  "D2-13": "Chaewon’s Fan Club",
  "D2-14": "We Eat Volleyball",
  "D2-15": "IndOz",

  // Division 3
  "D3-01": "Digma",
  "D3-02": "Beta Blockers",
  "D3-03": "Second Serves",
  "D3-04": "Lightning Spikes Twice",
  "D3-05": "Thirsty",
  "D3-06": "Annie Banannie",
  "D3-07": "Hits & Diggles 2.0",
  "D3-08": "Doraemon Demons",
  "D3-09": "Bears are Green",
};

function pad2(n) {
  return String(n).padStart(2, "0");
}

function buildTeams(divisions) {
  const out = [];
  for (const d of divisions) {
    for (let i = 1; i <= Number(d.teams || 0); i++) {
      out.push(`${d.code}-${pad2(i)}`);
    }
  }
  return out;
}

// parseClashes is kept for backwards-compatibility (raw CSV import),
// but the app currently uses the row-based UI and buildEdgesFromRows.
function parseClashes(_csvText) {
  return [];
}

function buildEdgesFromRows(clashRows) {
  const seen = new Set();
  const edges = [];
  for (const row of clashRows || []) {
    const ts = (row?.teams || []).map((x) => String(x).trim()).filter(Boolean);
    for (let i = 0; i < ts.length; i++) {
      for (let j = i + 1; j < ts.length; j++) {
        const a = ts[i];
        const b = ts[j];
        if (!a || !b || a === b) continue;
        const key = [a, b].sort().join("|");
        if (!seen.has(key)) {
          seen.add(key);
          edges.push([a, b]);
        }
      }
    }
  }
  return edges;
}

function edgesToCsv(edges) {
  const header = "team,clash_team";
  const nl = "\n";
  const body = (edges || []).map(([a, b]) => `${a},${b}`).join(nl);
  return header + (body ? nl + body + nl : nl);
}


function generatePairings({ weeks, divisions }) {
  const teamsByDiv = new Map();
  for (const d of divisions) {
    const arr = [];
    for (let i = 1; i <= Number(d.teams || 0); i++) arr.push(`${d.code}-${pad2(i)}`);
    teamsByDiv.set(d.code, arr);
  }

  const matches = [];
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


function shortVenueName(name) {
  var s = String(name || "").trim();
  if (!s) return s;
  return s.toLowerCase().indexOf("mullum") >= 0 ? "Mullum" : s;
}

function formatTimeLabel(hhmm) {
  var s = String(hhmm || "").trim();
  var parts = s.split(":");
  if (parts.length !== 2) return s;
  var hh = Number(parts[0]);
  var mm = parts[1];
  if (!isFinite(hh)) return s;
  if (mm.length !== 2) return s;
  var ampm = hh >= 12 ? "pm" : "am";
  var h = hh % 12;
  if (h === 0) h = 12;
  return String(h) + ":" + mm + ampm;
}

function buildSlotList(venues, timeslots) {
  var slots = [];

  for (var i = 0; i < venues.length; i++) {
    var v = venues[i];
    var venue = shortVenueName(v.name);
    var courts = Array.isArray(v.courts) ? v.courts : [];

    for (var ci = 0; ci < courts.length; ci++) {
      var courtLabel = String(courts[ci] || "").trim();
      if (!courtLabel) continue;

      for (var j = 0; j < timeslots.length; j++) {
        var t = String(timeslots[j]);
        slots.push({ venue: venue, court: courtLabel, timeRaw: t, time: formatTimeLabel(t) });
      }
    }
  }

  // Stable ordering: venue -> court label -> raw time
  slots.sort(function (a, b) {
    var av = String(a.venue).localeCompare(String(b.venue));
    if (av !== 0) return av;
    var ac = String(a.court).localeCompare(String(b.court));
    if (ac !== 0) return ac;
    return String(a.timeRaw).localeCompare(String(b.timeRaw));
  });

  return slots;
}

function parseTimeLabelToMinutes(t) {
  var s = String(t || "").trim().toLowerCase();
  var m = s.match(/^([0-9]{1,2}):([0-9]{2})(am|pm)$/);
  if (!m) return 99999;
  var h = Number(m[1]);
  var mins = Number(m[2]);
  var ap = m[3];
  if (!isFinite(h) || !isFinite(mins)) return 99999;
  if (h === 12) h = 0;
  var base = h * 60 + mins;
  if (ap === "pm") base += 12 * 60;
  return base;
}

function courtSortKey(c) {
  var s = String(c || "").trim();
  var m1 = s.match(/^([0-9]+)([A-Za-z]+)$/); // 3A
  if (m1) return { kind: 0, num: Number(m1[1]), str: String(m1[2]).toUpperCase() };
  var m2 = s.match(/^([A-Za-z]+)([0-9]+)$/); // DC1
  if (m2) return { kind: 1, num: Number(m2[2]), str: String(m2[1]).toUpperCase() };
  return { kind: 2, num: 9999, str: s.toUpperCase() };
}

function venueSortKey(v) {
  var s = String(v || "").trim();
  if (s === "Mullum") return 0;
  if (s === "DCC") return 1;
  return 2;
}

function placeMatches(pairings, venues, timeslots) {
  var slots = buildSlotList(venues, timeslots);
  var out = [];

  var byWeek = new Map();
  for (var i = 0; i < pairings.length; i++) {
    var m = pairings[i];
    if (!byWeek.has(m.week)) byWeek.set(m.week, []);
    byWeek.get(m.week).push(m);
  }

  for (const entry of byWeek.entries()) {
    var week = entry[0];
    var arr = entry[1];
    var games = arr.filter(function (x) { return x.away !== "BYE"; });
    var byes = arr.filter(function (x) { return x.away === "BYE"; });

    games.sort(function (a, b) {
      return (a.division + a.home + a.away).localeCompare(b.division + b.home + b.away);
    });

    for (var gi = 0; gi < games.length; gi++) {
      var s = slots[gi];
      var g = games[gi];
      if (!s) out.push({ week: week, division: g.division, home: g.home, away: g.away, venue: "", court: "", time: "" });
      else out.push({ week: week, division: g.division, home: g.home, away: g.away, venue: s.venue, court: s.court, time: s.time });
    }

    for (var bi = 0; bi < byes.length; bi++) {
      var b = byes[bi];
      out.push({ week: week, division: b.division, home: b.home, away: "BYE", venue: "BYE", court: "-", time: "" });
    }
  }

  out.sort(function (a, b) {
    if (a.week !== b.week) return a.week - b.week;
    var d = a.division.localeCompare(b.division);
    if (d !== 0) return d;
    var v = String(a.venue).localeCompare(String(b.venue));
    if (v !== 0) return v;
    var t = String(a.time).localeCompare(String(b.time));
    if (t !== 0) return t;
    return (a.home + a.away).localeCompare(b.home + b.away);
  });

  return out;
}

function downloadCsv(rows, filename) {
  const header = Object.keys(rows[0] || {}).join(",");
  const body = rows
    .map((r) =>
      Object.values(r)
        .map((v) => {
          const s = String(v ?? "");
          return s.includes(",") || s.includes("\"") || s.includes("\n")
            ? `\"${s.replaceAll("\"", "\"\"")}\"`
            : s;
        })
        .join(",")
    )
    .join("\n");
  const csv = [header, body].join("\n");
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

export default function VolleyballSchedulerMiniApp() {
  const [weeks, setWeeks] = useState(DEFAULT.weeks);
  const [timeslotsArr, setTimeslotsArr] = useState(DEFAULT.timeslots);
  const [venues, setVenues] = useState(DEFAULT.venues);
  const [divisions, setDivisions] = useState(DEFAULT.divisions);
  const [clashRows, setClashRows] = useState(DEFAULT.clashesRows);
  const [teamNames, setTeamNames] = useState({});

  const parsedTimeslots = useMemo(
    () => (timeslotsArr || []).map((s) => String(s || "").trim()).filter(Boolean),
    [timeslotsArr]
  );

  const totalCourts = useMemo(
    () => venues.reduce((sum, v) => sum + (Array.isArray(v.courts) ? v.courts.length : 0), 0),
    [venues]
  );

  const capacityPerWeek = useMemo(
    () => totalCourts * parsedTimeslots.length,
    [totalCourts, parsedTimeslots.length]
  );

    const slotRowsAll = useMemo(() => {
    const rows = buildSlotList(venues, parsedTimeslots)
      .map((s) => ({
        key: String(s.venue) + "__" + String(s.court) + "__" + String(s.time),
        venue: String(s.venue),
        court: String(s.court),
        time: String(s.time),
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
  }, [venues, parsedTimeslots]);

  const teams = useMemo(() => buildTeams(divisions), [divisions]);
  const teamsSet = useMemo(() => new Set(teams), [teams]);
  const clashes = useMemo(() => buildEdgesFromRows(clashRows), [clashRows]);
  const clashesCsv = useMemo(() => edgesToCsv(clashes), [clashes]);

  useEffect(() => {
    // Keep editable team names in sync with generated team IDs.
    setTeamNames((prev) => {
      const next = { ...prev };
      const current = new Set(teams);
      let changed = false;

      for (const id of teams) {
        if (next[id] === undefined) {
          next[id] = PRESET_TEAM_NAMES[id] ?? id;
          changed = true;
        }
      }
      for (const k of Object.keys(next)) {
        if (!current.has(k)) {
          delete next[k];
          changed = true;
        }
      }
      return changed ? next : prev;
    });
  }, [teams]);

  const displayName = useMemo(() => {
    return (id) => (id === "BYE" ? "BYE" : teamNames[id] || id);
  }, [teamNames]);

  const validation = useMemo(() => {
    const errs = [];
    const infos = [];
    infos.push(`Capacity per week: ${totalCourts} courts × ${parsedTimeslots.length} timeslots = ${capacityPerWeek} match-slots/week`);
    infos.push(`Teams total: ${teams.length}`);

    for (const d of divisions) {
      if (!d.code || !String(d.code).trim()) errs.push("Division code missing.");
      if (Number(d.teams) <= 0) errs.push(`Division ${d.code || "?"}: team count must be > 0`);
    }

    for (const v of venues) {
      if (!v.name || !String(v.name).trim()) errs.push("Venue name missing.");
      const courts = Array.isArray(v.courts) ? v.courts.map((x) => String(x || "").trim()).filter(Boolean) : [];
      if (courts.length <= 0) errs.push(`Venue ${v.name || "?"}: add at least 1 court name`);
      // Basic dup check within a venue
      if (new Set(courts).size !== courts.length) errs.push(`Venue ${v.name || "?"}: duplicate court names`);
    }

    if (parsedTimeslots.length === 0) errs.push("Add at least 1 timeslot.");

    // Basic dup + format check
    const tsClean = parsedTimeslots.map((x) => String(x).trim());
    if (new Set(tsClean).size !== tsClean.length) errs.push("Timeslots: duplicate values");
    for (const t of tsClean) {
      if (!/^([01]?\d|2[0-3]):[0-5]\d$/.test(t)) errs.push("Timeslots: invalid '" + t + "' (use HH:MM)");
    }
    if (Number(weeks) <= 0) errs.push("Weeks must be > 0.");

    // clashes refer to known teams (we assume team IDs follow division counts)
    for (const [a, b] of clashes) {
      if (!teamsSet.has(a)) errs.push(`Clashes: unknown team '${a}'`);
      if (!teamsSet.has(b)) errs.push(`Clashes: unknown team '${b}'`);
    }

    // informational: current generator doesn't place into time/court
    infos.push("Note: placement is currently greedy/stable (no clash/time-pref optimization yet)." );

    return { errs, infos };
  }, [capacityPerWeek, clashes, divisions, parsedTimeslots.length, teams.length, teamsSet, totalCourts, venues, weeks]);

  const [schedule, setSchedule] = useState([]);
  const [previewTab, setPreviewTab] = useState("division");
  const [mainTab, setMainTab] = useState("config");

  const teamsByDivision = useMemo(() => {
    const map = new Map();
    for (const id of teams) {
      const div = id.split("-")[0];
      if (!map.has(div)) map.set(div, []);
      map.get(div).push(id);
    }
    for (const [div, arr] of map.entries()) {
      arr.sort();
      map.set(div, arr);
    }
    return map;
  }, [teams]);

  const groupedByWeek = useMemo(() => {
    const map = new Map();
    for (const m of schedule) {
      if (!map.has(m.week)) map.set(m.week, []);
      map.get(m.week).push(m);
    }
    for (const [w, arr] of map.entries()) {
      arr.sort((a, b) => (a.division + a.home).localeCompare(b.division + b.home));
    }
    return map;
  }, [schedule]);

  const teamNum = useMemo(() => {
    return (id) => {
      if (!id || id === "BYE") return "";
      const parts = String(id).split("-");
      const n = Number(parts[1]);
      return Number.isFinite(n) ? String(n) : parts[1] || id;
    };
  }, []);

  const divisionGrid = useMemo(() => {
    const byDiv = new Map();
    const unassigned = new Map(); // div -> week -> [{home, away}]

    for (const m of schedule) {
      if (!byDiv.has(m.division)) byDiv.set(m.division, new Map());
      if (!unassigned.has(m.division)) unassigned.set(m.division, new Map());

      const byWeek = byDiv.get(m.division);
      if (!byWeek.has(m.week)) byWeek.set(m.week, { bySlot: new Map(), bye: null });
      const cell = byWeek.get(m.week);

      if (m.away === "BYE") {
        cell.bye = m.home;
        continue;
      }

      const venue = String(m.venue || "");
      const court = String(m.court || "");
      const time = String(m.time || "");

      if (!venue || !court || !time) {
        const uw = unassigned.get(m.division);
        if (!uw.has(m.week)) uw.set(m.week, []);
        uw.get(m.week).push({ home: m.home, away: m.away });
        continue;
      }

      const slotKey = venue + "__" + court + "__" + time;
      cell.bySlot.set(slotKey, { home: m.home, away: m.away, venue, court, time });
    }

    return { byDiv, unassigned };
  }, [schedule]);


  const divisionStats = useMemo(() => {
    const map = new Map();
    for (const m of schedule) {
      if (!map.has(m.division)) map.set(m.division, { games: 0, byes: 0, unassigned: 0 });
      const s = map.get(m.division);
      if (m.away === "BYE") s.byes += 1;
      else {
        s.games += 1;
        if (!m.venue || !m.court || !m.time) s.unassigned += 1;
      }
    }
    return map;
  }, [schedule]);


  return (
    <div className="min-h-screen bg-gray-50 p-4">
      <div className="mx-auto max-w-6xl">
        <div className="rounded-2xl bg-white p-5 shadow-sm border border-gray-200">
          <div className="flex flex-col gap-2 md:flex-row md:items-end md:justify-between">
            <div>
              <h1 className="text-xl font-semibold">Volleyball Scheduler (in-chat mini app)</h1>
              <p className="text-sm text-gray-600">Iterative build — we’ll add rules one by one.</p>
            </div>
            <div className="text-sm text-gray-700">
              <div><span className="font-medium">Revisit later:</span> (1) timeslot prefs, (2) stadium exceptions</div>
            </div>
          </div>

          {/* Main tabs */}
          <div className="mt-4 flex gap-2">
            <button
              className={`rounded-lg px-3 py-2 text-sm border ${mainTab === "config" ? "bg-black text-white border-black" : "bg-white border-gray-300 hover:bg-gray-50"}`}
              onClick={() => setMainTab("config")}
            >
              Configuration
            </button>
            <button
              className={`rounded-lg px-3 py-2 text-sm border ${mainTab === "teams" ? "bg-black text-white border-black" : "bg-white border-gray-300 hover:bg-gray-50"}`}
              onClick={() => setMainTab("teams")}
            >
              Teams
            </button>
            <button
              className={`rounded-lg px-3 py-2 text-sm border ${mainTab === "preview" ? "bg-black text-white border-black" : "bg-white border-gray-300 hover:bg-gray-50"} ${schedule.length ? "" : "opacity-50"}`}
              onClick={() => schedule.length && setMainTab("preview")}
              title={schedule.length ? "" : "Generate pairings first"}
            >
              CSV Preview
            </button>
          </div>

          {mainTab === "config" && (
            <>
              <div className="mt-4 grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="rounded-xl border border-gray-200 p-4">
              <div className="text-sm font-medium">Season</div>
              <label className="mt-2 block text-xs text-gray-600">Weeks</label>
              <input
                className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
                type="number"
                value={weeks}
                onChange={(e) => setWeeks(Number(e.target.value))}
                min={1}
              />

              <div className="mt-3">
                <div className="flex items-center justify-between">
                  <label className="block text-xs text-gray-600">Timeslots</label>
                  <button
                    className="text-xs rounded-lg border border-gray-300 px-2 py-1 hover:bg-gray-50"
                    onClick={() => setTimeslotsArr([...(timeslotsArr || []), ""])}
                  >
                    + Add
                  </button>
                </div>

                <div className="mt-2 space-y-2">
                  {(timeslotsArr || []).map((t, idx) => (
                    <div key={idx} className="flex gap-2">
                      <input
                        className="flex-1 rounded-lg border border-gray-300 px-3 py-2 text-sm font-mono"
                        value={t}
                        onChange={(e) => {
                          const next = (timeslotsArr || []).slice();
                          next[idx] = e.target.value;
                          setTimeslotsArr(next);
                        }}
                        placeholder="e.g. 19:00 or 20:05"
                      />
                      <button
                        className={`w-10 rounded-lg border text-sm ${(timeslotsArr || []).length === 1 ? "bg-gray-100 text-gray-400 border-gray-200" : "border-gray-300 hover:bg-gray-50"}`}
                        disabled={(timeslotsArr || []).length === 1}
                        onClick={() => setTimeslotsArr((timeslotsArr || []).filter((_, i) => i !== idx))}
                        title="Remove"
                      >
                        ×
                      </button>
                    </div>
                  ))}
                </div>

                <div className="mt-2 text-[11px] text-gray-600">
                  Use 24h format <span className="font-mono">HH:MM</span> (displayed as <span className="font-mono">7:00pm</span> etc).
                </div>
              </div>

              <div className="mt-3 text-xs text-gray-600">
                Courts total: <span className="font-medium text-gray-900">{totalCourts}</span> · Capacity/week: <span className="font-medium text-gray-900">{capacityPerWeek}</span>
              </div>
            </div>

            <div className="rounded-xl border border-gray-200 p-4">
              <div className="flex items-center justify-between">
                <div className="text-sm font-medium">Venues</div>
                <button
                  className="text-xs rounded-lg border border-gray-300 px-2 py-1 hover:bg-gray-50"
                  onClick={() => setVenues([...venues, { name: "", courts: [""] }])}
                >
                  + Add
                </button>
              </div>

              <div className="mt-2">
                <div className="mb-2 grid grid-cols-12 gap-2 text-xs text-gray-600">
                  <div className="col-span-5">Venue</div>
                  <div className="col-span-6">Courts (names)</div>
                  <div className="col-span-1"></div>
                </div>
                <div className="space-y-2">
                {venues.map((v, idx) => (
                  <div key={idx} className="flex gap-2">
                    <input
                      className="w-44 flex-shrink-0 rounded-lg border border-gray-300 px-3 py-2 text-sm"
                      value={v.name}
                      onChange={(e) => {
                        const next = venues.slice();
                        next[idx] = { ...next[idx], name: e.target.value };
                        setVenues(next);
                      }}
                      placeholder="Venue (e.g. Mullum)"
                    />

                    <div className="flex-1">
                      <div className="flex flex-wrap gap-2">
                        {(v.courts || []).map((cName, cIdx) => (
                          <div key={cIdx} className="flex items-center gap-1">
                            <input
                              className="w-24 rounded-lg border border-gray-300 px-2 py-2 text-sm font-mono"
                              value={cName}
                              onChange={(e) => {
                                const next = venues.slice();
                                const courts = (next[idx].courts || []).slice();
                                courts[cIdx] = e.target.value;
                                next[idx] = { ...next[idx], courts };
                                setVenues(next);
                              }}
                              placeholder="Court"
                            />
                            <button
                              className="h-9 w-9 rounded-lg border border-gray-300 text-sm hover:bg-gray-50"
                              title="Remove court"
                              onClick={() => {
                                const next = venues.slice();
                                const courts = (next[idx].courts || []).filter((_, i) => i !== cIdx);
                                next[idx] = { ...next[idx], courts };
                                setVenues(next);
                              }}
                            >
                              ×
                            </button>
                          </div>
                        ))}
                        <button
                          className="h-9 rounded-lg border border-gray-300 px-3 text-xs hover:bg-gray-50"
                          onClick={() => {
                            const next = venues.slice();
                            const courts = (next[idx].courts || []).slice();
                            courts.push("");
                            next[idx] = { ...next[idx], courts };
                            setVenues(next);
                          }}
                        >
                          + Court
                        </button>
                      </div>
                    </div>
                    <button
                      className="w-10 rounded-lg border border-gray-300 text-sm hover:bg-gray-50"
                      onClick={() => setVenues(venues.filter((_, i) => i !== idx))}
                      title="Remove"
                    >
                      ×
                    </button>
                  </div>
                ))}
              </div>
            </div>
            </div>

            <div className="rounded-xl border border-gray-200 p-4">
              <div className="flex items-center justify-between">
                <div className="text-sm font-medium">Divisions</div>
                <button
                  className="text-xs rounded-lg border border-gray-300 px-2 py-1 hover:bg-gray-50"
                  onClick={() => setDivisions([...divisions, { code: "", teams: 1 }])}
                >
                  + Add
                </button>
              </div>
              <div className="mt-2 space-y-2">
                {divisions.map((d, idx) => (
                  <div key={idx} className="flex gap-2">
                    <input
                      className="w-24 rounded-lg border border-gray-300 px-3 py-2 text-sm"
                      value={d.code}
                      onChange={(e) => {
                        const next = divisions.slice();
                        next[idx] = { ...next[idx], code: e.target.value.trim() };
                        setDivisions(next);
                      }}
                      placeholder="D1R"
                    />
                    <input
                      className="flex-1 rounded-lg border border-gray-300 px-3 py-2 text-sm"
                      type="number"
                      min={1}
                      value={d.teams}
                      onChange={(e) => {
                        const next = divisions.slice();
                        next[idx] = { ...next[idx], teams: Number(e.target.value) };
                        setDivisions(next);
                      }}
                    />
                    <button
                      className="w-10 rounded-lg border border-gray-300 text-sm hover:bg-gray-50"
                      onClick={() => setDivisions(divisions.filter((_, i) => i !== idx))}
                      title="Remove"
                    >
                      ×
                    </button>
                  </div>
                ))}
              </div>

              <div className="mt-3 text-xs text-gray-600">
                Team IDs auto-generated as <span className="font-mono">DivCode-##</span> (e.g. <span className="font-mono">D2-07</span>)
              </div>
            </div>
          </div>

          <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="rounded-xl border border-gray-200 p-4">
              <div className="flex items-center justify-between">
                <div className="text-sm font-medium">Clashes</div>
                <div className="text-xs text-gray-600">Edges: {clashes.length}</div>
              </div>
              <div className="mt-2 text-xs text-gray-600">
                Add rows of teams that share players. Each row creates clashes between every pair in that row.
              </div>

              <div className="mt-3 space-y-3">
                {clashRows.map((row, rowIdx) => {
                  const selected = row.teams || [];
                  const hasDup = new Set(selected).size !== selected.length;
                  return (
                    <div key={rowIdx} className="rounded-xl border border-gray-200 p-3">
                      <div className="flex items-center justify-between gap-2">
                        <div className="text-xs text-gray-600">Row {rowIdx + 1}</div>
                        <button
                          className={`text-xs rounded-lg border px-2 py-1 ${clashRows.length === 1 ? "bg-gray-100 text-gray-400 border-gray-200" : "border-gray-300 hover:bg-gray-50"}`}
                          disabled={clashRows.length === 1}
                          onClick={() => setClashRows(clashRows.filter((_, i) => i !== rowIdx))}
                        >
                          Remove row
                        </button>
                      </div>

                      <div className="mt-2 flex flex-col md:flex-row gap-2 md:items-center">
                        <select
                          className="flex-1 rounded-lg border border-gray-300 px-3 py-2 text-sm"
                          value={row.pending || ""}
                          onChange={(e) => {
                            const next = clashRows.slice();
                            next[rowIdx] = { ...next[rowIdx], pending: e.target.value };
                            setClashRows(next);
                          }}
                        >
                          <option value="">Select a team…</option>
                          {teams.map((t) => (
                            <option key={t} value={t} disabled={selected.includes(t)}>
                              {displayName(t)}
                            </option>
                          ))}
                        </select>

                        <button
                          className={`rounded-lg px-3 py-2 text-sm border ${row.pending && !selected.includes(row.pending) ? "bg-white border-gray-300 hover:bg-gray-50" : "bg-gray-100 text-gray-400 border-gray-200"}`}
                          disabled={!row.pending || selected.includes(row.pending)}
                          onClick={() => {
                            const team = row.pending;
                            if (!team || selected.includes(team)) return;
                            const next = clashRows.slice();
                            next[rowIdx] = { ...next[rowIdx], teams: [...selected, team], pending: "" };
                            setClashRows(next);
                          }}
                        >
                          + Add team
                        </button>
                      </div>

                      {hasDup && (
                        <div className="mt-2 text-xs text-red-700">
                          Duplicate team in this row — remove duplicates.
                        </div>
                      )}

                      <div className="mt-2 flex flex-wrap gap-2">
                        {selected.length === 0 ? (
                          <div className="text-xs text-gray-500">No teams yet.</div>
                        ) : (
                          selected.map((t) => (
                            <span key={t} className="inline-flex items-center gap-2 rounded-full border border-gray-300 bg-white px-3 py-1 text-xs" title={t}>
                              <span className="font-mono">{displayName(t)}</span>
                              <button
                                className="text-gray-500 hover:text-gray-900"
                                onClick={() => {
                                  const next = clashRows.slice();
                                  next[rowIdx] = { ...next[rowIdx], teams: selected.filter((x) => x !== t) };
                                  setClashRows(next);
                                }}
                                title="Remove"
                              >
                                ×
                              </button>
                            </span>
                          ))
                        )}
                      </div>

                      <div className="mt-2 text-xs text-gray-600">
                        This row generates: <span className="font-medium">{Math.max(0, (selected.length * (selected.length - 1)) / 2)}</span> clash edges
                      </div>
                    </div>
                  );
                })}

                <button
                  className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm hover:bg-gray-50"
                  onClick={() => setClashRows([...clashRows, { teams: [] }])}
                >
                  + Add row
                </button>
              </div>

              <details className="mt-3">
                <summary className="cursor-pointer text-xs text-gray-600">Show raw CSV</summary>
                <textarea
                  className="mt-2 h-36 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm font-mono"
                  value={clashesCsv}
                  readOnly
                />
              </details>

              <div className="mt-2 text-xs text-gray-600">Rule (later): clashing teams must not share the same timeslot.</div>
            </div>

            <div className="rounded-xl border border-gray-200 p-4">
              <div className="text-sm font-medium">Validation</div>
              <div className="mt-2 space-y-2">
                {validation.errs.length > 0 ? (
                  <div className="rounded-lg bg-red-50 border border-red-200 p-3 text-sm text-red-800">
                    <div className="font-medium">Fix these:</div>
                    <ul className="mt-1 list-disc pl-5">
                      {validation.errs.map((e, i) => (
                        <li key={i}>{e}</li>
                      ))}
                    </ul>
                  </div>
                ) : (
                  <div className="rounded-lg bg-green-50 border border-green-200 p-3 text-sm text-green-800">
                    Looks good.
                  </div>
                )}

                <div className="rounded-lg bg-gray-50 border border-gray-200 p-3 text-xs text-gray-700 space-y-1">
                  {validation.infos.map((x, i) => (
                    <div key={i}>{x}</div>
                  ))}
                </div>

                <div className="flex gap-2 mt-2">
                  <button
                    className={`rounded-lg px-3 py-2 text-sm border ${validation.errs.length ? "bg-gray-100 text-gray-400 border-gray-200" : "bg-black text-white border-black hover:opacity-90"}`}
                    disabled={validation.errs.length > 0}
                    onClick={() => {
                      const ms = generatePairings({ weeks: Number(weeks), divisions });
                      const placed = placeMatches(ms, venues, parsedTimeslots);
                      setSchedule(placed);
                      setPreviewTab("division");
                      setMainTab("preview");
                    }}
                  >
                    Generate 5-week pairings
                  </button>

                  <button
                    className={`rounded-lg px-3 py-2 text-sm border ${schedule.length ? "bg-white border-gray-300 hover:bg-gray-50" : "bg-gray-100 text-gray-400 border-gray-200"}`}
                    disabled={!schedule.length}
                    onClick={() => {
                      downloadCsv(schedule, "pairings_only.csv");
                    }}
                  >
                    Download CSV
                  </button>
                </div>
              </div>
            </div>
          </div>
          </>
          )}

          {mainTab === "teams" && (
            <div className="mt-4 rounded-2xl border border-gray-200 bg-white overflow-hidden">
              <div className="p-4 border-b border-gray-200">
                <div className="text-sm font-medium">Teams</div>
                <div className="text-xs text-gray-600">Edit names here. Team IDs stay stable for scheduling & clashes.</div>
              </div>
              <div className="p-4">
                <div className="overflow-auto rounded-xl border border-gray-200">
                  <table className="min-w-full text-sm">
                    <thead className="sticky top-0 bg-white">
                      <tr className="text-left text-xs text-gray-600 border-b border-gray-200">
                        <th className="py-2 px-3">Division</th>
                        <th className="py-2 px-3">Team ID</th>
                        <th className="py-2 px-3">Team Name</th>
                      </tr>
                    </thead>
                    <tbody>
                      {[...teamsByDivision.entries()].map(([div, ids]) => (
                        <React.Fragment key={div}>
                          {ids.map((id, i) => (
                            <tr key={id} className="border-t border-gray-100 hover:bg-gray-50">
                              <td className="py-2 px-3 font-mono">{i === 0 ? div : ""}</td>
                              <td className="py-2 px-3 font-mono">{id}</td>
                              <td className="py-2 px-3">
                                <input
                                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
                                  value={teamNames[id] ?? id}
                                  onChange={(e) => {
                                    const v = e.target.value;
                                    setTeamNames((prev) => ({ ...prev, [id]: v }));
                                  }}
                                  placeholder={id}
                                />
                              </td>
                            </tr>
                          ))}
                        </React.Fragment>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {mainTab === "preview" && schedule.length === 0 && (
            <div className="mt-4 rounded-xl border border-gray-200 bg-white p-4 text-sm text-gray-600">
              No schedule generated yet. Go to <span className="font-medium">Configuration</span> and click <span className="font-medium">Generate 5-week pairings</span>.
            </div>
          )}

          {mainTab === "preview" && schedule.length > 0 && (
            <div className="mt-4 rounded-2xl border border-gray-200 overflow-hidden">
              <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between bg-white p-4 border-b border-gray-200">
                <div>
                  <div className="text-sm font-medium">Schedule preview</div>
                  <div className="text-xs text-gray-600">Pairings + BYEs (with venue/court/time placement)</div>
                </div>
                <div className="flex items-center gap-2">
                  <div className="text-xs text-gray-600">Rows: {schedule.length}</div>
                  <div className="hidden lg:flex items-center gap-2 text-xs text-gray-600">
                    {[...divisionStats.entries()]
                      .sort(([a], [b]) => a.localeCompare(b))
                      .map(([div, st]) => (
                        <span key={div} className="rounded-full border border-gray-200 bg-white px-2 py-1">
                          <span className="font-mono">{div}</span>: {st.games} games, {st.byes} byes
                        </span>
                      ))}
                  </div>
                  <div className="flex gap-1">
                    <button
                      className={`rounded-lg px-2 py-1 text-xs border ${previewTab === "division" ? "bg-black text-white border-black" : "bg-white border-gray-300 hover:bg-gray-50"}`}
                      onClick={() => setPreviewTab("division")}
                    >
                      By division
                    </button>
                    <button
                      className={`rounded-lg px-2 py-1 text-xs border ${previewTab === "csv" ? "bg-black text-white border-black" : "bg-white border-gray-300 hover:bg-gray-50"}`}
                      onClick={() => setPreviewTab("csv")}
                    >
                      Flat CSV
                    </button>
                    <button
                      className={`rounded-lg px-2 py-1 text-xs border ${previewTab === "grouped" ? "bg-black text-white border-black" : "bg-white border-gray-300 hover:bg-gray-50"}`}
                      onClick={() => setPreviewTab("grouped")}
                    >
                      By week
                    </button>
                  </div>
                </div>
              </div>

              <div className="bg-white p-4">
                {previewTab === "division" ? (
                  <div className="space-y-6">
                    {divisions
                      .map((d) => d.code)
                      .filter(Boolean)
                      .sort((a, b) => a.localeCompare(b))
                      .map((div) => {
                        const byWeek = divisionGrid.byDiv.get(div) || new Map();
                        const st = divisionStats.get(div) || { games: 0, byes: 0, unassigned: 0 };
                        // Hide division if there are NO placed games and NO byes (i.e., nothing visible in grid)
                        const placedGames = (st.games || 0) - (st.unassigned || 0);
                        if (placedGames === 0 && (st.byes || 0) === 0) return null;
                        const weekNums = Array.from({ length: Number(weeks) }, (_, i) => i + 1);
                        // For this division, hide slot rows that are empty across ALL weeks.
                        const slotRowsDiv = slotRowsAll.filter((r) => {
                          for (let wi = 0; wi < weekNums.length; wi++) {
                            const w = weekNums[wi];
                            const cell = byWeek.get(w);
                            if (cell && cell.bySlot && cell.bySlot.get(r.key)) return true;
                          }
                          return false;
                        });
                        return (
                          <div key={div} className="rounded-2xl border border-gray-200 overflow-hidden">
                            <div className="bg-white p-4 border-b border-gray-200">
                              <div className="flex items-center justify-between gap-3">
                                <div className="text-sm font-semibold">{div}</div>
                                <div className="text-xs text-gray-600">
                                  {(() => {
                                    const st = divisionStats.get(div) || { games: 0, byes: 0, unassigned: 0 };
                                    return `Games: ${st.games} · BYEs: ${st.byes}${st.unassigned ? ` · Unassigned: ${st.unassigned}` : ""}`;

                                  })()}
                                </div>
                              </div>
                              <div className="text-xs text-gray-600">Like your template: weeks as columns, matches + BYE rows</div>
                            </div>
                            <div className="bg-white p-4">
                              <div className="mb-3 grid grid-cols-1 md:grid-cols-3 gap-2">
                                {(teamsByDivision.get(div) || []).map((id) => (
                                  <div key={id} className="text-xs">
                                    <span className="font-mono font-semibold">{teamNum(id)}.</span>{" "}
                                    <span>{displayName(id)}</span>
                                  </div>
                                ))}
                              </div>

                              <div className="overflow-auto rounded-xl border border-gray-200">
                                <table className="min-w-full text-sm">
                                <thead className="sticky top-0 bg-white">
                                  <tr className="text-left text-xs text-gray-600 border-b border-gray-200">
                                    <th className="py-2 px-3">Venue</th>
                                    <th className="py-2 px-3">Court</th>
                                    <th className="py-2 px-3">Time</th>
                                    {weekNums.map((w) => (
                                      <th key={w} className="py-2 px-3">Week {w}</th>
                                    ))}
                                  </tr>
                                </thead>
                                <tbody>
                                  {slotRowsDiv.map((r) => (
                                    <tr key={r.key} className="border-t border-gray-100">
                                      <td className="py-2 px-3 text-xs font-medium text-gray-800">{r.venue}</td>
                                      <td className="py-2 px-3 font-mono">{r.court}</td>
                                      <td className="py-2 px-3 font-mono">{r.time}</td>
                                      {weekNums.map((w) => {
                                        const cell = byWeek.get(w) || { bySlot: new Map(), bye: null };
                                        const p = cell.bySlot.get(r.key);
                                        if (!p) return <td key={w} className="py-2 px-3 text-gray-400">-</td>;
                                        const label = `${teamNum(p.home)} v ${teamNum(p.away)}`;
                                        const tip = `${displayName(p.home)} vs ${displayName(p.away)}`;
                                        return (
                                          <td key={w} className="py-2 px-3 font-mono" title={tip}>
                                            {label}
                                          </td>
                                        );
                                      })}
                                    </tr>
                                  ))}
                                  <tr className="border-t border-gray-200 bg-gray-50">
                                    <td className="py-2 px-3 text-xs font-medium text-gray-700">BYE</td>
                                    {weekNums.map((w) => {
                                      const cell = byWeek.get(w) || { bySlot: new Map(), bye: null };
                                      if (!cell.bye) return <td key={w} className="py-2 px-3 text-gray-400">-</td>;
                                      return (
                                        <td key={w} className="py-2 px-3 font-mono" title={displayName(cell.bye)}>
                                          {teamNum(cell.bye)}
                                        </td>
                                      );
                                    })}
                                  </tr>
                                </tbody>
                              </table>
                              </div>
                            </div>
                          </div>
                        );
                      })}
                  </div>
                ) : previewTab === "grouped" ? (
                  <>
                    {[...groupedByWeek.entries()].map(([w, arr]) => (
                      <div key={w} className="mb-6">
                        <div className="text-sm font-semibold">Week {w}</div>
                        <div className="mt-2 overflow-auto">
                          <table className="min-w-full text-sm">
                            <thead>
                              <tr className="text-left text-xs text-gray-600">
                                <th className="py-2 pr-4">Division</th>
                                <th className="py-2 pr-4">Home</th>
                                <th className="py-2 pr-4">Away</th>
                              </tr>
                            </thead>
                            <tbody>
                              {arr.map((m, i) => (
                                <tr key={i} className="border-t border-gray-100">
                                  <td className="py-2 pr-4 font-mono">{m.division}</td>
                                  <td className="py-2 pr-4">
                                    <div className="font-mono">{displayName(m.home)}</div>
                                    <div className="text-xs text-gray-500 font-mono">{m.home}</div>
                                  </td>
                                  <td className="py-2 pr-4">
                                    <div className="font-mono">{displayName(m.away)}</div>
                                    {m.away !== "BYE" && <div className="text-xs text-gray-500 font-mono">{m.away}</div>}
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      </div>
                    ))}
                  </>
                ) : (
                  <div className="overflow-auto rounded-xl border border-gray-200">
                    <table className="min-w-full text-sm">
                      <thead className="sticky top-0 bg-white">
                        <tr className="text-left text-xs text-gray-600 border-b border-gray-200">
                          <th className="py-2 px-3">Week</th>
                          <th className="py-2 px-3">Division</th>
                          <th className="py-2 px-3">Home</th>
                          <th className="py-2 px-3">Away</th>
                        </tr>
                      </thead>
                      <tbody>
                        {schedule.map((m, i) => (
                          <tr key={i} className="border-t border-gray-100 hover:bg-gray-50">
                            <td className="py-2 px-3 font-mono">{m.week}</td>
                            <td className="py-2 px-3 font-mono">{m.division}</td>
                            <td className="py-2 px-3">
                              <div className="font-mono">{displayName(m.home)}</div>
                              <div className="text-xs text-gray-500 font-mono">{m.home}</div>
                            </td>
                            <td className="py-2 px-3">
                              <div className="font-mono">{displayName(m.away)}</div>
                              {m.away !== "BYE" && <div className="text-xs text-gray-500 font-mono">{m.away}</div>}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
