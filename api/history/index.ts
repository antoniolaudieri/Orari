import { getHistory } from '../../lib/db';
import { getSessionId, createSessionCookie } from '../../lib/session';

export const config = {
  runtime: 'edge',
};

export default async function handler(req: Request) {
  if (req.method !== 'GET') {
    return new Response(JSON.stringify({ message: 'Method Not Allowed' }), { status: 405, headers: { 'Content-Type': 'application/json' } });
  }

  let sessionId = getSessionId(req);
  const headers = new Headers({ 'Content-Type': 'application/json' });

  // Se l'utente non ha una sessione, ne creiamo una nuova.
  if (!sessionId) {
    const [newSessionId, sessionCookie] = createSessionCookie();
    sessionId = newSessionId;
    headers.set('Set-Cookie', sessionCookie);
    // Un nuovo utente non ha storico, quindi restituiamo un array vuoto.
    return new Response(JSON.stringify([]), {
        status: 200,
        headers: headers,
    });
  }

  try {
    const history = await getHistory(sessionId);
    return new Response(JSON.stringify(history), {
        status: 200,
        headers: headers,
    });
  } catch (error) {
    console.error('Errore nel recuperare lo storico:', error);
    return new Response(JSON.stringify({ message: 'Errore interno del server' }), { status: 500, headers });
  }
}
