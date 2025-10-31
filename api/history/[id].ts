import { deleteHistory } from '../../lib/db';
import { getSessionId } from '../../lib/session';

export const config = {
  runtime: 'edge',
};

export default async function handler(req: Request) {
  if (req.method !== 'DELETE') {
    return new Response(JSON.stringify({ message: 'Method Not Allowed' }), { status: 405 });
  }

  const sessionId = getSessionId(req);
  if (!sessionId) {
    return new Response(JSON.stringify({ message: 'Non autorizzato' }), { status: 401 });
  }

  const url = new URL(req.url);
  const idStr = url.pathname.split('/').pop();
  const id = idStr ? parseInt(idStr, 10) : NaN;

  if (isNaN(id)) {
    return new Response(JSON.stringify({ message: 'ID non valido' }), { status: 400 });
  }

  try {
    await deleteHistory(id, sessionId);
    return new Response(null, { status: 204 });
  } catch (error) {
    console.error(`Errore nell'eliminare l'elemento ${id}:`, error);
    return new Response(JSON.stringify({ message: 'Errore interno del server' }), { status: 500 });
  }
}
