import React from 'react';

type ViewMode = 'week' | 'month';

interface ViewSwitcherProps {
  viewMode: ViewMode;
  setViewMode: (mode: ViewMode) => void;
}

export const ViewSwitcher: React.FC<ViewSwitcherProps> = ({ viewMode, setViewMode }) => {
  const getButtonClasses = (mode: ViewMode) => {
    const baseClasses = 'px-4 py-1.5 text-sm font-semibold rounded-md transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-slate-800 focus:ring-teal-400';
    if (viewMode === mode) {
      return `${baseClasses} bg-teal-500 text-white`;
    }
    return `${baseClasses} bg-slate-700/50 text-gray-300 hover:bg-slate-600`;
  };

  return (
    <div className="flex items-center p-1 bg-slate-800/70 rounded-lg">
      <button onClick={() => setViewMode('week')} className={getButtonClasses('week')}>
        Settimana
      </button>
      <button onClick={() => setViewMode('month')} className={getButtonClasses('month')}>
        Mese
      </button>
    </div>
  );
};