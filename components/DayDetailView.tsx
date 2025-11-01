import React, { useState, useEffect, useMemo } from 'react';
import type { DaySchedule, Shift } from '../types.js';
import { calculateHours, formatDecimalHours } from '../utils/dateUtils.js';

interface DayDetailViewProps {
  isOpen: boolean;
  onClose: () => void;
  daySchedule: DaySchedule | null;
}

export const DayDetailView: React.FC<DayDetailViewProps> = ({ isOpen, onClose, daySchedule }) => {
  const [isShowing, setIsShowing] = useState(false);

  useEffect(() => {
    if (isOpen) {
        setIsShowing(true);
    } else {
        setIsShowing(false);
    }
  }, [isOpen]);

  const totalHours = useMemo(() => {
    if (!daySchedule || daySchedule.type !== 'work') return 0;
    return daySchedule.shifts.reduce((total: number, shift: Shift) => total + calculateHours(shift.start, shift.end), 0);
  }, [daySchedule]);

  const formattedTotalHours = useMemo(() => formatDecimalHours(totalHours), [totalHours]);

  const formattedDate = useMemo(() => {
      if (!daySchedule) return '';
      return new Date(daySchedule.date + 'T12:00:00Z').toLocaleDateString('it-IT', {
        weekday: 'long',
        day: 'numeric',
        month: 'long',
      });
  }, [daySchedule]);
  
  const handleClose = () => {
      setIsShowing(false);
      setTimeout(onClose, 300);
  }

  if (!isOpen && !isShowing) return null;
  if (!daySchedule) return null;

  return (
    <div 
      className={`fixed inset-0 flex items-center justify-center z-50 transition-opacity duration-300 ${isShowing ? 'opacity-100' : 'opacity-0'}`}
      onClick={handleClose}
    >
      <div className="fixed inset-0 bg-gray-900/80 backdrop-blur-sm"></div>
      <div 
        className={`bg-slate-800 rounded-2xl shadow-2xl p-6 sm:p-8 ring-1 ring-white/10 w-full max-w-sm m-4 transition-all duration-300 ease-out ${isShowing ? 'scale-100 opacity-100' : 'scale-95 opacity-0'}`}
        onClick={e => e.stopPropagation()}
      >
        <div className="flex justify-between items-start mb-4">
          <h2 className="text-xl font-bold text-teal-300 capitalize">{formattedDate}</h2>
          <button onClick={handleClose} className="p-1.5 rounded-full text-gray-400 hover:bg-slate-700 hover:text-white transition-colors">
             <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
          </button>
        </div>
        
        {daySchedule.isUncertain && (
          <div className="mb-4 p-3 bg-yellow-900/50 border border-yellow-500/50 text-yellow-300 rounded-lg text-sm flex items-center gap-2">
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" className="flex-shrink-0"><path d="m21.73 18-8-14a2 2 0 0 0-3.46 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z"/><line x1="12" x2="12" y1="9" y2="13"/><line x1="12" x2="12.01" y1="17" y2="17"/></svg>
            L'IA ha interpretato questo giorno con incertezza.
          </div>
        )}

        {daySchedule.type === 'work' && (
          <div>
            <h3 className="text-sm font-semibold text-gray-400 mb-2">Turni di lavoro</h3>
            <div className="space-y-2">
              {daySchedule.shifts.map((shift: Shift, index: number) => (
                <div key={index} className="flex justify-between items-center bg-slate-900/50 p-3 rounded-lg ring-1 ring-slate-700">
                  <span className="font-mono font-semibold tracking-wide text-white">{shift.start} - {shift.end}</span>
                  <span className="text-sm text-gray-400">{formatDecimalHours(calculateHours(shift.start, shift.end))}</span>
                </div>
              ))}
            </div>
            <div className="mt-4 pt-4 border-t border-slate-700 flex justify-between items-center">
              <span className="font-bold text-gray-300">Totale Ore Giorno:</span>
              <span className="text-lg font-bold text-white bg-gray-700/50 px-3 py-1 rounded-md">{formattedTotalHours}</span>
            </div>
          </div>
        )}

        {daySchedule.type === 'rest' && (
          <div className="text-center py-8">
            <svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-teal-400 mx-auto mb-3">
                <path d="M18 8h1a4 4 0 0 1 0 8h-1"/><path d="M2 8h16v9a4 4 0 0 1-4 4H6a4 4 0 0 1-4-4V8z"/>
            </svg>
            <p className="font-bold text-lg text-teal-300">Giorno di Riposo</p>
          </div>
        )}

        {daySchedule.type === 'empty' && (
          <div className="text-center py-8">
             <p className="text-gray-500">Nessuna informazione disponibile per questo giorno.</p>
          </div>
        )}
      </div>
    </div>
  );
};