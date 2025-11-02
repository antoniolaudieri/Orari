import React, { useState, useEffect } from 'react';

interface DateEditModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (newStartDate: Date) => void;
  currentStartDate: Date;
}

const months = [
    "Gennaio", "Febbraio", "Marzo", "Aprile", "Maggio", "Giugno", 
    "Luglio", "Agosto", "Settembre", "Ottobre", "Novembre", "Dicembre"
];

export const DateEditModal: React.FC<DateEditModalProps> = ({ isOpen, onClose, onSave, currentStartDate }) => {
  const [selectedMonth, setSelectedMonth] = useState(0);
  const [selectedYear, setSelectedYear] = useState(2024);
  const [isShowing, setIsShowing] = useState(false);

  useEffect(() => {
    if (isOpen) {
        setIsShowing(true);
        setSelectedMonth(currentStartDate.getMonth());
        setSelectedYear(currentStartDate.getFullYear());
    } else {
        setIsShowing(false);
    }
  }, [isOpen, currentStartDate]);
  
  const handleClose = () => {
      setIsShowing(false);
      setTimeout(onClose, 300);
  }

  const handleSave = () => {
      const newDate = new Date(currentStartDate);
      newDate.setFullYear(selectedYear);
      newDate.setMonth(selectedMonth);
      onSave(newDate);
      handleClose();
  }

  if (!isOpen && !isShowing) return null;

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
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-xl font-bold text-teal-300">Modifica Data</h2>
          <button onClick={handleClose} className="p-1.5 rounded-full text-gray-400 hover:bg-slate-700 hover:text-white transition-colors">
             <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
          </button>
        </div>
        
        <div className="space-y-4">
            <div>
                <label htmlFor="month-select" className="block text-sm font-medium text-gray-300 mb-2">Mese</label>
                <select 
                    id="month-select"
                    value={selectedMonth} 
                    onChange={e => setSelectedMonth(parseInt(e.target.value))}
                    className="w-full bg-slate-700/50 text-white rounded-lg px-4 py-2.5 border-none focus:outline-none focus:ring-2 focus:ring-teal-500 transition"
                >
                    {months.map((month, index) => (
                        <option key={month} value={index}>{month}</option>
                    ))}
                </select>
            </div>
            <div>
                <label htmlFor="year-input" className="block text-sm font-medium text-gray-300 mb-2">Anno</label>
                <input 
                    id="year-input"
                    type="number"
                    value={selectedYear}
                    onChange={e => setSelectedYear(parseInt(e.target.value))}
                    className="w-full bg-slate-700/50 text-white rounded-lg px-4 py-2.5 border-none focus:outline-none focus:ring-2 focus:ring-teal-500 transition"
                    placeholder="YYYY"
                />
            </div>
        </div>

        <div className="mt-8 flex justify-end gap-4">
          <button 
            onClick={handleClose}
            className="px-5 py-2 bg-slate-700 text-gray-200 rounded-lg hover:bg-slate-600 transition-colors"
          >
            Annulla
          </button>
          <button 
            onClick={handleSave}
            className="px-5 py-2 bg-teal-500 text-white font-bold rounded-lg hover:bg-teal-600 transition-colors"
          >
            Salva
          </button>
        </div>
      </div>
    </div>
  );
};