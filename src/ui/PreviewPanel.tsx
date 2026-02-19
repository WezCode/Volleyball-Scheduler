import React, { useMemo } from "react";
import type {
  Division,
  DivisionGrid,
  DivisionStats,
  Match,
  SlotRow,
} from "../lib/types";
import { teamNum } from "../lib/ids";
import { computeNetHeightChanges } from "../lib/netHeights";

export function PreviewPanel(props: {
  weeks: number;
  divisions: Division[];
  schedule: Match[];

  previewTab: "division" | "netheights";
  setPreviewTab: React.Dispatch<
    React.SetStateAction<"division" | "netheights">
  >;

  divisionGrid: DivisionGrid;
  divisionStats: Map<string, DivisionStats>;
  slotRowsAll: SlotRow[];
  teamsByDivision: Map<string, string[]>;
  displayName: (id: string) => string;
  groupedByWeek: Map<number, Match[]>;
  timeslots: string[];
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
  } = props;

  const weekNums = Array.from({ length: Number(weeks) }, (_, i) => i + 1);

  const netChanges = useMemo(
    () => computeNetHeightChanges({ schedule, divisions, timeslots }),
    [schedule, divisions, timeslots]
  );

  const heightByDivision = useMemo(() => {
    const m = new Map<string, number>();
    for (const d of divisions || []) {
      m.set(String(d.code), Number((d as any).netHeightM));
    }
    return m;
  }, [divisions]);

  console.log("division sample:", divisions[0]);
  console.log(
    "division keys:",
    divisions[0] ? Object.keys(divisions[0] as any) : null
  );

  console.log("heightByDivision:", Array.from(heightByDivision.entries()));
  console.log(
    "first match division:",
    schedule[0]?.division,
    "height lookup:",
    heightByDivision.get(schedule[0]?.division)
  );

  const courts = useMemo(() => {
    const seen = new Set<string>();
    const out: { venue: string; court: string }[] = [];

    for (const m of schedule || []) {
      const venue = String(m.venue || "").trim();
      const court = String(m.court || "").trim();
      if (!venue || !court) continue;

      const k = `${venue}||${court}`;
      if (seen.has(k)) continue;
      seen.add(k);

      out.push({ venue, court });
    }

    out.sort((a, b) => (a.venue + a.court).localeCompare(b.venue + b.court));
    return out;
  }, [schedule]);

  const planByWeekCourt = useMemo(() => {
    // week -> venue||court -> time -> {division,heightM}
    const out = new Map<
      number,
      Map<string, Map<string, { division: string; heightM: number }>>
    >();

    for (const m of schedule as any[]) {
      const week = Number(m.week);
      const venue = String(m.venue || "").trim();
      const court = String(m.court || "").trim();
      const time = String(m.time || "").trim();
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

  return (
    <div className="mt-4 rounded-2xl border border-gray-200 overflow-hidden">
      <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between bg-white p-4 border-b border-gray-200">
        <div>
          <div className="text-sm font-medium">Schedule preview</div>
          <div className="text-xs text-gray-600">
            Pairings + BYEs (with venue/court/time placement)
          </div>
          <div className="mt-3 rounded-xl border border-gray-200 bg-white p-3">
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

              <span className="ml-auto flex items-center gap-2">
                <span className="text-gray-600">
                  Total:{" "}
                  <span className="font-semibold text-gray-900">
                    {netChanges.totalChanges}
                  </span>
                </span>

                <button
                  className={`rounded-lg px-2 py-1 text-xs border ${
                    previewTab === "netheights"
                      ? "bg-black text-white border-black"
                      : "bg-white border-gray-300 hover:bg-gray-50"
                  }`}
                  onClick={() =>
                    setPreviewTab(
                      previewTab === "netheights" ? "division" : "netheights"
                    )
                  }
                  title="Show where net height changes happen"
                >
                  {previewTab === "netheights" ? "Back" : "Net changes"}
                </button>
              </span>
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
                                  <div className="text-sm font-semibold">
                                    Week {w}
                                  </div>
                                  <div className="text-xs text-gray-600">
                                    Courts:{" "}
                                    <span className="font-medium">
                                      {courts.length}
                                    </span>
                                  </div>
                                </div>
                                <div className="text-xs text-gray-600">
                                  Division + net height required at each
                                  timeslot (no teams).
                                </div>
                              </div>

                              <div className="bg-white p-4 grid grid-cols-1 md:grid-cols-2 gap-4">
                                {courts.map(({ venue, court }) => {
                                  const courtKey = `${String(
                                    venue || ""
                                  ).trim()}||${String(court || "").trim()}`;
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
                                          <span className="font-mono">
                                            {court}
                                          </span>
                                        </div>
                                      </div>

                                      <div className="overflow-auto">
                                        <table className="min-w-full text-sm">
                                          <thead className="sticky top-0 bg-white">
                                            <tr className="text-left text-xs text-gray-600 border-b border-gray-200">
                                              <th className="py-2 px-3">
                                                Time
                                              </th>
                                              <th className="py-2 px-3">
                                                Division
                                              </th>
                                              <th className="py-2 px-3">
                                                Net height
                                              </th>
                                            </tr>
                                          </thead>
                                          <tbody>
                                            {(timeslots || []).map((tRaw) => {
                                              const t = String(
                                                tRaw || ""
                                              ).trim();
                                              const v = byTime.get(t);

                                              return (
                                                <tr
                                                  key={t}
                                                  className="border-t border-gray-100 hover:bg-gray-50"
                                                >
                                                  <td className="py-2 px-3 font-mono">
                                                    {t}
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
                    </div>
                  </div>
                );
              })}
          </div>
        ) : (
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
                                  const t = String(tRaw || "").trim();
                                  const v = byTime.get(t);

                                  return (
                                    <tr
                                      key={t}
                                      className="border-t border-gray-100 hover:bg-gray-50"
                                    >
                                      <td className="py-2 px-3 font-mono">
                                        {t}
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
        )}
      </div>
    </div>
  );
}
