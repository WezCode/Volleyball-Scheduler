import React from "react";

type TeamTimePrefs = Record<string, { preferred?: string[]; avoid?: string[] }>;

export function TeamsPanel(props: {
  teamsByDivision: Map<string, string[]>;
  teamNames: Record<string, string>;
  setTeamNames: React.Dispatch<React.SetStateAction<Record<string, string>>>;

  // NEW
  displayName: (id: string) => string;
  timeslots: string[]; // pass parsedTimeslots from App.tsx
  teamTimePrefs: TeamTimePrefs;
  setTeamTimePrefs: React.Dispatch<React.SetStateAction<TeamTimePrefs>>;
}) {
  const {
    teamsByDivision,
    teamNames,
    setTeamNames,
    displayName,
    timeslots,
    teamTimePrefs,
    setTeamTimePrefs,
  } = props;

  const divisions = React.useMemo(() => {
    const entries = Array.from(teamsByDivision.entries());
    entries.sort(([a], [b]) => a.localeCompare(b));
    return entries;
  }, [teamsByDivision]);

  const toggle = (arr: string[], value: string) =>
    arr.includes(value) ? arr.filter((x) => x !== value) : [...arr, value];

  const chips = (items: string[]) => {
    if (!items.length) return <span className="text-xs text-gray-500">—</span>;
    return (
      <div className="flex flex-wrap gap-1">
        {items.map((t) => (
          <span
            key={t}
            className="inline-flex items-center rounded-full border border-gray-300 bg-white px-2 py-0.5 text-[11px] font-mono"
          >
            {t}
          </span>
        ))}
      </div>
    );
  };

  return (
    <div className="mt-4 rounded-2xl border border-gray-200 bg-white overflow-hidden">
      <div className="p-4 border-b border-gray-200">
        <div className="text-sm font-medium">Teams</div>
        <div className="text-xs text-gray-600">
          Edit names here. Team IDs stay stable for scheduling & clashes. Time preferences are soft constraints.
        </div>
      </div>

      <div className="p-4">
        <div className="overflow-auto rounded-xl border border-gray-200">
          <table className="min-w-full text-sm">
            <thead className="sticky top-0 bg-white">
              <tr className="text-left text-xs text-gray-600 border-b border-gray-200">
                <th className="py-2 px-3">Division</th>
                <th className="py-2 px-3">Team ID</th>
                <th className="py-2 px-3">Team Name</th>
                <th className="py-2 px-3">Preferred</th>
                <th className="py-2 px-3">Avoid</th>
                <th className="py-2 px-3 w-40">Edit prefs</th>
              </tr>
            </thead>

            <tbody>
              {divisions.map(([div, ids]) => (
                <React.Fragment key={div}>
                  {ids.map((id, i) => {
                    const pref = teamTimePrefs[id]?.preferred || [];
                    const avoid = teamTimePrefs[id]?.avoid || [];

                    return (
                      <tr key={id} className="border-t border-gray-100 align-top hover:bg-gray-50">
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
                          <div className="mt-1 text-[11px] text-gray-500">
                            Display: <span className="font-medium text-gray-700">{displayName(id)}</span>
                          </div>
                        </td>

                        <td className="py-2 px-3">{chips(pref)}</td>
                        <td className="py-2 px-3">{chips(avoid)}</td>

                        <td className="py-2 px-3">
                          <details className="rounded-lg border border-gray-200 bg-white">
                            <summary className="cursor-pointer select-none px-3 py-2 text-xs text-gray-700 hover:bg-gray-50 rounded-lg">
                              Edit
                              <span className="ml-2 text-[11px] text-gray-500">
                                ({pref.length} / {avoid.length})
                              </span>
                            </summary>

                            <div className="px-3 pb-3">
                              <div className="mt-2 text-xs font-medium text-gray-700">Preferred</div>
                              <div className="mt-2 flex flex-wrap gap-2">
                                {(timeslots || []).map((slot) => {
                                  const checked = pref.includes(slot);
                                  return (
                                    <label
                                      key={"p:" + slot}
                                      className="inline-flex items-center gap-2 rounded-full border border-gray-300 bg-white px-3 py-1 text-xs"
                                    >
                                      <input
                                        type="checkbox"
                                        checked={checked}
                                        onChange={() => {
                                          setTeamTimePrefs((prevMap) => {
                                            const cfg = prevMap[id] || {};
                                            const nextPreferred = toggle(cfg.preferred || [], slot);
                                            const nextAvoid = (cfg.avoid || []).filter((x) => x !== slot);
                                            return {
                                              ...prevMap,
                                              [id]: { ...cfg, preferred: nextPreferred, avoid: nextAvoid },
                                            };
                                          });
                                        }}
                                      />
                                      <span className="font-mono">{slot}</span>
                                    </label>
                                  );
                                })}
                              </div>

                              <div className="mt-3 text-xs font-medium text-gray-700">Avoid</div>
                              <div className="mt-2 flex flex-wrap gap-2">
                                {(timeslots || []).map((slot) => {
                                  const checked = avoid.includes(slot);
                                  return (
                                    <label
                                      key={"a:" + slot}
                                      className="inline-flex items-center gap-2 rounded-full border border-gray-300 bg-white px-3 py-1 text-xs"
                                    >
                                      <input
                                        type="checkbox"
                                        checked={checked}
                                        onChange={() => {
                                          setTeamTimePrefs((prevMap) => {
                                            const cfg = prevMap[id] || {};
                                            const nextAvoid = toggle(cfg.avoid || [], slot);
                                            const nextPreferred = (cfg.preferred || []).filter((x) => x !== slot);
                                            return {
                                              ...prevMap,
                                              [id]: { ...cfg, avoid: nextAvoid, preferred: nextPreferred },
                                            };
                                          });
                                        }}
                                      />
                                      <span className="font-mono">{slot}</span>
                                    </label>
                                  );
                                })}
                              </div>

                              <div className="mt-3 flex gap-2">
                                <button
                                  className="rounded-lg border border-gray-300 bg-white px-3 py-2 text-xs hover:bg-gray-50"
                                  onClick={() =>
                                    setTeamTimePrefs((prevMap) => {
                                      const next = { ...prevMap };
                                      delete next[id];
                                      return next;
                                    })
                                  }
                                  type="button"
                                >
                                  Clear
                                </button>
                              </div>
                            </div>
                          </details>
                        </td>
                      </tr>
                    );
                  })}
                </React.Fragment>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}