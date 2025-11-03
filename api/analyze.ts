import type { VercelRequest, VercelResponse } from '@vercel/node';
import { addHistory } from './lib/db.js';
import type { DaySchedule } from '../types.js';

interface AnalysisPayload {
    analysisResult: {
        dateRange: string;
        schedule: DaySchedule[];
        summary: string;
        imageData?: string;
        mimeType?: string;
    };
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method Not Allowed' });
    }

    // ID utente statico dato che il login è stato rimosso.
    const userId = 'ilaria-user-id';

    try {
        const { analysisResult } = req.body as AnalysisPayload;

        if (!analysisResult) {
            return res.status(400).json({ error: 'Payload incompleto.' });
        }
        
        const historyEntry = {
            dateRange: analysisResult.dateRange,
            schedule: analysisResult.schedule,
            summary: analysisResult.summary,
            imageData: analysisResult.imageData,
            mimeType: analysisResult.mimeType,
        };

        const newEntry = await addHistory(userId, historyEntry);

        res.status(200).json(newEntry);
    } catch (error: any) {
        console.error('Error saving history:', error);
        res.status(500).json({ error: "Impossibile salvare l'analisi nello storico.", details: error.message });
    }
}
