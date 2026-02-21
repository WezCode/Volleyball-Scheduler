import React, { useEffect, useMemo, useState } from "react";
import type {
  Division,
  DivisionGrid,
  DivisionStats,
  Match,
  SlotRow,
} from "../lib/types";
import { teamNum } from "../lib/ids";
import { computeNetHeightChanges } from "../lib/netHeights";
import { formatTimeLabel, toHHMM } from "../lib/time";

// --- Clash groups tab: timeslots rows × weeks columns (with team colours) ---

function buildClashGroups(edges: Array<[string, string]>) {
  // Connected components (A-B and B-C => group [A,B,C])
  const adj = new Map<string, Set<string>>();

  for (const [a0, b0] of edges || []) {
    const a = String(a0 || "").trim();
    const b = String(b0 || "").trim();
    if (!a || !b || a === b) continue;

    if (!adj.has(a)) adj.set(a, new Set());
    if (!adj.has(b)) adj.set(b, new Set());
    adj.get(a)!.add(b);
    adj.get(b)!.add(a);
  }

  const seen = new Set<string>();
  const groups: { id: string; teams: string[] }[] = [];

  for (const start of adj.keys()) {
    if (seen.has(start)) continue;
    const stack = [start];
    const comp: string[] = [];
    seen.add(start);

    while (stack.length) {
      const cur = stack.pop()!;
      comp.push(cur);
      for (const nxt of adj.get(cur) || []) {
        if (!seen.has(nxt)) {
          seen.add(nxt);
          stack.push(nxt);
        }
      }
    }

    comp.sort();
    groups.push({ id: comp.join("|"), teams: comp });
  }

  groups.sort(
    (a, b) =>
      b.teams.length - a.teams.length || a.id.localeCompare(b.id)
  );
  return groups;
}

function makeTeamColorMap(groupTeams: string[]) {
  // up to 3 teams → 3 distinct colour “badges”
  const palette = [
    "bg-blue-100 text-blue-900 border-blue-200",
    "bg-emerald-100 text-emerald-900 border-emerald-200",
    "bg-purple-100 text-purple-900 border-purple-200",
  ];

  const m = new Map<string, string>();
  groupTeams.slice(0, 3).forEach((t, i) => m.set(t, palette[i]));
  // fallback if somehow more than 3 sneaks in (still readable)
  for (const t of groupTeams)
    if (!m.has(t))
      m.set(t, "bg-gray-100 text-gray-900 border-gray-200");
  return m;
}

function TeamBadge(props: { label: string; className: string; title?: string }) {
  return (
    <span
      title={props.title}
      className={`inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-semibold max-w-[140px] truncate ${props.className}`}
    >
      {props.label}
    </span>
  );
}

function buildGroupIndex(params: { groupTeams: string[]; schedule: Match[] }) {
  const { groupTeams, schedule } = params;
  const teamsSet = new Set(groupTeams);

  // week -> time(HH:MM|TBD) -> matches involving group teams at that time
  const byWeekTime = new Map<number, Map<string, Match[]>>();
  const ensure = (week: number, time: string) => {
    if (!byWeekTime.has(week)) byWeekTime.set(week, new Map());
    const m = byWeekTime.get(week)!;
    if (!m.has(time)) m.set(time, []);
    return m.get(time)!;
  };

  for (const m of schedule || []) {
    if (m.away === "BYE") continue;
    const week = Number(m.week);
    if (!week) continue;

    if (!teamsSet.has(m.home) && !teamsSet.has(m.away)) continue;

    const time = toHHMM(String(m.time || "").trim());
    const keyTime = time || "TBD";
    ensure(week, keyTime).push(m);
  }

  // stable ordering within each bucket
  for (const byTime of byWeekTime.values()) {
    for (const [t, arr] of byTime.entries()) {
      arr.sort((a, b) =>
        (a.division + a.home + a.away).localeCompare(
          b.division + b.home + b.away
        )
      );
      byTime.set(t, arr);
    }
  }

  return byWeekTime;
}

function ClashGroupsView(props: {
  weeks: number;
  schedule: Match[];
  clashes: Array<[string, string]>;
  displayName: (id: string) => string;
  timeslots: string[];
}) {
  const { weeks, schedule, clashes, displayName, timeslots } = props;

  const groups = useMemo(() => buildClashGroups(clashes), [clashes]);
  const weekNums = Array.from({ length: Number(weeks) }, (_, i) => i + 1);

  const timeslotRows = useMemo(() => {
    const t = (timeslots || [])
      .map((x) => toHHMM(String(x || "").trim()))
      .filter(Boolean);
    return Array.from(new Set(t)).sort((a, b) => a.localeCompare(b));
  }, [timeslots]);

  if (!groups.length) {
    return (
      <div className="rounded-xl border border-gray-200 bg-white p-4 text-sm text-gray-600">
        No clash pairs defined yet.
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {groups.map((g, idx) => {
        const teamColors = makeTeamColorMap(g.teams);
        const byWeekTime = buildGroupIndex({ groupTeams: g.teams, schedule });

        const hasTbd = weekNums.some(
          (w) => (byWeekTime.get(w)?.get("TBD") || []).length > 0
        );
        const rows = hasTbd ? [...timeslotRows, "TBD"] : timeslotRows;

        return (
          <div
            key={g.id}
            className="rounded-2xl border border-gray-200 overflow-hidden"
          >
            <div className="bg-white p-4 border-b border-gray-200">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="text-sm font-semibold">
                  Clash Group {idx + 1}{" "}
                  <span className="text-gray-500 font-medium">
                    ({g.teams.length} teams)
                  </span>
                </div>

                <div className="flex flex-wrap gap-2">
                  {g.teams.slice(0, 3).map((t) => (
                    <TeamBadge
                      key={t}
                      className={teamColors.get(t)!}
                      label={displayName(t)}
                      title={t}
                    />
                  ))}
                </div>
              </div>

              <div className="mt-1 text-xs text-gray-600">
                Row = time; cell shows who’s playing at that time that week.
              </div>
            </div>

            <div className="bg-white p-4 overflow-x-auto -mx-4 px-4">
              <table className="min-w-[1000px] w-full text-sm table-fixed">
                <colgroup>
                  <col style={{ width: 120 }} />
                  {weekNums.map((w) => (
                    <col key={w} style={{ width: 220 }} />
                  ))}
                </colgroup>

                <thead className="sticky top-0 bg-white">
                  <tr className="text-left text-xs text-gray-600 border-b border-gray-200">
                    <th className="py-2 px-3 w-[120px] sticky left-0 bg-white z-10">
                      Time
                    </th>
                    {weekNums.map((w) => (
                      <th key={w} className="py-2 px-3">
                        Week {w}
                      </th>
                    ))}
                  </tr>
                </thead>

                <tbody>
                  {rows.map((t) => (
                    <tr key={t} className="border-t border-gray-100 align-top">
                      <td className="py-2 px-3 font-mono text-xs text-gray-800 sticky left-0 bg-white z-10">
                        {t === "TBD" ? "TBD" : formatTimeLabel(t)}
                      </td>

                      {weekNums.map((w) => {
                        const matches = byWeekTime.get(w)?.get(t) || [];
                        if (!matches.length) {
                          return (
                            <td key={w} className="py-2 px-3 text-gray-300">
                              —
                            </td>
                          );
                        }

                        return (
                          <td key={w} className="py-2 px-3">
                            <div className="flex flex-col gap-2">
                              {matches.map((m, i) => {
                                const a = m.home;
                                const b = m.away;

                                const aInGroup = teamColors.has(a);
                                const bInGroup = teamColors.has(b);

                                let first = a;
                                let second = b;

                                // Put the clash-group team first if exactly one is in-group
                                if (aInGroup && !bInGroup) {
                                  first = a;
                                  second = b;
                                } else if (!aInGroup && bInGroup) {
                                  first = b;
                                  second = a;
                                } else {
                                  // both in group (or neither): stable order
                                  if (String(a).localeCompare(String(b)) > 0) {
                                    first = b;
                                    second = a;
                                  }
                                }

                                const where =
                                  m.venue && m.court
                                    ? `${m.venue} ${m.court}`
                                    : m.venue
                                    ? String(m.venue)
                                    : "";

                                return (
                                  <div
                                    key={i}
                                    className="rounded-xl border border-gray-200 bg-gray-50 px-2 py-2"
                                    title={`${displayName(first)} vs ${displayName(
                                      second
                                    )}`}
                                  >
                                    <div className="flex flex-wrap items-center gap-2 min-w-0">
                                      <span className="text-xs font-mono text-gray-700 shrink-0">
                                        {m.division}
                                      </span>

                                      {teamColors.has(first) ? (
                                        <TeamBadge
                                          className={teamColors.get(first)!}
                                          label={displayName(first)}
                                          title={first}
                                        />
                                      ) : (
                                        <span className="text-xs text-gray-700 max-w-[140px] truncate">
                                          {displayName(first)}
                                        </span>
                                      )}

                                      <span className="text-xs text-gray-500 shrink-0">
                                        vs
                                      </span>

                                      {teamColors.has(second) ? (
                                        <TeamBadge
                                          className={teamColors.get(second)!}
                                          label={displayName(second)}
                                          title={second}
                                        />
                                      ) : (
                                        <span className="text-xs text-gray-700 max-w-[140px] truncate">
                                          {displayName(second)}
                                        </span>
                                      )}
                                    </div>

                                    {where ? (
                                      <div className="mt-1 text-[11px] text-gray-500">
                                        {where}
                                      </div>
                                    ) : null}
                                  </div>
                                );
                              })}
                            </div>
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        );
      })}
    </div>
  );
}

export function PreviewPanel(props: {
  weeks: number;
  divisions: Division[];
  schedule: Match[];

  previewTab: "division" | "netheights" | "clashes";
  setPreviewTab: React.Dispatch<
    React.SetStateAction<"division" | "netheights" | "clashes">
  >;

  divisionGrid: DivisionGrid;
  divisionStats: Map<string, DivisionStats>;
  slotRowsAll: SlotRow[];
  teamsByDivision: Map<string, string[]>;
  displayName: (id: string) => string;
  groupedByWeek: Map<number, Match[]>;
  timeslots: string[];

  clashes: Array<[string, string]>;
}) {
  const {
    weeks,
    divisions,
    schedule,
    previewTab,
    setPreviewTab,
    divisionGrid,
    divisionStats,
    slotRowsAll,
    teamsByDivision,
    displayName,
    groupedByWeek,
    timeslots,
    clashes,
  } = props;

  const weekNums = Array.from({ length: Number(weeks) }, (_, i) => i + 1);

  const netChanges = useMemo(
    () => computeNetHeightChanges({ schedule, divisions, timeslots }),
    [schedule, divisions, timeslots]
  );

  const netChangeSlots = useMemo(() => {
    // highlight BOTH the "from" slot and the "to" slot for each change
    // key format: week||venue||court||HH:MM
    const s = new Set<string>();

    for (const e of netChanges.events || []) {
      const venue = String(e.venue || "").trim();
      const court = String(e.court || "").trim();

      const fromHHMM = toHHMM(e.fromTimeslot);
      const toHHMM_ = toHHMM(e.toTimeslot);

      s.add([e.week, venue, court, fromHHMM].join("||"));
      s.add([e.week, venue, court, toHHMM_].join("||"));
    }
    return s;
  }, [netChanges.events]);

  const heightByDivision = useMemo(() => {
    const m = new Map<string, number>();
    for (const d of divisions || []) {
      m.set(String(d.code), Number((d as any).netHeightM));
    }
    return m;
  }, [divisions]);

  const courts = useMemo(() => {
    const seen = new Set<string>();
    const out: { venue: string; court: string }[] = [];

    for (const m of schedule || []) {
      const venue = String(m.venue || "").trim();
      const court = String(m.court || "").trim();

      // ✅ skip BYE / placeholders
      if (!venue || !court) continue;
      if (court.toUpperCase() === "BYE") continue;
      if (venue.toUpperCase() === "BYE") continue;

      const k = `${venue}||${court}`;
      if (seen.has(k)) continue;
      seen.add(k);

      out.push({ venue, court });
    }

    out.sort((a, b) =>
      (a.venue + a.court).localeCompare(b.venue + b.court)
    );
    return out;
  }, [schedule]);

  const planByWeekCourt = useMemo(() => {
    const out = new Map<
      number,
      Map<string, Map<string, { division: string; heightM: number }>>
    >();

    for (const m of schedule as any[]) {
      const week = Number(m.week);
      const venue = String(m.venue || "").trim();
      const court = String(m.court || "").trim();

      // canonical HH:MM key
      const time = toHHMM(String(m.time || "").trim());

      const division = String(m.division || "").trim();
      if (!week || !venue || !court || !time || !division) continue;

      const heightM = heightByDivision.get(division);
      if (heightM === undefined || !isFinite(heightM)) continue;

      const courtKey = `${venue}||${court}`;

      if (!out.has(week)) out.set(week, new Map());
      const byCourt = out.get(week)!;
      if (!byCourt.has(courtKey)) byCourt.set(courtKey, new Map());
      byCourt.get(courtKey)!.set(time, { division, heightM });
    }

    return out;
  }, [schedule, heightByDivision]);

  useEffect(() => {
    if (!timeslots?.length || !schedule?.length) return;

    const w = 1;
    const byCourt = planByWeekCourt.get(w);

    console.log("DEBUG timeslots (HH:MM):", timeslots);

    if (!byCourt) {
      console.log("DEBUG no byCourt map for week", w);
      return;
    }

    const firstCourtEntry = byCourt.entries().next();
    if (firstCourtEntry.done) {
      console.log("DEBUG byCourt exists but empty for week", w);
      return;
    }

    const [courtKey, byTime] = firstCourtEntry.value;

    console.log("DEBUG first courtKey:", courtKey);
    console.log("DEBUG byTime keys (times in schedule):", [...byTime.keys()]);
  }, [timeslots, schedule, planByWeekCourt]);

  return (
    <div className="mt-4 rounded-2xl border border-gray-200 overflow-hidden">
      <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between bg-white p-4 border-b border-gray-200">
        <div className="w-full">
          <div className="text-sm font-medium">Schedule preview</div>
          <div className="text-xs text-gray-600">
            Pairings + BYEs (with venue/court/time placement)
          </div>

          {/* Preview tabs row */}
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <button
              className={`rounded-lg px-3 py-1 text-xs border ${
                previewTab === "division"
                  ? "bg-black text-white border-black"
                  : "bg-white border-gray-300 hover:bg-gray-50"
              }`}
              onClick={() => setPreviewTab("division")}
            >
              Division
            </button>

            <button
              className={`rounded-lg px-3 py-1 text-xs border ${
                previewTab === "netheights"
                  ? "bg-black text-white border-black"
                  : "bg-white border-gray-300 hover:bg-gray-50"
              }`}
              onClick={() => setPreviewTab("netheights")}
              title="Show where net height changes happen"
            >
              Net changes
            </button>

            <button
              className={`rounded-lg px-3 py-1 text-xs border ${
                previewTab === "clashes"
                  ? "bg-black text-white border-black"
                  : "bg-white border-gray-300 hover:bg-gray-50"
              }`}
              onClick={() => setPreviewTab("clashes")}
              title="Show clash groups and each group's games by week/time"
            >
              Clash groups
            </button>

            {/* Net summary box */}
            <div className="ml-auto w-full md:w-auto mt-3 md:mt-0 rounded-xl border border-gray-200 bg-white p-3">
              <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-gray-700">
                <span className="font-medium">Net height changes</span>

                {Array.from({ length: Number(weeks) }, (_, i) => i + 1).map(
                  (w) => (
                    <span key={w}>
                      Week {w}:{" "}
                      <span className="font-semibold">
                        {netChanges.breakdownByWeek[w] ?? 0}
                      </span>
                    </span>
                  )
                )}

                <span className="ml-auto text-gray-600">
                  Total:{" "}
                  <span className="font-semibold text-gray-900">
                    {netChanges.totalChanges}
                  </span>
                </span>
              </div>
            </div>
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
                const st = divisionStats.get(div) || {
                  games: 0,
                  byes: 0,
                  unassigned: 0,
                };
                const placedGames = (st.games || 0) - (st.unassigned || 0);
                if (placedGames === 0 && (st.byes || 0) === 0) return null;

                // hide slot rows that are empty across all weeks
                const slotRowsDiv = slotRowsAll.filter((r) => {
                  for (const w of weekNums) {
                    const cell = byWeek.get(w);
                    if (cell && cell.bySlot && cell.bySlot.get(r.key))
                      return true;
                  }
                  return false;
                });

                return (
                  <div
                    key={div}
                    className="rounded-2xl border border-gray-200 overflow-hidden"
                  >
                    <div className="bg-white p-4 border-b border-gray-200">
                      <div className="flex items-center justify-between gap-3">
                        <div className="text-sm font-semibold">{div}</div>
                        <div className="text-xs text-gray-600">
                          {`Games: ${st.games} · BYEs: ${st.byes}${
                            st.unassigned
                              ? ` · Unassigned: ${st.unassigned}`
                              : ""
                          }`}
                        </div>
                      </div>
                      <div className="text-xs text-gray-600">
                        Weeks as columns, matches + BYE rows
                      </div>
                    </div>

                    <div className="bg-white p-4">
                      <div className="mb-3 grid grid-cols-1 md:grid-cols-3 gap-2">
                        {(teamsByDivision.get(div) || []).map((id) => (
                          <div key={id} className="text-xs">
                            <span className="font-mono font-semibold">
                              {teamNum(id)}.
                            </span>{" "}
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
                                <th key={w} className="py-2 px-3">
                                  Week {w}
                                </th>
                              ))}
                            </tr>
                          </thead>
                          <tbody>
                            {slotRowsDiv.map((r) => (
                              <tr
                                key={r.key}
                                className="border-t border-gray-100"
                              >
                                <td className="py-2 px-3 text-xs font-medium text-gray-800">
                                  {r.venue}
                                </td>
                                <td className="py-2 px-3 font-mono">
                                  {r.court}
                                </td>
                                <td className="py-2 px-3 font-mono">
                                  {r.time}
                                </td>
                                {weekNums.map((w) => {
                                  const cell = byWeek.get(w) || {
                                    bySlot: new Map(),
                                    bye: null,
                                  };
                                  const p = cell.bySlot.get(r.key);
                                  if (!p)
                                    return (
                                      <td
                                        key={w}
                                        className="py-2 px-3 text-gray-400"
                                      >
                                        -
                                      </td>
                                    );
                                  const label = `${teamNum(p.home)} v ${teamNum(
                                    p.away
                                  )}`;
                                  const tip = `${displayName(
                                    p.home
                                  )} vs ${displayName(p.away)}`;
                                  return (
                                    <td
                                      key={w}
                                      className="py-2 px-3 font-mono"
                                      title={tip}
                                    >
                                      {label}
                                    </td>
                                  );
                                })}
                              </tr>
                            ))}

                            <tr className="border-t border-gray-200 bg-gray-50">
                              <td className="py-2 px-3 text-xs font-medium text-gray-700">
                                BYE
                              </td>
                              <td className="py-2 px-3" />
                              <td className="py-2 px-3" />
                              {weekNums.map((w) => {
                                const cell = byWeek.get(w) || {
                                  bySlot: new Map(),
                                  bye: null,
                                };
                                if (!cell.bye)
                                  return (
                                    <td
                                      key={w}
                                      className="py-2 px-3 text-gray-400"
                                    >
                                      -
                                    </td>
                                  );
                                return (
                                  <td
                                    key={w}
                                    className="py-2 px-3 font-mono"
                                    title={displayName(cell.bye)}
                                  >
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
        ) : previewTab === "netheights" ? (
          <div className="space-y-6">
            {weekNums.map((w) => {
              const byCourt = planByWeekCourt.get(w) || new Map();

              return (
                <div
                  key={w}
                  className="rounded-2xl border border-gray-200 overflow-hidden"
                >
                  <div className="bg-white p-4 border-b border-gray-200">
                    <div className="flex items-center justify-between">
                      <div className="text-sm font-semibold">Week {w}</div>
                      <div className="text-xs text-gray-600">
                        Courts:{" "}
                        <span className="font-medium">{courts.length}</span>
                      </div>
                    </div>
                    <div className="text-xs text-gray-600">
                      Division + net height required at each timeslot (no
                      teams).
                    </div>
                  </div>

                  <div className="bg-white p-4 grid grid-cols-1 md:grid-cols-2 gap-4">
                    {courts.map(({ venue, court }) => {
                      const courtKey = `${String(venue || "").trim()}||${String(
                        court || ""
                      ).trim()}`;
                      const byTime =
                        byCourt.get(courtKey) ||
                        new Map<string, { division: string; heightM: number }>();

                      return (
                        <div
                          key={courtKey}
                          className="rounded-xl border border-gray-200 overflow-hidden"
                        >
                          <div className="bg-gray-50 px-4 py-3 border-b border-gray-200">
                            <div className="text-sm font-medium">
                              {venue} ·{" "}
                              <span className="font-mono">{court}</span>
                            </div>
                          </div>

                          <div className="overflow-auto">
                            <table className="min-w-full text-sm">
                              <thead className="sticky top-0 bg-white">
                                <tr className="text-left text-xs text-gray-600 border-b border-gray-200">
                                  <th className="py-2 px-3">Time</th>
                                  <th className="py-2 px-3">Division</th>
                                  <th className="py-2 px-3">Net height</th>
                                </tr>
                              </thead>
                              <tbody>
                                {(timeslots || []).map((tRaw) => {
                                  const t = String(tRaw || "").trim(); // keep HH:MM for lookup
                                  const v = byTime.get(t);
                                  const slotKey = [
                                    w,
                                    String(venue).trim(),
                                    String(court).trim(),
                                    toHHMM(t),
                                  ].join("||");
                                  const isNetChangeRow =
                                    netChangeSlots.has(slotKey);

                                  return (
                                    <tr
                                      key={t}
                                      className={`border-t border-gray-100 hover:bg-gray-50 ${
                                        isNetChangeRow ? "bg-red-50" : ""
                                      }`}
                                    >
                                      <td className="py-2 px-3 font-mono">
                                        {formatTimeLabel(t)}
                                      </td>
                                      {!v ? (
                                        <>
                                          <td className="py-2 px-3 text-gray-400">
                                            -
                                          </td>
                                          <td className="py-2 px-3 text-gray-400">
                                            -
                                          </td>
                                        </>
                                      ) : (
                                        <>
                                          <td className="py-2 px-3 font-mono">
                                            {v.division}
                                          </td>
                                          <td className="py-2 px-3 font-mono">
                                            {v.heightM.toFixed(2)}m
                                          </td>
                                        </>
                                      )}
                                    </tr>
                                  );
                                })}
                              </tbody>
                            </table>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <ClashGroupsView
            weeks={Number(weeks)}
            schedule={schedule}
            clashes={clashes}
            displayName={displayName}
            timeslots={timeslots}
          />
        )}
      </div>
    </div>
  );
}