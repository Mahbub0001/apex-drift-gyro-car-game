import { GhostFrame } from '../types';

const RECORDS_STORAGE_KEY = 'apex_drift_records_v1';
const GHOST_STORAGE_KEY = 'apex_drift_best_ghost_v1';

export interface StoredRecords {
  bestLapMs: number | null;
  bestLapCarId: string | null;
  bestScore: number;
  totalLapsCompleted: number;
}

const DEFAULT_RECORDS: StoredRecords = {
  bestLapMs: null,
  bestLapCarId: null,
  bestScore: 0,
  totalLapsCompleted: 0
};

export function loadStoredRecords(): StoredRecords {
  if (typeof window === 'undefined') return DEFAULT_RECORDS;
  try {
    const raw = window.localStorage.getItem(RECORDS_STORAGE_KEY);
    if (!raw) return DEFAULT_RECORDS;
    return { ...DEFAULT_RECORDS, ...JSON.parse(raw) };
  } catch {
    return DEFAULT_RECORDS;
  }
}

export function saveBestLapRecord(lapMs: number, carId: string): StoredRecords {
  const current = loadStoredRecords();
  const next: StoredRecords = {
    ...current,
    totalLapsCompleted: current.totalLapsCompleted + 1,
    bestLapMs:
      current.bestLapMs === null || lapMs < current.bestLapMs ? Math.round(lapMs) : current.bestLapMs,
    bestLapCarId:
      current.bestLapMs === null || lapMs < current.bestLapMs ? carId : current.bestLapCarId
  };
  try {
    window.localStorage.setItem(RECORDS_STORAGE_KEY, JSON.stringify(next));
  } catch {}
  return next;
}

export function saveBestScoreRecord(score: number): StoredRecords {
  const current = loadStoredRecords();
  if (score <= current.bestScore) return current;
  const next: StoredRecords = {
    ...current,
    bestScore: Math.round(score)
  };
  try {
    window.localStorage.setItem(RECORDS_STORAGE_KEY, JSON.stringify(next));
  } catch {}
  return next;
}

export function loadSavedGhost(): { lapMs: number; carId: string; frames: GhostFrame[] } | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = window.localStorage.getItem(GHOST_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (
      parsed &&
      typeof parsed.lapMs === 'number' &&
      Array.isArray(parsed.frames) &&
      parsed.frames.length > 5
    ) {
      return parsed;
    }
    return null;
  } catch {
    return null;
  }
}

export function saveBestGhost(lapMs: number, carId: string, frames: GhostFrame[]) {
  if (typeof window === 'undefined' || frames.length < 5) return;
  try {
    window.localStorage.setItem(
      GHOST_STORAGE_KEY,
      JSON.stringify({
        lapMs: Math.round(lapMs),
        carId,
        frames
      })
    );
  } catch {}
}
