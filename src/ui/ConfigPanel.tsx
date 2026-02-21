import React from "react";
import type { ClashRow, Division, Venue, TeamTimePrefs } from "../lib/types";

export function ConfigPanel(props: {
  weeks: number;
  setWeeks: (n: number) => void;

  timeslotsArr: string[];
  setTimeslotsArr: (x: string[]) => void;

  venues: Venue[];
  setVenues: (x: Venue[]) => void;

  divisions: Division[];
  setDivisions: (x: Division[]) => void;

  clashRows: ClashRow[];
  setClashRows: (x: ClashRow[]) => void;

  teamTimePrefs: TeamTimePrefs;
  setTeamTimePrefs: React.Dispatch<React.SetStateAction<TeamTimePrefs>>;

  teams: string[];
  displayName: (id: string) => string;

  clashesCsv: string;
  clashesCount: number;

  validationErrs: string[];
  validationInfos: string[];

  canGenerate: boolean;
  onGenerate: () => void;

  canDownload: boolean;
  onDownload: () => void;

  onExportJson: () => void;
  onImportJson: (file: File) => Promise<void>;

  capacityPerWeek: number;
  totalCourts: number;
  parsedTimeslotsCount: number;
}) {
  const {
    weeks,
    setWeeks,
    timeslotsArr,
    setTimeslotsArr,
    venues,
    setVenues,
    divisions,
    setDivisions,
    clashRows,
    setClashRows,
    teamTimePrefs,
    setTeamTimePrefs,
    teams,
    displayName,
    clashesCsv,
    clashesCount,
    validationErrs,
    validationInfos,
    canGenerate,
    onGenerate,
    canDownload,
    onDownload,
    capacityPerWeek,
    totalCourts,
    parsedTimeslotsCount,
    onExportJson,
    onImportJson,
  } = props;

  const fileRef = React.useRef<HTMLInputElement | null>(null);
  const [ioMsg, setIoMsg] = React.useState<string>("");
  const [ioErr, setIoErr] = React.useState<string>("");

  const teamsByDivision = React.useMemo(() => {
    const map = new Map<string, string[]>();
    for (const t of teams || []) {
      const div = String(t).split("-")[0] || "Other";
      if (!map.has(div)) map.set(div, []);
      map.get(div)!.push(t);
    }
    const entries = Array.from(map.entries()).sort(([a], [b]) =>
      a.localeCompare(b)
    );
    for (const [, arr] of entries) arr.sort((a, b) => a.localeCompare(b));
    return entries;
  }, [teams]);

  const [prefTeam, setPrefTeam] = React.useState<string>("");

  React.useEffect(() => {
    // prune prefs when timeslots change
    const allowed = new Set(
      (timeslotsArr || []).map((t) => t.trim()).filter(Boolean)
    );
    setTeamTimePrefs((prev) => {
      const next: TeamTimePrefs = {};
      for (const [teamId, cfg] of Object.entries(prev || {})) {
        const preferred = (cfg.preferred || []).filter((t) => allowed.has(t));
        const avoid = (cfg.avoid || []).filter((t) => allowed.has(t));
        if (preferred.length || avoid.length)
          next[teamId] = { preferred, avoid };
      }
      return next;
    });
  }, [timeslotsArr, setTeamTimePrefs]);

  const toggle = (arr: string[], value: string) =>
    arr.includes(value) ? arr.filter((x) => x !== value) : [...arr, value];

  return (
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
                    className={`w-10 rounded-lg border text-sm ${
                      (timeslotsArr || []).length === 1
                        ? "bg-gray-100 text-gray-400 border-gray-200"
                        : "border-gray-300 hover:bg-gray-50"
                    }`}
                    disabled={(timeslotsArr || []).length === 1}
                    onClick={() =>
                      setTimeslotsArr(
                        (timeslotsArr || []).filter((_, i) => i !== idx)
                      )
                    }
                    title="Remove"
                  >
                    ×
                  </button>
                </div>
              ))}
            </div>

            <div className="mt-2 text-[11px] text-gray-600">
              Use 24h format <span className="font-mono">HH:MM</span>
            </div>
          </div>

          <div className="mt-3 text-xs text-gray-600">
            Courts total:{" "}
            <span className="font-medium text-gray-900">{totalCourts}</span> ·
            Capacity/week:{" "}
            <span className="font-medium text-gray-900">{capacityPerWeek}</span>
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
                              const courts = (next[idx].courts || []).filter(
                                (_, i) => i !== cIdx
                              );
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
                    onClick={() =>
                      setVenues(venues.filter((_, i) => i !== idx))
                    }
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
              onClick={() =>
                setDivisions([
                  ...divisions,
                  { code: "", teams: 1, netHeightM: 2.43 },
                ])
              }
            >
              + Add
            </button>
          </div>
          <div className="mt-2 space-y-2">
            <div className="mt-2 text-xs text-gray-600">
              Net height is per division (meters).
            </div>
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
                  className="w-20 rounded-lg border border-gray-300 px-3 py-2 text-sm"
                  type="number"
                  min={1}
                  value={d.teams}
                  onChange={(e) => {
                    const next = divisions.slice();
                    next[idx] = { ...next[idx], teams: Number(e.target.value) };
                    setDivisions(next);
                  }}
                />

                <input
                  className="w-28 rounded-lg border border-gray-300 px-3 py-2 text-sm font-mono"
                  type="number"
                  step="0.01"
                  min={2.0}
                  max={2.6}
                  value={d.netHeightM ?? 2.43}
                  onChange={(e) => {
                    const next = divisions.slice();
                    next[idx] = {
                      ...next[idx],
                      netHeightM: Number(e.target.value),
                    };
                    setDivisions(next);
                  }}
                  title="Net height in meters"
                  placeholder="2.43"
                />
                <button
                  className="w-10 rounded-lg border border-gray-300 text-sm hover:bg-gray-50"
                  onClick={() =>
                    setDivisions(divisions.filter((_, i) => i !== idx))
                  }
                  title="Remove"
                >
                  ×
                </button>
              </div>
            ))}
          </div>

          <div className="mt-3 text-xs text-gray-600">
            Team IDs auto-generated as{" "}
            <span className="font-mono">DivCode-##</span>
          </div>
        </div>
      </div>
      <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* LEFT: Clashes */}
        <div className="rounded-xl border border-gray-200 p-4">
          {/* --- KEEP your existing Clashes card contents EXACTLY here --- */}
          <div className="flex items-center justify-between">
            <div className="text-sm font-medium">Clashes</div>
            <div className="text-xs text-gray-600">Edges: {clashesCount}</div>
          </div>
          <div className="mt-2 text-xs text-gray-600">
            Add rows of teams that share players. Each row creates clashes
            between every pair in that row.
          </div>

          <div className="mt-3 space-y-3">
            {clashRows.map((row, rowIdx) => {
              const selected = row.teams || [];
              const hasDup = new Set(selected).size !== selected.length;

              return (
                <div
                  key={rowIdx}
                  className="rounded-xl border border-gray-200 p-3"
                >
                  <div className="flex items-center justify-between gap-2">
                    <div className="text-xs text-gray-600">
                      Row {rowIdx + 1}
                    </div>
                    <button
                      className={`text-xs rounded-lg border px-2 py-1 ${
                        clashRows.length === 1
                          ? "bg-gray-100 text-gray-400 border-gray-200"
                          : "border-gray-300 hover:bg-gray-50"
                      }`}
                      disabled={clashRows.length === 1}
                      onClick={() =>
                        setClashRows(clashRows.filter((_, i) => i !== rowIdx))
                      }
                    >
                      Remove row
                    </button>
                  </div>

                  <div className="mt-2 flex flex-col md:flex-row gap-2 md:items-center">
                    <select
                      className="flex-1 rounded-lg border border-gray-300 px-3 py-2 text-sm"
                      value={row.pending || ""}
                      onChange={(e) => {
                        const team = e.target.value;
                        if (!team) return;

                        if (selected.includes(team)) {
                          const next = clashRows.slice();
                          next[rowIdx] = { ...next[rowIdx], pending: "" };
                          setClashRows(next);
                          return;
                        }

                        const next = clashRows.slice();
                        next[rowIdx] = {
                          ...next[rowIdx],
                          teams: [...selected, team],
                          pending: "",
                        };
                        setClashRows(next);
                      }}
                    >
                      <option value="">Select a team…</option>
                      {teamsByDivision.map(([div, ts]) => (
                        <optgroup key={div} label={div}>
                          {ts.map((t) => (
                            <option
                              key={t}
                              value={t}
                              disabled={selected.includes(t)}
                            >
                              {displayName(t)}
                            </option>
                          ))}
                        </optgroup>
                      ))}
                    </select>
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
                        <span
                          key={t}
                          className="inline-flex items-center gap-2 rounded-full border border-gray-300 bg-white px-3 py-1 text-xs"
                          title={t}
                        >
                          <span className="font-mono">{displayName(t)}</span>
                          <button
                            className="text-gray-500 hover:text-gray-900"
                            onClick={() => {
                              const next = clashRows.slice();
                              next[rowIdx] = {
                                ...next[rowIdx],
                                teams: selected.filter((x) => x !== t),
                              };
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
                    This row generates:{" "}
                    <span className="font-medium">
                      {Math.max(
                        0,
                        (selected.length * (selected.length - 1)) / 2
                      )}
                    </span>{" "}
                    clash edges
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
            <summary className="cursor-pointer text-xs text-gray-600">
              Show raw CSV
            </summary>
            <textarea
              className="mt-2 h-36 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm font-mono"
              value={clashesCsv}
              readOnly
            />
          </details>

          <div className="mt-2 text-xs text-gray-600">
            Rule (later): clashing teams must not share the same timeslot.
          </div>
        </div>

        {/* RIGHT: stack Preferences + Validation */}
        <div className="space-y-4">
          {/* Validation (keep your existing validation card contents here) */}
          <div className="rounded-xl border border-gray-200 p-4">
            {/* --- paste your existing Validation card exactly as-is --- */}
            <div className="text-sm font-medium">Validation</div>
            <div className="mt-2 space-y-2">
              {validationErrs.length > 0 ? (
                <div className="rounded-lg bg-red-50 border border-red-200 p-3 text-sm text-red-800">
                  <div className="font-medium">Fix these:</div>
                  <ul className="mt-1 list-disc pl-5">
                    {validationErrs.map((e, i) => (
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
                {validationInfos.map((x, i) => (
                  <div key={i}>{x}</div>
                ))}
              </div>

              <div className="flex gap-2 mt-2 flex-wrap">
                <button
                  className={`rounded-lg px-3 py-2 text-sm border ${
                    canGenerate
                      ? "bg-black text-white border-black hover:opacity-90"
                      : "bg-gray-100 text-gray-400 border-gray-200"
                  }`}
                  disabled={!canGenerate}
                  onClick={onGenerate}
                >
                  Generate 5-week pairings
                </button>

                <button
                  className={`rounded-lg px-3 py-2 text-sm border ${
                    canDownload
                      ? "bg-white border-gray-300 hover:bg-gray-50"
                      : "bg-gray-100 text-gray-400 border-gray-200"
                  }`}
                  disabled={!canDownload}
                  onClick={onDownload}
                >
                  Download CSV
                </button>
              </div>

              <div className="text-xs text-gray-600">
                Capacity per week:{" "}
                <span className="font-medium">{totalCourts}</span> courts ×{" "}
                <span className="font-medium">{parsedTimeslotsCount}</span>{" "}
                timeslots
              </div>
            </div>
          </div>

          {/* Save / Load (moved under Validation) */}
          <div className="mt-3 border-t border-gray-200 pt-3">
            <div className="text-xs font-medium text-gray-800">Save / Load</div>
            <div className="mt-1 text-xs text-gray-600">
              Export a JSON snapshot (config + teams + clashes + schedule) and
              re-import it later to continue.
            </div>

            <div className="mt-2 flex flex-wrap gap-2">
              <button
                className="rounded-lg px-3 py-2 text-sm border bg-white border-gray-300 hover:bg-gray-50"
                onClick={() => {
                  setIoErr("");
                  setIoMsg("");
                  onExportJson();
                }}
                type="button"
              >
                Export JSON
              </button>

              <button
                className="rounded-lg px-3 py-2 text-sm border bg-white border-gray-300 hover:bg-gray-50"
                onClick={() => {
                  setIoErr("");
                  setIoMsg("");
                  fileRef.current?.click();
                }}
                type="button"
              >
                Import JSON
              </button>

              <input
                ref={fileRef}
                type="file"
                accept="application/json,.json"
                className="hidden"
                onChange={async (e) => {
                  const f = e.target.files?.[0];
                  if (!f) return;

                  try {
                    setIoErr("");
                    setIoMsg("Loading…");
                    await onImportJson(f);
                    setIoMsg(`Loaded: ${f.name}`);
                  } catch (err: any) {
                    setIoMsg("");
                    setIoErr(
                      err?.message
                        ? String(err.message)
                        : "Failed to import JSON"
                    );
                  } finally {
                    e.currentTarget.value = "";
                  }
                }}
              />
            </div>

            {ioMsg ? (
              <div className="mt-2 text-xs text-green-700">{ioMsg}</div>
            ) : null}
            {ioErr ? (
              <div className="mt-2 text-xs text-red-700">{ioErr}</div>
            ) : null}
          </div>
        </div>
      </div>
    </>
  );
}
