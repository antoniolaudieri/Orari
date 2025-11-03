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
import { ApiKeyModal } from './components/ApiKeyModal.js';
import { ShareModal } from './components/ShareModal.js';
import { DateEditModal } from './components/DateEditModal.js';
import type { DaySchedule, AnalysisEntry, Shift } from './types.js';
import { getWeekStartDate, formatDate, getWeekDays, calculateHours, formatDecimalHours, formatDateRange } from './utils/dateUtils.js';
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
    const [isHistoryPanelOpen, setIsHistoryPanelOpen] = useState(false);
    const [analysisHistory, setAnalysisHistory] = useState<AnalysisEntry[]>([]);
    const [isApiKeyModalOpen, setIsApiKeyModalOpen] = useState(false);
    const [isShareModalOpen, setIsShareModalOpen] = useState(false);
    const [isDateEditModalOpen, setIsDateEditModalOpen] = useState(false);
    const [now, setNow] = useState(new Date());
    const calendarRef = useRef<HTMLDivElement>(null);

    // Memoized values
    const imagePreview = useMemo(() => {
        if (currentAnalysis?.imageData && currentAnalysis.mimeType) {
            return `data:${currentAnalysis.mimeType};base64,${currentAnalysis.imageData}`;
        }
        return null;
    }, [currentAnalysis]);

    const weekStartDate = useMemo(() => getWeekStartDate(new Date(currentDate)), [currentDate]);
    const weekDays = useMemo(() => getWeekDays(weekStartDate), [weekStartDate]);
    const weekSchedule: DaySchedule[] = useMemo(() => {
        if (!currentAnalysis && analysisHistory.length === 0) {
            return weekDays.map(d => ({ date: formatDate(d.date), type: 'empty', shifts: [] }));
        }

        const weekStart = getWeekStartDate(new Date(currentDate));

        if (currentAnalysis) {
            const analysisWeekStart = getWeekStartDate(new Date(currentAnalysis.schedule[0].date));
            if (analysisWeekStart.getTime() === weekStart.getTime()) {
                return currentAnalysis.schedule;
            }
        }
        
        for (const historyEntry of analysisHistory) {
             const historyWeekStart = getWeekStartDate(new Date(historyEntry.schedule[0].date));
             if (weekStart.getTime() === historyWeekStart.getTime()) {
                 return historyEntry.schedule;
             }
        }
        
        return weekDays.map(d => ({ date: formatDate(d.date), type: 'empty', shifts: [] }));

    }, [currentAnalysis, currentDate, analysisHistory, weekDays]);
    
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
    
    useEffect(() => {
        const timer = setInterval(() => setNow(new Date()), 60000);
        return () => clearInterval(timer);
    }, []);

    // Handlers
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
            const thumbnailBase64 = await createImageThumbnail(file, 1024, 1024);
            const imagePart = {
                inlineData: {
                    data: thumbnailBase64,
                    mimeType: file.type,
                },
            };

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

            const analysisResult: Omit<AnalysisEntry, 'id'> = {
                dateRange: parsedResult.dateRange,
                schedule: parsedResult.schedule,
                summary: parsedResult.summary,
                imageData: thumbnailBase64,
                mimeType: file.type,
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
                const errorData = await response.json();
                throw new Error(errorData.error || 'Errore nel salvataggio dei dati.');
            }
            return await response.json();
        } catch(e: any) {
            console.error("Failed to save analysis:", e);
            setError(`Impossibile salvare l'analisi: ${e.message}`);
            // Return a local-only version if API fails
            return { id: Date.now(), ...analysisResult };
        }
    };
    
    const fetchHistory = async () => {
        try {
            const response = await fetch('/api/history');
            if (!response.ok) throw new Error("Errore nel recupero dello storico.");
            const data = await response.json();
            setAnalysisHistory(data);
        } catch(e: any) {
             console.error("Failed to fetch history:", e);
             // Don't show an error for this, as it might just be a network issue on load
             // setError(`Impossibile caricare lo storico: ${e.message}`);
        }
    };
    
    const handleDeleteHistory = async (id: number) => {
        const originalHistory = [...analysisHistory];
        setAnalysisHistory(prev => prev.filter(e => e.id !== id));
        if (currentAnalysis?.id === id) {
            setCurrentAnalysis(null);
        }
        
        try {
            const response = await fetch(`/api/history/${id}`, { method: 'DELETE'});
            if (!response.ok) {
                throw new Error("Errore nell'eliminazione.");
            }
        } catch (e: any) {
            setError(`Impossibile eliminare la voce: ${e.message}`);
            setAnalysisHistory(originalHistory);
        }
    };

    const handleLoadHistory = (id: number) => {
        const entry = analysisHistory.find(e => e.id === id);
        if (entry) {
            setCurrentAnalysis(entry);
            const entryStartDate = new Date(entry.schedule[0].date);
            setCurrentDate(entryStartDate);
            setIsHistoryPanelOpen(false);

            setTimeout(() => {
                calendarRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
            }, 300);
        }
    };

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
    
    const handleGoToToday = () => {
        setCurrentDate(new Date());
    }

    const handleDayClick = (daySchedule: DaySchedule) => {
        if (viewMode === 'month') {
             setCurrentDate(new Date(daySchedule.date));
             setViewMode('week');
        } else if (hasScheduleThisWeek) {
             setSelectedDayForEdit(daySchedule);
             setIsShiftModalOpen(true);
        }
    };

    const generateUpdatedSummary = (schedule: DaySchedule[]): string => {
        const workDays = schedule.filter(d => d.type === 'work' && d.shifts.length > 0).length;
        const restDays = 7 - workDays;
        const totalHours = schedule.reduce((total, day) => {
            if (day.type === 'work') {
                return total + day.shifts.reduce((dayTotal, shift) => dayTotal + calculateHours(shift.start, shift.end), 0);
            }
            return total;
        }, 0);
        const formattedHours = formatDecimalHours(totalHours);
        return `Ciao Ilaria! Riepilogo aggiornato: ora hai ${workDays} giorni lavorativi e ${restDays} di riposo, per un totale di ${formattedHours}. Continua così, sei una forza!`;
    };

    const handleUpdateDay = async (updatedDay: DaySchedule) => {
        if (currentAnalysis) {
            const updatedSchedule = currentAnalysis.schedule.map(d =>
                d.date === updatedDay.date ? updatedDay : d
            );
            const updatedSummary = generateUpdatedSummary(updatedSchedule);
            const updatedAnalysis: AnalysisEntry = {
                ...currentAnalysis,
                schedule: updatedSchedule,
                summary: updatedSummary,
            };

            setCurrentAnalysis(updatedAnalysis);
            setAnalysisHistory(prev => prev.map(entry => entry.id === updatedAnalysis.id ? updatedAnalysis : entry));
            
            setIsShiftModalOpen(false);
            setSelectedDayForEdit(null);

            try {
                const response = await fetch(`/api/history/${currentAnalysis.id}`, {
                    method: 'PATCH',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ schedule: updatedSchedule, summary: updatedSummary })
                });
                if (!response.ok) {
                    throw new Error("Errore nell'aggiornamento dell'analisi sul server.");
                }
            } catch (e: any) {
                console.error("Failed to update analysis:", e);
                setError(`Impossibile salvare le modifiche: ${e.message}`);
            }
        } else {
           setIsShiftModalOpen(false);
           setSelectedDayForEdit(null);
        }
    };
    
    const handleUpdateDateRange = async (newDate: Date) => {
        if (currentAnalysis) {
            const newWeekStartDate = getWeekStartDate(newDate);
            const newWeekDays = getWeekDays(newWeekStartDate);

            const updatedSchedule = currentAnalysis.schedule.map((day, index) => ({
                ...day,
                date: formatDate(newWeekDays[index].date)
            }));
            
            const newDateRange = formatDateRange(newWeekStartDate);

            const updatedAnalysis: AnalysisEntry = {
                ...currentAnalysis,
                schedule: updatedSchedule,
                dateRange: newDateRange,
            };

            setCurrentAnalysis(updatedAnalysis);
            setCurrentDate(newWeekStartDate);
            setAnalysisHistory(prev => prev.map(entry => entry.id === updatedAnalysis.id ? updatedAnalysis : entry));
            
            setIsDateEditModalOpen(false);

            try {
                const response = await fetch(`/api/history/${currentAnalysis.id}`, {
                    method: 'PATCH',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ 
                        schedule: updatedSchedule, 
                        dateRange: newDateRange 
                    })
                });
                if (!response.ok) {
                    throw new Error("Errore nell'aggiornamento della data sul server.");
                }
            } catch (e: any) {
                console.error("Failed to update date range:", e);
                setError(`Impossibile salvare la modifica della data: ${e.message}`);
            }
        }
    };

    const handleApiKeySave = (newKey: string) => {
        if (newKey) {
            setApiKey(newKey);
            localStorage.setItem('gemini_api_key', newKey);
            setError(null);
            setIsApiKeyModalOpen(false);
        } else {
            setError("La chiave API non può essere vuota.");
        }
    };

    return (
        <div className="min-h-screen p-2 sm:p-4 lg:p-6">
            {isLoading && <LoadingOverlay />}
            <ApiKeyModal isOpen={isApiKeyModalOpen} onClose={() => setIsApiKeyModalOpen(false)} onSave={handleApiKeySave} currentApiKey={apiKey}/>
            <ShiftModal isOpen={isShiftModalOpen} onClose={() => setIsShiftModalOpen(false)} daySchedule={selectedDayForEdit} onUpdateDay={handleUpdateDay} />
            <HistoryPanel isOpen={isHistoryPanelOpen} onClose={() => setIsHistoryPanelOpen(false)} entries={analysisHistory} onLoad={handleLoadHistory} onDelete={handleDeleteHistory} />
            <ShareModal isOpen={isShareModalOpen} onClose={() => setIsShareModalOpen(false)} schedule={weekSchedule} weekDays={getWeekDays(weekStartDate)} totalHours={formattedTotalHours} dateRange={currentAnalysis?.dateRange}/>
            <DateEditModal isOpen={isDateEditModalOpen} onClose={() => setIsDateEditModalOpen(false)} onSave={handleUpdateDateRange} currentStartDate={currentDate} />


            <div className="max-w-7xl mx-auto">
                <header className="flex flex-col sm:flex-row justify-between items-center gap-4 mb-6">
                    <div className="flex items-center gap-3">
                         <svg width="32" height="32" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" className="animate-breathing">
                            <defs>
                                <linearGradient id="logoGradient" x1="0" y1="0" x2="1" y2="1">
                                    <stop offset="0%" stopColor="#2DD4BF"/>
                                    <stop offset="100%" stopColor="#38BDF8"/>
                                </linearGradient>
                            </defs>
                            <path d="M12 22C17.5228 22 22 17.5228 22 12C22 6.47715 17.5228 2 12 2C6.47715 2 2 6.47715 2 12C2 17.5228 6.47715 22 12 22Z" stroke="url(#logoGradient)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                            <path d="M12 6V12L16 14" stroke="url(#logoGradient)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                            <path d="M12 9.5L11.25 11.25L9.5 12L11.25 12.75L12 14.5L12.75 12.75L14.5 12L12.75 11.25L12 9.5Z" fill="url(#logoGradient)"/>
                        </svg>
                        <h1 className="text-2xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-white to-gray-400 animate-text-glow">
                           Orario Intelligente
                        </h1>
                    </div>
                     <div className="flex items-center gap-2 sm:gap-4">
                        <button onClick={() => setIsShareModalOpen(true)} className="p-2.5 rounded-lg bg-slate-700/50 hover:bg-teal-500 text-gray-300 hover:text-white transition-all duration-200" title="Condividi">
                            <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8"/><polyline points="16 6 12 2 8 6"/><line x1="12" x2="12" y1="2" y2="15"/></svg>
                        </button>
                         <button onClick={() => setIsHistoryPanelOpen(true)} className="p-2.5 rounded-lg bg-slate-700/50 hover:bg-teal-500 text-gray-300 hover:text-white transition-all duration-200" title="Storico">
                            <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"/><path d="M3 3v5h5"/></svg>
                        </button>
                        <button onClick={() => setIsApiKeyModalOpen(true)} className="p-2.5 rounded-lg bg-slate-700/50 hover:bg-teal-500 text-gray-300 hover:text-white transition-all duration-200" title="Impostazioni">
                           <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 0 2l-.15.08a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.38a2 2 0 0 0-.73-2.73l-.15-.1a2 2 0 0 1 0-2l.15-.08a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z"/><circle cx="12" cy="12" r="3"/></svg>
                        </button>
                    </div>
                </header>
                
                 {error && <ErrorDisplay message={error} />}

                <main className="space-y-6">
                    <ImageUploader onAnalyze={handleAnalyze} isLoading={isLoading} initialPreview={imagePreview}/>
                   
                    {hasScheduleThisWeek && <AnalysisSummary summary={currentAnalysis?.summary ?? null} />}
                    
                    <div ref={calendarRef} className="bg-gray-800/20 p-4 sm:p-6 rounded-2xl ring-1 ring-white/10">
                        <div className="flex flex-col sm:flex-row justify-between items-center gap-4 mb-6">
                             <div className="flex items-center gap-2">
                                <div className="flex items-baseline gap-2">
                                    <span className="text-xl sm:text-2xl font-bold text-white">
                                        {viewMode === 'week' && currentAnalysis?.dateRange 
                                            ? currentAnalysis.dateRange 
                                            : currentDate.toLocaleDateString('it-IT', { month: 'long', year: 'numeric' })}
                                    </span>
                                </div>
                                {currentAnalysis && viewMode === 'week' && (
                                    <button 
                                        onClick={() => setIsDateEditModalOpen(true)}
                                        className="ml-2 p-1.5 rounded-full text-gray-400 hover:bg-slate-700 hover:text-white transition-colors"
                                        title="Modifica intervallo di date"
                                    >
                                        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z"/><path d="m15 5 4 4"/></svg>
                                    </button>
                                )}
                            </div>
                           
                            <div className="flex items-center gap-2">
                               <ViewSwitcher viewMode={viewMode} setViewMode={setViewMode} />
                               <button onClick={handleGoToToday} className="px-3 py-1.5 text-sm font-semibold rounded-md transition-colors duration-200 bg-slate-700/50 text-gray-300 hover:bg-slate-600">Oggi</button>
                               <WeekNavigator onPrevious={handlePrevious} onNext={handleNext} />
                            </div>
                        </div>

                        <div key={viewMode + currentDate.toISOString()} className="animate-scaleIn">
                            {viewMode === 'week' ? (
                                <CalendarGrid
                                weekDays={weekDays.map(d => d.name)}
                                schedule={weekSchedule}
                                onDayClick={handleDayClick}
                                now={now}
                                isEditable={hasScheduleThisWeek}
                                />
                            ) : (
                                <MonthCalendar 
                                    currentDate={currentDate}
                                    scheduleData={analysisHistory.flatMap(e => e.schedule)}
                                    onDayClick={(date: Date) => handleDayClick({date: formatDate(date), type: 'empty', shifts: []})}
                                />
                            )}
                        </div>
                    </div>

                    {!currentAnalysis && !hasScheduleThisWeek && <WelcomeMessage />}
                </main>

                <footer className="text-center text-sm text-gray-500 mt-8 pb-4">
                    <p>&copy; {new Date().getFullYear()} Orario Intelligente by seedgta</p>
                </footer>
            </div>
        </div>
    );
};

export default App;
