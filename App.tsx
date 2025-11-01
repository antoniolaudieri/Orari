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
import { getWeekStartDate, formatDate } from './utils/dateUtils.js';

// Gemini configuration moved from backend to frontend
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
    const timer = setInterval(() => setNow(new Date()), 60000); // Update every minute
    const savedApiKey = localStorage.getItem('gemini-api-key');
    if (savedApiKey) {
        setApiKey(savedApiKey);
    } else {
        setIsApiKeyModalOpen(true);
    }
    return () => clearInterval(timer);
  }, []);

  const loadHistory = useCallback(async () => {
    try {
      const response = await fetch('/api/history');
      if (!response.ok) {
        throw new Error('Failed to fetch history');
      }
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

  const handleSaveApiKey = (key: string) => {
    if (key) {
      setApiKey(key);
      localStorage.setItem('gemini-api-key', key);
      setIsApiKeyModalOpen(false);
      setError(null);
    } else {
      setError("La chiave API non può essere vuota.");
    }
  };


  const handleAnalyze = async (file: File) => {
    if (!apiKey) {
      setError("Per favore, imposta la tua chiave API di Google Gemini nelle impostazioni.");
      setIsApiKeyModalOpen(true);
      return;
    }

    setIsLoading(true);
    setError(null);
    
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = async () => {
        const base64Data = (reader.result as string).split(',')[1];
        
        try {
            const ai = new GoogleGenAI({ apiKey });
            
            const imagePart = {
                inlineData: {
                    data: base64Data,
                    mimeType: file.type,
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
                },
            });

            let jsonString = response.text?.trim();
            if (!jsonString) {
                throw new Error("L'analisi IA non ha restituito un testo valido.");
            }

            if (jsonString.startsWith('```json')) {
                jsonString = jsonString.substring(7, jsonString.length - 3).trim();
            } else if (jsonString.startsWith('```')) {
                jsonString = jsonString.substring(3, jsonString.length - 3).trim();
            }

            const analysisResult = JSON.parse(jsonString);

            const payload = {
                analysisResult: {
                    dateRange: analysisResult.dateRange,
                    schedule: analysisResult.schedule,
                    summary: analysisResult.summary,
                }
            };

            const saveResponse = await fetch('/api/analyze', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload),
            });

            if (!saveResponse.ok) {
                const errorData = await saveResponse.json();
                throw new Error(errorData.error || 'Salvataggio analisi fallito');
            }

            const result: AnalysisEntry = await saveResponse.json();
            
            // The result from DB doesn't have image data.
            // We augment it with the original full-res image data for the UI preview.
            const resultForUI = { ...result, imageData: base64Data, mimeType: file.type };

            setCurrentAnalysis(resultForUI);
            setSchedule(result.schedule);
            loadHistory(); // Refresh history
        } catch (err: any) {
            console.error("Analysis Error:", err);
            setError(err.message || "L'IA non è riuscita a interpretare l'immagine. Prova con una foto più chiara o ritagliata meglio.");
        } finally {
            setIsLoading(false);
        }
    };
    reader.onerror = (error) => {
        console.error("File Reading Error:", error);
        setError("Impossibile leggere il file immagine.");
        setIsLoading(false);
    };
  };

  const handlePreviousWeek = () => {
    setCurrentDate(prev => {
      const newDate = new Date(prev);
      newDate.setDate(newDate.getDate() - 7);
      return newDate;
    });
  };

  const handleNextWeek = () => {
    setCurrentDate(prev => {
      const newDate = new Date(prev);
      newDate.setDate(newDate.getDate() + 7);
      return newDate;
    });
  };
  
  const handlePreviousMonth = () => {
    setCurrentDate(prev => {
        const newDate = new Date(prev);
        newDate.setMonth(newDate.getMonth() - 1);
        return newDate;
    });
  };

  const handleNextMonth = () => {
      setCurrentDate(prev => {
          const newDate = new Date(prev);
          newDate.setMonth(newDate.getMonth() + 1);
          return newDate;
      });
  };

  const handleDayClick = (day: DaySchedule) => {
      if (viewMode === 'week') {
          setSelectedDay(day);
          setIsModalOpen(true);
      }
  };
  
  const handleMonthDayClick = (date: Date) => {
      const dateString = formatDate(date);
      const dayData = history.flatMap(h => h.schedule).find(d => d.date === dateString);
      if(dayData) {
          setDayDetail(dayData);
          setIsDayDetailOpen(true);
      } else {
           setDayDetail({ date: dateString, type: 'empty', shifts: [] });
           setIsDayDetailOpen(true);
      }
  };


  const handleUpdateDay = (updatedDay: DaySchedule) => {
    if (schedule && currentAnalysis) {
      const newSchedule = schedule.map(day => day.date === updatedDay.date ? updatedDay : day);
      setSchedule(newSchedule);
      // Here you would typically also