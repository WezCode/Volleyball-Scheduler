import type { ClashRow, Division, Venue } from "../lib/types";

export const DEFAULT_WEEKS = 5;

export const DEFAULT_TIMESLOTS = ["19:00", "20:00", "21:00"];

export const DEFAULT_VENUES: Venue[] = [
  { name: "Mullum Mullum", courts: ["3A", "3B", "4A", "4B", "5A", "5B"] },
  { name: "DCC", courts: ["DC1", "DC2"] },
];

export const DEFAULT_DIVISIONS: Division[] = [
  { code: "D0", teams: 9 },
  { code: "D1", teams: 9 },
  { code: "D1R", teams: 11 },
  { code: "D2", teams: 15 },
  { code: "D3", teams: 9 },
];

export const DEFAULT_CLASH_ROWS: ClashRow[] = [{ teams: [] }];
