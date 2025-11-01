import type { VercelRequest, VercelResponse } from '@vercel/node';
import { setSession } from './lib/auth.js';

export default function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  const { username, password } = req.body;

  // IMPORTANT: This is highly insecure and for demonstration purposes only.
  // In a real application, use a database and hashed passwords.
  if (username === 'Ilaria' && password === '123456') {
    setSession(res);
    return res.status(200).json({ success: true });
  }

  return res.status(401).json({ error: 'Invalid credentials' });
}