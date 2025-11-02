import React, { useMemo } from 'react';
import type { DaySchedule } from '../types.js';
import { generateScheduleSvg } from '../utils/imageUtils.js';

interface ShareModalProps {
  isOpen: boolean;
  onClose: () => void;
  schedule: DaySchedule[];
  weekDays: { name: string; date: Date }[];
  totalHours: string;
  dateRange: string | undefined;
}

const DownloadIcon: React.FC<React.SVGProps<SVGSVGElement>> = (props) => (
  <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...props}>
    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" x2="12" y1="15" y2="3"/>
  </svg>
);


export const ShareModal: React.FC<ShareModalProps> = ({ isOpen, onClose, schedule, weekDays, totalHours, dateRange }) => {
  const [isShowing, setIsShowing] = React.useState(false);
  
  React.useEffect(() => {
    setIsShowing(isOpen);
  }, [isOpen]);

  const svgDataUrl = useMemo(() => {
      if (!schedule || !weekDays || schedule.length === 0) return '';
      return generateScheduleSvg(schedule, weekDays, totalHours, dateRange);
  }, [schedule, weekDays, totalHours, dateRange]);


  const handleClose = () => {
      setIsShowing(false);
      setTimeout(onClose, 300);
  };

  if (!isOpen && !isShowing) return null;

  const fileName = dateRange ? `Orario-${dateRange.replace(/\s/g, '_')}.svg` : 'orario.svg';
  
  return (
    <div 
      className={`fixed inset-0 flex items-center justify-center z-50 transition-opacity duration-300 ${isShowing ? 'opacity-100' : 'opacity-0'}`}
      onClick={handleClose}
    >
      <div className="fixed inset-0 bg-gray-900/80 backdrop-blur-sm"></div>
      <div 
        className={`bg-slate-800 rounded-2xl shadow-2xl p-6 sm:p-8 ring-1 ring-white/10 w-full max-w-lg m-4 transition-all duration-300 ease-out ${isShowing ? 'scale-100 opacity-100' : 'scale-95 opacity-0'}`}
        onClick={e => e.stopPropagation()}
      >
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-xl font-bold text-teal-300">Condividi Orario</h2>
          <button onClick={handleClose} className="p-1.5 rounded-full text-gray-400 hover:bg-slate-700 hover:text-white transition-colors">
             <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
          </button>
        </div>
        
        <div className="bg-slate-900/50 p-4 rounded-lg ring-1 ring-slate-700">
            {svgDataUrl ? (
                <img src={svgDataUrl} alt="Anteprima orario" className="w-full h-auto rounded-md" />
            ) : (
                <div className="h-64 flex items-center justify-center text-gray-500">
                    Errore nella generazione dell'immagine.
                </div>
            )}
        </div>

        <div className="mt-8 flex justify-end">
            <a 
                href={svgDataUrl}
                download={fileName}
                className="px-6 py-3 bg-teal-500 text-white font-bold rounded-lg hover:bg-teal-600 transition-all duration-300 transform hover:-translate-y-1 disabled:opacity-50 flex items-center justify-center gap-2 shadow-lg hover:shadow-xl shadow-teal-500/20 hover:shadow-teal-500/40"
            >
                <DownloadIcon />
                Scarica Immagine
            </a>
        </div>
      </div>
    </div>
  );
};