import { Context, Next } from 'hono';
import type { Env } from '../types';

export async function authMiddleware(c: Context<{ Bindings: Env }>, next: Next) {
  const apiKey = c.env.API_KEY;

  // If no API_KEY is configured in environment, skip authentication (development mode)
  if (!apiKey) {
    console.warn('API_KEY not configured - authentication disabled');
    return next();
  }

  // Get API key from request header
  const requestApiKey = c.req.header('X-API-Key');

  if (!requestApiKey) {
    return c.json({ error: 'Missing API key' }, 401);
  }

  if (requestApiKey !== apiKey) {
    return c.json({ error: 'Invalid API key' }, 401);
  }

  return next();
}
