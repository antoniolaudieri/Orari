import { createPool } from '@vercel/postgres';
import type { DaySchedule, AnalysisEntry } from '../../types';

// La connessione al database viene gestita automaticamente da Vercel
// tramite la variabile d'ambiente POSTGRES_URL.
const pool = createPool();

// Funzione per creare la tabella dello storico se non esiste già.
// Viene eseguita in modo sicuro prima di ogni operazione sul database.
export async function createHistoryTable() {
  await pool.sql`
    CREATE TABLE IF NOT EXISTS analysis_history (
      id SERIAL PRIMARY KEY,
      user_id TEXT NOT NULL,
      created_at TIMESTAMPTZ DEFAULT NOW(),
      date_range TEXT NOT NULL,
      schedule_data JSONB NOT NULL,
      summary TEXT NOT NULL,
      image_data TEXT NOT NULL,
      mime_type TEXT NOT NULL
    );
  `;
}

// Recupera lo storico delle analisi per un utente specifico.
export async function getHistory(userId: string): Promise<AnalysisEntry[]> {
    await createHistoryTable();
    const { rows } = await pool.sql`
        SELECT 
            id, 
            date_range AS "dateRange", 
            schedule_data AS schedule, 
            summary, 
            image_data AS "imageData", 
            mime_type AS "mimeType"
        FROM analysis_history
        WHERE user_id = ${userId}
        ORDER BY created_at DESC;
    `;
    return rows as AnalysisEntry[];
}

// Aggiunge una nuova analisi al database.
export async function addHistory(
  userId: string,
  entry: Omit<AnalysisEntry, 'id'>
) {
  await createHistoryTable();
  const { dateRange, schedule, summary, imageData, mimeType } = entry;
  const { rows } = await pool.sql`
    INSERT INTO analysis_history (user_id, date_range, schedule_data, summary, image_data, mime_type)
    VALUES (${userId}, ${dateRange}, ${JSON.stringify(schedule)}, ${summary}, ${imageData}, ${mimeType})
    RETURNING 
        id, 
        date_range AS "dateRange", 
        schedule_data AS schedule, 
        summary, 
        image_data AS "imageData", 
        mime_type AS "mimeType";
  `;
  return rows[0] as AnalysisEntry;
}

// Elimina un'analisi specifica dal database.
export async function deleteHistory(id: number, userId: string) {
    await pool.sql`
        DELETE FROM analysis_history
        WHERE id = ${id} AND user_id = ${userId};
    `;
}