import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { ImageUploader } from './components/ImageUploader';
import { CalendarGrid } from './components/CalendarGrid';
import { WeekNavigator } from './components/WeekNavigator';
import { HourTracker } from './components/HourTracker';
import { LoadingOverlay } from './components/LoadingOverlay';
import { ErrorDisplay } from './components/ErrorDisplay';
import { WelcomeMessage } from './components/WelcomeMessage';
import { ShiftModal } from './components/ShiftModal';
import { AnalysisSummary } from './components/AnalysisSummary';
import { HistoryPanel } from './components/HistoryPanel';
import { ViewSwitcher } from './components/ViewSwitcher';
import { MonthCalendar } from './components/MonthCalendar';
import { DayDetailView } from './components/DayDetailView';
import { LoginPage } from './components/LoginPage';
import type { DaySchedule, AnalysisEntry } from './types';
import { getWeekStartDate, formatDate } from './utils/dateUtils';

// Main application component, rendered only when logged in
const MainApp: React.FC<{ onLogout: () => void }> = ({ onLogout }) => {
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


  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 60000); // Update every minute
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

  const handleAnalyze = async (file: File) => {
    setIsLoading(true);
    setError(null);

    const formData = new FormData();
    formData.append('image', file);

    try {
      const response = await fetch('/api/analyze', {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Analisi fallita');
      }

      const result: AnalysisEntry = await response.json();
      setCurrentAnalysis(result);
      setSchedule(result.schedule);
      loadHistory(); // Refresh history after analysis
    } catch (err: any) {
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
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
      // Here you would typically also update the entry in the database
      // For now, it's a client-side only update for simplicity after initial analysis
      console.log("Updated schedule (client-side):", newSchedule);
    }
    setIsModalOpen(false);
  };
  
  const handleLoadFromHistory = (id: number) => {
      const entry = history.find(e => e.id === id);
      if (entry) {
          setCurrentAnalysis(entry);
          setSchedule(entry.schedule);
          
          // Try to set the date to the first day of the schedule
          if (entry.schedule && entry.schedule.length > 0) {
              setCurrentDate(new Date(entry.schedule[0].date + 'T12:00:00Z'));
          }

          setIsHistoryPanelOpen(false);
      }
  };
  
  const handleDeleteFromHistory = async (id: number) => {
      try {
          const response = await fetch(`/api/history/${id}`, { method: 'DELETE' });
          if (!response.ok) {
              throw new Error('Failed to delete history item.');
          }
          setHistory(prev => prev.filter(e => e.id !== id));
      } catch (err) {
          console.error(err);
          setError("Impossibile eliminare l'elemento dallo storico.");
      }
  };

  const weekSchedule = useMemo(() => {
    const weekStart = getWeekStartDate(currentDate);
    const weekDays: DaySchedule[] = [];
    for (let i = 0; i < 7; i++) {
        const day = new Date(weekStart);
        day.setDate(weekStart.getDate() + i);
        const dateString = formatDate(day);
        
        const dayData = schedule?.find(d => d.date === dateString);
        if (dayData) {
            weekDays.push(dayData);
        } else {
            weekDays.push({ date: dateString, type: 'empty', shifts: [] });
        }
    }
    return weekDays;
  }, [currentDate, schedule]);

  const weekDaysNames = useMemo(() => {
      const weekStart = getWeekStartDate(currentDate);
      const names = [];
      for (let i = 0; i < 7; i++) {
          const day = new Date(weekStart);
          day.setDate(weekStart.getDate() + i);
          names.push(day.toLocaleDateString('it-IT', { weekday: 'long' }));
      }
      return names;
  }, [currentDate]);
  
  const allScheduleData = useMemo(() => history.flatMap(entry => entry.schedule), [history]);

  return (
    <>
      {isLoading && <LoadingOverlay />}
      <div className="min-h-screen flex flex-col p-2 sm:p-4 lg:p-6">
        <header className="flex flex-col sm:flex-row justify-between items-center mb-4 sm:mb-6">
            <div className="flex items-center gap-3 mb-3 sm:mb-0">
                <svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-teal-400"><path d="M12 2a10 10 0 1 0 10 10c0-4.42-2.87-8.1-7-9.44"/><path d="m13 2-3 9 9 3-3-9Z"/></svg>
                <h1 className="text-xl sm:text-2xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-white to-gray-400" style={{ animation: 'text-glow 2s ease-in-out infinite' }}>
                    Orario Intelligente
                </h1>
            </div>
            <div className="flex items-center gap-2 sm:gap-4">
               <button onClick={() => setIsHistoryPanelOpen(true)} className="p-2.5 rounded-lg bg-slate-700/50 hover:bg-teal-500 text-gray-300 hover:text-white transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-teal-400 transform hover:-translate-y-0.5">
                    <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 6v6l4 2"/><circle cx="12" cy="12" r="10"/></svg>
               </button>
               <button onClick={onLogout} className="px-4 py-2 text-sm font-semibold text-gray-200 bg-slate-700/50 rounded-lg hover:bg-red-800/80 hover:text-white transition-colors duration-200">
                   Logout
               </button>
            </div>
        </header>

        <main className="flex-1 w-full max-w-7xl mx-auto">
          <div className="animate-slideInUp">
            <ImageUploader 
                onAnalyze={handleAnalyze} 
                isLoading={isLoading} 
                initialPreview={currentAnalysis ? `data:${currentAnalysis.mimeType};base64,${currentAnalysis.imageData}` : null}
            />
          </div>

          {error && <ErrorDisplay message={error} />}
          
          {currentAnalysis && <AnalysisSummary summary={currentAnalysis.summary} />}

          <div className="mt-6 sm:mt-8 animate-slideInUp" style={{ animationDelay: '150ms' }}>
             <div className="flex flex-col sm:flex-row justify-between items-center mb-4 gap-4">
                <div className="flex items-center gap-2">
                   <WeekNavigator onPrevious={viewMode === 'week' ? handlePreviousWeek : handlePreviousMonth} onNext={viewMode === 'week' ? handleNextWeek : handleNextMonth} />
                    <h2 className="text-lg font-semibold text-white w-48 text-center">
                      {viewMode === 'week' ?
                        `${formatDate(getWeekStartDate(currentDate)).split('-').reverse().join('/')} - ${formatDate(new Date(getWeekStartDate(currentDate).getTime() + 6 * 24 * 60 * 60 * 1000)).split('-').reverse().join('/')}`
                        :
                        currentDate.toLocaleDateString('it-IT', { month: 'long', year: 'numeric' })
                      }
                    </h2>
                </div>
                <div className="flex items-center gap-4">
                  <HourTracker schedule={schedule || []} />
                  <ViewSwitcher viewMode={viewMode} setViewMode={setViewMode} />
                </div>
              </div>

              {viewMode === 'week' ? (
                <CalendarGrid weekDays={weekDaysNames} schedule={weekSchedule} onDayClick={handleDayClick} now={now} />
              ) : (
                <MonthCalendar currentDate={currentDate} scheduleData={allScheduleData} onDayClick={handleMonthDayClick} />
              )}
          </div>
          
          {!schedule && !isLoading && !error && (
            <div className="mt-8 animate-slideInUp" style={{ animationDelay: '150ms' }}>
                <WelcomeMessage />
            </div>
          )}

        </main>
      </div>
      <ShiftModal 
        isOpen={isModalOpen} 
        onClose={() => setIsModalOpen(false)} 
        daySchedule={selectedDay}
        onUpdateDay={handleUpdateDay}
      />
      <HistoryPanel
        isOpen={isHistoryPanelOpen}
        onClose={() => setIsHistoryPanelOpen(false)}
        entries={history}
        onLoad={handleLoadFromHistory}
        onDelete={handleDeleteFromHistory}
      />
      <DayDetailView
        isOpen={isDayDetailOpen}
        onClose={() => setIsDayDetailOpen(false)}
        daySchedule={dayDetail}
      />
    </>
  );
};


// Main component that handles authentication state
const App: React.FC = () => {
    const [authStatus, setAuthStatus] = useState<'loading' | 'loggedIn' | 'loggedOut'>('loading');

    useEffect(() => {
        const checkSession = async () => {
            try {
                const response = await fetch('/api/session');
                const data = await response.json();
                setAuthStatus(data.loggedIn ? 'loggedIn' : 'loggedOut');
            } catch (error) {
                console.error("Failed to check session", error);
                setAuthStatus('loggedOut');
            }
        };
        checkSession();
    }, []);

    const handleLoginSuccess = () => {
        setAuthStatus('loggedIn');
    };
    
    const handleLogout = async () => {
        await fetch('/api/logout', { method: 'POST' });
        setAuthStatus('loggedOut');
    };


    if (authStatus === 'loading') {
        return (
            <div className="flex items-center justify-center min-h-screen">
                <div className="w-16 h-16 border-4 border-dashed rounded-full animate-spin border-teal-500"></div>
            </div>
        );
    }
    
    if (authStatus === 'loggedOut') {
        return <LoginPage onLoginSuccess={handleLoginSuccess} />;
    }

    return <MainApp onLogout={handleLogout} />;
}


export default App;
