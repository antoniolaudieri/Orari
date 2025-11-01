import React from 'react';
import { getMonthGrid, formatDate } from '../utils/dateUtils.js';
import type { DaySchedule } from '../types.js';

interface MonthCalendarProps {
  currentDate: Date;
  scheduleData: DaySchedule[];
  onDayClick: (date: Date) => void;
}

export const MonthCalendar: React.FC<MonthCalendarProps> = ({ currentDate, scheduleData, onDayClick }) => {
  const monthGrid = getMonthGrid(currentDate);
  const weekDays = ['Lun', 'Mar', 'Mer', 'Gio', 'Ven', 'Sab', 'Dom'];

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  return (
    <div className="bg-slate-900/30 p-4 rounded-lg">
      <div className="grid grid-cols-7 gap-2 text-center mb-2">
        {weekDays.map(day => (
          <div key={day} className="text-xs font-bold text-gray-400 uppercase">{day}</div>
        ))}
      </div>
      <div className="grid grid-cols-7 gap-1">
        {monthGrid.map(({ date, isCurrentMonth }: { date: Date; isCurrentMonth: boolean }, index: number) => {
          const dateString = formatDate(date);
          const dayData = scheduleData.find(d => d.date === dateString);
          const isToday = date.getTime() === today.getTime();

          let cellClasses = 'relative h-16 sm:h-20 flex flex-col items-start p-2 rounded-lg transition-colors duration-200 ';
          if (isCurrentMonth) {
            cellClasses += 'bg-slate-800/50 hover:bg-slate-700/70 cursor-pointer';
          } else {
            cellClasses += 'bg-transparent text-gray-600';
          }

          if(isToday && isCurrentMonth) {
              cellClasses += ' ring-2 ring-teal-400';
          }

          return (
            <div key={index} className={cellClasses} onClick={() => isCurrentMonth && onDayClick(date)}>
              <span className={`font-semibold ${isToday && 'text-teal-300'}`}>{date.getDate()}</span>
              {isCurrentMonth && dayData?.type === 'work' && (
                  <div className="absolute bottom-2 left-1/2 -translate-x-1/2 w-1.5 h-1.5 bg-blue-400 rounded-full"></div>
              )}
               {isCurrentMonth && dayData?.type === 'rest' && (
                  <div className="absolute bottom-2 left-1/2 -translate-x-1/2 w-1.5 h-1.5 bg-teal-500 rounded-full"></div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};