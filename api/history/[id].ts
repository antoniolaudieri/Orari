import type { VercelRequest, VercelResponse } from '@vercel/node';
import { deleteHistory, updateHistory } from '../lib/db.js';
import type { DaySchedule } from '../../types.js';

export default async function handler(req: VercelRequest, res: VercelResponse) {
    const userId = 'ilaria-user-id';
    const { id } = req.query;

    if (!id || typeof id !== 'string') {
        return res.status(400).json({ error: 'ID non valido' });
    }
    const entryId = parseInt(id, 10);

    if (req.method === 'DELETE') {
        try {
            await deleteHistory(entryId, userId);
            return res.status(200).json({ success: true });
        } catch (error) {
            console.error(`Impossibile eliminare la voce ${id}:`, error);
            return res.status(500).json({ error: 'Errore interno del server' });
        }
    }
    
    if (req.method === 'PATCH') {
        try {
            const { schedule, summary, dateRange } = req.body as { schedule?: DaySchedule[], summary?: string, dateRange?: string };
            if (!schedule && !summary && !dateRange) {
                return res.status(400).json({ error: 'Payload incompleto: almeno un campo (schedule, summary, o dateRange) è richiesto.' });
            }
            const updatedEntry = await updateHistory(entryId, userId, { schedule, summary, dateRange });
            return res.status(200).json(updatedEntry);
        } catch (error: any) {
            console.error(`Impossibile aggiornare la voce ${id}:`, error);
            if (error.message.includes('not found')) {
                 return res.status(404).json({ error: 'Voce dello storico non trovata.' });
            }
            return res.status(500).json({ error: 'Errore interno del server', details: error.message });
        }
    }

    return res.status(405).json({ error: 'Metodo non consentito' });
}