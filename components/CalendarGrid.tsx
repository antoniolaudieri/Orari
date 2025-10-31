import React from 'react';
import type { DaySchedule } from '../types';
import { timeToMinutes } from '../utils/dateUtils';

interface CalendarGridProps {
  weekDays: string[];
  schedule: DaySchedule[];
  onDayClick: (daySchedule: DaySchedule) => void;
  now: Date;
}

const RestDayContent = () => (
    <div className="relative w-full h-full flex flex-col items-center justify-end text-center overflow-hidden">
        {/* Stars */}
        <svg className="absolute top-0 left-0 w-full h-full text-teal-400" style={{ animation: 'twinkle 4s ease-in-out infinite' }}>
            <circle cx="20%" cy="25%" r="1" className="opacity-50" />
            <circle cx="80%" cy="30%" r="1" style={{ animationDelay: '1s' }} />
            <circle cx="50%" cy="15%" r="1" className="opacity-70" style={{ animationDelay: '2s' }} />
            <circle cx="90%" cy="50%" r="1" style={{ animationDelay: '3s' }} />
        </svg>

        {/* Moon */}
        <svg className="absolute top-4 right-4 w-6 h-6 text-teal-200 opacity-60" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ filter: 'drop-shadow(0 0 5px currentColor)' }}>
            <path d="M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9Z"/>
        </svg>

        {/* Coffee Cup with animated steam */}
        <div className="relative mb-3">
             <svg className="absolute -top-6 left-1/2 -translate-x-1/2 w-8 h-8 text-teal-200 opacity-40">
                <path d="M4 0 Q5 5 4 10" stroke="currentColor" strokeWidth="1.5" fill="none" style={{ animation: 'steam 3s linear infinite', animationDelay: '0s' }} />
                <path d="M8 0 Q7 5 8 10" stroke="currentColor" strokeWidth="1.5" fill="none" style={{ animation: 'steam 3s linear infinite', animationDelay: '1s' }} />
                <path d="M12 0 Q13 5 12 10" stroke="currentColor" strokeWidth="1.5" fill="none" style={{ animation: 'steam 3s linear infinite', animationDelay: '2s' }} />
             </svg>
            <svg xmlns="http://www.w3.org/2000/svg" width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-teal-300">
                <path d="M18 8h1a4 4 0 0 1 0 8h-1"/><path d="M2 8h16v9a4 4 0 0 1-4 4H6a4 4 0 0 1-4-4V8z"/>
            </svg>
        </div>
        <span className="font-bold text-lg text-teal-300">Riposo</span>
    </div>
);


const DayCard: React.FC<{ dayName: string; daySchedule: DaySchedule; onClick: () => void; delay: number; now: Date; }> = ({ dayName, daySchedule, onClick, delay, now }) => {
  const { date, type, shifts, isUncertain } = daySchedule;
  const dayDate = new Date(date + 'T00:00:00');
  const dayOfMonth = dayDate.getDate();

  const isToday = now.toDateString() === dayDate.toDateString();
  const isPast = !isToday && dayDate < now;
  
  const nowMinutes = now.getHours() * 60 + now.getMinutes();
  const timelinePercent = (nowMinutes / (24 * 60)) * 100;


  let cardClasses = "relative flex flex-col rounded-xl p-3 sm:p-4 h-44 sm:h-52 transition-all duration-300 shadow-lg transform opacity-0 group ";
  let content;
  
  cardClasses += " animate-scaleIn";
  
  if (isPast) {
      cardClasses += " opacity-60 filter grayscale-[50%]";
  }


  switch (type) {
    case 'work':
      cardClasses += " bg-blue-900/30 ring-1 ring-blue-500/50 cursor-pointer hover:bg-blue-900/50 hover:ring-blue-400";
      content = (
        <div className="relative w-full h-full">
            {shifts.map((shift, index) => {
                const startMinutes = timeToMinutes(shift.start);
                const topPercent = (startMinutes / (24 * 60)) * 100;
                return (
                    <div 
                        key={index} 
                        className="absolute w-[90%] left-1/2 -translate-x-1/2 bg-black/50 rounded px-1 py-0.5 text-xs font-mono font-bold tracking-tight text-white transition-transform duration-200 group-hover:scale-105 shadow-md text-center"
                        style={{ top: `${topPercent}%`, transitionDelay: `${index * 50}ms`}}
                    >
                        <span>{shift.start}</span>
                        <span className="text-blue-400/80 mx-1">-</span>
                        <span>{shift.end}</span>
                    </div>
                );
            })}
        </div>
      );
      break;
    case 'rest':
      cardClasses += "bg-gradient-to-t from-teal-900/50 to-slate-800/50 ring-1 ring-teal-500/50 overflow-hidden";
      content = <RestDayContent />;
      break;
    default: // 'empty'
      cardClasses += "bg-slate-800/50";
      content = (
        <div className="flex items-center justify-center h-full text-gray-600">
          <span>-</span>
        </div>
      );
      break;
  }

  return (
    <div className={cardClasses} onClick={type === 'work' ? onClick : undefined} style={{ animationDelay: `${delay}ms` }}>
      {isUncertain && (
        <div className="absolute top-2.5 right-2.5 z-10" title="L'IA ha interpretato questo giorno con incertezza. Si prega di controllare.">
          <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" className="text-yellow-400 animate-pulse"><path d="m21.73 18-8-14a2 2 0 0 0-3.46 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z"/><line x1="12" x2="12" y1="9" y2="13"/><line x1="12" x2="12.01" y1="17" y2="17"/></svg>
        </div>
      )}
      <div className="flex justify-between items-baseline mb-2">
        <span className="font-bold text-sm capitalize text-gray-300">{dayName.substring(0, 3)}</span>
        <span className="text-lg font-mono text-gray-400">{String(dayOfMonth).padStart(2, '0')}</span>
      </div>
      <div className="flex-grow relative overflow-hidden">
          {content}
          {isToday && (
              <div 
                  className="absolute left-0 right-0 h-0.5 z-20 flex items-center"
                  style={{ top: `${timelinePercent}%` }}
              >
                  <div className="w-2 h-2 -ml-1 rounded-full bg-red-500 shadow-lg animate-pulse"></div>
                  <div className="w-full h-[1px] bg-red-500/70 shadow"></div>
              </div>
          )}
      </div>
    </div>
  );
};


export const CalendarGrid: React.FC<CalendarGridProps> = ({ weekDays, schedule, onDayClick, now }) => {
  if (!schedule || schedule.length === 0) {
    return (
      <div className="text-center py-10 text-gray-500">
        Nessun dato del calendario da visualizzare per questa settimana.
      </div>
    );
  }

  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-7 gap-2 sm:gap-4">
      {schedule.map((daySchedule, index) => (
        <DayCard 
          key={daySchedule.date || index} 
          dayName={weekDays[index]} 
          daySchedule={daySchedule}
          onClick={() => onDayClick(daySchedule)}
          delay={index * 50}
          now={now}
        />
      ))}
    </div>
  );
};