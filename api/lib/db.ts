import { createPool } from '@vercel/postgres';
import type { AnalysisEntry, DaySchedule } from '../../types.js';

const pool = createPool();

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

export async function addHistory(userId: string, entry: Omit<AnalysisEntry, 'id' | 'imageData' | 'mimeType'>): Promise<AnalysisEntry> {
    await createHistoryTable();
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

export async function getHistory(userId: string): Promise<AnalysisEntry[]> {
    await createHistoryTable();
    const result = await pool.sql`
        SELECT id, date_range, schedule, summary FROM history
        WHERE user_id = ${userId}
        ORDER BY created_at DESC;
    `;
    return result.rows.map(row => ({
        id: row.id,
        dateRange: row.date_range,
        schedule: typeof row.schedule === 'string' ? JSON.parse(row.schedule) : row.schedule,
        summary: row.summary,
    }));
}

export async function deleteHistory(id: number, userId: string): Promise<void> {
    await createHistoryTable();
    await pool.sql`
        DELETE FROM history
        WHERE id = ${id} AND user_id = ${userId};
    `;
}

export async function updateHistory(id: number, userId: string, entry: { schedule?: DaySchedule[], summary?: string, dateRange?: string }): Promise<AnalysisEntry> {
    await createHistoryTable();

    const currentResult = await pool.sql`SELECT schedule, summary, date_range FROM history WHERE id = ${id} AND user_id = ${userId}`;
    if (currentResult.rows.length === 0) {
        throw new Error('Voce dello storico non trovata o utente non autorizzato.');
    }
    const currentEntry = currentResult.rows[0];

    const updatedSchedule = entry.schedule ? JSON.stringify(entry.schedule) : currentEntry.schedule;
    const updatedSummary = entry.summary ?? currentEntry.summary;
    const updatedDateRange = entry.dateRange ?? currentEntry.date_range;

    const result = await pool.sql`
        UPDATE history
        SET schedule = ${updatedSchedule}, summary = ${updatedSummary}, date_range = ${updatedDateRange}
        WHERE id = ${id} AND user_id = ${userId}
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