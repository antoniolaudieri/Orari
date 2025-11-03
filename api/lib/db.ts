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
            image_data TEXT,
            mime_type VARCHAR(255),
            created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
        );
    `;
}

export async function addHistory(userId: string, entry: Omit<AnalysisEntry, 'id'>): Promise<AnalysisEntry> {
    await createHistoryTable();
    const result = await pool.sql`
        INSERT INTO history (user_id, date_range, schedule, summary, image_data, mime_type)
        VALUES (${userId}, ${entry.dateRange}, ${JSON.stringify(entry.schedule)}, ${entry.summary}, ${entry.imageData || null}, ${entry.mimeType || null})
        RETURNING id, date_range, schedule, summary, image_data, mime_type;
    `;
    const row = result.rows[0];
    return {
        id: row.id,
        dateRange: row.date_range,
        schedule: row.schedule,
        summary: row.summary,
        imageData: row.image_data,
        mimeType: row.mime_type,
    };
}

export async function getHistory(userId: string): Promise<AnalysisEntry[]> {
    await createHistoryTable();
    const result = await pool.sql`
        SELECT id, date_range, schedule, summary, image_data, mime_type FROM history
        WHERE user_id = ${userId}
        ORDER BY created_at DESC;
    `;
    return result.rows.map(row => ({
        id: row.id,
        dateRange: row.date_range,
        schedule: typeof row.schedule === 'string' ? JSON.parse(row.schedule) : row.schedule,
        summary: row.summary,
        imageData: row.image_data,
        mimeType: row.mime_type,
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

    const currentResult = await pool.sql`SELECT schedule, summary, date_range, image_data, mime_type FROM history WHERE id = ${id} AND user_id = ${userId}`;
    if (currentResult.rows.length === 0) {
        throw new Error('Voce dello storico non trovata o utente non autorizzato.');
    }
    const currentEntry = currentResult.rows[0];

    const scheduleToUpdate = entry.schedule ?? currentEntry.schedule;
    const summaryToUpdate = entry.summary ?? currentEntry.summary;
    const dateRangeToUpdate = entry.dateRange ?? currentEntry.date_range;

    const result = await pool.sql`
        UPDATE history
        SET 
            schedule = ${JSON.stringify(scheduleToUpdate)}, 
            summary = ${summaryToUpdate}, 
            date_range = ${dateRangeToUpdate}
        WHERE id = ${id} AND user_id = ${userId}
        RETURNING id, date_range, schedule, summary, image_data, mime_type;
    `;
    
    const row = result.rows[0];
    return {
        id: row.id,
        dateRange: row.date_range,
        schedule: row.schedule,
        summary: row.summary,
        imageData: row.image_data,
        mimeType: row.mime_type,
    };
}