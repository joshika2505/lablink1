import crypto from 'node:crypto';
import type { NextFunction, Request, Response } from 'express';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import type { UserProfile, UserRole } from '../src/types/lablink.js';

const RUNTIME_FALLBACK_SECRET = crypto.randomBytes(32).toString('hex');

function getSessionSecret(): string {
  return process.env.SESSION_SECRET || RUNTIME_FALLBACK_SECRET;
}

export function isSupabaseServerConfigured(): boolean {
  const url = process.env.SUPABASE_URL?.trim() || '';
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim() || '';
  return (
    url.startsWith('https://') &&
    !url.includes('MY_SUPABASE') &&
    !url.includes('your-project') &&
    serviceKey.length > 20 &&
    !serviceKey.includes('MY_SUPABASE')
  );
}

export function isSupabaseAuthReady(): boolean {
  const viteUrl = process.env.VITE_SUPABASE_URL?.trim() || '';
  const viteAnon = process.env.VITE_SUPABASE_ANON_KEY?.trim() || '';
  return (
    isSupabaseServerConfigured() &&
    viteUrl.startsWith('https://') &&
    !viteUrl.includes('MY_SUPABASE') &&
    !viteUrl.includes('your-project') &&
    viteAnon.length > 20 &&
    !viteAnon.includes('MY_SUPABASE')
  );
}

let cachedSupabaseAdmin: SupabaseClient | null = null;

export function getSupabaseAdmin(): SupabaseClient | null {
  if (!isSupabaseServerConfigured()) return null;
  const url = process.env.SUPABASE_URL!.trim();
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!.trim();
  if (!cachedSupabaseAdmin) {
    cachedSupabaseAdmin = createClient(url, serviceKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
  }
  return cachedSupabaseAdmin;
}

export function hashPassword(password: string): string {
  const salt = crypto.randomBytes(16).toString('hex');
  const derived = crypto.scryptSync(password, salt, 64).toString('hex');
  return `${salt}:${derived}`;
}

export function verifyPassword(password: string, storedHash: string): boolean {
  if (!storedHash || !storedHash.includes(':')) return false;
  const [salt, originalHex] = storedHash.split(':');
  if (!salt || !originalHex) return false;
  const derived = crypto.scryptSync(password, salt, 64);
  const original = Buffer.from(originalHex, 'hex');
  if (derived.length !== original.length) return false;
  return crypto.timingSafeEqual(derived, original);
}

export interface TokenPayload {
  sub: string;
  email: string;
  role: UserRole;
  name: string;
  exp: number;
}

export function signSessionToken(user: Pick<UserProfile, 'id' | 'email' | 'role' | 'name'>): string {
  const payload: TokenPayload = {
    sub: user.id,
    email: user.email,
    role: user.role,
    name: user.name,
    exp: Date.now() + 1000 * 60 * 60 * 24 * 7, // 7 days
  };
  const encoded = Buffer.from(JSON.stringify(payload), 'utf8').toString('base64url');
  const signature = crypto
    .createHmac('sha256', getSessionSecret())
    .update(encoded)
    .digest('base64url');
  return `${encoded}.${signature}`;
}

export function verifySessionToken(token: string): TokenPayload | null {
  const parts = token.split('.');
  if (parts.length !== 2) return null;
  const [encoded, signature] = parts;
  const expected = crypto
    .createHmac('sha256', getSessionSecret())
    .update(encoded)
    .digest('base64url');
  const sigBuf = Buffer.from(signature, 'utf8');
  const expBuf = Buffer.from(expected, 'utf8');
  if (sigBuf.length !== expBuf.length || !crypto.timingSafeEqual(sigBuf, expBuf)) {
    return null;
  }
  try {
    const payload = JSON.parse(Buffer.from(encoded, 'base64url').toString('utf8')) as TokenPayload;
    if (!payload.sub || !payload.role || Date.now() > payload.exp) {
      return null;
    }
    return payload;
  } catch {
    return null;
  }
}

export interface AuthenticatedRequest extends Request {
  authUser?: TokenPayload;
}

export async function resolveAuthFromRequest(req: Request): Promise<TokenPayload | null> {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return null;
  }
  const token = authHeader.slice('Bearer '.length).trim();
  if (!token) return null;

  const localPayload = verifySessionToken(token);
  if (localPayload) return localPayload;

  const supabaseAdmin = getSupabaseAdmin();
  if (supabaseAdmin) {
    try {
      const { data, error } = await supabaseAdmin.auth.getUser(token);
      if (!error && data.user) {
        const userEmail = (data.user.email || '').toLowerCase();

        // Always read authoritative role from database profiles + authorized_admins (never trust client metadata)
        const { data: profileRow } = await supabaseAdmin
          .from('profiles')
          .select('role, full_name')
          .eq('id', data.user.id)
          .maybeSingle();

        let authoritativeRole: UserRole =
          profileRow?.role === 'faculty'
            ? 'faculty'
            : profileRow?.role === 'admin'
              ? 'admin'
              : 'student';

        if (authoritativeRole === 'admin') {
          const { data: adminRow } = await supabaseAdmin
            .from('authorized_admins')
            .select('email')
            .ilike('email', userEmail)
            .maybeSingle();
          if (!adminRow) {
            authoritativeRole = 'student';
          }
        }

        return {
          sub: data.user.id,
          email: userEmail,
          role: authoritativeRole,
          name: profileRow?.full_name || data.user.email || 'Campus User',
          exp: Date.now() + 3600_000,
        };
      }
    } catch {
      return null;
    }
  }
  return null;
}

export async function requireAuth(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction,
): Promise<void> {
  const user = await resolveAuthFromRequest(req);
  if (!user) {
    res.status(401).json({ error: 'Please sign in to continue.' });
    return;
  }
  req.authUser = user;
  next();
}

export function requireRole(...allowedRoles: UserRole[]) {
  return (req: AuthenticatedRequest, res: Response, next: NextFunction): void => {
    if (!req.authUser) {
      res.status(401).json({ error: 'Please sign in to continue.' });
      return;
    }
    if (!allowedRoles.includes(req.authUser.role)) {
      res.status(403).json({
        error: `Access denied. This action requires ${allowedRoles.join(' or ')} permissions.`,
      });
      return;
    }
    next();
  };
}
