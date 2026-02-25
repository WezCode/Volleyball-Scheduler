import React from "react";

type TeamTimePrefs = Record<
  string,
  { preferred?: string[]; notPreferred?: string[]; unavailable?: string[] }
>;

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

  // Default to first division (e.g. "D0") — NOT "All"
  const [activeDiv, setActiveDiv] = React.useState<string>(
    () => divisions[0]?.[0] ?? "ALL"
  );

  // Keep activeDiv valid if divisions change dynamically
  React.useEffect(() => {
    if (activeDiv === "ALL") return;
    const divs = new Set(divisions.map(([d]) => d));
    if (!divs.has(activeDiv)) {
      setActiveDiv(divisions[0]?.[0] ?? "ALL");
    }
  }, [divisions, activeDiv]);

  const tabItems = React.useMemo(() => {
    const divKeys = divisions.map(([d]) => d);
    return [...divKeys, "ALL"]; // ✅ All last
  }, [divisions]);

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

  const visibleDivisions =
    activeDiv === "ALL"
      ? divisions
      : divisions.filter(([div]) => div === activeDiv);

  return (
    <div className="mt-4 rounded-2xl border border-gray-200 bg-white overflow-hidden">
      <div className="p-4 border-b border-gray-200">
        <div className="text-sm font-medium">Teams</div>
        <div className="mt-3 flex flex-wrap gap-2">
          {tabItems.map((key) => (
            <button
              key={key}
              type="button"
              onClick={() => setActiveDiv(key)}
              className={`rounded-lg border px-3 py-2 text-xs ${
                activeDiv === key
                  ? "bg-black text-white border-black"
                  : "bg-white border-gray-300 hover:bg-gray-50"
              }`}
              title={key === "ALL" ? "Show all divisions" : `Show ${key}`}
            >
              {key === "ALL" ? "All" : key}
            </button>
          ))}
        </div>
        <div className="text-xs text-gray-600">
          Edit names here. Team IDs stay stable for scheduling & clashes. Time
          preferences are soft constraints.
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
                <th className="py-2 px-3">Not preferred</th>
                <th className="py-2 px-3">Unavailable</th>
                <th className="py-2 px-3 w-40">Edit prefs</th>
              </tr>
            </thead>

            <tbody>
              {visibleDivisions.map(([div, ids]) => (
                <React.Fragment key={div}>
                  {ids.map((id, i) => {
                    const pref = teamTimePrefs[id]?.preferred || [];
                    const notPref = teamTimePrefs[id]?.notPreferred || [];
                    const unavail = teamTimePrefs[id]?.unavailable || [];
                    return (
                      <tr
                        key={id}
                        className="border-t border-gray-100 align-top hover:bg-gray-50"
                      >
                        <td className="py-2 px-3 font-mono">
                          {i === 0 ? div : ""}
                        </td>
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
                            Display:{" "}
                            <span className="font-medium text-gray-700">
                              {displayName(id)}
                            </span>
                          </div>
                        </td>

                        <td className="py-2 px-3">{chips(pref)}</td>
                        <td className="py-2 px-3">{chips(notPref)}</td>
                        <td className="py-2 px-3">{chips(unavail)}</td>

                        <td className="py-2 px-3">
                          <details className="rounded-lg border border-gray-200 bg-white">
                            <summary className="cursor-pointer select-none px-3 py-2 text-xs text-gray-700 hover:bg-gray-50 rounded-lg">
                              Edit
                              <span className="ml-2 text-[11px] text-gray-500">
                                ({pref.length} / {notPref.length} /{" "}
                                {unavail.length})
                              </span>
                            </summary>

                            <div className="px-3 pb-3">
                              {/* Preferred */}
                              <div className="mt-2 text-xs font-medium text-gray-700">
                                Preferred
                              </div>
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
                                            const nextPreferred = toggle(
                                              cfg.preferred || [],
                                              slot
                                            );

                                            // mutual exclusivity: remove from other buckets
                                            const nextNotPreferred = (
                                              cfg.notPreferred || []
                                            ).filter((x) => x !== slot);
                                            const nextUnavailable = (
                                              cfg.unavailable || []
                                            ).filter((x) => x !== slot);

                                            return {
                                              ...prevMap,
                                              [id]: {
                                                ...cfg,
                                                preferred: nextPreferred,
                                                notPreferred: nextNotPreferred,
                                                unavailable: nextUnavailable,
                                              },
                                            };
                                          });
                                        }}
                                      />
                                      <span className="font-mono">{slot}</span>
                                    </label>
                                  );
                                })}
                              </div>

                              {/* Not preferred */}
                              <div className="mt-3 text-xs font-medium text-gray-700">
                                Not preferred
                              </div>
                              <div className="mt-2 flex flex-wrap gap-2">
                                {(timeslots || []).map((slot) => {
                                  const checked = notPref.includes(slot);
                                  return (
                                    <label
                                      key={"n:" + slot}
                                      className="inline-flex items-center gap-2 rounded-full border border-gray-300 bg-white px-3 py-1 text-xs"
                                    >
                                      <input
                                        type="checkbox"
                                        checked={checked}
                                        onChange={() => {
                                          setTeamTimePrefs((prevMap) => {
                                            const cfg = prevMap[id] || {};
                                            const nextNotPreferred = toggle(
                                              cfg.notPreferred || [],
                                              slot
                                            );

                                            // mutual exclusivity: remove from other buckets
                                            const nextPreferred = (
                                              cfg.preferred || []
                                            ).filter((x) => x !== slot);
                                            const nextUnavailable = (
                                              cfg.unavailable || []
                                            ).filter((x) => x !== slot);

                                            return {
                                              ...prevMap,
                                              [id]: {
                                                ...cfg,
                                                notPreferred: nextNotPreferred,
                                                preferred: nextPreferred,
                                                unavailable: nextUnavailable,
                                              },
                                            };
                                          });
                                        }}
                                      />
                                      <span className="font-mono">{slot}</span>
                                    </label>
                                  );
                                })}
                              </div>

                              {/* Unavailable */}
                              <div className="mt-3 text-xs font-medium text-gray-700">
                                Unavailable
                              </div>
                              <div className="mt-2 flex flex-wrap gap-2">
                                {(timeslots || []).map((slot) => {
                                  const checked = unavail.includes(slot);
                                  return (
                                    <label
                                      key={"u:" + slot}
                                      className="inline-flex items-center gap-2 rounded-full border border-gray-300 bg-white px-3 py-1 text-xs"
                                    >
                                      <input
                                        type="checkbox"
                                        checked={checked}
                                        onChange={() => {
                                          setTeamTimePrefs((prevMap) => {
                                            const cfg = prevMap[id] || {};
                                            const nextUnavailable = toggle(
                                              cfg.unavailable || [],
                                              slot
                                            );

                                            // mutual exclusivity: remove from other buckets
                                            const nextPreferred = (
                                              cfg.preferred || []
                                            ).filter((x) => x !== slot);
                                            const nextNotPreferred = (
                                              cfg.notPreferred || []
                                            ).filter((x) => x !== slot);

                                            return {
                                              ...prevMap,
                                              [id]: {
                                                ...cfg,
                                                unavailable: nextUnavailable,
                                                preferred: nextPreferred,
                                                notPreferred: nextNotPreferred,
                                              },
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
