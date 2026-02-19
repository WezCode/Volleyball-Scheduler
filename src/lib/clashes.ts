import type { ClashRow } from "./types";

export function buildEdgesFromRows(clashRows: ClashRow[]) {
  const seen = new Set<string>();
  const edges: [string, string][] = [];

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

export function edgesToCsv(edges: [string, string][]) {
  const header = "team,clash_team";
  const nl = "\n";
  const body = (edges || []).map(([a, b]) => `${a},${b}`).join(nl);
  return header + (body ? nl + body + nl : nl);
}
