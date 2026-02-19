import type { Division } from "./types";

export function pad2(n: number) {
  return String(n).padStart(2, "0");
}

export function buildTeams(divisions: Division[]) {
  const out: string[] = [];
  for (const d of divisions) {
    for (let i = 1; i <= Number(d.teams || 0); i++) {
      out.push(`${d.code}-${pad2(i)}`);
    }
  }
  return out;
}

export function teamNum(id: string) {
  if (!id || id === "BYE") return "";
  const parts = String(id).split("-");
  const n = Number(parts[1]);
  return Number.isFinite(n) ? String(n) : parts[1] || id;
}
