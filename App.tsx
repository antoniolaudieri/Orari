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
import { ShareModal } from './components/ShareModal.js';
import type { DaySchedule, AnalysisEntry, Shift } from './types.js';
import { getWeekStartDate, formatDate, getWeekDays, calculateHours, formatDecimalHours } from './utils/dateUtils.js';
import { createImageThumbnail } from './utils/imageUtils.js';

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
    *   'rest': Se è indicato esplicitamente "RIPOSO", una singola "R", un trattino ("-"), o una dicitura simile.
    *   'empty': Se la casella del giorno è vuota o non interpretabile e non rientra nei casi precedenti.
5.  **Incertezza**: Se non riesci a leggere chiaramente un orario o un giorno, imposta \`isUncertain\` a \`true\`.`;

const App: React.FC = () => {
    // State
    const [apiKey, setApiKey] = useState<string | null>(null);
    const [ai, setAi] = useState<GoogleGenAI | null>(null);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [currentAnalysis, setCurrentAnalysis] = useState<AnalysisEntry | null>(null);
    const [currentDate, setCurrentDate] = useState(new Date());
    const [viewMode, setViewMode] = useState<'week' | 'month'>('week');
    const [isShiftModalOpen, setIsShiftModalOpen] = useState(false);
    const [selectedDayForEdit, setSelectedDayForEdit] = useState<DaySchedule | null>(null);
    const [isDayDetailOpen, setIsDayDetailOpen] = useState(false);
    const [selectedDayForDetail, setSelectedDayForDetail] = useState<DaySchedule | null>(null);
    const [isHistoryPanelOpen, setIsHistoryPanelOpen] = useState(false);
    const [analysisHistory, setAnalysisHistory] = useState<AnalysisEntry[]>([]);
    const [isApiKeyModalOpen, setIsApiKeyModalOpen] = useState(false);
    const [isShareModalOpen, setIsShareModalOpen] = useState(false);
    const [now, setNow] = useState(new Date());

    // Memoized values
    const weekStartDate = useMemo(() => getWeekStartDate(new Date(currentDate)), [currentDate]);
    const weekDays = useMemo(() => getWeekDays(weekStartDate), [weekStartDate]);
    const weekSchedule: DaySchedule[] = useMemo(() => {
        if (!currentAnalysis && analysisHistory.length === 0) return weekDays.map(d => ({ date: formatDate(d.date), type: 'empty', shifts: [] }));

        const weekStart = getWeekStartDate(new Date(currentDate));
        
        // Find if any day of the current week is in history
        for (const historyEntry of analysisHistory) {
             const historyStart = new Date(historyEntry.schedule[0].date);
             if (weekStart.getTime() === historyStart.getTime()) {
                 return historyEntry.schedule;
             }
        }
        
        // If current analysis matches the week, show it
        if (currentAnalysis) {
          const analysisStart = new Date(currentAnalysis.schedule[0].date);
           if (analysisStart.getTime() === weekStart.getTime()) {
              return currentAnalysis.schedule;
          }
        }
        
        return weekDays.map(d => ({ date: formatDate(d.date), type: 'empty', shifts: [] }));

    }, [currentAnalysis, weekDays, currentDate, analysisHistory]);
    
    const hasScheduleThisWeek = useMemo(() => weekSchedule.some(d => d.type !== 'empty'), [weekSchedule]);
    
    const formattedTotalHours = useMemo(() => {
         const totalHours = weekSchedule.reduce((total, day) => {
            if (day.type === 'work') {
                const dayHours = day.shifts.reduce((dayTotal: number, shift: Shift) => {
                return dayTotal + calculateHours(shift.start, shift.end);
                }, 0);
                return total + dayHours;
            }
            return total;
        }, 0);
        return formatDecimalHours(totalHours);
    }, [weekSchedule]);


    // Effects
    useEffect(() => {
        const storedApiKey = localStorage.getItem('gemini_api_key');
        if (storedApiKey) {
            setApiKey(storedApiKey);
        } else {
            setIsApiKeyModalOpen(true);
        }
        fetchHistory();
    }, []);

    useEffect(() => {
        if (apiKey) {
            try {
                 setAi(new GoogleGenAI({apiKey}));
            } catch (e: any) {
                setError(`Errore nell'inizializzazione dell'API: ${e.message}`);
                setAi(null);
            }
        }
    }, [apiKey]);
    
    // Timer to update "now" for the timeline in CalendarGrid
    useEffect(() => {
        const timer = setInterval(() => setNow(new Date()), 60000); // Update every minute
        return () => clearInterval(timer);
    }, []);

    // Handlers
    const fileToGenerativePart = async (file: File) => {
        const base64EncodedData = await createImageThumbnail(file, 1024, 1024);
        return {
            inlineData: {
                data: base64EncodedData,
                mimeType: file.type,
            },
        };
    };

    const handleAnalyze = useCallback(async (file: File) => {
        if (!ai) {
            setError('La chiave API non è configurata correttamente. Vai nelle impostazioni.');
            setIsApiKeyModalOpen(true);
            return;
        }
        setIsLoading(true);
        setError(null);
        setCurrentAnalysis(null);

        try {
            const imagePart = await fileToGenerativePart(file);
            const response = await ai.models.generateContent({
                model: geminiModel,
                contents: { parts: [imagePart] },
                config: {
                    systemInstruction: getSystemInstruction(),
                    safetySettings,
                    responseMimeType: 'application/json',
                    responseSchema: jsonSchema,
                },
            });
            
            const resultText = response.text;
            if (!resultText) {
                 throw new Error("L'IA ha restituito una risposta vuota.");
            }
            const parsedResult = JSON.parse(resultText.trim());

            if (!parsedResult.schedule || parsedResult.schedule.length !== 7) {
                 throw new Error("L'IA ha restituito un formato di orario non valido.");
            }
            
            const analysisStartDate = new Date(parsedResult.schedule[0].date);
            setCurrentDate(analysisStartDate);

            const analysisResult = {
                dateRange: parsedResult.dateRange,
                schedule: parsedResult.schedule,
                summary: parsedResult.summary,
            };

            const savedEntry = await saveAnalysisToHistory(analysisResult);
            setCurrentAnalysis(savedEntry);
            await fetchHistory();

        } catch (e: any) {
            console.error(e);
            let errorMessage = "Si è verificato un errore durante l'analisi. Riprova.";
            if (e.message?.includes("API key not valid")) {
                errorMessage = "La chiave API non è valida. Controllala nelle impostazioni.";
                setApiKey(null);
                localStorage.removeItem('gemini_api_key');
                setIsApiKeyModalOpen(true);
            } else if (e instanceof SyntaxError) {
                errorMessage = "L'IA ha restituito una risposta non valida. Prova con un'immagine più chiara.";
            } else if (e.message) {
                errorMessage = e.message;
            }
            setError(errorMessage);
        } finally {
            setIsLoading(false);
        }
    }, [ai]);
    
    const saveAnalysisToHistory = async (analysisResult: Omit<AnalysisEntry, 'id'>) => {
        try {
            const response = await fetch('/api/analyze', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ analysisResult })
            });
            if (!response.ok) {
                throw new Error('Failed to save analysis to history');
            }
            return await response.json();
        } catch (e) {
            console.error(e);
            setError("Impossibile salvare l'analisi. Verrà visualizzata solo temporaneamente.");
            return { id: Date.now(), ...analysisResult };
        }
    };
    
    const fetchHistory = useCallback(async () => {
        try {
            const response = await fetch('/api/history');
            if (response.ok) {
                const data = await response.json();
                setAnalysisHistory(data);
            }
        } catch (e) {
            console.error("Failed to fetch history:", e);
        }
    }, []);
    
    const handleLoadHistory = (id: number) => {
        const entry = analysisHistory.find(e => e.id === id);
        if (entry) {
            setCurrentAnalysis(entry);
            const startDate = new Date(entry.schedule[0].date + 'T12:00:00Z');
            setCurrentDate(startDate);
            setIsHistoryPanelOpen(false);
        }
    };

    const handleDeleteHistory = async (id: number) => {
        try {
            const response = await fetch(`/api/history/${id}`, { method: 'DELETE' });
            if (response.ok) {
                setAnalysisHistory(prev => prev.filter(e => e.id !== id));
                 if(currentAnalysis?.id === id) {
                    setCurrentAnalysis(null);
                }
            } else {
                 setError("Impossibile eliminare la voce dello storico.");
            }
        } catch (e) {
            setError("Errore di rete durante l'eliminazione.");
        }
    };
    
    const handleSaveApiKey = (key: string) => {
        setApiKey(key);
        localStorage.setItem('gemini_api_key', key);
        setIsApiKeyModalOpen(false);
        setError(null);
    };

    const handleUpdateDay = (updatedDay: DaySchedule) => {
        const analysisToUpdate = currentAnalysis || analysisHistory.find(h => h.schedule.some(d => d.date === updatedDay.date));

        if (analysisToUpdate) {
            const updatedSchedule = analysisToUpdate.schedule.map(d =>
                d.date === updatedDay.date ? updatedDay : d
            );
            const updatedAnalysis = { ...analysisToUpdate, schedule: updatedSchedule };

            if(currentAnalysis?.id === updatedAnalysis.id) {
                setCurrentAnalysis(updatedAnalysis);
            }
            setAnalysisHistory(prev => prev.map(h => h.id === updatedAnalysis.id ? updatedAnalysis : h));
            // Note: This change is client-side only. A dedicated API endpoint would be needed to persist it.
        }
        setIsShiftModalOpen(false);
    };
    
    // Navigation
    const handlePrevious = () => {
        setCurrentDate(prev => {
            const newDate = new Date(prev);
            if(viewMode === 'week') {
                newDate.setDate(newDate.getDate() - 7);
            } else {
                newDate.setMonth(newDate.getMonth() - 1);
            }
            return newDate;
        });
    };

    const handleNext = () => {
        setCurrentDate(prev => {
            const newDate = new Date(prev);
            if(viewMode === 'week') {
                newDate.setDate(newDate.getDate() + 7);
            } else {
                newDate.setMonth(newDate.getMonth() + 1);
            }
            return newDate;
        });
    };
    
    // Day Click handlers
    const handleWeekDayClick = (day: DaySchedule) => {
        setSelectedDayForEdit(day);
        setIsShiftModalOpen(true);
    };

    const handleMonthDayClick = (date: Date) => {
        const dateString = formatDate(date);
        const dayData = analysisHistory.flatMap(h => h.schedule).find(d => d.date === dateString);
        if (dayData) {
            setSelectedDayForDetail(dayData);
            setIsDayDetailOpen(true);
        } else {
            setCurrentDate(date);
            setViewMode('week');
        }
    };
    
    const allSchedulesForMonth = useMemo(() => {
        return analysisHistory.flatMap(entry => entry.schedule);
    }, [analysisHistory]);
    
    const currentWeekDateRange = useMemo(() => {
       const entry = analysisHistory.find(e => {
            const historyStart = new Date(e.schedule[0].date).getTime();
            const weekStart = getWeekStartDate(new Date(currentDate)).getTime();
            return historyStart === weekStart;
       });
       return entry ? entry.dateRange : currentAnalysis?.dateRange;
    }, [currentDate, analysisHistory, currentAnalysis]);

    return (
        <div className="min-h-screen">
            {isLoading && <LoadingOverlay />}
            <ApiKeyModal
                isOpen={isApiKeyModalOpen}
                onClose={() => setIsApiKeyModalOpen(false)}
                onSave={handleSaveApiKey}
                currentApiKey={apiKey}
            />
            <ShiftModal
                isOpen={isShiftModalOpen}
                onClose={() => setIsShiftModalOpen(false)}
                daySchedule={selectedDayForEdit}
                onUpdateDay={handleUpdateDay}
            />
            <DayDetailView
                isOpen={isDayDetailOpen}
                onClose={() => setIsDayDetailOpen(false)}
                daySchedule={selectedDayForDetail}
            />
            <HistoryPanel
                isOpen={isHistoryPanelOpen}
                onClose={() => setIsHistoryPanelOpen(false)}
                entries={analysisHistory}
                onLoad={handleLoadHistory}
                onDelete={handleDeleteHistory}
            />
             <ShareModal 
                isOpen={isShareModalOpen}
                onClose={() => setIsShareModalOpen(false)}
                schedule={weekSchedule}
                weekDays={weekDays}
                totalHours={formattedTotalHours}
                dateRange={currentWeekDateRange}
            />
            
            <main className="container mx-auto p-4 sm:p-6 lg:p-8 max-w-7xl">
                <header className="flex flex-col sm:flex-row justify-between items-center mb-6 gap-4">
                    <div className="text-center sm:text-left">
                         <h1 className="text-2xl sm:text-3xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-white to-gray-400 animate-text-glow">
                           Analizzatore Turni
                         </h1>
                        <p className="text-gray-400 text-sm capitalize">
                          {viewMode === 'week' 
                            ? `${weekDays[0].date.toLocaleDateString('it-IT', {day:'numeric', month:'long'})} - ${weekDays[6].date.toLocaleDateString('it-IT', {day:'numeric', month:'long', year:'numeric'})}`
                            : currentDate.toLocaleDateString('it-IT', { month: 'long', year: 'numeric' })
                          }
                        </p>
                    </div>
                    <div className="flex items-center gap-2 sm:gap-4">
                        <ViewSwitcher viewMode={viewMode} setViewMode={setViewMode} />
                        <WeekNavigator onPrevious={handlePrevious} onNext={handleNext} />
                        {hasScheduleThisWeek && <HourTracker schedule={weekSchedule} />}
                         <button
                            onClick={() => setIsShareModalOpen(true)}
                            disabled={!hasScheduleThisWeek}
                            className="p-2.5 rounded-lg bg-slate-700/50 hover:bg-teal-500 text-gray-300 hover:text-white transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-teal-400 transform hover:-translate-y-0.5 disabled:opacity-30 disabled:cursor-not-allowed"
                            aria-label="Condividi orario"
                          >
                            <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="18" cy="5" r="3"></circle><circle cx="6" cy="12" r="3"></circle><circle cx="18"cy="19" r="3"></circle><line x1="8.59" y1="13.51" x2="15.42" y2="17.49"></line><line x1="15.41" y1="6.51" x2="8.59" y2="10.49"></line></svg>
                          </button>
                         <button
                            onClick={() => setIsApiKeyModalOpen(true)}
                            className="p-2.5 rounded-lg bg-slate-700/50 hover:bg-teal-500 text-gray-300 hover:text-white transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-teal-400 transform hover:-translate-y-0.5"
                            aria-label="Impostazioni"
                          >
                           <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="3"></circle><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"></path></svg>
                          </button>
                         <button
                            onClick={() => setIsHistoryPanelOpen(true)}
                            className="p-2.5 rounded-lg bg-slate-700/50 hover:bg-teal-500 text-gray-300 hover:text-white transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-teal-400 transform hover:-translate-y-0.5"
                            aria-label="Storico"
                          >
                           <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"/><path d="M12 8v4l4 2"/></svg>
                          </button>
                    </div>
                </header>
                
                <div className="mb-6 animate-slideInUp" style={{animationDelay: '100ms'}}>
                     <ImageUploader onAnalyze={handleAnalyze} isLoading={isLoading} />
                </div>
                
                {error && <ErrorDisplay message={error} />}
                
                {currentAnalysis && <AnalysisSummary summary={currentAnalysis.summary} />}
                
                <div className="mt-6">
                  {viewMode === 'week' ? (
                     weekSchedule.some(d => d.type !== 'empty') ? (
                       <CalendarGrid
                         weekDays={weekDays.map(d => d.name)}
                         schedule={weekSchedule}
                         onDayClick={handleWeekDayClick}
                         now={now}
                       />
                     ) : (
                       !isLoading && <WelcomeMessage />
                     )
                   ) : (
                    <MonthCalendar 
                        currentDate={currentDate}
                        scheduleData={allSchedulesForMonth}
                        onDayClick={handleMonthDayClick}
                    />
                  )}
                </div>

            </main>
        </div>
    );
};

export default App;