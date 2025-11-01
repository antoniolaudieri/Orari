import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { GoogleGenAI, HarmCategory, HarmBlockThreshold, Type } from '@google/genai';
import { ImageUploader } from './components/ImageUploader.js';
import { CalendarGrid } from './components/CalendarGrid.js';
import { WeekNavigator } from './components/WeekNavigator.js';
import { HourTracker } from './components/HourTracker.js';
import { LoadingOverlay } from './components/LoadingOverlay.js';
import { ErrorDisplay } from './components/ErrorDisplay.js';
import { WelcomeMessage } from './components/WelcomeMessage.js';
import { ShiftModal } from './components/ShiftModal.js';
import { AnalysisSummary } from './components/AnalysisSummary.js';
import { HistoryPanel } from './components/HistoryPanel.js';
import { ViewSwitcher } from './components/ViewSwitcher.js';
import { MonthCalendar } from './components/MonthCalendar.js';
import { DayDetailView } from './components/DayDetailView.js';
import { ApiKeyModal } from './components/ApiKeyModal.js';
import type { DaySchedule, AnalysisEntry } from './types.js';
import { getWeekStartDate, formatDate, getWeekDays } from './utils/dateUtils.js';

const geminiModel = 'gemini-2.5-flash';
const safetySettings = [
    { category: HarmCategory.HARM_CATEGORY_HARASSMENT, threshold: HarmBlockThreshold.BLOCK_NONE },
    { category: HarmCategory.HARM_CATEGORY_HATE_SPEECH, threshold: HarmBlockThreshold.BLOCK_NONE },
    { category: HarmCategory.HARM_CATEGORY_SEXUALLY_EXPLICIT, threshold: HarmBlockThreshold.BLOCK_NONE },
    { category: HarmCategory.HARM_CATEGORY_DANGEROUS_CONTENT, threshold: HarmBlockThreshold.BLOCK_NONE },
];

const jsonSchema = {
    type: Type.OBJECT,
    properties: {
        dateRange: { type: Type.STRING, description: "L'intervallo di date della settimana, es. '27 Maggio - 02 Giugno 2024'." },
        schedule: {
            type: Type.ARRAY,
            description: "Un array di 7 oggetti, uno per ogni giorno da Lunedì a Domenica.",
            items: {
                type: Type.OBJECT,
                properties: {
                    date: { type: Type.STRING, description: "La data del giorno in formato YYYY-MM-DD." },
                    type: { type: Type.STRING, description: "Tipo di giornata: 'work' per lavoro, 'rest' per riposo, o 'empty' se non specificato." },
                    shifts: {
                        type: Type.ARRAY,
                        description: "Un array di turni per la giornata. Vuoto se è riposo o non specificato.",
                        items: {
                            type: Type.OBJECT,
                            properties: {
                                start: { type: Type.STRING, description: "Orario di inizio turno in formato HH:MM (24h)." },
                                end: { type: Type.STRING, description: "Orario di fine turno in formato HH:MM (24h)." },
                            },
                            required: ['start', 'end']
                        }
                    },
                    isUncertain: { type: Type.BOOLEAN, description: "True se l'IA non è sicura dell'interpretazione di questo giorno, altrimenti false." }
                },
                required: ['date', 'type', 'shifts', 'isUncertain']
            }
        },
        summary: { type: Type.STRING, description: "Un breve riassunto testuale dell'orario, es. 'Settimana con 5 giorni lavorativi e 2 di riposo, con un totale di X ore.'" },
    },
    required: ['dateRange', 'schedule', 'summary']
};

const getSystemInstruction = () => `Sei un assistente specializzato nell'analizzare immagini di orari di lavoro settimanali, nello specifico per l'azienda "Appiani". Il tuo compito è estrarre con la massima precisione le informazioni e restituirle in formato JSON.

Regole di Analisi:
1.  **Formato Input**: Riceverai un'immagine contenente un orario settimanale. L'orario va da Lunedì a Domenica.
2.  **Identifica le Date**: Trova l'intervallo di date della settimana. Determina la data esatta (YYYY-MM-DD) per ogni giorno da Lunedì a Domenica. L'anno corrente è ${new Date().getFullYear()}.
3.  **Analisi Giornaliera**: Per ogni giorno, estrai i turni di lavoro. Un giorno può avere uno o più turni. Ogni turno ha un orario di inizio e uno di fine in formato HH:MM (24 ore).
4.  **Tipi di Giornata**:
    *   'work': Se ci sono turni di lavoro.
    *   'rest': Se è indicato esplicitamente "RIPOSO" o una dicitura simile.
    *   'empty': Se la casella del giorno è vuota o non interpretabile.
5.  **Incertezza**: Se non riesci a leggere chiaramente un orario o un giorno, imposta \`isUncertain\` a \`true\` per quel giorno e fai una stima plausibile. Non lasciare mai un turno parziale (es. solo inizio o solo fine).
6.  **Output**: Restituisci SEMPRE un oggetto JSON strutturato secondo lo schema fornito, con 7 elementi nell'array \`schedule\`, uno per ogni giorno da Lunedì a Domenica in ordine. Assicurati che tutti i campi richiesti dallo schema siano presenti.
7.  **Riepilogo (Summary)**: Crea un breve riassunto testuale dell'orario, menzionando i giorni lavorativi, i riposi e una nota generale.
8.  **Gestione Errori**: Se l'immagine è illeggibile o non contiene un orario, restituisci un JSON con un messaggio di errore nel campo 'summary'.`;

const App: React.FC = () => {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [schedule, setSchedule] = useState<DaySchedule[] | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedDay, setSelectedDay] = useState<DaySchedule | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [currentAnalysis, setCurrentAnalysis] = useState<AnalysisEntry | null>(null);
  const [history, setHistory] = useState<AnalysisEntry[]>([]);
  const [isHistoryPanelOpen, setIsHistoryPanelOpen] = useState(false);
  const [now, setNow] = useState(new Date());
  const [viewMode, setViewMode] = useState<'week' | 'month'>('week');
  const [dayDetail, setDayDetail] = useState<DaySchedule | null>(null);
  const [isDayDetailOpen, setIsDayDetailOpen] = useState(false);
  const [apiKey, setApiKey] = useState<string | null>(null);
  const [isApiKeyModalOpen, setIsApiKeyModalOpen] = useState(false);

  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 60000);
    const storedApiKey = localStorage.getItem('gemini-api-key');
    if (storedApiKey) {
      setApiKey(storedApiKey);
    } else {
      setIsApiKeyModalOpen(true);
    }
    return () => clearInterval(timer);
  }, []);

  const loadHistory = useCallback(async () => {
    try {
      const response = await fetch('/api/history');
      if (!response.ok) throw new Error('Failed to fetch history');
      const data: AnalysisEntry[] = await response.json();
      setHistory(data);
    } catch (err) {
      console.error(err);
      setError('Impossibile caricare lo storico delle analisi.');
    }
  }, []);

  useEffect(() => {
    loadHistory();
  }, [loadHistory]);

  const handleSaveApiKey = (newApiKey: string) => {
    setApiKey(newApiKey);
    localStorage.setItem('gemini-api-key', newApiKey);
    setIsApiKeyModalOpen(false);
  };

  const handleAnalyze = async (file: File) => {
    if (!apiKey) {
      setError("Per favore, imposta la tua chiave API di Gemini nelle impostazioni.");
      setIsApiKeyModalOpen(true);
      return;
    }

    setIsLoading(true);
    setError(null);
    
    const reader = new FileReader();
    reader.readAsDataURL(file);
    
    reader.onload = async () => {
        const base64Data = (reader.result as string).split(',')[1];
        
        const saveHistoryInBackground = async (analysisData: Omit<AnalysisEntry, 'id'>) => {
            try {
                const saveResponse = await fetch('/api/analyze', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ analysisResult: analysisData }),
                });
                if (saveResponse.ok) {
                    console.log('Analisi salvata con successo.');
                    loadHistory(); 
                } else {
                    console.error('Salvataggio in background fallito:', await saveResponse.json());
                }
            } catch (saveErr) {
                console.error('Errore durante il salvataggio in background:', saveErr);
            }
        };

        try {
            const ai = new GoogleGenAI({ apiKey });
            
            const imagePart = { inlineData: { data: base64Data, mimeType: file.type } };
            const textPart = { text: "Analizza questa immagine di un orario di lavoro e restituisci i dati strutturati in formato JSON come specificato nelle istruzioni di sistema. Assicurati di seguire lo schema JSON richiesto." };

            const response = await ai.models.generateContent({
                model: geminiModel,
                contents: { parts: [textPart, imagePart] },
                config: {
                    systemInstruction: getSystemInstruction(),
                    responseMimeType: "application/json",
                    responseSchema: jsonSchema,
                },
                safetySettings,
            });

            if (!response.text) {
                throw new Error("L'analisi IA non ha restituito un testo valido.");
            }
            const text = response.text;
            let jsonString = text.trim();

            if (jsonString.startsWith('```json')) {
                jsonString = jsonString.substring(7, jsonString.length - 3).trim();
            } else if (jsonString.startsWith('```')) {
                jsonString = jsonString.substring(3, jsonString.length - 3).trim();
            }

            const analysisResult = JSON.parse(jsonString);

            // FIX: Navigate calendar to the analyzed week
            if (analysisResult.schedule && analysisResult.schedule.length > 0) {
                const firstDayOfSchedule = analysisResult.schedule[0].date;
                // Add T12:00:00Z to avoid timezone issues when creating the date
                setCurrentDate(new Date(firstDayOfSchedule + 'T12:00:00Z'));
            }

            const resultForUI: AnalysisEntry = {
                id: Date.now(),
                ...analysisResult,
                imageData: base64Data,
                mimeType: file.type,
            };

            setCurrentAnalysis(resultForUI);
            setSchedule(analysisResult.schedule);
            setIsLoading(false);

            saveHistoryInBackground(analysisResult);

        } catch (err: any) {
            console.error("Analysis Error:", err);
            setError(err.message || "L'IA non è riuscita a interpretare l'immagine.");
            setIsLoading(false);
        }
    };
    reader.onerror = (error) => {
        console.error("File Reading Error:", error);
        setError("Impossibile leggere il file immagine.");
        setIsLoading(false);
    };
  };

  const handlePreviousWeek = () => setCurrentDate(prev => new Date(prev.setDate(prev.getDate() - 7)));
  const handleNextWeek = () => setCurrentDate(prev => new Date(prev.setDate(prev.getDate() + 7)));
  const handlePreviousMonth = () => setCurrentDate(prev => new Date(prev.setMonth(prev.getMonth() - 1)));
  const handleNextMonth = () => setCurrentDate(prev => new Date(prev.setMonth(prev.getMonth() + 1)));

  const handleDayClick = (day: DaySchedule) => {
      if (viewMode === 'week') {
          setSelectedDay(day);
          setIsModalOpen(true);
      }
  };
  
  const handleMonthDayClick = (date: Date) => {
      const dateString = formatDate(date);
      const dayData = history.flatMap(h => h.schedule).find(d => d.date === dateString);
      setDayDetail(dayData || { date: dateString, type: 'empty', shifts: [] });
      setIsDayDetailOpen(true);
  };

  const handleUpdateDay = (updatedDay: DaySchedule) => {
    if (schedule) {
      setSchedule(schedule.map(day => day.date === updatedDay.date ? updatedDay : day));
      setIsModalOpen(false);
    }
  };

  const handleCloseModal = () => setIsModalOpen(false);
  const handleCloseDayDetail = () => setIsDayDetailOpen(false);

  const handleLoadHistory = (id: number) => {
    const entry = history.find(e => e.id === id);
    if (entry) {
        if (entry.schedule && entry.schedule.length > 0) {
            const firstDayOfSchedule = entry.schedule[0].date;
            setCurrentDate(new Date(firstDayOfSchedule + 'T12:00:00Z'));
        }
        setCurrentAnalysis(entry);
        setSchedule(entry.schedule);
        setIsHistoryPanelOpen(false);
    }
  };

  const handleDeleteHistory = async (id: number) => {
    try {
      const response = await fetch(`/api/history/${id}`, { method: 'DELETE' });
      if (!response.ok) throw new Error('Failed to delete entry');
      setHistory(prev => prev.filter(e => e.id !== id));
    } catch (err) {
      setError('Impossibile eliminare la voce dallo storico.');
    }
  };

  const weekDays = useMemo(() => getWeekDays(currentDate).map(d => d.name), [currentDate]);

  const scheduleForWeekView = useMemo(() => {
    if (schedule) {
        const weekStart = getWeekStartDate(currentDate);
        const weekDates = getWeekDays(weekStart).map(day => formatDate(day.date));
        const matchingSchedule = schedule.filter(day => weekDates.includes(day.date));
        // Check if there is a matching schedule, even if not a full week
        if (matchingSchedule.length > 0) return matchingSchedule;
    }
    return getWeekDays(currentDate).map(day => ({ date: formatDate(day.date), type: 'empty', shifts: [] }));
  }, [schedule, currentDate]);
  
  const scheduleForMonthView = useMemo(() => history.flatMap(entry => entry.schedule), [history]);

  return (
    <>
      {isLoading && <LoadingOverlay />}
      <ApiKeyModal
        isOpen={isApiKeyModalOpen}
        onClose={() => setIsApiKeyModalOpen(false)}
        onSave={handleSaveApiKey}
        currentApiKey={apiKey}
      />
      <div className="min-h-screen flex flex-col items-center p-2 sm:p-4 md:p-6 text-gray-100">
        <main className="w-full max-w-7xl mx-auto">
          <header className="flex flex-col sm:flex-row justify-between items-center mb-4 sm:mb-6 p-4 bg-gray-900/30 rounded-2xl ring-1 ring-white/10 animate-slideInUp">
            <div className="flex items-center gap-3">
              <svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-teal-400"><path d="M12 2a10 10 0 1 0 10 10c0-4.42-2.87-8.1-7-9.44"/><path d="m13 2-3 9 9 3-3-9Z"/></svg>
              <h1 className="text-xl sm:text-2xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-white to-gray-400">
                Orario Intelligente
              </h1>
            </div>
            <div className='flex items-center gap-2 mt-3 sm:mt-0'>
                <button 
                  onClick={() => setIsHistoryPanelOpen(true)}
                  className="p-2.5 rounded-lg bg-slate-700/50 hover:bg-teal-500 text-gray-300 hover:text-white transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-teal-400 transform hover:-translate-y-0.5"
                  aria-label="Apri storico"
                >
                    <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M22 12h-4l-3 9L9 3l-3 9H2"/></svg>
                </button>
                <button
                  onClick={() => setIsApiKeyModalOpen(true)}
                  className="p-2.5 rounded-lg bg-slate-700/50 hover:bg-yellow-500 text-gray-300 hover:text-white transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-yellow-400 transform hover:-translate-y-0.5"
                  aria-label="Impostazioni API"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 0 2l-.15.08a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.38a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1 0-2l.15-.08a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z"/><circle cx="12" cy="12" r="3"/></svg>
                </button>
            </div>
          </header>
          
          <ImageUploader 
            onAnalyze={handleAnalyze} 
            isLoading={isLoading} 
            initialPreview={currentAnalysis?.imageData && currentAnalysis?.mimeType ? `data:${currentAnalysis.mimeType};base64,${currentAnalysis.imageData}` : null} 
          />

          {error && <ErrorDisplay message={error} />}

          {currentAnalysis && <AnalysisSummary summary={currentAnalysis.summary} />}
          
          <div className="mt-6 sm:mt-8">
            <div className="flex flex-col sm:flex-row justify-between items-center mb-4 gap-4">
              <div className="flex items-center gap-4">
                  <ViewSwitcher viewMode={viewMode} setViewMode={setViewMode} />
                  <WeekNavigator onPrevious={viewMode === 'week' ? handlePreviousWeek : handlePreviousMonth} onNext={viewMode === 'week' ? handleNextWeek : handleNextMonth} />
              </div>
              <h2 className="text-lg font-semibold text-gray-300 order-first sm:order-none animate-text-glow">
                {viewMode === 'week' ?
                  `${getWeekStartDate(currentDate).toLocaleDateString('it-IT', { day: 'numeric', month: 'long' })} - ${new Date(new Date(getWeekStartDate(currentDate)).setDate(getWeekStartDate(currentDate).getDate() + 6)).toLocaleDateString('it-IT', { day: 'numeric', month: 'long', year: 'numeric' })}` :
                  currentDate.toLocaleDateString('it-IT', { month: 'long', year: 'numeric' })
                }
              </h2>
              {schedule && <HourTracker schedule={scheduleForWeekView} />}
            </div>

            {viewMode === 'week' ? (
                schedule && schedule.length > 0 ? (
                    <CalendarGrid 
                        weekDays={weekDays} 
                        schedule={scheduleForWeekView} 
                        onDayClick={handleDayClick} 
                        now={now}
                    />
                ) : (
                   !isLoading && <WelcomeMessage />
                )
            ) : (
                <MonthCalendar 
                    currentDate={currentDate}
                    scheduleData={scheduleForMonthView}
                    onDayClick={handleMonthDayClick}
                />
            )}
          </div>
        </main>
      </div>

      <ShiftModal isOpen={isModalOpen} onClose={handleCloseModal} daySchedule={selectedDay} onUpdateDay={handleUpdateDay} />
      <HistoryPanel isOpen={isHistoryPanelOpen} onClose={() => setIsHistoryPanelOpen(false)} entries={history} onLoad={handleLoadHistory} onDelete={handleDeleteHistory} />
      <DayDetailView isOpen={isDayDetailOpen} onClose={handleCloseDayDetail} daySchedule={dayDetail} />
    </>
  );
};

export default App;