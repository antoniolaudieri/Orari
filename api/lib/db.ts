import { createPool } from '@vercel/postgres';
import type { AnalysisEntry } from '../../types.js';

// La connessione al database viene gestita automaticamente da Vercel
// tramite la variabile d'ambiente POSTGRES_URL.
const pool = createPool();

// Funzione per creare la tabella dello storico se non esiste già.
// Viene eseguita in modo sicuro prima di ogni operazione sul database.
export async function createHistoryTable() {
    await pool.sql`
        CREATE TABLE IF NOT EXISTS history (
            id SERIAL PRIMARY KEY,
            user_id VARCHAR(255) NOT NULL,
            date_range VARCHAR(255),
            schedule JSONB,
            summary TEXT,
            created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
        );
    `;
}

/**
 * Aggiunge una nuova voce allo storico per un utente specifico.
 * @param userId - L'ID dell'utente.
 * @param entry - L'oggetto dell'analisi da salvare.
 * @returns La voce dello storico appena creata.
 */
export async function addHistory(userId: string, entry: Omit<AnalysisEntry, 'id' | 'imageData' | 'mimeType'>): Promise<AnalysisEntry> {
    await createHistoryTable(); // Assicura che la tabella esista
    const result = await pool.sql`
        INSERT INTO history (user_id, date_range, schedule, summary)
        VALUES (${userId}, ${entry.dateRange}, ${JSON.stringify(entry.schedule)}, ${entry.summary})
        RETURNING id, date_range, schedule, summary;
    `;
    const row = result.rows[0];
    return {
        id: row.id,
        dateRange: row.date_range,
        schedule: row.schedule,
        summary: row.summary,
    };
}

/**
 * Recupera lo storico delle analisi per un utente specifico.
 * @param userId - L'ID dell'utente.
 * @returns Un array di voci dello storico.
 */
export async function getHistory(userId: string): Promise<AnalysisEntry[]> {
    await createHistoryTable(); // Assicura che la tabella esista
    const result = await pool.sql`
        SELECT id, date_range, schedule, summary FROM history
        WHERE user_id = ${userId}
        ORDER BY created_at DESC;
    `;
    // Il tipo di 'schedule' dal DB potrebbe essere stringa o oggetto a seconda del driver,
    // quindi ci assicuriamo che sia sempre un oggetto.
    return result.rows.map(row => ({
        id: row.id,
        dateRange: row.date_range,
        schedule: typeof row.schedule === 'string' ? JSON.parse(row.schedule) : row.schedule,
        summary: row.summary,
    }));
}

/**
 * Elimina una voce specifica dallo storico di un utente.
 * @param id - L'ID della voce da eliminare.
 * @param userId - L'ID dell'utente, per sicurezza.
 */
export async function deleteHistory(id: number, userId: string): Promise<void> {
    await createHistoryTable(); // Assicura che la tabella esista
    await pool.sql`
        DELETE FROM history
        WHERE id = ${id} AND user_id = ${userId};
    `;
}