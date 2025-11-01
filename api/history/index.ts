import type { VercelRequest, VercelResponse } from '@vercel/node';
import { getHistory } from '../lib/db';

export default async function handler(req: VercelRequest, res: VercelResponse) {
    if (req.method !== 'GET') {
        return res.status(405).json({ error: 'Method Not Allowed' });
    }

    // ID utente statico dato che il login è stato rimosso.
    const userId = 'ilaria-user-id';

    try {
        const history = await getHistory(userId);
        res.status(200).json(history);
    } catch (error) {
        console.error('Failed to get history:', error);
        res.status(500).json({ error: 'Internal Server Error' });
    }
}