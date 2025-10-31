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
  id: number; // Timestamp
  dateRange: string;
  schedule: DaySchedule[];
  summary: string;
  imageData: string; // Base64 encoded image data
  mimeType: string;
}
