// lib/clashGroups.ts
export type ClashEdge = [string, string];

export function buildClashGroups(edges: ClashEdge[]) {
  const adj = new Map<string, Set<string>>();

  const addEdge = (a0: string, b0: string) => {
    const a = String(a0 || "").trim();
    const b = String(b0 || "").trim();
    if (!a || !b || a === b) return;

    if (!adj.has(a)) adj.set(a, new Set());
    if (!adj.has(b)) adj.set(b, new Set());
    adj.get(a)!.add(b);
    adj.get(b)!.add(a);
  };

  for (const [a, b] of edges || []) addEdge(a, b);

  const seen = new Set<string>();
  const groups: string[][] = [];

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
    groups.push(comp);
  }

  groups.sort((a, b) => b.length - a.length);
  return groups;
}
