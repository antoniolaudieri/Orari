import type { VercelRequest, VercelResponse } from '@vercel/node';
import { getUserIdFromRequest } from '../lib/auth';

export default function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  const userId = getUserIdFromRequest(req);

  if (userId) {
    return res.status(200).json({ loggedIn: true });
  } else {
    return res.status(200).json({ loggedIn: false });
  }
}
