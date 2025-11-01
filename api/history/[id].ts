import type { VercelRequest, VercelResponse } from '@vercel/node';
import { deleteHistory } from '../lib/db';

export default async function handler(req: VercelRequest, res: VercelResponse) {
    if (req.method !== 'DELETE') {
        return res.status(405).json({ error: 'Method Not Allowed' });
    }

    // ID utente statico dato che il login è stato rimosso.
    const userId = 'ilaria-user-id';

    const { id } = req.query;

    if (!id || typeof id !== 'string') {
        return res.status(400).json({ error: 'Invalid ID' });
    }

    try {
        await deleteHistory(parseInt(id, 10), userId);
        res.status(200).json({ success: true });
    } catch (error) {
        console.error(`Failed to delete history item ${id}:`, error);
        res.status(500).json({ error: 'Internal Server Error' });
    }
}