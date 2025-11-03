import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
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
import { SettingsModal } from './components/ApiKeyModal.js';
import { ShareModal } from './components/ShareModal.js';
import { DateEditModal } from './components/DateEditModal.js';
import type { DaySchedule, AnalysisEntry, Shift, SafetySetting } from './types.js';
import { getWeekStartDate, formatDate, getWeekDays, calculateHours, formatDecimalHours, formatDateRange } from './utils/dateUtils.js';
import { createImageThumbnail } from './utils/imageUtils.js';

const geminiModel = 'gemini-2.5-flash';

const defaultSafetySettings: SafetySetting[] = [
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
        summary: { type: Type.STRING, description: "Un breve riassunto testuale dell'orario, es. 'Ciao Ilaria! Settimana con 5 giorni lavorativi e 2 di riposo, con un totale di X ore. Pronta a conquistare il mondo... dopo un caffè!'." },
    },
    required: ['dateRange', 'schedule', 'summary']
};

const getSystemInstruction = () => `Sei un assistente specializzato nell'analizzare immagini di orari di lavoro settimanali, nello specifico per l'azienda "Appiani". Il tuo compito è estrarre con la massima precisione le informazioni e restituirle in formato JSON, rivolgendoti sempre a una utente di nome "Ilaria".

Regole di Analisi:
1.  **Formato Input**: Riceverai un'immagine contenente un orario settimanale. L'orario va da Lunedì a Domenica.
2.  **Identifica le Date**: Trova l'intervallo di date della settimana. Determina la data esatta (YYYY-MM-DD) per ogni giorno da Lunedì a Domenica. L'anno corrente è ${new Date().getFullYear()}.
3.  **Analisi Giornaliera**: Per ogni giorno, estrai i turni di lavoro. Un giorno può avere uno o più turni. Ogni turno ha un orario di inizio e uno di fine in formato HH:MM (24 ore).
4.  **Tipi di Giornata**:
    *   'work': Se ci sono turni di lavoro.
    *   'rest': Se è indicato esplicitamente "RIPOSO", una singola "R", un trattino ("-"), o una dicitura simile.
    *   'empty': Se la casella del giorno è vuota o non interpretabile e non rientra nei casi precedenti.
5.  **Incertezza**: Se non riesci a leggere chiaramente un orario o un giorno, imposta \`isUncertain\` a \`true\`.
6.  **Genera il Sommario (campo 'summary')**: Crea un riassunto testuale dell'orario per Ilaria.
    *   **Inizio**: Inizia sempre salutando "Ciao Ilaria!".
    *   **Contenuto**: Indica il numero di giorni lavorativi, di riposo e il totale delle ore calcolate.
    *   **Fine**: Concludi OBBLIGATORIAMENTE con una frase motivazionale creativa e personalizzata per Ilaria, per darle la carica per la settimana. Sii incoraggiante e originale. Esempi: 'Forza Ilaria, un'altra settimana da dominare!', 'Ricorda: ogni turno è un passo verso i tuoi obiettivi!', 'Che questa settimana ti porti un sacco di soddisfazioni!'.`;


export const App: React.FC = () => {
    // State
    const [apiKey, setApiKey] = useState<string | null>(null);
    const [safetySettings, setSafetySettings] = useState<SafetySetting[]>(defaultSafetySettings);
    const [ai, setAi] = useState<GoogleGenAI | null>(null);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [currentAnalysis, setCurrentAnalysis] = useState<AnalysisEntry | null>(null);
    const [currentDate, setCurrentDate] = useState(new Date());
    const [history, setHistory] = useState<AnalysisEntry[]>([]);
    const [isShiftModalOpen, setIsShiftModalOpen] = useState(false);
    const [isHistoryPanelOpen, setIsHistoryPanelOpen] = useState(false);
    const [isSettingsModalOpen, setIsSettingsModalOpen] = useState(false);
    const [isShareModalOpen, setIsShareModalOpen] = useState(false);
    const [isDateEditModalOpen, setIsDateEditModalOpen] = useState(false);
    const [selectedDay, setSelectedDay] = useState<DaySchedule | null>(null);
    const [viewMode, setViewMode] = useState<'week' | 'month'>('week');
    
    const nowRef = useRef(new Date());
    
    // --- Effects ---
    
    // Load API Key and settings from localStorage on mount
    useEffect(() => {
        const storedApiKey = localStorage.getItem('gemini-api-key');
        if (storedApiKey) {
            setApiKey(storedApiKey);
        } else {
            setIsSettingsModalOpen(true);
        }

        const storedSettings = localStorage.getItem('gemini-safety-settings');
        if (storedSettings) {
            try {
                setSafetySettings(JSON.parse(storedSettings));
            } catch (e) {
                console.error("Failed to parse safety settings from localStorage", e);
                localStorage.removeItem('gemini-safety-settings');
            }
        }
    }, []);

    // Initialize GoogleGenAI instance when API key changes
    useEffect(() => {
        if (apiKey) {
            try {
                const genAI = new GoogleGenAI({ apiKey });
                setAi(genAI);
            } catch (e: any) {
                setError(`Errore nell'inizializzazione dell'IA: ${e.message}`);
                setAi(null);
            }
        }
    }, [apiKey]);
    
    // Fetch history on mount
    const fetchHistory = useCallback(async () => {
        try {
            const response = await fetch('/api/history');
            if (!response.ok) throw new Error('Failed to fetch history');
            const data = await response.json();
            setHistory(data);
        } catch (err: any) {
            console.error("History fetch error:", err);
            setError(err.message);
        }
    }, []);

    useEffect(() => {
        fetchHistory();
    }, [fetchHistory]);
    
    // --- Data Memos ---
    
    const weekDays = useMemo(() => getWeekDays(currentDate), [currentDate]);
    
    const weekSchedule = useMemo(() => {
        if (currentAnalysis) return currentAnalysis.schedule;
        return getWeekDays(currentDate).map(day => ({
            date: formatDate(day.date),
            type: 'empty',
            shifts: [],
        }));
    }, [currentAnalysis, currentDate]);
    
    const totalHours = useMemo(() => {
        if (!currentAnalysis) return 0;
        return currentAnalysis.schedule.reduce((total, day) => {
            return total + day.shifts.reduce((dayTotal, shift) => dayTotal + calculateHours(shift.start, shift.end), 0);
        }, 0);
    }, [currentAnalysis]);
    
    // --- Handlers ---
    
    const handleAnalyze = async (file: File) => {
        if (!ai) {
            setError("La chiave API non è impostata. Vai nelle impostazioni per aggiungerla.");
            return;
        }
        setIsLoading(true);
        setError(null);
        setCurrentAnalysis(null);

        try {
            const imagePart = {
                inlineData: {
                    mimeType: file.type,
                    data: await new Promise<string>((resolve, reject) => {
                        const reader = new FileReader();
                        reader.onload = () => resolve((reader.result as string).split(',')[1]);
                        reader.onerror = reject;
                        reader.readAsDataURL(file);
                    }),
                },
            };
            
            const response = await ai.models.generateContent({
                model: geminiModel,
                contents: { parts: [imagePart] },
                config: {
                    systemInstruction: getSystemInstruction(),
                    responseMimeType: "application/json",
                    responseSchema: jsonSchema,
                    safetySettings,
                }
            });

            const resultText = response.text;
            let resultJson;
            try {
                resultJson = JSON.parse(resultText);
            } catch (e) {
                 throw new Error("L'IA ha restituito una risposta non valida. Assicurati che l'immagine sia chiara e riprova.");
            }

            const thumbnail = await createImageThumbnail(file, 200, 200);

            const analysisResult = {
                ...resultJson,
                imageData: thumbnail,
                mimeType: file.type
            };

            const saveResponse = await fetch('/api/analyze', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ analysisResult }),
            });

            if (!saveResponse.ok) throw new Error('Failed to save analysis to history');
            const newEntry = await saveResponse.json();
            
            setCurrentAnalysis(newEntry);
            setHistory(prev => [newEntry, ...prev]);
            
            // Set current date to the start of the analyzed week
            if (newEntry.schedule && newEntry.schedule.length > 0) {
                setCurrentDate(new Date(newEntry.schedule[0].date));
            }

        } catch (e: any) {
            console.error(e);
            setError(e.message || "Si è verificato un errore sconosciuto durante l'analisi.");
        } finally {
            setIsLoading(false);
        }
    };
    
    const handleUpdateDay = async (updatedDay: DaySchedule) => {
        if (!currentAnalysis) return;
        
        const updatedSchedule = currentAnalysis.schedule.map(d => 
            d.date === updatedDay.date ? updatedDay : d
        );
        
        const updatedAnalysis = { ...currentAnalysis, schedule: updatedSchedule };
        setCurrentAnalysis(updatedAnalysis);
        setIsShiftModalOpen(false);

        try {
            await fetch(`/api/history/${currentAnalysis.id}`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ schedule: updatedSchedule }),
            });
             setHistory(prev => prev.map(h => h.id === currentAnalysis.id ? updatedAnalysis : h));
        } catch(e) {
            console.error("Failed to save updated day", e);
            setError("Impossibile salvare le modifiche.");
            // Revert optimistic update
            setCurrentAnalysis(currentAnalysis);
        }
    };

    const handleLoadHistory = (id: number) => {
        const entry = history.find(e => e.id === id);
        if (entry) {
            setCurrentAnalysis(entry);
            if (entry.schedule && entry.schedule.length > 0) {
                setCurrentDate(new Date(entry.schedule[0].date));
            }
        }
        setIsHistoryPanelOpen(false);
    };

    const handleDeleteHistory = async (id: number) => {
        try {
            await fetch(`/api/history/${id}`, { method: 'DELETE' });
            setHistory(prev => prev.filter(e => e.id !== id));
            if (currentAnalysis?.id === id) {
                setCurrentAnalysis(null);
            }
        } catch (e) {
            console.error("Failed to delete history item", e);
            setError("Impossibile eliminare la voce.");
        }
    };

    const handlePreviousWeek = () => {
        const newDate = new Date(currentDate);
        newDate.setDate(newDate.getDate() - 7);
        setCurrentDate(newDate);
    };

    const handleNextWeek = () => {
        const newDate = new Date(currentDate);
        newDate.setDate(newDate.getDate() + 7);
        setCurrentDate(newDate);
    };

    const handleDayClick = (day: DaySchedule) => {
        setSelectedDay(day);
        setIsShiftModalOpen(true);
    };
    
    const handleSaveSettings = (newApiKey: string, newSettings: SafetySetting[]) => {
        setApiKey(newApiKey);
        setSafetySettings(newSettings);
        localStorage.setItem('gemini-api-key', newApiKey);
        localStorage.setItem('gemini-safety-settings', JSON.stringify(newSettings));
        setIsSettingsModalOpen(false);
        setError(null);
    };
    
    const handleSetDateFromMonthView = (date: Date) => {
        setCurrentDate(getWeekStartDate(date));
        setViewMode('week');
    }
    
    const handleDateEditSave = (newStartDate: Date) => {
        setCurrentDate(newStartDate);
    }
    
    // --- JSX ---
    return (
        <div className="min-h-screen">
            {isLoading && <LoadingOverlay />}
            <main className="container mx-auto p-4 sm:p-6 max-w-7xl">
                <header className="flex flex-col sm:flex-row justify-between items-center gap-4 mb-6 animate-slideInUp">
                    <div className="flex items-center gap-3">
                        <svg width="36" height="36" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                            <defs><linearGradient id="logoGradient" x1="0" y1="0" x2="1" y2="1"><stop offset="0%" stop-color="#2DD4BF"/><stop offset="100%" stop-color="#38BDF8"/></linearGradient></defs>
                            <path d="M12 22C17.5228 22 22 17.5228 22 12C22 6.47715 17.5228 2 12 2C6.47715 2 2 6.47715 2 12C2 17.5228 6.47715 22 12 22Z" stroke="url(#logoGradient)" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
                            <path d="M12 6V12L16 14" stroke="url(#logoGradient)" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/><path d="M12 9.5L11.25 11.25L9.5 12L11.25 12.75L12 14.5L12.75 12.75L14.5 12L12.75 11.25L12 9.5Z" fill="url(#logoGradient)"/>
                        </svg>
                        <h1 className="text-2xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-white to-gray-400 animate-text-glow">Analizzatore Turni</h1>
                    </div>
                    <div className="flex items-center gap-3">
                         <button onClick={() => setIsShareModalOpen(true)} disabled={!currentAnalysis} className="p-2.5 rounded-lg bg-slate-700/50 hover:bg-teal-500 text-gray-300 hover:text-white transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-teal-400 disabled:opacity-50 disabled:cursor-not-allowed transform hover:-translate-y-0.5" aria-label="Condividi">
                            <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/><line x1="8.59" x2="15.42" y1="13.51" y2="17.49"/><line x1="15.41" x2="8.59" y1="6.51" y2="10.49"/></svg>
                        </button>
                        <button onClick={() => setIsHistoryPanelOpen(true)} className="p-2.5 rounded-lg bg-slate-700/50 hover:bg-teal-500 text-gray-300 hover:text-white transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-teal-400 transform hover:-translate-y-0.5" aria-label="Storico">
                            <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M1 4v6h6"/><path d="M3.51 15a9 9 0 1 0 2.13-9.36L1 10"/></svg>
                        </button>
                        <button onClick={() => setIsSettingsModalOpen(true)} className="p-2.5 rounded-lg bg-slate-700/50 hover:bg-teal-500 text-gray-300 hover:text-white transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-teal-400 transform hover:-translate-y-0.5" aria-label="Impostazioni">
                           <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 0 2l-.15.08a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.38a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1 0-2l.15-.08a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z"/><circle cx="12" cy="12" r="3"/></svg>
                        </button>
                    </div>
                </header>

                <div className="animate-slideInUp" style={{ animationDelay: '100ms' }}>
                    <ImageUploader onAnalyze={handleAnalyze} isLoading={isLoading} initialPreview={currentAnalysis?.imageData ? `data:${currentAnalysis.mimeType};base64,${currentAnalysis.imageData}` : null} />
                </div>
                
                {error && <ErrorDisplay message={error} />}
                
                {currentAnalysis ? (
                    <div className="mt-8">
                        <AnalysisSummary summary={currentAnalysis.summary} />
                         <div className="flex flex-col md:flex-row justify-between items-center gap-4 my-6 animate-slideInUp" style={{ animationDelay: '200ms' }}>
                             <div className="flex items-baseline gap-4">
                                <h2 className="text-xl sm:text-2xl font-semibold text-white">{formatDateRange(currentDate)}</h2>
                                <button onClick={() => setIsDateEditModalOpen(true)} className="p-1 text-gray-400 hover:text-teal-300 transition-colors">
                                    <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z"/><path d="m15 5 4 4"/></svg>
                                </button>
                             </div>
                             <div className="flex items-center gap-2">
                                <HourTracker schedule={weekSchedule} />
                                <WeekNavigator onPrevious={handlePreviousWeek} onNext={handleNextWeek} />
                                <ViewSwitcher viewMode={viewMode} setViewMode={setViewMode} />
                             </div>
                        </div>

                         <div className="animate-slideInUp" style={{ animationDelay: '300ms' }}>
                            {viewMode === 'week' ? (
                                <CalendarGrid 
                                    weekDays={weekDays.map(d => d.name)} 
                                    schedule={weekSchedule} 
                                    onDayClick={handleDayClick} 
                                    now={nowRef.current}
                                    isEditable={true}
                                />
                            ) : (
                                <MonthCalendar 
                                    currentDate={currentDate}
                                    scheduleData={history.flatMap(h => h.schedule)}
                                    onDayClick={handleSetDateFromMonthView}
                                />
                            )}
                         </div>
                    </div>
                ) : (
                    <div className="mt-8">
                        <WelcomeMessage />
                    </div>
                )}
                
                <ShiftModal 
                    isOpen={isShiftModalOpen}
                    onClose={() => setIsShiftModalOpen(false)}
                    daySchedule={selectedDay}
                    onUpdateDay={handleUpdateDay}
                />
                
                <HistoryPanel 
                    isOpen={isHistoryPanelOpen}
                    onClose={() => setIsHistoryPanelOpen(false)}
                    entries={history}
                    onLoad={handleLoadHistory}
                    onDelete={handleDeleteHistory}
                />
                
                <SettingsModal
                    isOpen={isSettingsModalOpen}
                    onClose={() => setIsSettingsModalOpen(false)}
                    onSave={handleSaveSettings}
                    currentApiKey={apiKey}
                    currentSafetySettings={safetySettings}
                />
                
                <ShareModal 
                    isOpen={isShareModalOpen}
                    onClose={() => setIsShareModalOpen(false)}
                    schedule={currentAnalysis?.schedule || []}
                    weekDays={weekDays}
                    totalHours={formatDecimalHours(totalHours)}
                    dateRange={currentAnalysis?.dateRange}
                />
                
                <DateEditModal
                    isOpen={isDateEditModalOpen}
                    onClose={() => setIsDateEditModalOpen(false)}
                    onSave={handleDateEditSave}
                    currentStartDate={currentDate}
                />

            </main>
        </div>
    );
};
