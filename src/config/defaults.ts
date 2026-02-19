import type { ClashRow, Division, Venue } from "../lib/types";

export const DEFAULT_WEEKS = 5;

export const DEFAULT_TIMESLOTS = ["19:00", "20:00", "21:00"];

export const DEFAULT_VENUES: Venue[] = [
  { name: "Mullum Mullum", courts: ["3A", "3B", "4A", "4B", "5A", "5B"] },
  { name: "DCC", courts: ["DC1", "DC2"] },
];

// example shape — keep your existing codes/teams, just add netHeightM
export const DEFAULT_DIVISIONS = [
  { code: "D0",  teams: 9, netHeightM: 2.43 },
  { code: "D1",  teams: 9, netHeightM: 2.43 },
  { code: "D1R", teams: 11, netHeightM: 2.43 },
  { code: "D2",  teams: 15, netHeightM: 2.35 },
  { code: "D3",  teams: 9, netHeightM: 2.24 },
];

export const DEFAULT_CLASH_ROWS: ClashRow[] = [{ teams: [] }];
