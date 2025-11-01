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
import type { DaySchedule, AnalysisEntry, Shift } from './types.js';
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
5.  **Incertezza**: Se non riesci a leggere chiaramente un orario o un giorno, imposta \`isUncertain\` a \`true\`