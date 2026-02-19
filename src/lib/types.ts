export type Division = { code: string; teams: number };

export type Venue = { name: string; courts: string[] };

export type ClashRow = { teams: string[]; pending?: string };

export type Match = {
  week: number;
  division: string;
  home: string;
  away: string; // team id or "BYE"
  venue?: string;
  court?: string;
  time?: string;
};

export type Slot = {
  venue: string;
  court: string;
  timeRaw: string; // "19:00"
  time: string; // "7:00pm"
};

export type SlotRow = {
  key: string; // venue__court__time
  venue: string;
  court: string;
  time: string;
};

export type DivisionWeekCell = {
  bySlot: Map<string, { home: string; away: string; venue: string; court: string; time: string }>;
  bye: string | null;
};

export type DivisionGrid = {
  byDiv: Map<string, Map<number, DivisionWeekCell>>;
  unassigned: Map<string, Map<number, { home: string; away: string }[]>>;
};

export type DivisionStats = { games: number; byes: number; unassigned: number };
