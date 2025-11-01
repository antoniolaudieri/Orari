import React, { useState, useEffect } from 'react';

interface ApiKeyModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (apiKey: string) => void;
  currentApiKey: string | null;
}

export const ApiKeyModal: React.FC<ApiKeyModalProps> = ({ isOpen, onClose, onSave, currentApiKey }) => {
  const [key, setKey] = useState('');
  const [isShowing, setIsShowing] = useState(false);

  useEffect(() => {
    if (isOpen) {
        setIsShowing(true);
        setKey(currentApiKey || '');
    } else {
        setIsShowing(false);
    }
  }, [isOpen, currentApiKey]);

  const handleClose = () => {
    setIsShowing(false);
    setTimeout(onClose, 300);
  };
  
  const handleSave = () => {
      onSave(key);
  }

  if (!isOpen && !isShowing) return null;

  return (
    <div
      className={`fixed inset-0 flex items-center justify-center z-50 transition-opacity duration-300 ${isShowing ? 'opacity-100' : 'opacity-0'}`}
    >
      <div className="fixed inset-0 bg-gray-900/80 backdrop-blur-sm" onClick={handleClose}></div>
      <div
        className={`bg-slate-800 rounded-2xl shadow-2xl p-6 sm:p-8 ring-1 ring-white/10 w-full max-w-md m-4 transition-all duration-300 ease-out ${isShowing ? 'scale-100 opacity-100' : 'scale-95 opacity-0'}`}
        onClick={e => e.stopPropagation()}
      >
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-xl font-bold text-teal-300">Impostazioni API</h2>
           <button onClick={handleClose} className="p-1.5 rounded-full text-gray-400 hover:bg-slate-700 hover:text-white transition-colors">
             <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
          </button>
        </div>
        
        <p className="text-sm text-gray-400 mb-6">
          Inserisci la tua chiave API di Google Gemini per attivare l'analisi IA. La chiave verrà salvata solo nel tuo browser.
        </p>

        <div>
            <label htmlFor="apiKey" className="block text-sm font-medium text-gray-300 mb-2">Chiave API Gemini</label>
            <input
            id="apiKey"
            type="password"
            value={key}
            onChange={(e) => setKey(e.target.value)}
            className="w-full bg-slate-700/50 text-white rounded-lg px-4 py-2.5 border-none focus:outline-none focus:ring-2 focus:ring-teal-500 transition"
            placeholder="***************************************"
            />
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
            Salva Chiave
          </button>
        </div>
      </div>
    </div>
  );
};
