import React, { useState, useEffect } from 'react';
import { HarmCategory, HarmBlockThreshold } from '@google/genai';
import type { SafetySetting } from '../types.js';

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (apiKey: string, settings: SafetySetting[]) => void;
  currentApiKey: string | null;
  currentSafetySettings: SafetySetting[];
}

const harmCategoryLabels: Record<HarmCategory, string> = {
  [HarmCategory.HARM_CATEGORY_HARASSMENT]: "Molestie",
  [HarmCategory.HARM_CATEGORY_HATE_SPEECH]: "Incitamento all'odio",
  [HarmCategory.HARM_CATEGORY_SEXUALLY_EXPLICIT]: "Contenuti sessualmente espliciti",
  [HarmCategory.HARM_CATEGORY_DANGEROUS_CONTENT]: "Contenuti pericolosi",
  [HarmCategory.HARM_CATEGORY_UNSPECIFIED]: "Non specificato",
};

const harmBlockThresholdOptions: { value: HarmBlockThreshold; label: string }[] = [
    { value: HarmBlockThreshold.HARM_BLOCK_THRESHOLD_UNSPECIFIED, label: 'Predefinito' },
    { value: HarmBlockThreshold.BLOCK_LOW_AND_ABOVE, label: 'Blocca bassi e superiori' },
    { value: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE, label: 'Blocca medi e superiori' },
    { value: HarmBlockThreshold.BLOCK_ONLY_HIGH, label: 'Blocca solo alti' },
    { value: HarmBlockThreshold.BLOCK_NONE, label: 'Blocca nessuno' },
];

export const SettingsModal: React.FC<SettingsModalProps> = ({ isOpen, onClose, onSave, currentApiKey, currentSafetySettings }) => {
  const [key, setKey] = useState('');
  const [settings, setSettings] = useState<SafetySetting[]>([]);
  const [isShowing, setIsShowing] = useState(false);

  useEffect(() => {
    if (isOpen) {
        setIsShowing(true);
        setKey(currentApiKey || '');
        // Deep copy to prevent modifying the original state directly
        setSettings(JSON.parse(JSON.stringify(currentSafetySettings)));
    } else {
        setIsShowing(false);
    }
  }, [isOpen, currentApiKey, currentSafetySettings]);

  const handleClose = () => {
    setIsShowing(false);
    setTimeout(onClose, 300);
  };
  
  const handleSave = () => {
      onSave(key, settings);
  }

  const handleSettingChange = (category: HarmCategory, threshold: HarmBlockThreshold) => {
      setSettings(prevSettings => 
          prevSettings.map(setting => 
              setting.category === category ? { ...setting, threshold } : setting
          )
      );
  }

  if (!isOpen && !isShowing) return null;

  return (
    <div
      className={`fixed inset-0 flex items-center justify-center z-50 transition-opacity duration-300 ${isShowing ? 'opacity-100' : 'opacity-0'}`}
    >
      <div className="fixed inset-0 bg-gray-900/80 backdrop-blur-sm" onClick={handleClose}></div>
      <div
        className={`bg-slate-800 rounded-2xl shadow-2xl p-6 sm:p-8 ring-1 ring-white/10 w-full max-w-lg m-4 transition-all duration-300 ease-out ${isShowing ? 'scale-100 opacity-100' : 'scale-95 opacity-0'}`}
        onClick={e => e.stopPropagation()}
      >
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-xl font-bold text-teal-300">Impostazioni</h2>
           <button onClick={handleClose} className="p-1.5 rounded-full text-gray-400 hover:bg-slate-700 hover:text-white transition-colors">
             <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
          </button>
        </div>
        
        <div className="space-y-6">
            <div>
                <h3 className="text-lg font-semibold text-gray-200 border-b border-slate-700 pb-2 mb-3">Chiave API</h3>
                <p className="text-sm text-gray-400 mb-4">
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
            </div>

            <div>
                <h3 className="text-lg font-semibold text-gray-200 border-b border-slate-700 pb-2 mb-3">Impostazioni di Sicurezza IA</h3>
                 <p className="text-sm text-gray-400 mb-4">
                    Configura il livello di rigore con cui l'IA blocca contenuti potenzialmente dannosi. "Blocca nessuno" è l'opzione più permissiva.
                </p>
                <div className="space-y-3">
                    {settings.map(({ category, threshold }) => (
                         <div key={category} className="flex flex-col sm:flex-row sm:items-center sm:justify-between">
                            <label htmlFor={`safety-${category}`} className="block text-sm font-medium text-gray-300 mb-1 sm:mb-0">
                                {harmCategoryLabels[category] || category}
                            </label>
                            <select
                                id={`safety-${category}`}
                                value={threshold}
                                onChange={(e) => handleSettingChange(category, e.target.value as HarmBlockThreshold)}
                                className="w-full sm:w-64 bg-slate-700/50 text-white text-sm rounded-lg px-3 py-2 border-none focus:outline-none focus:ring-2 focus:ring-teal-500 transition"
                            >
                                {harmBlockThresholdOptions.map(opt => (
                                    <option key={opt.value} value={opt.value}>{opt.label}</option>
                                ))}
                            </select>
                        </div>
                    ))}
                </div>
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
            Salva Impostazioni
          </button>
        </div>
      </div>
    </div>
  );
};