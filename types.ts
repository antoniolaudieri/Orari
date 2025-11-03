import type { HarmCategory, HarmBlockThreshold } from '@google/genai';

export interface Shift {
  start: string;
  end: string;
}

export interface DaySchedule {
  date: string; // YYYY-MM-DD
  type: 'work' | 'rest' | 'empty';
  shifts: Shift[];
  isUncertain?: boolean;
}

export interface AnalysisEntry {
  id: number; // Database primary key
  dateRange: string;
  schedule: DaySchedule[];
  summary: string;
  imageData?: string; // Base64 encoded image data - Now optional
  mimeType?: string; // Now optional
}

export type SafetySetting = {
  category: HarmCategory;
  threshold: HarmBlockThreshold;
};
