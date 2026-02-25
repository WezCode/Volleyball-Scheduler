// App.tsx
import React, { useEffect, useMemo, useState } from "react";
import {
  DEFAULT_CLASH_ROWS,
  DEFAULT_DIVISIONS,
  DEFAULT_TIMESLOTS,
  DEFAULT_VENUES,
  DEFAULT_WEEKS,
} from "./config/defaults";
import { PRESET_TEAM_NAMES } from "./data/presetTeamNames";
import { buildEdgesFromRows, edgesToCsv } from "./lib/clashes";
import { downloadCsv } from "./lib/csv";
import { buildTeams } from "./lib/ids";
import { buildSlotRowsAll } from "./lib/slots";
import {
  buildDivisionGrid,
  buildDivisionStats,
  generatePairings,
  placeMatches,
} from "./lib/scheduling";
import type { Match, PreviewTabKey } from "./lib/types";
import { Tabs } from "./ui/Tabs";
import { ConfigPanel } from "./ui/ConfigPanel";
import { TeamsPanel } from "./ui/TeamsPanel";
import { PreviewPanel } from "./ui/PreviewPanel";
import { downloadJson, readJsonFile } from "./lib/json";

export default function App() {
  const [weeks, setWeeks] = useState(DEFAULT_WEEKS);
  const [timeslotsArr, setTimeslotsArr] = useState(DEFAULT_TIMESLOTS);
  const [venues, setVenues] = useState(DEFAULT_VENUES);
  const [divisions, setDivisions] = useState(DEFAULT_DIVISIONS);
  const [clashRows, setClashRows] = useState(DEFAULT_CLASH_ROWS);
  const [teamNames, setTeamNames] = useState<Record<string, string>>({});
  const [teamTimePrefs, setTeamTimePrefs] = React.useState<
    Record<string, { preferred?: string[]; avoid?: string[] }>
  >({});

  type SnapshotV1 = {
    schemaVersion: 1;
    createdAt: string;
    state: {
      weeks: number;
      timeslotsArr: string[];
      venues: any[];
      divisions: any[];
      clashRows: any[];
      teamNames: Record<string, string>;
      teamTimePrefs: Record<string, { preferred?: string[]; avoid?: string[] }>;
      schedule: Match[];
      mainTab?: "config" | "teams" | "preview";
      previewTab?: PreviewTabKey;
    };
  };

  const isObj = (x: any): x is Record<string, any> =>
    x !== null && typeof x === "object" && !Array.isArray(x);

  const asNum = (v: any, fallback: number) => {
    const n = Number(v);
    return Number.isFinite(n) ? n : fallback;
  };

  const asStrArr = (v: any, fallback: string[]) => {
    if (!Array.isArray(v)) return fallback;
    return v.map((x) => String(x ?? ""));
  };

  const normalizeSnapshot = (raw: any): SnapshotV1 => {
    if (!isObj(raw))
      throw new Error("Invalid JSON: expected an object at the top level");

    // Accept either {schemaVersion, state} or older “state-less” snapshots.
    const schemaVersion = raw.schemaVersion ?? 1;
    if (schemaVersion !== 1)
      throw new Error(`Unsupported snapshot schemaVersion: ${schemaVersion}`);

    const state = isObj(raw.state) ? raw.state : raw;
    if (!isObj(state)) throw new Error("Invalid JSON: missing 'state' object");

    return {
      schemaVersion: 1,
      createdAt: String(raw.createdAt ?? new Date().toISOString()),
      state: {
        weeks: asNum(state.weeks, DEFAULT_WEEKS),
        timeslotsArr: asStrArr(state.timeslotsArr, DEFAULT_TIMESLOTS),
        venues: Array.isArray(state.venues) ? state.venues : DEFAULT_VENUES,
        divisions: Array.isArray(state.divisions)
          ? state.divisions
          : DEFAULT_DIVISIONS,
        clashRows: Array.isArray(state.clashRows)
          ? state.clashRows
          : DEFAULT_CLASH_ROWS,
        teamNames: isObj(state.teamNames) ? (state.teamNames as any) : {},
        teamTimePrefs: isObj(state.teamTimePrefs)
          ? (state.teamTimePrefs as any)
          : {},
        schedule: Array.isArray(state.schedule)
          ? (state.schedule as Match[])
          : [],
        mainTab: state.mainTab,
        previewTab: state.previewTab,
      },
    };
  };

  const exportSnapshot = () => {
    const snap: SnapshotV1 = {
      schemaVersion: 1,
      createdAt: new Date().toISOString(),
      state: {
        weeks,
        timeslotsArr,
        venues,
        divisions,
        clashRows,
        teamNames,
        teamTimePrefs,
        schedule,
        mainTab,
        previewTab,
      },
    };

    const stamp = new Date().toISOString().replace(/[:.]/g, "-");
    downloadJson(snap, `volleyball-scheduler-${stamp}.json`);
  };

  const importSnapshot = async (file: File) => {
    const raw = await readJsonFile(file);
    const snap = normalizeSnapshot(raw);

    setWeeks(asNum(snap.state.weeks, DEFAULT_WEEKS));
    setTimeslotsArr(asStrArr(snap.state.timeslotsArr, DEFAULT_TIMESLOTS));
    setVenues(
      Array.isArray(snap.state.venues)
        ? (snap.state.venues as any)
        : DEFAULT_VENUES
    );
    setDivisions(
      Array.isArray(snap.state.divisions)
        ? (snap.state.divisions as any)
        : DEFAULT_DIVISIONS
    );
    setClashRows(
      Array.isArray(snap.state.clashRows)
        ? (snap.state.clashRows as any)
        : DEFAULT_CLASH_ROWS
    );

    setTeamNames(
      isObj(snap.state.teamNames) ? (snap.state.teamNames as any) : {}
    );
    setTeamTimePrefs(
      isObj(snap.state.teamTimePrefs) ? (snap.state.teamTimePrefs as any) : {}
    );
    setSchedule(
      Array.isArray(snap.state.schedule) ? (snap.state.schedule as Match[]) : []
    );

    const hasSchedule =
      Array.isArray(snap.state.schedule) && snap.state.schedule.length > 0;
    setPreviewTab((snap.state.previewTab as any) ?? "division");
    setMainTab(
      (snap.state.mainTab as any) ?? (hasSchedule ? "preview" : "config")
    );
  };

  const parsedTimeslots = useMemo(
    () =>
      (timeslotsArr || []).map((s) => String(s || "").trim()).filter(Boolean),
    [timeslotsArr]
  );

  const totalCourts = useMemo(
    () =>
      venues.reduce(
        (sum, v) => sum + (Array.isArray(v.courts) ? v.courts.length : 0),
        0
      ),
    [venues]
  );

  const capacityPerWeek = useMemo(
    () => totalCourts * parsedTimeslots.length,
    [totalCourts, parsedTimeslots.length]
  );

  const slotRowsAll = useMemo(
    () => buildSlotRowsAll(venues, parsedTimeslots),
    [venues, parsedTimeslots]
  );

  const teams = useMemo(() => buildTeams(divisions), [divisions]);
  const teamsSet = useMemo(() => new Set(teams), [teams]);

  const clashes = useMemo(() => buildEdgesFromRows(clashRows), [clashRows]);
  const clashesCsv = useMemo(() => edgesToCsv(clashes), [clashes]);

  useEffect(() => {
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
    return (id: string) => (id === "BYE" ? "BYE" : teamNames[id] || id);
  }, [teamNames]);

  const validation = useMemo(() => {
    const errs: string[] = [];
    const infos: string[] = [];
    infos.push(
      `Capacity per week: ${totalCourts} courts × ${parsedTimeslots.length} timeslots = ${capacityPerWeek} match-slots/week`
    );
    infos.push(`Teams total: ${teams.length}`);
    infos.push(
      "Note: placement is currently greedy/stable (no clash/time-pref optimization yet)."
    );

    for (const d of divisions) {
      if (!d.code || !String(d.code).trim())
        errs.push("Division code missing.");
      if (Number(d.teams) <= 0)
        errs.push(`Division ${d.code || "?"}: team count must be > 0`);
      if (!Number.isFinite(d.netHeightM) || d.netHeightM <= 0)
        errs.push(
          `Division ${d.code || "?"}: net height must be a valid number`
        );
    }

    for (const v of venues) {
      if (!v.name || !String(v.name).trim()) errs.push("Venue name missing.");
      const courts = Array.isArray(v.courts)
        ? v.courts.map((x) => String(x || "").trim()).filter(Boolean)
        : [];
      if (courts.length <= 0)
        errs.push(`Venue ${v.name || "?"}: add at least 1 court name`);
      if (new Set(courts).size !== courts.length)
        errs.push(`Venue ${v.name || "?"}: duplicate court names`);
    }

    if (parsedTimeslots.length === 0) errs.push("Add at least 1 timeslot.");

    const tsClean = parsedTimeslots.map((x) => String(x).trim());
    if (new Set(tsClean).size !== tsClean.length)
      errs.push("Timeslots: duplicate values");
    for (const t of tsClean) {
      if (!/^([01]?\d|2[0-3]):[0-5]\d$/.test(t))
        errs.push(`Timeslots: invalid '${t}' (use HH:MM)`);
    }
    if (Number(weeks) <= 0) errs.push("Weeks must be > 0.");

    for (const [a, b] of clashes) {
      if (!teamsSet.has(a)) errs.push(`Clashes: unknown team '${a}'`);
      if (!teamsSet.has(b)) errs.push(`Clashes: unknown team '${b}'`);
    }

    return { errs, infos };
  }, [
    capacityPerWeek,
    clashes,
    divisions,
    parsedTimeslots,
    teams.length,
    teamsSet,
    totalCourts,
    venues,
    weeks,
  ]);

  const [schedule, setSchedule] = useState<Match[]>([]);
  const [previewTab, setPreviewTab] = useState<PreviewTabKey>("division");
  const [mainTab, setMainTab] = useState<"config" | "teams" | "preview">(
    "config"
  );

  const teamsByDivision = useMemo(() => {
    const map = new Map<string, string[]>();
    for (const id of teams) {
      const div = id.split("-")[0];
      if (!map.has(div)) map.set(div, []);
      map.get(div)!.push(id);
    }
    for (const [div, arr] of map.entries()) {
      arr.sort();
      map.set(div, arr);
    }
    return map;
  }, [teams]);

  const groupedByWeek = useMemo(() => {
    const map = new Map<number, Match[]>();
    for (const m of schedule) {
      if (!map.has(m.week)) map.set(m.week, []);
      map.get(m.week)!.push(m);
    }
    for (const [w, arr] of map.entries()) {
      arr.sort((a, b) =>
        (a.division + a.home).localeCompare(b.division + b.home)
      );
    }
    return map;
  }, [schedule]);

  const divisionGrid = useMemo(() => buildDivisionGrid(schedule), [schedule]);
  const divisionStats = useMemo(() => buildDivisionStats(schedule), [schedule]);

  return (
    <div className="min-h-screen bg-gray-50 p-4">
      <div className="mx-auto max-w-6xl">
        <div className="rounded-2xl bg-white p-5 shadow-sm border border-gray-200">
          <div className="flex flex-col gap-2 md:flex-row md:items-end md:justify-between">
            <div>
              <h1 className="text-xl font-semibold">Volleyball Scheduler</h1>
              <p className="text-sm text-gray-600">
                Iterative build — rules added one by one.
              </p>
            </div>
            <div className="text-sm text-gray-700">
              <div>
                <span className="font-medium">Revisit later:</span> (1) timeslot
                prefs, (2) stadium exceptions
              </div>
            </div>
          </div>

          <Tabs
            value={mainTab}
            onChange={(v) => setMainTab(v as any)}
            items={[
              { key: "config", label: "Configuration" },
              { key: "teams", label: "Teams" },
              {
                key: "preview",
                label: "Schedule",
                disabled: !schedule.length,
                title: schedule.length ? "" : "Generate pairings first",
              },
            ]}
          />

          {mainTab === "config" && (
            <ConfigPanel
              onExportJson={exportSnapshot}
              onImportJson={importSnapshot}
              weeks={weeks}
              setWeeks={setWeeks}
              timeslotsArr={timeslotsArr}
              setTimeslotsArr={setTimeslotsArr}
              venues={venues}
              setVenues={setVenues}
              divisions={divisions}
              setDivisions={setDivisions}
              clashRows={clashRows}
              setClashRows={setClashRows}
              teamTimePrefs={teamTimePrefs}
              setTeamTimePrefs={setTeamTimePrefs}
              teams={teams}
              displayName={displayName}
              clashesCsv={clashesCsv}
              clashesCount={clashes.length}
              validationErrs={validation.errs}
              validationInfos={validation.infos}
              canGenerate={validation.errs.length === 0}
              onGenerate={() => {
                const ms = generatePairings({
                  weeks: Number(weeks),
                  divisions,
                });

                // IMPORTANT: pass clashes through
                const placed = placeMatches(
                  ms,
                  venues,
                  parsedTimeslots,
                  clashes
                );

                setSchedule(placed);
                setPreviewTab("division");
                setMainTab("preview");
              }}
              canDownload={!!schedule.length}
              onDownload={() => downloadCsv(schedule, "pairings_only.csv")}
              capacityPerWeek={capacityPerWeek}
              totalCourts={totalCourts}
              parsedTimeslotsCount={parsedTimeslots.length}
            />
          )}

          {mainTab === "teams" && (
            <TeamsPanel
              teamsByDivision={teamsByDivision}
              teamNames={teamNames}
              setTeamNames={setTeamNames}
              displayName={displayName}
              timeslots={parsedTimeslots}
              teamTimePrefs={teamTimePrefs}
              setTeamTimePrefs={setTeamTimePrefs}
            />
          )}

          {mainTab === "preview" && schedule.length > 0 && (
            <PreviewPanel
              weeks={weeks}
              divisions={divisions}
              schedule={schedule}
              previewTab={previewTab}
              setPreviewTab={setPreviewTab}
              clashes={clashes}
              divisionGrid={divisionGrid}
              divisionStats={divisionStats}
              slotRowsAll={slotRowsAll}
              teamsByDivision={teamsByDivision}
              displayName={displayName}
              groupedByWeek={groupedByWeek}
              timeslots={parsedTimeslots}
              teamTimePrefs={teamTimePrefs}
            />
          )}

          {mainTab === "preview" && schedule.length === 0 && (
            <div className="mt-4 rounded-xl border border-gray-200 bg-white p-4 text-sm text-gray-600">
              No schedule generated yet. Go to{" "}
              <span className="font-medium">Configuration</span> and click{" "}
              <span className="font-medium">Generate 5-week pairings</span>.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
