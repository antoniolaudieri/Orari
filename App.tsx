import React, { useState, useEffect, useMemo } from 'react';
import type { DaySchedule, AnalysisEntry } from './types';
import { getWeekDays, formatDate } from './utils/dateUtils';
import { analyzeScheduleImage } from './services/geminiService';

import { ImageUploader } from './components/ImageUploader';
import { WeekNavigator } from './components/WeekNavigator';
import { HourTracker } from './components/HourTracker';
import { CalendarGrid } from './components/CalendarGrid';
import { LoadingOverlay } from './components/LoadingOverlay';
import { ErrorDisplay } from './components/ErrorDisplay';
import { WelcomeMessage } from './components/WelcomeMessage';
import { AnalysisSummary } from './components/AnalysisSummary';
import { ShiftModal } from './components/ShiftModal';
import { ViewSwitcher } from './components/ViewSwitcher';
import { MonthCalendar } from './components/MonthCalendar';
import { HistoryPanel } from './components/HistoryPanel';
import { DayDetailView } from './components/DayDetailView';
import { ApiKeyModal } from './components/ApiKeyModal';

const App: React.FC = () => {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [schedule, setSchedule] = useState<DaySchedule[]>([]);
  const [allSchedules, setAllSchedules] = useState<Record<string, DaySchedule>>({});
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [analysisSummary, setAnalysisSummary] = useState<string | null>(null);
  
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedDay, setSelectedDay] = useState<DaySchedule | null>(null);

  const [viewMode, setViewMode] = useState<'week' | 'month'>('week');

  const [history, setHistory] = useState<AnalysisEntry[]>([]);
  const [isHistoryOpen, setIsHistoryOpen] = useState(false);
  const [loadedImage, setLoadedImage] = useState<string | null>(null);

  const [isDayDetailOpen, setIsDayDetailOpen] = useState(false);
  const [selectedDayForDetail, setSelectedDayForDetail] = useState<DaySchedule | null>(null);

  const [now, setNow] = useState(new Date());

  const [apiKey, setApiKey] = useState<string | null>(null);
  const [isApiKeyModalOpen, setIsApiKeyModalOpen] = useState(false);

  useEffect(() => {
    const timer = setInterval(() => {
      setNow(new Date());
    }, 60000); // Update every minute
    return () => clearInterval(timer);
  }, []);


  useEffect(() => {
    try {
      const savedHistory = localStorage.getItem('scheduleHistory');
      if (savedHistory) {
        setHistory(JSON.parse(savedHistory));
      }
      const savedApiKey = localStorage.getItem('geminiApiKey');
      if (savedApiKey) {
        setApiKey(savedApiKey);
      } else {
        setIsApiKeyModalOpen(true);
      }
    } catch (e) {
      console.error("Failed to load data from localStorage", e);
    }
  }, []);

  const handleSaveApiKey = (key: string) => {
    setApiKey(key);
    localStorage.setItem('geminiApiKey', key);
    setIsApiKeyModalOpen(false);
  };


  const weekInfo = useMemo(() => getWeekDays(currentDate), [currentDate]);
  const weekDayNames = useMemo(() => weekInfo.map(d => d.name), [weekInfo]);

  useEffect(() => {
    const newWeekSchedule = weekInfo.map((dayInfo): DaySchedule => {
      const dateStr = formatDate(dayInfo.date);
      return allSchedules[dateStr] || { date: dateStr, type: 'empty', shifts: [] };
    });
    setSchedule(newWeekSchedule);
  }, [weekInfo, allSchedules]);


  const fileToBase64 = (file: File): Promise<string> =>
    new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onload = () => resolve((reader.result as string).split(',')[1]);
      reader.onerror = (error) => reject(error);
    });

  const handleAnalyze = async (file: File) => {
    if (!apiKey) {
      setError("La chiave API di Gemini è necessaria per l'analisi. Per favore, inseriscila nelle impostazioni.");
      setIsApiKeyModalOpen(true);
      return;
    }

    setIsLoading(true);
    setError(null);
    setAnalysisSummary(null);
    setLoadedImage(null);

    try {
      const base64Image = await fileToBase64(file);
      const result = await analyzeScheduleImage(base64Image, file.type, apiKey);
      
      const updatedSchedules: Record<string, DaySchedule> = { ...allSchedules };
      result.schedule.forEach(day => {
        updatedSchedules[day.date] = day;
      });
      setAllSchedules(updatedSchedules);
      setAnalysisSummary(result.summary);

      if (result.schedule && result.schedule.length > 0) {
        const firstDay = new Date(result.schedule[0].date + 'T12:00:00Z');
        setCurrentDate(firstDay);

        // Save to history
        const newEntry: AnalysisEntry = {
          id: Date.now(),
          dateRange: `Settimana del ${firstDay.toLocaleDateString('it-IT', { day: 'numeric', month: 'long' })}`,
          schedule: result.schedule,
          summary: result.summary,
          imageData: base64Image,
          mimeType: file.type,
        };
        const updatedHistory = [...history, newEntry];
        setHistory(updatedHistory);
        localStorage.setItem('scheduleHistory', JSON.stringify(updatedHistory));
      }

    } catch (err) {
      setError(err instanceof Error ? err.message : 'An unknown error occurred.');
    } finally {
      setIsLoading(false);
    }
  };
  
  const handleLoadEntry = (id: number) => {
    const entry = history.find(e => e.id === id);
    if (entry) {
        const schedulesMap = entry.schedule.reduce((acc, day) => {
            acc[day.date] = day;
            return acc;
        }, {} as Record<string, DaySchedule>);

        setAllSchedules(prev => ({...prev, ...schedulesMap}));
        setAnalysisSummary(entry.summary);
        setCurrentDate(new Date(entry.schedule[0].date + 'T12:00:00Z'));
        setLoadedImage(`data:${entry.mimeType};base64,${entry.imageData}`);
        setIsHistoryOpen(false);
    }
  };

  const handleDeleteEntry = (id: number) => {
    const updatedHistory = history.filter(e => e.id !== id);
    setHistory(updatedHistory);
    localStorage.setItem('scheduleHistory', JSON.stringify(updatedHistory));
  };


  const handlePreviousWeek = () => {
    const newDate = new Date(currentDate);
    newDate.setDate(currentDate.getDate() - 7);
    setCurrentDate(newDate);
  };

  const handleNextWeek = () => {
    const newDate = new Date(currentDate);
    newDate.setDate(currentDate.getDate() + 7);
    setCurrentDate(newDate);
  };
  
  const handleDayClick = (day: DaySchedule) => {
    setSelectedDay(day);
    setIsModalOpen(true);
  }
  
  const handleCloseModal = () => {
    setIsModalOpen(false);
    setSelectedDay(null);
  }

  const handleUpdateDay = (updatedDay: DaySchedule) => {
     setAllSchedules(prev => ({
        ...prev,
        [updatedDay.date]: updatedDay
     }));
     handleCloseModal();
  }
  
  const handleMonthDayClick = (date: Date) => {
    const dateStr = formatDate(date);
    const dayData = allSchedules[dateStr] || { date: dateStr, type: 'empty', shifts: [] };
    setSelectedDayForDetail(dayData);
    setIsDayDetailOpen(true);
  }

  const handleCloseDayDetail = () => {
    setIsDayDetailOpen(false);
    setTimeout(() => setSelectedDayForDetail(null), 300);
  };

  const hasScheduleData = Object.keys(allSchedules).length > 0;

  return (
    <div className="bg-gray-900 text-white min-h-screen font-sans">
      {isLoading && <LoadingOverlay />}
      <ApiKeyModal
        isOpen={isApiKeyModalOpen}
        onClose={() => setIsApiKeyModalOpen(false)}
        onSave={handleSaveApiKey}
        currentApiKey={apiKey}
      />
      <ShiftModal 
        isOpen={isModalOpen}
        onClose={handleCloseModal}
        daySchedule={selectedDay}
        onUpdateDay={handleUpdateDay}
      />
      <HistoryPanel
        isOpen={isHistoryOpen}
        onClose={() => setIsHistoryOpen(false)}
        entries={history}
        onLoad={handleLoadEntry}
        onDelete={handleDeleteEntry}
      />
      <DayDetailView
        isOpen={isDayDetailOpen}
        onClose={handleCloseDayDetail}
        daySchedule={selectedDayForDetail}
      />

      <main className="max-w-7xl mx-auto p-4 sm:p-6 lg:p-8">
        <header className="flex flex-col sm:flex-row justify-between sm:items-center gap-4 text-center sm:text-left mb-6 animate-slideInUp" style={{ animationDelay: '100ms' }}>
          <div>
            <h1 className="text-3xl font-bold text-teal-400" style={{ animation: 'text-glow 2s ease-in-out infinite' }}>Orario Intelligente</h1>
            <p className="text-gray-400 mt-1">Usa l'IA per digitalizzare e analizzare i tuoi turni di lavoro.</p>
          </div>
          <div className="flex items-center justify-center sm:justify-end gap-2">
            <button 
              onClick={() => setIsHistoryOpen(true)}
              className="flex items-center justify-center gap-2 px-4 py-2 bg-slate-700 text-gray-200 rounded-lg hover:bg-slate-600 transition-colors transform hover:-translate-y-0.5 disabled:opacity-50"
              disabled={history.length === 0}
              title="Mostra storico analisi"
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 3v18h18"/><path d="m19 9-5 5-4-4-3 3"/></svg>
              Storico
            </button>
            <button 
              onClick={() => setIsApiKeyModalOpen(true)}
              className="p-2.5 bg-slate-700 text-gray-200 rounded-lg hover:bg-slate-600 transition-colors transform hover:-translate-y-0.5"
              title="Impostazioni API Key"
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 0 2.4l-.15.08a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.38a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1 0-2.4l.15-.08a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z"/><circle cx="12" cy="12" r="3"/></svg>
            </button>
          </div>
        </header>
        
        <div className="animate-slideInUp" style={{ animationDelay: '200ms' }}>
            <ImageUploader onAnalyze={handleAnalyze} isLoading={isLoading} initialPreview={loadedImage} />
        </div>

        {error && <ErrorDisplay message={error} />}
        {analysisSummary && <AnalysisSummary summary={analysisSummary} />}

        {hasScheduleData ? (
          <div className="mt-8 animate-slideInUp" style={{ animationDelay: '300ms' }}>
            <div className="flex flex-col sm:flex-row justify-between items-center mb-4 gap-4">
              <h2 className="text-xl font-semibold text-center sm:text-left">
                {viewMode === 'week' ? `Settimana del ${new Date(weekInfo[0].date).toLocaleDateString('it-IT', { day: 'numeric', month: 'long' })}` : `Mese di ${currentDate.toLocaleDateString('it-IT', { month: 'long', year: 'numeric'})}`}
              </h2>
              <div className="flex flex-wrap items-center justify-center sm:justify-end gap-4">
                <ViewSwitcher viewMode={viewMode} setViewMode={setViewMode} />
                <HourTracker schedule={schedule} />
                {viewMode === 'week' && <WeekNavigator onPrevious={handlePreviousWeek} onNext={handleNextWeek} />}
              </div>
            </div>

            {viewMode === 'week' ? (
              <CalendarGrid weekDays={weekDayNames} schedule={schedule} onDayClick={handleDayClick} now={now}/>
            ) : (
              <MonthCalendar currentDate={currentDate} scheduleData={Object.values(allSchedules)} onDayClick={handleMonthDayClick} />
            )}
          </div>
        ) : (
          !isLoading && <div className="mt-8 animate-slideInUp" style={{ animationDelay: '300ms' }}><WelcomeMessage /></div>
        )}
      </main>
    </div>
  );
};

export default App;
