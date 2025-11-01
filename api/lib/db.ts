import { createPool } from '@vercel/postgres';
import type { DaySchedule, AnalysisEntry } from '../../types';

// La connessione al database viene gestita automaticamente da Vercel
// tramite la variabile d'ambiente POSTGRES_URL.
const pool = createPool();

// Funzione per creare la tabella dello storico se non esiste già.
// Viene eseguita in modo sicuro prima di ogni operazione sul database.
export async function createHistoryTable()