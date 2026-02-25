import React, { useEffect, useMemo, useState } from "react";
import type {
  Division,
  DivisionGrid,
  DivisionStats,
  Match,
  PreviewTabKey,
  SlotRow,
  TeamTimePrefs,
} from "../lib/types";
import { teamNum } from "../lib/ids";
import { computeNetHeightChanges } from "../lib/netHeights";
import { computeOpponentVariety } from "../lib/scheduling";
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
    (a, b) => b.teams.length - a.teams.length || a.id.localeCompare(b.id)
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
    if (!m.has(t)) m.set(t, "bg-gray-100 text-gray-900 border-gray-200");
  return m;
}

function TeamBadge(props: {
  label: string;
  className: string;
  title?: string;
}) {
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
  weekNums?: number[];
  schedule: Match[];
  clashes: Array<[string, string]>;
  displayName: (id: string) => string;
  timeslots: string[];
}) {
  const {
    weeks,
    weekNums: weekNumsProp,
    schedule,
    clashes,
    displayName,
    timeslots,
  } = props;

  const weekNums = weekNumsProp?.length
    ? weekNumsProp
    : Array.from({ length: Number(weeks) }, (_, i) => i + 1);

  const groups = useMemo(() => buildClashGroups(clashes), [clashes]);

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
                                    title={`${displayName(
                                      first
                                    )} vs ${displayName(second)}`}
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

// --- Opponent variety tab ----------------------------------------------------

function pct01(x: number, digits = 0) {
  const v = Number.isFinite(x) ? x : 0;
  return (v * 100).toFixed(digits) + "%";
}

function OpponentVarietyView(props: {
  schedule: Match[];
  teamsByDivision: Map<string, string[]>;
  displayName: (id: string) => string;
}) {
  const [expandedTeams, setExpandedTeams] = useState<Set<string>>(
    () => new Set()
  );

  function toggleExpanded(teamId: string) {
    setExpandedTeams((prev) => {
      const next = new Set(prev);
      if (next.has(teamId)) next.delete(teamId);
      else next.add(teamId);
      return next;
    });
  }
  const { schedule, teamsByDivision, displayName } = props;

  const data = useMemo(
    () => computeOpponentVariety({ schedule, teamsByDivision }),
    [schedule, teamsByDivision]
  );

  const overall = useMemo(() => {
    const ratios = (data.teams || []).map((r: any) =>
      Number(r.varietyRatio || 0)
    );
    const avg = ratios.length
      ? ratios.reduce((s: number, x: number) => s + x, 0) / ratios.length
      : 1;
    const min = ratios.length ? Math.min(...ratios) : 1;
    return { avg, min };
  }, [data.teams]);

  const rowsByDiv = useMemo(() => {
    const m = new Map<string, any[]>();
    for (const r of data.teams || []) {
      const d = String((r as any).division || "");
      if (!m.has(d)) m.set(d, []);
      m.get(d)!.push(r);
    }
    for (const [d, arr] of m.entries()) {
      arr.sort((a, b) => String(a.teamId).localeCompare(String(b.teamId)));
      m.set(d, arr);
    }
    return m;
  }, [data.teams]);

  return (
    <div className="space-y-6">
      <div className="rounded-2xl border border-gray-200 bg-white p-4">
        <div className="text-sm font-semibold">Opponent variety</div>
        <div className="mt-1 text-xs text-gray-600">
          Variety ={" "}
          <span className="font-mono">
            uniqueOpponents / min(gamesPlayed, teamsInDivision-1)
          </span>
          . 100% means the team achieved the maximum possible variety given
          their number of games.
        </div>

        <div className="mt-3 grid grid-cols-1 md:grid-cols-3 gap-3">
          <div className="rounded-xl border border-gray-200 p-3">
            <div className="text-xs text-gray-600">Overall average</div>
            <div className="text-lg font-semibold">{pct01(overall.avg, 0)}</div>
            <div className="mt-2 h-2 rounded bg-gray-100">
              <div
                className="h-2 rounded bg-black"
                style={{ width: pct01(overall.avg, 0) }}
              />
            </div>
          </div>

          <div className="rounded-xl border border-gray-200 p-3">
            <div className="text-xs text-gray-600">Worst team</div>
            <div className="text-lg font-semibold">{pct01(overall.min, 0)}</div>
            <div className="mt-2 h-2 rounded bg-gray-100">
              <div
                className="h-2 rounded bg-black"
                style={{ width: pct01(overall.min, 0) }}
              />
            </div>
          </div>

          <div className="rounded-xl border border-gray-200 p-3">
            <div className="text-xs text-gray-600">Tip</div>
            <div className="text-xs text-gray-700 mt-1">
              Lower scores = repeated opponents (what you want to minimise).
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {(data.byDivision || []).map((s: any) => (
          <div
            key={s.division}
            className="rounded-2xl border border-gray-200 bg-white p-4"
          >
            <div className="flex items-center justify-between">
              <div className="text-sm font-semibold">{s.division}</div>
              <div className="text-xs text-gray-600">
                Teams: <span className="font-medium">{s.teams}</span> · Possible
                opponents/team: {s.possibleOpponents}
              </div>
            </div>

            <div className="mt-2 grid grid-cols-3 gap-2 text-sm">
              <div>
                <div className="text-xs text-gray-600">Avg</div>
                <div className="font-semibold">
                  {pct01(s.avgVarietyRatio, 0)}
                </div>
              </div>
              <div>
                <div className="text-xs text-gray-600">Min</div>
                <div className="font-semibold">
                  {pct01(s.minVarietyRatio, 0)}
                </div>
              </div>
              <div>
                <div className="text-xs text-gray-600">Max</div>
                <div className="font-semibold">
                  {pct01(s.maxVarietyRatio, 0)}
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>

      <div className="overflow-auto rounded-2xl border border-gray-200 bg-white">
        <table className="min-w-[900px] w-full text-sm">
          <thead className="sticky top-0 bg-white">
            <tr className="text-left text-xs text-gray-600 border-b border-gray-200">
              <th className="py-2 px-3">Division</th>
              <th className="py-2 px-3">Team</th>
              <th className="py-2 px-3">Games</th>
              <th className="py-2 px-3">Unique opp.</th>
              <th className="py-2 px-3">Max unique</th>
              <th className="py-2 px-3">Variety</th>
              <th className="py-2 px-3">Repeats</th>
              <th className="py-2 px-3">Opponents</th>
            </tr>
          </thead>

          <tbody>
            {Array.from(rowsByDiv.entries())
              .sort(([a], [b]) => a.localeCompare(b))
              .flatMap(([div, rows]) =>
                (rows || []).map((r: any) => {
                  const variety = Number(r.varietyRatio || 0);
                  const repeats = Number(r.repeatGames || 0);
                  const repeatOpps = (r.opponentCounts || []).filter(
                    (x: any) => Number(x.count) > 1
                  );

                  const isExpanded = expandedTeams.has(r.teamId);
                  const oppsAll = r.opponentCounts || [];
                  const oppsShown = isExpanded ? oppsAll : oppsAll.slice(0, 8);

                  return (
                    <tr
                      key={r.teamId}
                      className="border-t border-gray-100 hover:bg-gray-50 align-top"
                    >
                      <td className="py-2 px-3 font-mono">{div}</td>

                      <td className="py-2 px-3">
                        <div className="font-mono">{r.teamId}</div>
                        <div className="text-xs text-gray-600">
                          {teamNum(r.teamId)}. {displayName(r.teamId)}
                        </div>
                      </td>

                      <td className="py-2 px-3 font-mono">{r.games}</td>
                      <td className="py-2 px-3 font-mono">
                        {r.uniqueOpponents}
                      </td>
                      <td className="py-2 px-3 font-mono">
                        {r.maxUniquePossible}
                      </td>

                      <td className="py-2 px-3">
                        <div className="font-mono">{pct01(variety, 0)}</div>
                        <div className="mt-1 h-2 rounded bg-gray-100">
                          <div
                            className="h-2 rounded bg-black"
                            style={{ width: pct01(variety, 0) }}
                          />
                        </div>
                      </td>

                      <td className="py-2 px-3">
                        <div className="font-mono">{repeats}</div>
                        {repeatOpps.length > 0 ? (
                          <div className="mt-1 flex flex-wrap gap-1">
                            {repeatOpps.slice(0, 4).map((x: any) => (
                              <span
                                key={x.opponent}
                                className="inline-flex items-center rounded-full border border-gray-300 bg-white px-2 py-0.5 text-[11px] font-mono"
                                title={`${displayName(
                                  r.teamId
                                )} played ${displayName(x.opponent)} ${
                                  x.count
                                } times`}
                              >
                                {x.opponent}×{x.count}
                              </span>
                            ))}
                          </div>
                        ) : (
                          <div className="mt-1 text-xs text-gray-500">—</div>
                        )}
                      </td>

                      <td className="py-2 px-3">
                        {oppsAll.length === 0 ? (
                          <div className="text-xs text-gray-500">—</div>
                        ) : (
                          <>
                            <div className="flex flex-wrap gap-1">
                              {oppsShown.map((x: any) => (
                                <span
                                  key={x.opponent}
                                  className="inline-flex items-center rounded-full border border-gray-300 bg-white px-2 py-0.5 text-[11px] font-mono"
                                  title={`${displayName(
                                    r.teamId
                                  )} played ${displayName(x.opponent)} ${
                                    x.count
                                  } time(s)`}
                                >
                                  {x.opponent}×{x.count}
                                </span>
                              ))}
                              {!isExpanded &&
                              oppsAll.length > oppsShown.length ? (
                                <span className="text-[11px] text-gray-500">
                                  +{oppsAll.length - oppsShown.length} more
                                </span>
                              ) : null}
                            </div>

                            {oppsAll.length > 8 ? (
                              <button
                                type="button"
                                className="mt-2 text-[11px] text-blue-700 hover:underline"
                                onClick={() => toggleExpanded(r.teamId)}
                              >
                                {isExpanded ? "Show less" : "Show all"}
                              </button>
                            ) : null}
                          </>
                        )}
                      </td>
                    </tr>
                  );
                })
              )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export function PreviewPanel(props: {
  weeks: number;
  divisions: Division[];
  schedule: Match[];

  previewTab: PreviewTabKey;
  setPreviewTab: React.Dispatch<React.SetStateAction<PreviewTabKey>>;

  divisionGrid: DivisionGrid;
  divisionStats: Map<string, DivisionStats>;
  slotRowsAll: SlotRow[];
  teamsByDivision: Map<string, string[]>;
  displayName: (id: string) => string;
  groupedByWeek: Map<number, Match[]>;
  timeslots: string[];
  teamTimePrefs: TeamTimePrefs;

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
    teamTimePrefs,
  } = props;

  const PAGE_SIZE = 5;
  const [weekPage, setWeekPage] = useState(0);
  const [hoverTeamId, setHoverTeamId] = useState<string | null>(null);

  const totalWeeks = Number(weeks) || 0;
  const totalPages = Math.max(1, Math.ceil(totalWeeks / PAGE_SIZE));

  const allWeekNums = useMemo(
    () => Array.from({ length: totalWeeks }, (_, i) => i + 1),
    [totalWeeks]
  );

  const visibleWeekNums = useMemo(() => {
    const start = weekPage * PAGE_SIZE + 1; // 1-based week number
    const end = Math.min(totalWeeks, start + PAGE_SIZE - 1);
    if (totalWeeks <= 0) return [];
    return Array.from({ length: end - start + 1 }, (_, i) => start + i);
  }, [weekPage, totalWeeks]);

  const visibleWeekCols = useMemo(() => {
    if (totalWeeks <= 0) return [];
    const cols: Array<number | null> = [...visibleWeekNums];

    // keep 5 columns wide on the last page (if roster is >= 5 weeks)
    if (totalWeeks >= PAGE_SIZE) {
      while (cols.length < PAGE_SIZE) cols.push(null);
    }
    return cols;
  }, [visibleWeekNums, totalWeeks, PAGE_SIZE]);

  // Keep weekPage valid if weeks changes (e.g. import JSON, change weeks)
  useEffect(() => {
    setWeekPage((p) => Math.min(p, Math.max(0, totalPages - 1)));
  }, [totalPages]);

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

    out.sort((a, b) => (a.venue + a.court).localeCompare(b.venue + b.court));
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

  const timePrefStats = React.useMemo(() => {
    const prefs = teamTimePrefs || {};

    // team -> Set(times they played)
    const playedByTeam = new Map<string, Set<string>>();
    const addPlayed = (teamId: string, time: string) => {
      if (!teamId || !time) return;
      if (!playedByTeam.has(teamId)) playedByTeam.set(teamId, new Set());
      playedByTeam.get(teamId)!.add(time);
    };

    for (const m of schedule || []) {
      if (!m || m.away === "BYE") continue;
      const time = String(m.time || "").trim();
      if (!time) continue; // ignore unassigned
      addPlayed(String(m.home || "").trim(), time);
      addPlayed(String(m.away || "").trim(), time);
    }

    let totalPrefs = 0;
    let teamsWithPrefs = 0;
    let perfectTeams = 0;

    let preferredTotal = 0,
      preferredHit = 0;

    let notPrefTotal = 0,
      notPrefOk = 0,
      notPrefViol = 0;

    let unavailTotal = 0,
      unavailOk = 0,
      unavailViol = 0;

    for (const [teamId, cfg] of Object.entries(prefs)) {
      const preferred = (cfg.preferred || []).map(String);
      const notPreferred = (cfg.notPreferred || []).map(String);
      const unavailable = (cfg.unavailable || []).map(String);

      const hasAny =
        preferred.length + notPreferred.length + unavailable.length > 0;
      if (!hasAny) continue;

      teamsWithPrefs += 1;
      totalPrefs += preferred.length + notPreferred.length + unavailable.length;

      const played = playedByTeam.get(teamId) || new Set<string>();

      const pHit = preferred.filter((t) => played.has(t)).length;
      const pMiss = preferred.length - pHit;

      const npViol = notPreferred.filter((t) => played.has(t)).length;
      const npOk = notPreferred.length - npViol;

      const uViol = unavailable.filter((t) => played.has(t)).length;
      const uOk = unavailable.length - uViol;

      preferredTotal += preferred.length;
      preferredHit += pHit;

      notPrefTotal += notPreferred.length;
      notPrefOk += npOk;
      notPrefViol += npViol;

      unavailTotal += unavailable.length;
      unavailOk += uOk;
      unavailViol += uViol;

      const isPerfect = pMiss === 0 && npViol === 0 && uViol === 0;
      if (isPerfect) perfectTeams += 1;
    }

    return {
      totalPrefs,
      teamsWithPrefs,
      perfectTeams,
      preferredTotal,
      preferredHit,
      notPrefTotal,
      notPrefOk,
      notPrefViol,
      unavailTotal,
      unavailOk,
      unavailViol,
    };
  }, [schedule, teamTimePrefs]);

  const timePrefGrid = React.useMemo(() => {
    // teamId -> week -> string[] (times)
    const map = new Map<string, Map<number, string[]>>();

    const push = (teamId: string, week: number, time: string) => {
      if (!teamId || !week || !time) return;
      if (!map.has(teamId)) map.set(teamId, new Map());
      const byWeek = map.get(teamId)!;
      if (!byWeek.has(week)) byWeek.set(week, []);
      byWeek.get(week)!.push(time);
    };

    for (const m of schedule || []) {
      if (!m || m.away === "BYE") continue;
      const week = Number(m.week || 0);
      const time = String(m.time || "").trim();
      if (!week || !time) continue; // ignore unassigned
      push(String(m.home || "").trim(), week, time);
      push(String(m.away || "").trim(), week, time);
    }

    // Build team list: only teams that have any prefs
    const teams = Object.entries(teamTimePrefs || {})
      .filter(([_, cfg]) => {
        const p = (cfg.preferred || []).length;
        const n = (cfg.notPreferred || []).length;
        const u = (cfg.unavailable || []).length;
        return p + n + u > 0;
      })
      .map(([teamId]) => teamId)
      .sort((a, b) => displayName(a).localeCompare(displayName(b)));

    return { map, teams };
  }, [schedule, teamTimePrefs, displayName]);

  type TimePrefOutcome = "green" | "yellow" | "orange" | "red";

  function evalWeekOutcome(
    teamId: string,
    times: string[]
  ): {
    outcome: TimePrefOutcome;
    cls: string;
    debug?: any;
  } {
    const cfg = teamTimePrefs?.[teamId] || {};

    const preferred = new Set(
      (cfg.preferred || []).map((t) => toHHMM(String(t).trim())).filter(Boolean)
    );
    const notPreferred = new Set(
      (cfg.notPreferred || [])
        .map((t) => toHHMM(String(t).trim()))
        .filter(Boolean)
    );
    const unavailable = new Set(
      (cfg.unavailable || [])
        .map((t) => toHHMM(String(t).trim()))
        .filter(Boolean)
    );

    const normTimes = (times || [])
      .map((t) => toHHMM(String(t).trim()))
      .filter(Boolean);

    let hitPreferred = false;
    let hitNotPreferred = false;
    let hitUnavailable = false;

    for (const t of normTimes) {
      if (unavailable.has(t)) hitUnavailable = true;
      else if (notPreferred.has(t)) hitNotPreferred = true;
      else if (preferred.has(t)) hitPreferred = true;
    }

    // Priority: red > orange > green > yellow
    let outcome: TimePrefOutcome = "yellow";
    if (hitUnavailable) outcome = "red";
    else if (hitNotPreferred) outcome = "orange";
    else if (hitPreferred) outcome = "green";
    else outcome = "yellow";

    const cls =
      outcome === "red"
        ? "bg-red-200 text-red-900"
        : outcome === "orange"
        ? "bg-orange-200 text-orange-900"
        : outcome === "green"
        ? "bg-green-200 text-green-900"
        : "bg-yellow-100 text-yellow-900";

    return {
      outcome,
      cls,
      debug: {
        normTimes,
        preferred: Array.from(preferred),
        notPreferred: Array.from(notPreferred),
        unavailable: Array.from(unavailable),
        hitPreferred,
        hitNotPreferred,
        hitUnavailable,
      },
    };
  }

  const CHIP = {
    preferred: "bg-blue-50 text-blue-900 border-blue-200",
    notPreferred: "bg-purple-50 text-purple-900 border-purple-200", // or gray
    unavailable: "bg-slate-100 text-slate-900 border-slate-300", // or bg-black/ text-white if you want harsh
  } as const;

  function plainChips(items: string[]) {
    if (!items.length) return <span className="text-xs text-gray-400">—</span>;
    return (
      <div className="flex flex-wrap gap-1">
        {items.map((t) => (
          <span
            key={t}
            className="inline-flex items-center rounded-full border border-gray-300 bg-white px-2 py-0.5 text-[11px] font-mono text-gray-800"
          >
            {t}
          </span>
        ))}
      </div>
    );
  }

  return (
    <div className="mt-4 rounded-2xl border border-gray-200 overflow-hidden">
      <div className="flex flex-col gap-2 md:flex-row md:items-start md:justify-between bg-white p-4 border-b border-gray-200">
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

            <button
              className={`rounded-lg px-3 py-1 text-xs border ${
                previewTab === "variety"
                  ? "bg-black text-white border-black"
                  : "bg-white border-gray-300 hover:bg-gray-50"
              }`}
              onClick={() => setPreviewTab("variety")}
              title="How often teams repeat opponents"
            >
              Opponent variety
            </button>

            <button
              className={`rounded-lg px-3 py-1 text-xs border ${
                previewTab === "timeprefs"
                  ? "bg-black text-white border-black"
                  : "bg-white border-gray-300 hover:bg-gray-50"
              }`}
              onClick={() => setPreviewTab("timeprefs")}
              title="Show clash groups and each group's games by week/time"
            >
              Time Prefs
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

        {totalWeeks > PAGE_SIZE ? (
          <div className="shrink-0 self-start md:ml-4">
            <div className="grid grid-cols-[76px_76px_170px] items-center gap-2">
              <button
                className="w-[76px] rounded-lg px-3 py-1 text-xs border bg-white border-gray-300 hover:bg-gray-50 disabled:opacity-40"
                disabled={weekPage === 0}
                onClick={() => setWeekPage((p) => Math.max(0, p - 1))}
                type="button"
              >
                Prev
              </button>

              <button
                className="w-[76px] rounded-lg px-3 py-1 text-xs border bg-white border-gray-300 hover:bg-gray-50 disabled:opacity-40"
                disabled={weekPage >= totalPages - 1}
                onClick={() =>
                  setWeekPage((p) => Math.min(totalPages - 1, p + 1))
                }
                type="button"
              >
                Next
              </button>

              <div className="w-[170px] text-right text-xs text-gray-600 whitespace-nowrap font-mono tabular-nums">
                Weeks {visibleWeekNums[0] ?? 0}–
                {visibleWeekNums[visibleWeekNums.length - 1] ?? 0} of{" "}
                {totalWeeks}
              </div>
            </div>
          </div>
        ) : null}
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
                  for (const w of allWeekNums) {
                    const cell = byWeek.get(w);
                    if (cell && cell.bySlot && cell.bySlot.get(r.key))
                      return true;
                  }
                  return false;
                });

                const hoverId =
                  hoverTeamId &&
                  (teamsByDivision.get(div) || []).includes(hoverTeamId)
                    ? hoverTeamId
                    : null;

                const rowHasTeam = new Set<string>(); // slotRow key
                const colHasTeam = new Set<number>(); // week number
                const byeHasTeam = new Set<number>(); // week number where this team is BYE

                if (hoverId) {
                  for (const w of visibleWeekCols) {
                    if (!w) continue;
                    const cell = byWeek.get(w);
                    if (!cell) continue;

                    if (cell.bye === hoverId) {
                      colHasTeam.add(w);
                      byeHasTeam.add(w);
                    }

                    for (const [slotKey, p] of (
                      cell.bySlot || new Map()
                    ).entries()) {
                      if (!p) continue;
                      if (p.home === hoverId || p.away === hoverId) {
                        rowHasTeam.add(slotKey);
                        colHasTeam.add(w);
                      }
                    }
                  }
                }

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
                        {(teamsByDivision.get(div) || []).map((id) => {
                          const active = hoverTeamId === id;
                          return (
                            <div
                              key={id}
                              onMouseEnter={() => setHoverTeamId(id)}
                              className={`text-xs rounded px-1 py-0.5 cursor-pointer ${
                                active ? "bg-yellow-100" : "hover:bg-yellow-50"
                              }`}
                              title="Hover to highlight this team in the grid"
                            >
                              <span className="font-mono font-semibold">
                                {teamNum(id)}.
                              </span>{" "}
                              <span>{displayName(id)}</span>
                            </div>
                          );
                        })}
                      </div>

                      <div
                        className="overflow-auto rounded-xl border border-gray-200"
                        onMouseLeave={() => setHoverTeamId(null)}
                      >
                        <table className="min-w-[980px] w-full text-sm table-fixed">
                          <colgroup>
                            <col style={{ width: 220 }} /> {/* Venue */}
                            <col style={{ width: 90 }} /> {/* Court */}
                            <col style={{ width: 90 }} /> {/* Time */}
                            {visibleWeekCols.map((w, i) => (
                              <col
                                key={w ?? `empty-${i}`}
                                style={{ width: 120 }}
                              />
                            ))}
                          </colgroup>

                          <thead className="sticky top-0 bg-white">
                            <tr className="text-left text-xs text-gray-600 border-b border-gray-200">
                              <th className="py-2 px-3">Venue</th>
                              <th className="py-2 px-3">Court</th>
                              <th className="py-2 px-3">Time</th>
                              {visibleWeekCols.map((w, i) => (
                                <th
                                  key={w ?? `empty-${i}`}
                                  className={`py-2 px-3 font-mono tabular-nums ${
                                    w && hoverId && colHasTeam.has(w)
                                      ? "bg-yellow-50"
                                      : ""
                                  }`}
                                >
                                  {w ? `Week ${w}` : ""}
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
                                <td
                                  className={`py-2 px-3 text-xs font-medium text-gray-800 truncate ${
                                    hoverId && rowHasTeam.has(r.key)
                                      ? "bg-yellow-50"
                                      : ""
                                  }`}
                                >
                                  {r.venue}
                                </td>
                                <td
                                  className={`py-2 px-3 font-mono ${
                                    hoverId && rowHasTeam.has(r.key)
                                      ? "bg-yellow-50"
                                      : ""
                                  }`}
                                >
                                  {r.court}
                                </td>
                                <td
                                  className={`py-2 px-3 font-mono ${
                                    hoverId && rowHasTeam.has(r.key)
                                      ? "bg-yellow-50"
                                      : ""
                                  }`}
                                >
                                  {r.time}
                                </td>

                                {visibleWeekCols.map((w, i) => {
                                  const rowHighlight = !!(
                                    hoverId && rowHasTeam.has(r.key)
                                  );
                                  const colHighlight = !!(
                                    w &&
                                    hoverId &&
                                    colHasTeam.has(w)
                                  );

                                  if (!w) {
                                    return (
                                      <td
                                        key={`empty-${i}`}
                                        className={`py-2 px-3 text-gray-200 ${
                                          rowHighlight ? "bg-yellow-50" : ""
                                        }`}
                                      >
                                        &nbsp;
                                      </td>
                                    );
                                  }

                                  const cell = byWeek.get(w) || {
                                    bySlot: new Map(),
                                    bye: null,
                                  };
                                  const p = cell.bySlot.get(r.key);

                                  if (!p) {
                                    return (
                                      <td
                                        key={w}
                                        className={`py-2 px-3 text-gray-400 font-mono tabular-nums transition-colors ${
                                          rowHighlight || colHighlight
                                            ? "bg-yellow-50"
                                            : ""
                                        }`}
                                      >
                                        -
                                      </td>
                                    );
                                  }

                                  const cellHasTeam = !!(
                                    hoverId &&
                                    (p.home === hoverId || p.away === hoverId)
                                  );

                                  const tip = `${displayName(
                                    p.home
                                  )} vs ${displayName(p.away)}`;

                                  return (
                                    <td
                                      key={w}
                                      className={`py-2 px-3 font-mono tabular-nums transition-colors ${
                                        rowHighlight || colHighlight
                                          ? "bg-yellow-50"
                                          : ""
                                      } ${
                                        cellHasTeam
                                          ? "bg-yellow-200 font-semibold"
                                          : ""
                                      }`}
                                      title={tip}
                                    >
                                      <span
                                        className={`cursor-pointer rounded px-1 ${
                                          hoverTeamId === p.home
                                            ? "bg-yellow-300"
                                            : "hover:bg-yellow-100"
                                        }`}
                                        onMouseEnter={() =>
                                          setHoverTeamId(p.home)
                                        }
                                      >
                                        {teamNum(p.home)}
                                      </span>
                                      <span className="text-gray-500"> v </span>
                                      <span
                                        className={`cursor-pointer rounded px-1 ${
                                          hoverTeamId === p.away
                                            ? "bg-yellow-300"
                                            : "hover:bg-yellow-100"
                                        }`}
                                        onMouseEnter={() =>
                                          setHoverTeamId(p.away)
                                        }
                                      >
                                        {teamNum(p.away)}
                                      </span>
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

                              {visibleWeekCols.map((w, i) => {
                                if (!w) {
                                  return (
                                    <td
                                      key={`empty-bye-${i}`}
                                      className="py-2 px-3 text-gray-200"
                                    >
                                      &nbsp;
                                    </td>
                                  );
                                }

                                const colHighlight = !!(
                                  hoverId && colHasTeam.has(w)
                                );
                                const cellHasTeam = !!(
                                  hoverId && byeHasTeam.has(w)
                                );

                                const cell = byWeek.get(w) || {
                                  bySlot: new Map(),
                                  bye: null,
                                };

                                if (!cell.bye) {
                                  return (
                                    <td
                                      key={w}
                                      className={`py-2 px-3 text-gray-400 font-mono tabular-nums ${
                                        colHighlight ? "bg-yellow-50" : ""
                                      }`}
                                    >
                                      -
                                    </td>
                                  );
                                }

                                return (
                                  <td
                                    key={w}
                                    className={`py-2 px-3 font-mono tabular-nums ${
                                      colHighlight ? "bg-yellow-50" : ""
                                    } ${
                                      cellHasTeam
                                        ? "bg-yellow-200 font-semibold"
                                        : ""
                                    }`}
                                    title={displayName(cell.bye)}
                                  >
                                    <span
                                      className={`cursor-pointer rounded px-1 ${
                                        hoverTeamId === cell.bye
                                          ? "bg-yellow-300"
                                          : "hover:bg-yellow-100"
                                      }`}
                                      onMouseEnter={() =>
                                        setHoverTeamId(cell.bye)
                                      }
                                    >
                                      {teamNum(cell.bye)}
                                    </span>
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
            {visibleWeekNums.map((w) => {
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
                        new Map<
                          string,
                          { division: string; heightM: number }
                        >();

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
        ) : previewTab === "variety" ? (
          <OpponentVarietyView
            schedule={schedule}
            teamsByDivision={teamsByDivision}
            displayName={displayName}
          />
        ) : previewTab === "timeprefs" ? (
          <div className="space-y-4">
            <div className="grid gap-3 sm:grid-cols-3">
              <div className="rounded-xl border border-gray-200 bg-white p-3">
                <div className="text-xs text-gray-600">Total preferences</div>
                <div className="text-2xl font-semibold">
                  {timePrefStats.totalPrefs}
                </div>
              </div>

              <div className="rounded-xl border border-gray-200 bg-white p-3">
                <div className="text-xs text-gray-600">
                  Teams with preferences
                </div>
                <div className="text-2xl font-semibold">
                  {timePrefStats.teamsWithPrefs}
                </div>
              </div>

              <div className="rounded-xl border border-gray-200 bg-white p-3">
                <div className="text-xs text-gray-600">Perfectly fulfilled</div>
                <div className="text-2xl font-semibold">
                  {timePrefStats.perfectTeams}
                </div>
              </div>
            </div>

            <div className="grid gap-3 sm:grid-cols-3">
              <div className="rounded-xl border border-gray-200 bg-white p-3">
                <div className="text-xs text-gray-600">Preferred satisfied</div>
                <div className="text-sm font-medium">
                  {timePrefStats.preferredHit} / {timePrefStats.preferredTotal}
                </div>
              </div>

              <div className="rounded-xl border border-gray-200 bg-white p-3">
                <div className="text-xs text-gray-600">
                  Not preferred avoided
                </div>
                <div className="text-sm font-medium">
                  {timePrefStats.notPrefOk} / {timePrefStats.notPrefTotal}
                </div>
                <div className="text-[11px] text-gray-500">
                  violations: {timePrefStats.notPrefViol}
                </div>
              </div>

              <div className="rounded-xl border border-gray-200 bg-white p-3">
                <div className="text-xs text-gray-600">
                  Unavailable respected
                </div>
                <div className="text-sm font-medium">
                  {timePrefStats.unavailOk} / {timePrefStats.unavailTotal}
                </div>
                <div className="text-[11px] text-gray-500">
                  violations: {timePrefStats.unavailViol}
                </div>
              </div>
            </div>

            <div className="text-xs text-gray-500">
              *Counts ignore unassigned games (no time). Preferred is satisfied
              when the team is scheduled at that time at least once.
            </div>

            <div className="mt-3 flex flex-wrap gap-2 text-xs">
              <span className="inline-flex items-center gap-2 rounded-full border border-gray-200 bg-white px-3 py-1">
                <span className="h-3 w-3 rounded bg-green-200 border border-green-300" />
                Preferred met
              </span>
              <span className="inline-flex items-center gap-2 rounded-full border border-gray-200 bg-white px-3 py-1">
                <span className="h-3 w-3 rounded bg-yellow-100 border border-yellow-300" />
                Neutral
              </span>
              <span className="inline-flex items-center gap-2 rounded-full border border-gray-200 bg-white px-3 py-1">
                <span className="h-3 w-3 rounded bg-orange-200 border border-orange-300" />
                Not pref violated
              </span>
              <span className="inline-flex items-center gap-2 rounded-full border border-gray-200 bg-white px-3 py-1">
                <span className="h-3 w-3 rounded bg-red-200 border border-red-300" />
                Unavailable violated
              </span>
            </div>

            <div className="mt-4 overflow-auto rounded-xl border border-gray-200 bg-white">
              <table className="min-w-[980px] w-full text-sm table-fixed">
                <colgroup>
                  <col style={{ width: 150 }} /> {/* Team */}
                  <col style={{ width: 80 }} /> {/* Pref */}
                  {visibleWeekCols.map((w, i) => (
                    <col key={w ?? `empty-${i}`} style={{ width: 120 }} />
                  ))}
                </colgroup>

                <thead className="sticky top-0 bg-white">
                  <tr className="text-left text-xs text-gray-600 border-b border-gray-200">
                    <th className="py-2 px-3">Team</th>
                    <th className="py-2 px-3">Preferences</th>
                    {visibleWeekCols.map((w, i) => (
                      <th
                        key={w ?? `empty-${i}`}
                        className="py-2 px-3 font-mono tabular-nums"
                      >
                        {w ? `Week ${w}` : ""}
                      </th>
                    ))}
                  </tr>
                </thead>

                <tbody>
                  {timePrefGrid.teams.map((teamId) => (
                    <tr
                      key={teamId}
                      className="border-t border-gray-100 align-top"
                    >
                      <td className="py-2 px-3">
                        <div className="font-mono text-xs">{teamId}</div>
                        <div className="text-xs text-gray-700">
                          {displayName(teamId)}
                        </div>
                      </td>
                      {(() => {
                        const cfg = teamTimePrefs?.[teamId] || {};
                        const preferred = (cfg.preferred || []).map(String);
                        const notPreferred = (cfg.notPreferred || []).map(
                          String
                        );
                        const unavailable = (cfg.unavailable || []).map(String);

                        return (
                          <>
                            <td className="py-2 px-3">
                              {plainChips(preferred)}
                              {plainChips(notPreferred)}
                              {plainChips(unavailable)}
                            </td>
                          </>
                        );
                      })()}

                      {visibleWeekCols.map((w, i) => {
                        if (!w) {
                          return (
                            <td
                              key={`empty-${i}`}
                              className="py-2 px-3 text-gray-200"
                            >
                              &nbsp;
                            </td>
                          );
                        }

                        const times =
                          timePrefGrid.map.get(teamId)?.get(w) || [];
                        if (!times.length) {
                          return (
                            <td
                              key={w}
                              className="py-2 px-3 text-gray-400 font-mono"
                            >
                              -
                            </td>
                          );
                        }

                        const s = evalWeekOutcome(teamId, times);

                        return (
                          <td key={w} className="py-2 px-3">
                            <div className={`rounded-lg p-2 ${s.cls}`}>
                              <div className="flex flex-col gap-1">
                                {times.map((t, idx) => (
                                  <div
                                    key={t + ":" + idx}
                                    className="rounded-md bg-white/40 px-2 py-1 text-xs font-mono"
                                  >
                                    {t}
                                  </div>
                                ))}
                              </div>
                            </div>
                          </td>
                        );
                      })}
                    </tr>
                  ))}

                  {!timePrefGrid.teams.length && (
                    <tr>
                      <td
                        className="py-3 px-3 text-xs text-gray-500"
                        colSpan={4 + visibleWeekCols.length}
                      >
                        No teams have time preferences yet.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        ) : (
          <ClashGroupsView
            weeks={Number(weeks)}
            weekNums={visibleWeekNums}
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
