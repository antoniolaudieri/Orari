import { serialize, parse } from 'cookie';
import type { VercelRequest, VercelResponse } from '@vercel/node';

const COOKIE_NAME = 'auth_session';
// This should be a securely stored secret in a real application
const SESSION_SECRET_TOKEN = process.env.SESSION_SECRET || 'secret-insecure-token-for-demo-only';
const USER_ID = 'ilaria-user-id'; // Static user ID for the single user

export function setSession(res: VercelResponse) {
  const cookie = serialize(COOKIE_NAME, SESSION_SECRET_TOKEN, {
    httpOnly: true,
    secure: process.env.NODE_ENV !== 'development',
    path: '/',
    maxAge: 60 * 60 * 24 * 7, // 1 week
    sameSite: 'strict',
  });
  res.setHeader('Set-Cookie', cookie);
}

export function clearSession(res: VercelResponse) {
  const cookie = serialize(COOKIE_NAME, '', {
    httpOnly: true,
    path: '/',
    maxAge: -1,
  });
  res.setHeader('Set-Cookie', cookie);
}

export function getUserIdFromRequest(req: VercelRequest): string | null {
  const cookieHeader = req.headers.cookie;
  if (!cookieHeader) {
    return null;
  }
  
  const cookies = parse(cookieHeader);
  const token = cookies[COOKIE_NAME];

  if (token === SESSION_SECRET_TOKEN) {
    return USER_ID;
  }

  return null;
}
