import { serialize, parse } from 'cookie';
import { webcrypto } from 'crypto';

const SESSION_COOKIE_NAME = 'app-session-id';
const ONE_YEAR_IN_SECONDS = 31536000;

// Estrae l'ID di sessione dai cookie di una richiesta.
export function getSessionId(req: Request): string {
    const cookies = parse(req.headers.get('cookie') || '');
    return cookies[SESSION_COOKIE_NAME] || '';
}

// Crea un nuovo cookie di sessione sicuro.
export function createSessionCookie(): [string, string] {
  const sessionId = webcrypto.randomUUID();
  const cookie = serialize(SESSION_COOKIE_NAME, sessionId, {
    path: '/',
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    maxAge: ONE_YEAR_IN_SECONDS,
    sameSite: 'lax',
  });
  return [sessionId, cookie];
}
