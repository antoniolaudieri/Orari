import React from 'react';
import type { DaySchedule, Shift } from '../types.js';
import { calculateHours, formatDecimalHours } from '../utils/dateUtils.js';

interface HourTrackerProps {
  schedule: DaySchedule[];
}

export const HourTracker: React.FC<HourTrackerProps> = ({ schedule }) => {
  const totalHours = React.useMemo(() => 
    schedule.reduce((total, day) => {
      if (day.type === 'work') {
        const dayHours = day.shifts.reduce((dayTotal: number, shift: Shift) => {
          return dayTotal + calculateHours(shift.start, shift.end);
        }, 0);
        return total + dayHours;
      }
      return total;
    }, 0), [schedule]);

  const formattedHours = React.useMemo(() => formatDecimalHours(totalHours), [totalHours]);

  return (
    <div className="flex items-center gap-3 bg-gray-700/50 px-4 py-2 rounded-lg ring-1 ring-white/10">
      <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-teal-400 h-6 w-6"><circle cx="12" cy="12" r="10"/><path d="M12 6v6l4 2"/></svg>
      <div className="text-left">
        <span className="text-sm text-gray-400">Monte Ore</span>
        <p className="font-bold text-lg text-white">{formattedHours}</p>
      </div>
    </div>
  );
};