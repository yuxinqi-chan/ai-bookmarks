import { Hono } from 'hono';
import { cors } from 'hono/cors';
import type { Env } from './types';
import bookmarksRoute from './routes/bookmarks';
import { authMiddleware } from './middleware/auth';

const app = new Hono<{ Bindings: Env }>();

app.use('/*', cors());

// Apply auth middleware to all routes including health check
app.use('/*', authMiddleware);

app.get('/health', (c) => {
  return c.json({ status: 'ok' });
});

app.route('/api/bookmarks', bookmarksRoute);

export default app;
