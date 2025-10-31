import React from 'react';

interface WeekNavigatorProps {
  onPrevious: () => void;
  onNext: () => void;
}

const ArrowLeftIcon: React.FC<React.SVGProps<SVGSVGElement>> = (props) => (
  <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...props}><path d="m15 18-6-6 6-6"/></svg>
);

const ArrowRightIcon: React.FC<React.SVGProps<SVGSVGElement>> = (props) => (
  <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...props}><path d="m9 18 6-6-6-6"/></svg>
);

export const WeekNavigator: React.FC<WeekNavigatorProps> = ({ onPrevious, onNext }) => {
  return (
    <div className="flex items-center gap-2">
      <button
        onClick={onPrevious}
        className="p-2.5 rounded-lg bg-slate-700/50 hover:bg-teal-500 text-gray-300 hover:text-white transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-teal-400 transform hover:-translate-y-0.5"
        aria-label="Precedente"
      >
        <ArrowLeftIcon className="w-5 h-5" />
      </button>
      <button
        onClick={onNext}
        className="p-2.5 rounded-lg bg-slate-700/50 hover:bg-teal-500 text-gray-300 hover:text-white transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-teal-400 transform hover:-translate-y-0.5"
        aria-label="Successivo"
      >
        <ArrowRightIcon className="w-5 h-5" />
      </button>
    </div>
  );
};