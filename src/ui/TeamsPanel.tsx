import React from "react";

export function TeamsPanel(props: {
  teamsByDivision: Map<string, string[]>;
  teamNames: Record<string, string>;
  setTeamNames: React.Dispatch<React.SetStateAction<Record<string, string>>>;
}) {
  const { teamsByDivision, teamNames, setTeamNames } = props;

  return (
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
  );
}
