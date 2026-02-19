import React from "react";
import type { Division, DivisionGrid, DivisionStats, Match, SlotRow } from "../lib/types";
import { teamNum } from "../lib/ids";

export function PreviewPanel(props: {
  weeks: number;
  divisions: Division[];
  schedule: Match[];

  previewTab: "division" | "csv" | "grouped";
  setPreviewTab: (t: "division" | "csv" | "grouped") => void;

  divisionGrid: DivisionGrid;
  divisionStats: Map<string, DivisionStats>;
  slotRowsAll: SlotRow[];
  teamsByDivision: Map<string, string[]>;
  displayName: (id: string) => string;
  groupedByWeek: Map<number, Match[]>;
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
  } = props;

  const weekNums = Array.from({ length: Number(weeks) }, (_, i) => i + 1);

  return (
    <div className="mt-4 rounded-2xl border border-gray-200 overflow-hidden">
      <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between bg-white p-4 border-b border-gray-200">
        <div>
          <div className="text-sm font-medium">Schedule preview</div>
          <div className="text-xs text-gray-600">Pairings + BYEs (with venue/court/time placement)</div>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <div className="text-xs text-gray-600">Rows: {schedule.length}</div>
          <div className="flex gap-1">
            <button
              className={`rounded-lg px-2 py-1 text-xs border ${
                previewTab === "division" ? "bg-black text-white border-black" : "bg-white border-gray-300 hover:bg-gray-50"
              }`}
              onClick={() => setPreviewTab("division")}
            >
              By division
            </button>
            <button
              className={`rounded-lg px-2 py-1 text-xs border ${
                previewTab === "csv" ? "bg-black text-white border-black" : "bg-white border-gray-300 hover:bg-gray-50"
              }`}
              onClick={() => setPreviewTab("csv")}
            >
              Flat CSV
            </button>
            <button
              className={`rounded-lg px-2 py-1 text-xs border ${
                previewTab === "grouped" ? "bg-black text-white border-black" : "bg-white border-gray-300 hover:bg-gray-50"
              }`}
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
                const placedGames = (st.games || 0) - (st.unassigned || 0);
                if (placedGames === 0 && (st.byes || 0) === 0) return null;

                // hide slot rows that are empty across all weeks
                const slotRowsDiv = slotRowsAll.filter((r) => {
                  for (const w of weekNums) {
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
                          {`Games: ${st.games} · BYEs: ${st.byes}${st.unassigned ? ` · Unassigned: ${st.unassigned}` : ""}`}
                        </div>
                      </div>
                      <div className="text-xs text-gray-600">Weeks as columns, matches + BYE rows</div>
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
                                <th key={w} className="py-2 px-3">
                                  Week {w}
                                </th>
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
                              <td className="py-2 px-3" />
                              <td className="py-2 px-3" />
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
  );
}
