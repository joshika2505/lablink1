import 'dotenv/config';
import path from 'node:path';
import express from 'express';
import { createClient } from '@supabase/supabase-js';
import { createServer as createViteServer } from 'vite';
import {
  isSupabaseAuthReady,
  isSupabaseServerConfigured,
  requireAuth,
  requireRole,
  resolveAuthFromRequest,
  signSessionToken,
  verifyPassword,
  type AuthenticatedRequest,
} from './server/auth.js';
import { db } from './server/db.js';
import {
  analyzeProjectWithAI,
  askLabAssistantWithAI,
  discoverEquipmentWithAI,
  evaluateFairSlotWithAI,
  GeminiConfigError,
} from './server/gemini.js';
import {
  DbConflictError,
  DbForbiddenError,
  DbSchemaError,
  supabaseDb,
} from './server/supabaseDb.js';
import type { ClayEquipmentTheme, EquipmentCategory, UserRole } from './src/types/lablink.js';

function createEphemeralSupabaseAnonClient() {
  const url = process.env.SUPABASE_URL?.trim() || process.env.VITE_SUPABASE_URL?.trim() || '';
  const anonKey =
    process.env.VITE_SUPABASE_ANON_KEY?.trim() ||
    process.env.SUPABASE_ANON_KEY?.trim() ||
    process.env.SUPABASE_SERVICE_ROLE_KEY?.trim() ||
    '';
  return createClient(url, anonKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

function handleRouteError(res: express.Response, err: unknown, defaultStatus = 400): void {
  if (err instanceof DbConflictError) {
    res.status(409).json({ error: err.message, conflictDetected: true });
    return;
  }
  if (err instanceof DbForbiddenError) {
    res.status(403).json({ error: err.message });
    return;
  }
  if (err instanceof DbSchemaError) {
    res.status(503).json({ error: err.message, schemaError: true });
    return;
  }
  res.status(defaultStatus).json({
    error: err instanceof Error ? err.message : 'Request failed.',
  });
}

async function startServer() {
  const app = express();
  const PORT = Number(process.env.PORT) || 3000;

  app.use(express.json({ limit: '1mb' }));

  app.get('/api/health', async (_req, res) => {
    const geminiConfigured = Boolean(
      process.env.GEMINI_API_KEY && process.env.GEMINI_API_KEY !== 'MY_GEMINI_API_KEY',
    );
    if (isSupabaseServerConfigured()) {
      const schema = await supabaseDb.checkSchemaStatus();
      res.json({
        ok: true,
        supabaseConfigured: isSupabaseAuthReady(),
        supabaseSchemaReady: schema.schemaReady,
        missingTables: schema.missingTables,
        geminiConfigured,
      });
      return;
    }
    res.json({
      ok: true,
      supabaseConfigured: false,
      supabaseSchemaReady: false,
      missingTables: [],
      geminiConfigured,
    });
  });

  async function requireAuthorizedAdmin(
    req: AuthenticatedRequest,
    res: express.Response,
    next: express.NextFunction,
  ): Promise<void> {
    if (!req.authUser || req.authUser.role !== 'admin') {
      res
        .status(403)
        .json({ error: 'Access denied. Only authorized administrators can perform this action.' });
      return;
    }
    try {
      const allowed = isSupabaseServerConfigured()
        ? await supabaseDb.isAuthorizedAdmin(req.authUser.email)
        : db.isAuthorizedAdmin(req.authUser.email);
      if (!allowed) {
        res.status(403).json({ error: 'Account is not in the authorized administrator list.' });
        return;
      }
      next();
    } catch (err) {
      handleRouteError(res, err, 500);
    }
  }

  // Authentication endpoints
  app.post('/api/auth/login', async (req, res) => {
    const email = typeof req.body?.email === 'string' ? req.body.email.trim().toLowerCase() : '';
    const password = typeof req.body?.password === 'string' ? req.body.password : '';
    if (!email || !password) {
      res.status(400).json({ error: 'Email and password are required.' });
      return;
    }

    if (isSupabaseServerConfigured()) {
      try {
        const client = createEphemeralSupabaseAnonClient();
        const { data, error } = await client.auth.signInWithPassword({ email, password });
        if (error || !data.user || !data.session) {
          res.status(401).json({ error: error?.message || 'Invalid email or password.' });
          return;
        }
        const profile = await supabaseDb.ensureProfileForAuthUser({
          id: data.user.id,
          email,
          name: String(data.user.user_metadata?.full_name || ''),
          department: String(data.user.user_metadata?.department || 'Bioengineering'),
        });
        if (profile.role === 'admin') {
          const isAllowed = await supabaseDb.isAuthorizedAdmin(email);
          if (!isAllowed) {
            res.status(403).json({ error: 'This account is not authorized for admin access.' });
            return;
          }
        }
        res.json({
          user: profile,
          token: data.session.access_token,
          refreshToken: data.session.refresh_token,
        });
      } catch (err) {
        handleRouteError(res, err, 500);
      }
      return;
    }

    const user = db.findUserByEmail(email);
    if (!user || !user.passwordHash || !verifyPassword(password, user.passwordHash)) {
      res.status(401).json({ error: 'Invalid email or password.' });
      return;
    }
    if (user.role === 'admin' && !db.isAuthorizedAdmin(user.email)) {
      res.status(403).json({ error: 'This account is not authorized for admin access.' });
      return;
    }
    const publicUser = db.toPublicUser(user);
    const token = signSessionToken(publicUser);
    res.json({ user: publicUser, token });
  });

  app.post('/api/auth/register', async (req, res) => {
    const email = typeof req.body?.email === 'string' ? req.body.email.trim().toLowerCase() : '';
    const name = typeof req.body?.name === 'string' ? req.body.name.trim() : '';
    const password = typeof req.body?.password === 'string' ? req.body.password : '';
    const department =
      typeof req.body?.department === 'string' && req.body.department.trim()
        ? req.body.department.trim()
        : 'Bioengineering';
    const requestFaculty = Boolean(req.body?.requestFaculty);

    if (!email || !name || password.length < 6) {
      res.status(400).json({
        error: 'Please enter your name, university email, and a password of at least 6 characters.',
      });
      return;
    }

    if (isSupabaseServerConfigured()) {
      try {
        // Never assign 'faculty' or 'admin' directly at registration.
        // Faculty requests start as role='student' with facultyApprovalStatus='pending'.
        const profile = await supabaseDb.registerAuthUser({
          email,
          name,
          password,
          department,
          requestFaculty,
        });
        const client = createEphemeralSupabaseAnonClient();
        const { data: sessionData, error: signErr } = await client.auth.signInWithPassword({
          email,
          password,
        });
        if (signErr || !sessionData.session) {
          res.status(201).json({ user: profile, token: '' });
          return;
        }
        res.status(201).json({
          user: profile,
          token: sessionData.session.access_token,
          refreshToken: sessionData.session.refresh_token,
        });
      } catch (err) {
        const msg = err instanceof Error ? err.message : 'Sign up failed.';
        const status = msg.toLowerCase().includes('already') ? 409 : 400;
        if (err instanceof DbSchemaError) {
          handleRouteError(res, err, 503);
          return;
        }
        res.status(status).json({ error: msg });
      }
      return;
    }

    try {
      const publicUser = db.createUser({
        email,
        name,
        password,
        department,
        role: 'student',
        requestFaculty,
      });
      const token = signSessionToken(publicUser);
      res.status(201).json({ user: publicUser, token });
    } catch (err) {
      res.status(409).json({ error: err instanceof Error ? err.message : 'Sign up failed.' });
    }
  });

  app.post('/api/auth/demo-session', (req, res) => {
    if (isSupabaseServerConfigured()) {
      res.status(403).json({
        error:
          'Instant demo sign-in is disabled while live Supabase authentication is active. Please sign in or create an account.',
      });
      return;
    }
    const requestedRole = req.body?.role;
    if (requestedRole === 'faculty' || requestedRole === 'admin') {
      res.status(403).json({
        error:
          'Elevated role preview sign-in is disabled. Faculty and administrators must sign in with verified credentials.',
      });
      return;
    }
    const user = db.findUserByEmail('alex.rivera@lablink.edu');
    if (!user) {
      res.status(404).json({ error: 'Student demo account not found.' });
      return;
    }
    const publicUser = db.toPublicUser(user);
    const token = signSessionToken(publicUser);
    res.json({ user: publicUser, token });
  });

  app.get('/api/auth/admin-status', async (_req, res) => {
    const supabaseConfigured = isSupabaseAuthReady();
    if (isSupabaseServerConfigured()) {
      const schema = await supabaseDb.checkSchemaStatus();
      res.json({
        supabaseConfigured,
        schemaReady: schema.schemaReady,
        claimRequired: false,
      });
      return;
    }
    res.json({
      supabaseConfigured: false,
      schemaReady: true,
      claimRequired: db.isAdminClaimRequired(),
      configuredAdminEmailHint: db.isAdminClaimRequired()
        ? process.env.ADMIN_EMAIL || 'admin@lablink.edu'
        : undefined,
    });
  });

  app.post('/api/auth/admin-claim', (req, res) => {
    if (isSupabaseServerConfigured()) {
      res.status(403).json({
        error: 'Supabase authentication is active. Provision authorized admins in Supabase.',
      });
      return;
    }
    const email = typeof req.body?.email === 'string' ? req.body.email.trim() : '';
    const name = typeof req.body?.name === 'string' ? req.body.name.trim() : 'Platform Administrator';
    const password = typeof req.body?.password === 'string' ? req.body.password : '';
    try {
      const adminUser = db.claimInitialAdmin(email, name, password);
      const token = signSessionToken(adminUser);
      res.status(201).json({ user: adminUser, token });
    } catch (err) {
      res.status(403).json({ error: err instanceof Error ? err.message : 'Admin setup failed.' });
    }
  });

  app.post('/api/auth/admin-login', async (req, res) => {
    const email = typeof req.body?.email === 'string' ? req.body.email.trim().toLowerCase() : '';
    const password = typeof req.body?.password === 'string' ? req.body.password : '';
    if (!email || !password) {
      res.status(400).json({ error: 'Admin email and password are required.' });
      return;
    }

    if (isSupabaseServerConfigured()) {
      try {
        const isAllowed = await supabaseDb.isAuthorizedAdmin(email);
        if (!isAllowed) {
          res.status(403).json({
            error: 'Access denied. Account is not on the authorized administrator list.',
          });
          return;
        }
        const client = createEphemeralSupabaseAnonClient();
        const { data, error } = await client.auth.signInWithPassword({ email, password });
        if (error || !data.user || !data.session) {
          res.status(403).json({
            error: 'Access denied. Invalid admin credentials.',
          });
          return;
        }
        const profile = await supabaseDb.ensureProfileForAuthUser({
          id: data.user.id,
          email,
          name: String(data.user.user_metadata?.full_name || 'Platform Administrator'),
        });
        const adminProfile =
          profile.role === 'admin' ? profile : await supabaseDb.updateUserRole(profile.id, 'admin');
        res.json({
          user: adminProfile,
          token: data.session.access_token,
          refreshToken: data.session.refresh_token,
        });
      } catch (err) {
        handleRouteError(res, err, 403);
      }
      return;
    }

    const adminUser = db.verifyAdminCredentials(email, password);
    if (!adminUser) {
      res.status(403).json({
        error: 'Access denied. Invalid credentials or account is not on the authorized admin list.',
      });
      return;
    }
    const token = signSessionToken(adminUser);
    res.json({ user: adminUser, token });
  });

  app.get('/api/auth/me', requireAuth, async (req: AuthenticatedRequest, res) => {
    if (isSupabaseServerConfigured()) {
      try {
        const profile = await supabaseDb.ensureProfileForAuthUser({
          id: req.authUser!.sub,
          email: req.authUser!.email,
          name: req.authUser!.name,
        });
        res.json({ user: profile });
      } catch (err) {
        handleRouteError(res, err, 500);
      }
      return;
    }

    const user = db.findUserById(req.authUser!.sub);
    if (!user) {
      res.status(404).json({ error: 'Profile not found.' });
      return;
    }
    res.json({ user: db.toPublicUser(user) });
  });

  app.patch('/api/profile', requireAuth, async (req: AuthenticatedRequest, res) => {
    const name = typeof req.body?.name === 'string' ? req.body.name.trim() : undefined;
    const department =
      typeof req.body?.department === 'string' ? req.body.department.trim() : undefined;
    const title = typeof req.body?.title === 'string' ? req.body.title.trim() : undefined;
    try {
      const updated = isSupabaseServerConfigured()
        ? await supabaseDb.updateProfile(req.authUser!.sub, { name, department, title })
        : db.updateProfile(req.authUser!.sub, { name, department, title });
      res.json({ user: updated });
    } catch (err) {
      handleRouteError(res, err, 400);
    }
  });

  // Bootstrap data (strictly public catalog when unauthenticated; zero PII leakage)
  app.get('/api/bootstrap', async (req, res) => {
    const authUser = await resolveAuthFromRequest(req);

    if (isSupabaseServerConfigured()) {
      try {
        const payload = await supabaseDb.getBootstrapForUser(
          authUser
            ? {
                id: authUser.sub,
                email: authUser.email,
                name: authUser.name,
                role: authUser.role,
              }
            : null,
        );
        res.json(payload);
      } catch (err) {
        handleRouteError(res, err, 500);
      }
      return;
    }

    const localUser = authUser ? db.findUserById(authUser.sub) : undefined;
    const isVerifiedAdmin = Boolean(
      authUser && authUser.role === 'admin' && db.isAuthorizedAdmin(authUser.email),
    );
    const resolvedUser = localUser ? db.toPublicUser(localUser) : null;

    res.json({
      user: resolvedUser,
      departments: db.getDepartments(),
      laboratories: db.getLaboratories(),
      equipment: db.getEquipment(),
      projects: authUser ? db.getProjects(authUser.sub, authUser.role) : [],
      accessRequests: authUser ? db.getAccessRequests(authUser.sub, authUser.role) : [],
      bookings: authUser ? db.getBookings(authUser.sub, authUser.role) : [],
      busySlots: db.getBusySlots(),
      conflicts: authUser ? db.getConflicts(authUser.sub, authUser.role) : [],
      maintenance: db.getMaintenance(),
      notifications: authUser ? db.getNotifications(authUser.sub) : [],
      analytics: isVerifiedAdmin ? db.getAnalytics() : null,
      users: isVerifiedAdmin ? db.getPublicUsers() : [],
      authorizedAdmins: isVerifiedAdmin ? db.getAuthorizedAdmins() : [],
    });
  });

  // Equipment, Departments & Labs
  app.get('/api/equipment', async (_req, res) => {
    if (isSupabaseServerConfigured()) {
      try {
        const { equipment } = await supabaseDb.getDepartmentsAndLabsAndEquipment();
        res.json({ equipment });
      } catch (err) {
        handleRouteError(res, err, 500);
      }
      return;
    }
    res.json({ equipment: db.getEquipment() });
  });

  app.post(
    '/api/equipment',
    requireAuth,
    requireRole('admin'),
    requireAuthorizedAdmin,
    async (req: AuthenticatedRequest, res) => {
      const {
        code,
        name,
        category,
        departmentId,
        laboratoryId,
        hourlyRate,
        requiresFacultyApproval,
        certificationRequired,
        description,
        specsPreview,
      } = req.body ?? {};

      if (!name || !category || !departmentId || !laboratoryId) {
        res.status(400).json({ error: 'Name, category, department, and lab are required.' });
        return;
      }

      try {
        const catalog = isSupabaseServerConfigured()
          ? await supabaseDb.getDepartmentsAndLabsAndEquipment()
          : { departments: db.getDepartments(), laboratories: db.getLaboratories() };
        const dept = catalog.departments.find((d) => d.id === departmentId);
        const lab = catalog.laboratories.find((l) => l.id === laboratoryId);
        if (!dept || !lab) {
          res.status(400).json({ error: 'Invalid department or lab selection.' });
          return;
        }

        const themeMap: Record<EquipmentCategory, ClayEquipmentTheme> = {
          'Electronics & Circuits': 'arduino',
          '3D Printing & Making': 'printer',
          Robotics: 'robot',
          'Computers & Software': 'pc',
          'Testing & Measurement': 'multimeter',
          'Mechanical Workshop': 'lathe',
        };

        const itemPayload = {
          code: String(code || `EQ-${Math.floor(1000 + Math.random() * 9000)}`),
          name: String(name).trim(),
          category: category as EquipmentCategory,
          departmentId: dept.id,
          departmentName: dept.name,
          laboratoryId: lab.id,
          locationLabel: `${lab.name}, ${lab.room}`,
          status: 'available' as const,
          hourlyRate: Number(hourlyRate) || 20,
          requiresFacultyApproval: Boolean(requiresFacultyApproval),
          certificationRequired: String(certificationRequired || 'General Lab Safety'),
          biosafetyLevel: 'Live Lab Inventory',
          nextSlotLabel: 'Today, 1:00 PM',
          lastCalibrated: 'Today',
          shortPurpose: String(description || `${String(name).trim()} for campus lab projects.`),
          description: String(description || 'Shared campus lab equipment.'),
          specsPreview: String(specsPreview || 'Checked • Ready for use'),
          isSampleData: false,
          specs: [
            { label: 'Category', value: String(category), icon: 'science', tone: 'mint' as const },
            {
              label: 'Lab Room',
              value: `${lab.building} ${lab.room}`,
              icon: 'location_on',
              tone: 'blue' as const,
            },
            {
              label: 'Safety Training',
              value: String(certificationRequired || 'General Lab Safety'),
              icon: 'verified_user',
              tone: 'pink' as const,
            },
          ],
          guidelines: [
            {
              title: 'Safety Rules',
              detail: 'Verify lab safety training before starting work.',
              icon: 'school',
            },
          ],
          imageUrl: '',
          clayTheme: themeMap[category as EquipmentCategory] || 'arduino',
        };

        const created = isSupabaseServerConfigured()
          ? await supabaseDb.addEquipment(itemPayload)
          : db.addEquipment(itemPayload);
        res.status(201).json({ equipment: created });
      } catch (err) {
        handleRouteError(res, err, 400);
      }
    },
  );

  app.put(
    '/api/equipment/:id',
    requireAuth,
    requireRole('admin'),
    requireAuthorizedAdmin,
    async (req: AuthenticatedRequest, res) => {
      const body = req.body ?? {};
      const patch: Record<string, unknown> = {};
      if (typeof body.name === 'string' && body.name.trim()) patch.name = body.name.trim();
      if (typeof body.category === 'string') patch.category = body.category as EquipmentCategory;
      if (typeof body.hourlyRate === 'number' && body.hourlyRate >= 0) patch.hourlyRate = body.hourlyRate;
      if (typeof body.requiresFacultyApproval === 'boolean') {
        patch.requiresFacultyApproval = body.requiresFacultyApproval;
      }
      if (typeof body.certificationRequired === 'string') {
        patch.certificationRequired = body.certificationRequired.trim();
      }
      if (typeof body.description === 'string') patch.description = body.description.trim();
      if (typeof body.specsPreview === 'string') patch.specsPreview = body.specsPreview.trim();
      if (body.status === 'available' || body.status === 'in_use' || body.status === 'maintenance') {
        patch.status = body.status;
      }

      try {
        const catalog = isSupabaseServerConfigured()
          ? await supabaseDb.getDepartmentsAndLabsAndEquipment()
          : { departments: db.getDepartments(), laboratories: db.getLaboratories() };

        if (typeof body.departmentId === 'string') {
          const dept = catalog.departments.find((d) => d.id === body.departmentId);
          if (dept) {
            patch.departmentId = dept.id;
            patch.departmentName = dept.name;
          }
        }
        if (typeof body.laboratoryId === 'string') {
          const lab = catalog.laboratories.find((l) => l.id === body.laboratoryId);
          if (lab) {
            patch.laboratoryId = lab.id;
            patch.locationLabel = `${lab.name}, ${lab.room}`;
          }
        }

        const updated = isSupabaseServerConfigured()
          ? await supabaseDb.updateEquipment(String(req.params.id), patch)
          : db.updateEquipment(String(req.params.id), patch);
        res.json({ equipment: updated });
      } catch (err) {
        handleRouteError(res, err, 404);
      }
    },
  );

  app.delete(
    '/api/equipment/:id',
    requireAuth,
    requireRole('admin'),
    requireAuthorizedAdmin,
    async (req: AuthenticatedRequest, res) => {
      try {
        const id = String(req.params.id);
        if (isSupabaseServerConfigured()) {
          await supabaseDb.deleteEquipment(id);
        } else {
          db.deleteEquipment(id);
        }
        res.json({ ok: true, deletedId: id });
      } catch (err) {
        handleRouteError(res, err, 404);
      }
    },
  );

  app.patch(
    '/api/equipment/:id/status',
    requireAuth,
    requireRole('admin', 'faculty'),
    async (req: AuthenticatedRequest, res) => {
      const status = req.body?.status;
      if (status !== 'available' && status !== 'in_use' && status !== 'maintenance') {
        res.status(400).json({ error: 'Invalid equipment status.' });
        return;
      }
      try {
        if (isSupabaseServerConfigured()) {
          const updated = await supabaseDb.updateEquipmentStatus(
            String(req.params.id),
            status,
            req.authUser!.sub,
            req.authUser!.role,
          );
          res.json({ equipment: updated });
          return;
        }
        db.assertFacultyScopeForEquipment(
          req.authUser!.sub,
          req.authUser!.role,
          String(req.params.id),
        );
        const updated = db.updateEquipmentStatus(String(req.params.id), status);
        res.json({ equipment: updated });
      } catch (err) {
        handleRouteError(res, err, 403);
      }
    },
  );

  app.post(
    '/api/departments',
    requireAuth,
    requireRole('admin'),
    requireAuthorizedAdmin,
    async (req, res) => {
      const { name, code, headName } = req.body ?? {};
      if (!name || !code) {
        res.status(400).json({ error: 'Department name and code are required.' });
        return;
      }
      try {
        const payload = {
          name: String(name).trim(),
          code: String(code).trim().toUpperCase(),
          headName: String(headName || 'Department Lead'),
          instrumentCount: 0,
          uptimePercent: 99.0,
          accentColor: 'mint' as const,
          icon: 'science',
        };
        const created = isSupabaseServerConfigured()
          ? await supabaseDb.addDepartment(payload)
          : db.addDepartment(payload);
        res.status(201).json({ department: created });
      } catch (err) {
        handleRouteError(res, err, 400);
      }
    },
  );

  app.post(
    '/api/laboratories',
    requireAuth,
    requireRole('admin'),
    requireAuthorizedAdmin,
    async (req, res) => {
      const { name, departmentId, building, room, capacity, managerName } = req.body ?? {};
      if (!name || !departmentId || !building || !room) {
        res.status(400).json({ error: 'Name, department, building, and room are required.' });
        return;
      }
      try {
        const catalog = isSupabaseServerConfigured()
          ? await supabaseDb.getDepartmentsAndLabsAndEquipment()
          : { departments: db.getDepartments() };
        const dept = catalog.departments.find((d) => d.id === departmentId);
        if (!dept) {
          res.status(400).json({ error: 'Department not found.' });
          return;
        }
        const payload = {
          name: String(name).trim(),
          departmentId: dept.id,
          departmentName: dept.name,
          building: String(building).trim(),
          room: String(room).trim(),
          accessLevel: 'Keycard Access',
          capacity: Number(capacity) || 8,
          occupied: 0,
          status: 'open' as const,
          managerName: String(managerName || dept.headName),
          managerTitle: 'Lab Coordinator',
          coordinates: { lat: 42.361, lng: -71.09, xPercent: 50, yPercent: 50 },
        };
        const created = isSupabaseServerConfigured()
          ? await supabaseDb.addLaboratory(payload)
          : db.addLaboratory(payload);
        res.status(201).json({ laboratory: created });
      } catch (err) {
        handleRouteError(res, err, 400);
      }
    },
  );

  // Projects
  app.get('/api/projects', requireAuth, async (req: AuthenticatedRequest, res) => {
    try {
      const projects = isSupabaseServerConfigured()
        ? await supabaseDb.getProjects(req.authUser!.sub, req.authUser!.role)
        : db.getProjects(req.authUser!.sub, req.authUser!.role);
      res.json({ projects });
    } catch (err) {
      handleRouteError(res, err, 500);
    }
  });

  app.post('/api/projects', requireAuth, async (req: AuthenticatedRequest, res) => {
    const {
      title,
      grantCode,
      department,
      category,
      description,
      deadline,
      recommendedEquipmentIds,
      aiAnalysisSummary,
    } = req.body ?? {};
    if (!title || !description || !deadline) {
      res.status(400).json({ error: 'Project title, description, and deadline are required.' });
      return;
    }
    try {
      const created = isSupabaseServerConfigured()
        ? await supabaseDb.createProject({
            ownerId: req.authUser!.sub,
            ownerName: req.authUser!.name,
            title: String(title).trim(),
            grantCode: String(grantCode || 'DEPT-2026').trim(),
            department: String(department || 'Bioengineering'),
            category: String(category || 'Research'),
            description: String(description).trim(),
            deadline: String(deadline),
            recommendedEquipmentIds: Array.isArray(recommendedEquipmentIds)
              ? recommendedEquipmentIds
              : [],
            aiAnalysisSummary:
              typeof aiAnalysisSummary === 'string' ? aiAnalysisSummary : undefined,
          })
        : db.createProject({
            ownerId: req.authUser!.sub,
            ownerName: req.authUser!.name,
            title: String(title).trim(),
            grantCode: String(grantCode || 'DEPT-2026').trim(),
            department: String(department || 'Bioengineering'),
            category: String(category || 'Research'),
            description: String(description).trim(),
            deadline: String(deadline),
            progress: 15,
            tone: 'mint',
            icon: 'science',
            recommendedEquipmentIds: Array.isArray(recommendedEquipmentIds)
              ? recommendedEquipmentIds
              : [],
            aiAnalysisSummary:
              typeof aiAnalysisSummary === 'string' ? aiAnalysisSummary : undefined,
            status: 'active',
          });
      res.status(201).json({ project: created });
    } catch (err) {
      handleRouteError(res, err, 400);
    }
  });

  // Project-Based Access Requests
  app.get('/api/access-requests', requireAuth, async (req: AuthenticatedRequest, res) => {
    try {
      const accessRequests = isSupabaseServerConfigured()
        ? await supabaseDb.getAccessRequestsForActor({
            id: req.authUser!.sub,
            role: req.authUser!.role,
          })
        : db.getAccessRequests(req.authUser!.sub, req.authUser!.role);
      res.json({ accessRequests });
    } catch (err) {
      handleRouteError(res, err, 500);
    }
  });

  app.post('/api/access-requests', requireAuth, async (req: AuthenticatedRequest, res) => {
    const { projectId, equipmentId, requestedHours, preferredDate, justification } = req.body ?? {};
    const hours = Number(requestedHours);
    if (
      !projectId ||
      !equipmentId ||
      !preferredDate ||
      !justification ||
      !Number.isInteger(hours) ||
      hours < 1 ||
      hours > 40
    ) {
      res.status(400).json({
        error: 'Project, equipment, preferred date, valid hours (1–40), and justification are required.',
      });
      return;
    }
    try {
      const created = isSupabaseServerConfigured()
        ? await supabaseDb.createAccessRequest({
            userId: req.authUser!.sub,
            projectId: String(projectId),
            equipmentId: String(equipmentId),
            requestedHours: hours,
            preferredDate: String(preferredDate),
            justification: String(justification).trim(),
          })
        : db.createAccessRequest({
            userId: req.authUser!.sub,
            projectId: String(projectId),
            equipmentId: String(equipmentId),
            requestedHours: hours,
            preferredDate: String(preferredDate),
            justification: String(justification).trim(),
          });
      res.status(201).json({ accessRequest: created });
    } catch (err) {
      handleRouteError(res, err, 400);
    }
  });

  app.patch(
    '/api/access-requests/:id',
    requireAuth,
    requireRole('faculty', 'admin'),
    async (req: AuthenticatedRequest, res) => {
      const decision = req.body?.decision;
      if (
        decision !== 'approved' &&
        decision !== 'rejected' &&
        decision !== 'alternative_suggested'
      ) {
        res.status(400).json({ error: 'Invalid decision.' });
        return;
      }
      try {
        const updated = isSupabaseServerConfigured()
          ? await supabaseDb.decideAccessRequest({
              requestId: String(req.params.id),
              actorId: req.authUser!.sub,
              actorRole: req.authUser!.role,
              actorName: req.authUser!.name,
              decision,
              reviewerNotes:
                typeof req.body?.reviewerNotes === 'string' ? req.body.reviewerNotes.trim() : undefined,
              alternative: req.body?.alternative,
            })
          : db.decideAccessRequest({
              requestId: String(req.params.id),
              actorId: req.authUser!.sub,
              actorRole: req.authUser!.role,
              actorName: req.authUser!.name,
              decision,
              reviewerNotes:
                typeof req.body?.reviewerNotes === 'string' ? req.body.reviewerNotes.trim() : undefined,
              alternative: req.body?.alternative,
            });
        res.json({ accessRequest: updated });
      } catch (err) {
        handleRouteError(res, err, 403);
      }
    },
  );

  // Bookings & Atomic Conflict Prevention
  app.get('/api/bookings', requireAuth, async (req: AuthenticatedRequest, res) => {
    try {
      const bookings = isSupabaseServerConfigured()
        ? await supabaseDb.getBookingsForActor({
            id: req.authUser!.sub,
            role: req.authUser!.role,
          })
        : db.getBookings(req.authUser!.sub, req.authUser!.role);
      res.json({ bookings });
    } catch (err) {
      handleRouteError(res, err, 500);
    }
  });

  app.post('/api/bookings', requireAuth, async (req: AuthenticatedRequest, res) => {
    const { equipmentId, projectId, date, startHour, durationHours, submitToFairSlotOnConflict } =
      req.body ?? {};
    const parsedStart = Number(startHour);
    const parsedDuration = Number(durationHours);

    if (
      !equipmentId ||
      !date ||
      !Number.isInteger(parsedStart) ||
      parsedStart < 7 ||
      parsedStart > 21 ||
      !Number.isInteger(parsedDuration) ||
      parsedDuration < 1 ||
      parsedDuration > 8
    ) {
      res.status(400).json({ error: 'Invalid equipment, date, start time, or duration.' });
      return;
    }

    try {
      const result = isSupabaseServerConfigured()
        ? await supabaseDb.createBookingAtomic({
            equipmentId: String(equipmentId),
            userId: req.authUser!.sub,
            projectId: projectId ? String(projectId) : undefined,
            date: String(date),
            startHour: parsedStart,
            durationHours: parsedDuration,
            submitToFairSlotOnConflict: Boolean(submitToFairSlotOnConflict),
          })
        : db.createBookingAtomic({
            equipmentId: String(equipmentId),
            userId: req.authUser!.sub,
            projectId: String(projectId || ''),
            date: String(date),
            startHour: parsedStart,
            durationHours: parsedDuration,
            submitToFairSlotOnConflict: Boolean(submitToFairSlotOnConflict),
          });

      if (result.conflictError) {
        res.status(409).json({
          error: result.conflictError,
          conflictDetected: true,
          suggestedAlternative: result.suggestedAlternative,
        });
        return;
      }

      if (result.conflictCase) {
        res.status(202).json({
          fairSlotSubmitted: true,
          conflictCase: result.conflictCase,
          message: 'Time conflict sent to Smart Booking for review.',
        });
        return;
      }

      res.status(201).json({ booking: result.booking });
    } catch (err) {
      handleRouteError(res, err, 400);
    }
  });

  app.patch('/api/bookings/:id/cancel', requireAuth, async (req: AuthenticatedRequest, res) => {
    try {
      const booking = isSupabaseServerConfigured()
        ? await supabaseDb.cancelBooking(
            String(req.params.id),
            req.authUser!.sub,
            req.authUser!.role,
          )
        : db.cancelBooking(String(req.params.id), req.authUser!.sub, req.authUser!.role);
      res.json({ booking });
    } catch (err) {
      handleRouteError(res, err, 403);
    }
  });

  // Faculty Approvals (Faculty / Admin only, lab-scoped)
  app.patch(
    '/api/approvals/:id',
    requireAuth,
    requireRole('faculty', 'admin'),
    async (req: AuthenticatedRequest, res) => {
      const decision = req.body?.decision;
      if (
        decision !== 'confirmed' &&
        decision !== 'rejected' &&
        decision !== 'alternative_suggested'
      ) {
        res.status(400).json({ error: 'Invalid approval decision.' });
        return;
      }
      try {
        const booking = isSupabaseServerConfigured()
          ? await supabaseDb.decideBooking({
              bookingId: String(req.params.id),
              decision,
              actorId: req.authUser!.sub,
              actorRole: req.authUser!.role,
              actorName: req.authUser!.name,
              alternative: req.body?.alternative,
            })
          : db.decideBooking(
              String(req.params.id),
              decision,
              req.authUser!.name,
              req.body?.alternative,
              req.authUser!.sub,
              req.authUser!.role,
            );
        res.json({ booking });
      } catch (err) {
        handleRouteError(res, err, 409);
      }
    },
  );

  // Smart Booking Conflicts (Authenticated & role-scoped; Faculty/Admin retain final approval & override authority)
  app.get('/api/fairslot/conflicts', requireAuth, async (req: AuthenticatedRequest, res) => {
    try {
      const conflicts = isSupabaseServerConfigured()
        ? await supabaseDb.getConflictsForActor({
            id: req.authUser!.sub,
            role: req.authUser!.role,
          })
        : db.getConflicts(req.authUser!.sub, req.authUser!.role);
      res.json({ conflicts });
    } catch (err) {
      handleRouteError(res, err, 500);
    }
  });

  app.post(
    '/api/fairslot/conflicts/:id/resolve',
    requireAuth,
    requireRole('faculty', 'admin'),
    async (req: AuthenticatedRequest, res) => {
      const mode = req.body?.mode === 'overridden_faculty' ? 'overridden_faculty' : 'resolved_ai';
      const alternativeId =
        typeof req.body?.alternativeId === 'string' ? req.body.alternativeId : undefined;
      try {
        const result = isSupabaseServerConfigured()
          ? await supabaseDb.resolveConflict({
              conflictId: String(req.params.id),
              mode,
              alternativeId,
              actorId: req.authUser!.sub,
              actorRole: req.authUser!.role,
              actorName: req.authUser!.name,
            })
          : db.resolveConflict(
              String(req.params.id),
              mode,
              alternativeId,
              req.authUser!.name,
              req.authUser!.sub,
              req.authUser!.role,
            );
        res.json(result);
      } catch (err) {
        handleRouteError(res, err, 400);
      }
    },
  );

  // Admin User, Faculty Approval & Authorized Admin Management
  app.get(
    '/api/users',
    requireAuth,
    requireRole('admin'),
    requireAuthorizedAdmin,
    async (_req, res) => {
      try {
        const users = isSupabaseServerConfigured()
          ? await supabaseDb.getAllUsers()
          : db.getPublicUsers();
        res.json({ users });
      } catch (err) {
        handleRouteError(res, err, 500);
      }
    },
  );

  app.patch(
    '/api/users/:id/role',
    requireAuth,
    requireRole('admin'),
    requireAuthorizedAdmin,
    async (req, res) => {
      const role = req.body?.role as UserRole;
      if (role !== 'student' && role !== 'faculty' && role !== 'admin') {
        res.status(400).json({ error: 'Invalid role.' });
        return;
      }
      try {
        const user = isSupabaseServerConfigured()
          ? await supabaseDb.updateUserRole(String(req.params.id), role)
          : db.updateUserRole(String(req.params.id), role);
        res.json({ user });
      } catch (err) {
        handleRouteError(res, err, 404);
      }
    },
  );

  app.patch(
    '/api/admin/faculty-requests/:id',
    requireAuth,
    requireRole('admin'),
    requireAuthorizedAdmin,
    async (req: AuthenticatedRequest, res) => {
      const decision = req.body?.decision;
      if (decision !== 'approved' && decision !== 'rejected') {
        res.status(400).json({ error: 'Decision must be approved or rejected.' });
        return;
      }
      const assignedLabIds = Array.isArray(req.body?.assignedLabIds)
        ? req.body.assignedLabIds.map(String)
        : undefined;
      try {
        const user = isSupabaseServerConfigured()
          ? await supabaseDb.decideFacultyRequest({
              userId: String(req.params.id),
              decision,
              assignedLabIds,
              reviewerName: req.authUser!.name,
            })
          : db.decideFacultyRequest({
              userId: String(req.params.id),
              decision,
              assignedLabIds,
              reviewerName: req.authUser!.name,
            });
        res.json({ user });
      } catch (err) {
        handleRouteError(res, err, 404);
      }
    },
  );

  app.post(
    '/api/admin/faculty',
    requireAuth,
    requireRole('admin'),
    requireAuthorizedAdmin,
    async (req, res) => {
      const { email, name, department, password, assignedLabIds } = req.body ?? {};
      if (!email || !name || !password || String(password).length < 6) {
        res.status(400).json({
          error: 'Provide faculty name, email, and a temporary password of at least 6 characters.',
        });
        return;
      }
      try {
        const user = isSupabaseServerConfigured()
          ? await supabaseDb.createFacultyAccount({
              email: String(email),
              name: String(name),
              department: String(department || 'Bioengineering'),
              password: String(password),
              assignedLabIds: Array.isArray(assignedLabIds) ? assignedLabIds.map(String) : undefined,
            })
          : db.createUser({
              email: String(email),
              name: String(name),
              department: String(department || 'Bioengineering'),
              password: String(password),
              role: 'faculty',
            });
        res.status(201).json({ user });
      } catch (err) {
        handleRouteError(res, err, 409);
      }
    },
  );

  app.post(
    '/api/admin/authorized-admins',
    requireAuth,
    requireRole('admin'),
    requireAuthorizedAdmin,
    async (req: AuthenticatedRequest, res) => {
      const email = typeof req.body?.email === 'string' ? req.body.email.trim() : '';
      const name = typeof req.body?.name === 'string' ? req.body.name.trim() : '';
      if (!email) {
        res.status(400).json({ error: 'Email is required.' });
        return;
      }
      try {
        const list = isSupabaseServerConfigured()
          ? await supabaseDb.grantAuthorizedAdmin(email, name, req.authUser!.name)
          : db.grantAuthorizedAdmin(email, name, req.authUser!.name);
        res.status(201).json({ authorizedAdmins: list });
      } catch (err) {
        handleRouteError(res, err, 400);
      }
    },
  );

  app.delete(
    '/api/admin/authorized-admins/:email',
    requireAuth,
    requireRole('admin'),
    requireAuthorizedAdmin,
    async (req: AuthenticatedRequest, res) => {
      try {
        const target = decodeURIComponent(String(req.params.email));
        const list = isSupabaseServerConfigured()
          ? await supabaseDb.revokeAuthorizedAdmin(target, req.authUser!.email)
          : db.revokeAuthorizedAdmin(target, req.authUser!.email);
        res.json({ authorizedAdmins: list });
      } catch (err) {
        handleRouteError(res, err, 400);
      }
    },
  );

  // Maintenance
  app.get('/api/maintenance', async (_req, res) => {
    if (isSupabaseServerConfigured()) {
      try {
        const { equipment } = await supabaseDb.getDepartmentsAndLabsAndEquipment();
        const equipmentMap = new Map(equipment.map((e) => [e.id, e]));
        const maintenance = await supabaseDb.getMaintenance(equipmentMap);
        res.json({ maintenance });
      } catch (err) {
        handleRouteError(res, err, 500);
      }
      return;
    }
    res.json({ maintenance: db.getMaintenance() });
  });

  app.post(
    '/api/maintenance',
    requireAuth,
    requireRole('admin', 'faculty'),
    async (req: AuthenticatedRequest, res) => {
      const { equipmentId, technician, taskTitle, status, scheduledDate, notes } = req.body ?? {};
      if (!equipmentId || !taskTitle) {
        res.status(400).json({ error: 'Valid equipment and task title are required.' });
        return;
      }
      try {
        const eq = isSupabaseServerConfigured()
          ? await supabaseDb.assertFacultyScopeForEquipment(
              req.authUser!.sub,
              req.authUser!.role,
              String(equipmentId),
            )
          : db.assertFacultyScopeForEquipment(
              req.authUser!.sub,
              req.authUser!.role,
              String(equipmentId),
            );

        const payload = {
          equipmentId: eq.id,
          equipmentName: eq.name,
          technician: String(technician || 'Lab Staff'),
          taskTitle: String(taskTitle).trim(),
          status:
            status === 'in_progress' || status === 'cleared'
              ? (status as 'in_progress' | 'cleared')
              : ('scheduled' as const),
          scheduledDate: String(scheduledDate || new Date().toISOString().slice(0, 10)),
          notes: String(notes || ''),
        };

        const log = isSupabaseServerConfigured()
          ? await supabaseDb.addMaintenance(payload)
          : db.addMaintenance(payload);
        res.status(201).json({ maintenance: log });
      } catch (err) {
        handleRouteError(res, err, 400);
      }
    },
  );

  // Notifications
  app.get('/api/notifications', requireAuth, async (req: AuthenticatedRequest, res) => {
    try {
      const notifications = isSupabaseServerConfigured()
        ? await supabaseDb.getNotifications(req.authUser!.sub)
        : db.getNotifications(req.authUser!.sub);
      res.json({ notifications });
    } catch (err) {
      handleRouteError(res, err, 500);
    }
  });

  app.patch('/api/notifications/:id/read', requireAuth, async (req: AuthenticatedRequest, res) => {
    try {
      if (isSupabaseServerConfigured()) {
        await supabaseDb.markNotificationRead(String(req.params.id), req.authUser!.sub);
      } else {
        db.markNotificationRead(String(req.params.id));
      }
      res.json({ ok: true });
    } catch (err) {
      handleRouteError(res, err, 400);
    }
  });

  app.get(
    '/api/analytics',
    requireAuth,
    requireRole('admin'),
    requireAuthorizedAdmin,
    async (_req, res) => {
      try {
        const analytics = isSupabaseServerConfigured()
          ? await supabaseDb.getAnalytics()
          : db.getAnalytics();
        res.json({ analytics });
      } catch (err) {
        handleRouteError(res, err, 500);
      }
    },
  );

  // Server-Side Google Gemini API Routes
  app.post('/api/ai/discover', async (req, res) => {
    const query = typeof req.body?.query === 'string' ? req.body.query.trim() : '';
    if (!query) {
      res.status(400).json({ error: 'Please describe what you need for your experiment.' });
      return;
    }
    try {
      const catalog = isSupabaseServerConfigured()
        ? (await supabaseDb.getDepartmentsAndLabsAndEquipment()).equipment
        : db.getEquipment();
      const result = await discoverEquipmentWithAI(query, catalog);
      res.json(result);
    } catch (err) {
      res.status(502).json({
        error: err instanceof Error ? err.message : 'Gemini AI discovery request failed.',
      });
    }
  });

  app.post('/api/ai/project-match', requireAuth, async (req, res) => {
    const { title, department, description, deadline } = req.body ?? {};
    if (!title || !description) {
      res.status(400).json({ error: 'Project title and description are required for AI analysis.' });
      return;
    }
    try {
      const catalog = isSupabaseServerConfigured()
        ? (await supabaseDb.getDepartmentsAndLabsAndEquipment()).equipment
        : db.getEquipment();
      const result = await analyzeProjectWithAI(
        {
          title: String(title),
          department: String(department || 'Bioengineering'),
          description: String(description),
          deadline: String(deadline || 'Flexible'),
        },
        catalog,
      );
      res.json(result);
    } catch (err) {
      res.status(502).json({
        error: err instanceof Error ? err.message : 'Gemini AI project analysis failed.',
      });
    }
  });

  app.post('/api/ai/fairslot/:id/analyze', requireAuth, async (req: AuthenticatedRequest, res) => {
    try {
      const conflicts = isSupabaseServerConfigured()
        ? await supabaseDb.getConflictsForActor({
            id: req.authUser!.sub,
            role: req.authUser!.role,
          })
        : db.getConflicts(req.authUser!.sub, req.authUser!.role);
      const conflict = conflicts.find((c) => c.id === String(req.params.id));
      if (!conflict) {
        res.status(404).json({ error: 'Smart Booking conflict case not found.' });
        return;
      }
      const result = await evaluateFairSlotWithAI(conflict);
      res.json(result);
    } catch (err) {
      res.status(502).json({
        error: err instanceof Error ? err.message : 'Gemini AI Smart Booking analysis failed.',
      });
    }
  });

  app.post('/api/ai/assistant', async (req, res) => {
    const rawPrompt =
      typeof req.body?.message === 'string'
        ? req.body.message
        : typeof req.body?.prompt === 'string'
          ? req.body.prompt
          : '';
    const prompt = rawPrompt.trim();
    if (!prompt) {
      res.status(400).json({ error: 'Please enter a question for LabBot.' });
      return;
    }

    const rawHistory = Array.isArray(req.body?.history) ? req.body.history : [];
    const safeHistory = rawHistory
      .filter(
        (m: unknown): m is { role: 'user' | 'assistant'; text: string } =>
          Boolean(m) &&
          typeof m === 'object' &&
          ((m as { role?: string }).role === 'user' || (m as { role?: string }).role === 'assistant') &&
          typeof (m as { text?: unknown }).text === 'string',
      )
      .slice(-8)
      .map((m: { role: 'user' | 'assistant'; text: string }) => ({
        role: m.role,
        text: m.text.slice(0, 600),
      }));

    try {
      const authUser = await resolveAuthFromRequest(req);
      const role: 'guest' | UserRole = authUser ? authUser.role : 'guest';

      if (isSupabaseServerConfigured()) {
        const boot = await supabaseDb.getBootstrapForUser(
          authUser
            ? {
                id: authUser.sub,
                email: authUser.email,
                name: authUser.name,
                role: authUser.role,
              }
            : null,
        );
        const result = await askLabAssistantWithAI(
          prompt,
          boot.equipment,
          {
            userName: boot.user?.name || authUser?.name || 'Campus Visitor',
            userRole: role,
            department: boot.user?.department || 'General Campus Labs',
            certifications: boot.user?.certifications || ['General Lab Safety'],
            laboratories: boot.laboratories,
            scopedBookings: boot.bookings,
            scopedProjects: boot.projects,
            pendingApprovalsCount:
              role === 'faculty' || role === 'admin'
                ? boot.bookings.filter((b) => b.status === 'pending').length
                : undefined,
            openConflictsCount:
              role === 'faculty' || role === 'admin'
                ? boot.conflicts.filter((c) => c.status === 'open').length
                : undefined,
            analytics: role === 'admin' ? boot.analytics : null,
          },
          safeHistory,
        );
        res.json(result);
        return;
      }

      const localUser = authUser ? db.findUserById(authUser.sub) : undefined;
      const isVerifiedAdmin = Boolean(
        authUser && authUser.role === 'admin' && db.isAuthorizedAdmin(authUser.email),
      );
      const scopedBookings = authUser ? db.getBookings(authUser.sub, authUser.role) : [];
      const scopedProjects = authUser ? db.getProjects(authUser.sub, authUser.role) : [];
      const result = await askLabAssistantWithAI(
        prompt,
        db.getEquipment(),
        {
          userName: localUser?.name || authUser?.name || 'Campus Visitor',
          userRole: role,
          department: localUser?.department || 'General Campus Labs',
          certifications: localUser?.certifications || ['General Lab Safety'],
          laboratories: db.getLaboratories(),
          scopedBookings,
          scopedProjects,
          pendingApprovalsCount:
            role === 'faculty' || role === 'admin'
              ? scopedBookings.filter((b) => b.status === 'pending').length
              : undefined,
          openConflictsCount:
            role === 'faculty' || role === 'admin'
              ? db.getConflicts(authUser!.sub, authUser!.role).filter((c) => c.status === 'open').length
              : undefined,
          analytics: isVerifiedAdmin ? db.getAnalytics() : null,
        },
        safeHistory,
      );
      res.json(result);
    } catch (err) {
      if (err instanceof GeminiConfigError) {
        res.status(503).json({ error: err.message });
        return;
      }
      if (err instanceof DbSchemaError) {
        res.status(503).json({ error: err.message });
        return;
      }
      res.status(502).json({
        error: err instanceof Error ? err.message : 'Gemini AI assistant request failed.',
      });
    }
  });

  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.resolve(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`LabLink server listening on http://0.0.0.0:${PORT}`);
  });
}

startServer();
