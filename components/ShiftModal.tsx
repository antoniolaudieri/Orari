import React, { useState, useEffect } from 'react';
import type { DaySchedule, Shift } from '../types.js';

interface ShiftModalProps {
  isOpen: boolean;
  onClose: () => void;
  daySchedule: DaySchedule | null;
  onUpdateDay: (updatedDay: DaySchedule) => void;
}

export const ShiftModal: React.FC<ShiftModalProps> = ({ isOpen, onClose, daySchedule, onUpdateDay }) => {
  const [editableShifts, setEditableShifts] = useState<Shift[]>([]);
  const [isShowing, setIsShowing] = useState(false);

  useEffect(() => {
    if (isOpen) {
        setIsShowing(true);
        if (daySchedule) {
            setEditableShifts(JSON.parse(JSON.stringify(daySchedule.shifts)));
        }
    } else {
        setIsShowing(false);
    }
  }, [isOpen, daySchedule]);
  
  const handleClose = () => {
      setIsShowing(false);
      // Wait for animation to finish before calling parent's onClose
      setTimeout(onClose, 300);
  }


  if (!isOpen && !isShowing) return null;
  if(!daySchedule) return null;

  const handleShiftChange = (index: number, field: keyof Shift, value: string) => {
    const updatedShifts = [...editableShifts];
    updatedShifts[index] = { ...updatedShifts[index], [field]: value };
    setEditableShifts(updatedShifts);
  };

  const handleAddShift = () => {
    setEditableShifts([...editableShifts, { start: '00:00', end: '00:00' }]);
  };

  const handleDeleteShift = (index: number) => {
    const updatedShifts = editableShifts.filter((_, i) => i !== index);
    setEditableShifts(updatedShifts);
  };

  const handleSaveChanges = () => {
    const newType = editableShifts.length > 0 ? 'work' : 'rest';
    onUpdateDay({ ...daySchedule, shifts: editableShifts, type: newType });
  };

  const formattedDate = new Date(daySchedule.date + 'T12:00:00Z').toLocaleDateString('it-IT', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  });

  return (
    <div 
      className={`fixed inset-0 flex items-center justify-center z-50 transition-opacity duration-300 ${isShowing ? 'opacity-100' : 'opacity-0'}`}
      onClick={handleClose}
    >
      <div className="fixed inset-0 bg-gray-900/80 backdrop-blur-sm"></div>
      <div 
        className={`bg-slate-800 rounded-2xl shadow-2xl p-6 sm:p-8 ring-1 ring-white/10 w-full max-w-md m-4 transition-all duration-300 ease-out ${isShowing ? 'scale-100 opacity-100' : 'scale-95 opacity-0'}`}
        onClick={e => e.stopPropagation()}
      >
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-xl font-bold text-teal-300 capitalize">{formattedDate}</h2>
          <button onClick={handleClose} className="p-1.5 rounded-full text-gray-400 hover:bg-slate-700 hover:text-white transition-colors">
             <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
          </button>
        </div>
        
        <div className="space-y-4 max-h-64 overflow-y-auto pr-2">
          {editableShifts.map((shift, index) => (
            <div key={index} className="flex items-center gap-2 bg-slate-900/50 p-3 rounded-lg ring-1 ring-slate-700">
              <input 
                type="time" 
                value={shift.start}
                onChange={(e) => handleShiftChange(index, 'start', e.target.value)}
                className="bg-slate-700 text-white rounded px-2 py-1.5 w-full focus:outline-none focus:ring-2 focus:ring-teal-500 border-none"
              />
              <span className="text-gray-400">-</span>
              <input 
                type="time" 
                value={shift.end}
                onChange={(e) => handleShiftChange(index, 'end', e.target.value)}
                className="bg-slate-700 text-white rounded px-2 py-1.5 w-full focus:outline-none focus:ring-2 focus:ring-teal-500 border-none"
              />
              <button onClick={() => handleDeleteShift(index)} className="p-2 text-red-400 hover:text-red-300 hover:bg-red-900/50 rounded-full transition-colors">
                <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg>
              </button>
            </div>
          ))}
        </div>

        <button 
            onClick={handleAddShift}
            className="w-full mt-4 py-2 text-sm text-teal-300 border border-dashed border-slate-600 rounded-lg hover:bg-slate-700/50 hover:border-teal-500 transition-colors"
        >
            + Aggiungi Turno
        </button>

        <div className="mt-8 flex justify-end gap-4">
          <button 
            onClick={handleClose}
            className="px-5 py-2 bg-slate-700 text-gray-200 rounded-lg hover:bg-slate-600 transition-colors"
          >
            Annulla
          </button>
          <button 
            onClick={handleSaveChanges}
            className="px-5 py-2 bg-teal-500 text-white font-bold rounded-lg hover:bg-teal-600 transition-colors"
          >
            Salva Modifiche
          </button>
        </div>
      </div>
    </div>
  );
};