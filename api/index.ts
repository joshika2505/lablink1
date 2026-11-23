import 'dotenv/config';
import { createApp } from '../server.js';
import type { VercelRequest, VercelResponse } from '@vercel/node';

// Cache the app instance across warm invocations (Vercel reuses function instances)
let appPromise: Promise<ReturnType<typeof createApp>> | null = null;

function getApp() {
  if (!appPromise) {
    appPromise = createApp();
  }
  return appPromise;
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const app = await getApp();
  // Express app handles the request
  return new Promise<void>((resolve, reject) => {
    app(req as any, res as any, (err?: unknown) => {
      if (err) reject(err);
      else resolve();
    });
  });
}
