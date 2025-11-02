import React from 'react';
import type { AnalysisEntry } from '../types.js';

interface HistoryPanelProps {
  isOpen: boolean;
  onClose: () => void;
  entries: AnalysisEntry[];
  onLoad: (id: number) => void;
  onDelete: (id: number) => void;
}

export const HistoryPanel: React.FC<HistoryPanelProps> = ({ isOpen, onClose, entries, onLoad, onDelete }) => {
  const [isShowing, setIsShowing] = React.useState(false);
  
  React.useEffect(() => {
    if (isOpen) {
        setIsShowing(true);
    } else {
        setIsShowing(false);
    }
  }, [isOpen]);

  if (!isOpen && !isShowing) return null;


  const sortedEntries = [...entries].sort((a, b) => b.id - a.id);

  return (
    <div className="fixed inset-0 z-40" onClick={onClose}>
      <div className={`absolute inset-0 bg-gray-900/60 backdrop-blur-sm transition-opacity duration-300 ${isShowing ? 'opacity-100' : 'opacity-0'}`}></div>
      <div 
        className={`fixed bottom-0 left-0 right-0 bg-slate-800/95 border-t border-slate-700 shadow-2xl rounded-t-2xl max-h-[75vh] flex flex-col transition-transform duration-300 ease-out ${isShowing ? 'translate-y-0' : 'translate-y-full'}`}
        onClick={e => e.stopPropagation()}
      >
        <div className="p-4 border-b border-slate-700 flex justify-between items-center flex-shrink-0">
          <h2 className="text-lg font-bold text-teal-300">Storico Analisi</h2>
          <button onClick={onClose} className="p-1.5 rounded-full text-gray-400 hover:bg-slate-700 hover:text-white transition-colors">
            <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
          </button>
        </div>
        <div className="overflow-y-auto p-4">
          {sortedEntries.length > 0 ? (
            <ul className="space-y-3">
              {sortedEntries.map((entry, index) => (
                <li key={entry.id} className="bg-slate-900/50 p-3 sm:p-4 rounded-lg flex flex-col sm:flex-row items-center gap-4 ring-1 ring-slate-700 opacity-0 animate-slideInUp" style={{ animationDelay: `${index * 75}ms`}}>
                  <div className="w-20 h-14 sm:w-24 sm:h-16 flex-shrink-0 bg-slate-800/50 rounded-md overflow-hidden flex items-center justify-center ring-1 ring-slate-700">
                    <svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-slate-500"><path d="M12 6v6l4 2"/><circle cx="12" cy="12" r="10"/></svg>
                  </div>
                  <div className="flex-1 text-center sm:text-left">
                    <p className="font-semibold text-white">{entry.dateRange}</p>
                    <p className="text-xs text-gray-400 truncate">{entry.summary}</p>
                  </div>
                  <div className="flex gap-2 flex-shrink-0">
                    <button onClick={() => onLoad(entry.id)} className="px-3 py-1.5 text-sm bg-teal-500 text-white font-semibold rounded-md hover:bg-teal-600 transition-colors transform hover:scale-105">Carica</button>
                    <button onClick={() => onDelete(entry.id)} className="p-1.5 text-red-400 hover:text-red-300 hover:bg-red-900/50 rounded-md transition-colors transform hover:scale-110">
                       <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg>
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          ) : (
            <div className="text-center py-12">
              <p className="text-gray-400">Nessuna analisi salvata nello storico.</p>
              <p className="text-sm text-gray-500 mt-1">Completa un'analisi per salvarla qui.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};