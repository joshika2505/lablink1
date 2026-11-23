/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useCallback, useEffect, useState } from 'react';
import { AnimatePresence, motion, MotionConfig } from 'motion/react';
import type {
  AccessRequest,
  AppNotification,
  AuthorizedAdminEntry,
  Booking,
  BusySlot,
  Department,
  Equipment,
  FairSlotConflictCase,
  Laboratory,
  MaintenanceLog,
  ResearchProject,
  UserProfile,
  UtilizationAnalytics,
} from './types/lablink';
import { api, setAuthToken } from './lib/api';
import { isSupabaseClientConfigured, supabase } from './lib/supabase';
import { WorkspaceShell, type WorkspaceRoute } from './components/layout/WorkspaceShell';
import { LandingPage } from './components/views/LandingPage';
import { AdminLoginView } from './components/views/AdminLoginView';
import { DashboardView } from './components/views/DashboardView';
import { DiscoverView } from './components/views/DiscoverView';
import { EquipmentDetailView } from './components/views/EquipmentDetailView';
import { FairSlotView } from './components/views/FairSlotView';
import { ApprovalsAdminView } from './components/views/ApprovalsAdminView';
import {
  ProjectsView,
  ReservationsView,
} from './components/views/ProjectsAndReservationsView';
import { LabMapView, SettingsView } from './components/views/LabMapAndSettingsView';
import { AuthModal } from './components/views/AuthModal';
import { SPRING_TACTILE } from './components/motion/MotionPrimitives';
import { OpeningSplashScreen } from './components/motion/OpeningSplashScreen';
import { LabBotChatbot } from './components/chat/LabBotChatbot';

type AppRoute = 'landing' | 'admin-login' | WorkspaceRoute;

const PROTECTED_ROUTES = new Set<AppRoute>([
  'dashboard',
  'my-reservations',
  'projects',
  'approvals',
  'admin-console',
  'settings',
]);

function getRouteFromPathname(pathname: string): AppRoute {
  if (pathname === '/admin-login') return 'admin-login';
  if (pathname === '/admin') return 'admin-console';
  return 'landing';
}

function getPathnameForRoute(route: AppRoute): string {
  if (route === 'admin-login') return '/admin-login';
  if (route === 'admin-console') return '/admin';
  return '/';
}

export default function App() {
  const [route, setRoute] = useState<AppRoute>(() =>
    getRouteFromPathname(window.location.pathname),
  );
  const [pendingProtectedRoute, setPendingProtectedRoute] = useState<AppRoute | null>(null);
  const [selectedEquipmentId, setSelectedEquipmentId] = useState<string>('eq-arduino-kit');
  const [authModalOpen, setAuthModalOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [splashDone, setSplashDone] = useState(false);
  const [accessDeniedNotice, setAccessDeniedNotice] = useState<string | null>(null);
  const [bootstrapError, setBootstrapError] = useState<string | null>(null);
  const [schemaStatus, setSchemaStatus] = useState<{
    configured: boolean;
    schemaReady: boolean;
    missingTables: string[];
  } | null>(null);

  const [user, setUser] = useState<UserProfile | null>(null);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [laboratories, setLaboratories] = useState<Laboratory[]>([]);
  const [equipment, setEquipment] = useState<Equipment[]>([]);
  const [projects, setProjects] = useState<ResearchProject[]>([]);
  const [accessRequests, setAccessRequests] = useState<AccessRequest[]>([]);
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [busySlots, setBusySlots] = useState<BusySlot[]>([]);
  const [conflicts, setConflicts] = useState<FairSlotConflictCase[]>([]);
  const [maintenance, setMaintenance] = useState<MaintenanceLog[]>([]);
  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const [analytics, setAnalytics] = useState<UtilizationAnalytics | null>(null);
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [authorizedAdmins, setAuthorizedAdmins] = useState<AuthorizedAdminEntry[]>([]);

  const syncUrl = useCallback((nextRoute: AppRoute) => {
    const targetPath = getPathnameForRoute(nextRoute);
    if (window.location.pathname !== targetPath) {
      window.history.pushState({ route: nextRoute }, '', targetPath);
    }
  }, []);

  const loadBootstrap = useCallback(async (): Promise<UserProfile | null> => {
    try {
      const data = await api.bootstrap();
      setBootstrapError(null);
      setUser(data.user || null);
      setDepartments(data.departments);
      setLaboratories(data.laboratories);
      setEquipment(data.equipment);
      setProjects(data.projects);
      setAccessRequests(data.accessRequests || []);
      setBookings(data.bookings);
      setBusySlots(data.busySlots || []);
      setConflicts(data.conflicts);
      setMaintenance(data.maintenance);
      setNotifications(data.notifications);
      setAnalytics(data.analytics || null);
      setUsers(data.users || []);
      setAuthorizedAdmins(data.authorizedAdmins || []);
      if (
        data.equipment[0] &&
        !data.equipment.some((item) => item.id === selectedEquipmentId)
      ) {
        setSelectedEquipmentId(data.equipment[0].id);
      }
      return data.user || null;
    } catch (err) {
      setBootstrapError(err instanceof Error ? err.message : 'Unable to load campus data.');
      return null;
    } finally {
      setLoading(false);
    }
  }, [selectedEquipmentId]);

  useEffect(() => {
    let mounted = true;
    (async () => {
      api
        .health()
        .then((h) => {
          if (mounted) {
            setSchemaStatus({
              configured: h.supabaseConfigured,
              schemaReady: h.supabaseSchemaReady,
              missingTables: h.missingTables || [],
            });
          }
        })
        .catch(() => undefined);

      if (isSupabaseClientConfigured && supabase) {
        const { data } = await supabase.auth.getSession();
        if (data.session?.access_token) {
          setAuthToken(data.session.access_token);
        }
      }
      const loadedUser = await loadBootstrap();
      if (!mounted) return;
      if (window.location.pathname === '/admin' && loadedUser?.role !== 'admin') {
        setAccessDeniedNotice(
          'Access denied. Only authorized administrators can open the Admin Console.',
        );
        setRoute('landing');
        syncUrl('landing');
      }
    })();

    const authListener =
      isSupabaseClientConfigured && supabase
        ? supabase.auth.onAuthStateChange((_event, session) => {
            setAuthToken(session?.access_token ?? null);
          })
        : null;

    return () => {
      mounted = false;
      authListener?.data.subscription.unsubscribe();
    };
  }, [loadBootstrap, syncUrl]);

  useEffect(() => {
    const onPopState = () => {
      const target = getRouteFromPathname(window.location.pathname);
      if (target === 'admin-console' && user?.role !== 'admin') {
        setAccessDeniedNotice(
          'Access denied. Only authorized administrators can open the Admin Console.',
        );
        setRoute('landing');
        syncUrl('landing');
        return;
      }
      if (!user && PROTECTED_ROUTES.has(target)) {
        setAccessDeniedNotice('Please sign in to access your LabLink account pages.');
        setRoute('landing');
        syncUrl('landing');
        return;
      }
      setRoute(target);
    };
    window.addEventListener('popstate', onPopState);
    return () => window.removeEventListener('popstate', onPopState);
  }, [user, syncUrl]);

  const handleNavigate = useCallback(
    (nextRoute: string, eqId?: string) => {
      const target = nextRoute as AppRoute;
      if (eqId) setSelectedEquipmentId(eqId);

      if (target === 'admin-console' && user?.role !== 'admin') {
        setAccessDeniedNotice(
          'Access denied. Only authorized administrators can open the Admin Console.',
        );
        const fallback: AppRoute = user ? 'dashboard' : 'landing';
        setRoute(fallback);
        syncUrl(fallback);
        return;
      }
      if (!user && PROTECTED_ROUTES.has(target)) {
        setPendingProtectedRoute(target);
        setAccessDeniedNotice('Please sign in to open your bookings, projects, or account settings.');
        setAuthModalOpen(true);
        return;
      }
      if (target === 'approvals' && user?.role !== 'faculty' && user?.role !== 'admin') {
        setAccessDeniedNotice('Only approved faculty or administrators can review waiting requests.');
        const fallback: AppRoute = user ? 'dashboard' : 'landing';
        setRoute(fallback);
        syncUrl(fallback);
        return;
      }
      setAccessDeniedNotice(null);
      setRoute(target);
      syncUrl(target);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    },
    [user, syncUrl],
  );

  const handleEnterWorkspace = useCallback(
    async (targetRoute?: string, eqId?: string) => {
      const resolved = (targetRoute as AppRoute) || 'dashboard';
      if (eqId) setSelectedEquipmentId(eqId);

      if (resolved === 'admin-console' && user?.role !== 'admin') {
        setAccessDeniedNotice(
          'Access denied. Please sign in through Admin Login to open the Admin Console.',
        );
        setRoute('admin-login');
        syncUrl('admin-login');
        return;
      }

      if (!user && PROTECTED_ROUTES.has(resolved)) {
        setPendingProtectedRoute(resolved);
        setAccessDeniedNotice('Sign in with your university email to access your workspace.');
        setAuthModalOpen(true);
        return;
      }

      if (resolved === 'approvals' && user?.role !== 'faculty' && user?.role !== 'admin') {
        setAccessDeniedNotice(
          'Only approved faculty or administrators can review equipment requests.',
        );
        setRoute(user ? 'dashboard' : 'landing');
        syncUrl(user ? 'dashboard' : 'landing');
        return;
      }

      setAccessDeniedNotice(null);
      setRoute(resolved);
      syncUrl(resolved);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    },
    [user, syncUrl],
  );

  const handleSignOut = async () => {
    setAuthToken(null);
    if (isSupabaseClientConfigured && supabase) {
      await supabase.auth.signOut().catch(() => undefined);
    }
    setUser(null);
    setBookings([]);
    setProjects([]);
    setAccessRequests([]);
    setConflicts([]);
    setNotifications([]);
    setUsers([]);
    setAuthorizedAdmins([]);
    setAnalytics(null);
    setAccessDeniedNotice(null);
    setPendingProtectedRoute(null);
    setRoute('landing');
    syncUrl('landing');
    await loadBootstrap();
  };

  const handleMarkNotificationRead = async (id: string) => {
    setNotifications((prev) => prev.map((n) => (n.id === id ? { ...n, read: true } : n)));
    try {
      await api.markNotificationRead(id);
    } catch {
      // Ignore network hiccup for read toggle
    }
  };

  const selectedEquipment =
    equipment.find((e) => e.id === selectedEquipmentId) || equipment[0];
  const selectedLab = laboratories.find((l) => l.id === selectedEquipment?.laboratoryId);
  const pendingApprovalsCount =
    bookings.filter((b) => b.status === 'pending').length +
    accessRequests.filter((r) => r.status === 'pending').length;
  const openConflictsCount = conflicts.filter((c) => c.status === 'open').length;

  const fallbackStudent: UserProfile = user || {
    id: 'guest',
    email: 'guest@lablink.edu',
    name: 'Visitor',
    role: 'student',
    department: 'Engineering',
    title: 'Lab Visitor',
    weeklyQuotaHours: 8,
    usedHoursThisWeek: 0,
    certifications: ['General Lab Safety'],
  };

  const schemaWarning =
    schemaStatus?.configured && !schemaStatus.schemaReady
      ? `Supabase database schema needs initialization (${schemaStatus.missingTables.join(', ')} missing). Run supabase/schema.sql in your Supabase SQL Editor.`
      : bootstrapError;

  return (
    <MotionConfig reducedMotion="user">
      <AnimatePresence>
        {!splashDone && (
          <OpeningSplashScreen
            bootstrapDone={!loading}
            onComplete={() => setSplashDone(true)}
          />
        )}
      </AnimatePresence>

      <AnimatePresence mode="wait">
        {route === 'landing' ? (
          <motion.div
            key="landing-view"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.25 }}
          >
            {schemaWarning && (
              <div className="bg-[#f8de91] text-[#4a3800] px-4 py-2.5 text-center text-xs font-semibold">
                {schemaWarning}
              </div>
            )}
            <LandingPage
              equipment={equipment}
              departments={departments}
              onEnterWorkspace={handleEnterWorkspace}
              onOpenAuth={() => setAuthModalOpen(true)}
              onOpenAdminLogin={() => handleNavigate('admin-login')}
              accessDeniedNotice={accessDeniedNotice}
              onDismissNotice={() => setAccessDeniedNotice(null)}
            />
          </motion.div>
        ) : route === 'admin-login' ? (
          <motion.div
            key="admin-login-view"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.25 }}
          >
            <AdminLoginView
              deniedNotice={accessDeniedNotice}
              onBackToSite={() => handleNavigate('landing')}
              onAuthenticatedAdmin={async (adminUser) => {
                setUser(adminUser);
                setAccessDeniedNotice(null);
                await loadBootstrap();
                setRoute('admin-console');
                syncUrl('admin-console');
              }}
            />
          </motion.div>
        ) : (
          <motion.div
            key="workspace-view"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.25 }}
          >
            <WorkspaceShell
              activeRoute={route}
              user={user}
              notifications={notifications}
              pendingApprovalsCount={pendingApprovalsCount}
              openConflictsCount={openConflictsCount}
              onNavigate={(next) => handleNavigate(next)}
              onBackToLanding={() => handleNavigate('landing')}
              onOpenAuth={() => setAuthModalOpen(true)}
              onSignOut={handleSignOut}
              onMarkNotificationRead={handleMarkNotificationRead}
            >
              {schemaWarning && (
                <div className="mb-4 rounded-2xl bg-[#f8de91] text-[#4a3800] px-5 py-3 text-xs font-semibold">
                  {schemaWarning}
                </div>
              )}

              {accessDeniedNotice && (
                <div className="mb-5 rounded-2xl bg-[#ffd9e0] text-[#673946] px-5 py-3 text-xs font-semibold flex items-center justify-between gap-3">
                  <span>{accessDeniedNotice}</span>
                  <button
                    type="button"
                    onClick={() => setAccessDeniedNotice(null)}
                    className="underline cursor-pointer shrink-0"
                  >
                    Dismiss
                  </button>
                </div>
              )}

              <AnimatePresence mode="wait">
                <motion.div
                  key={`${route}-${route === 'equipment-detail' ? selectedEquipmentId : ''}`}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -8 }}
                  transition={SPRING_TACTILE}
                >
                  {route === 'dashboard' && (
                    <DashboardView
                      user={fallbackStudent}
                      equipment={equipment}
                      projects={projects}
                      bookings={bookings}
                      onNavigate={handleNavigate}
                    />
                  )}

                  {route === 'discover' && (
                    <DiscoverView
                      equipment={equipment}
                      onSelectEquipment={(id) => handleNavigate('equipment-detail', id)}
                    />
                  )}

                  {route === 'equipment-detail' && selectedEquipment && (
                    <EquipmentDetailView
                      equipment={selectedEquipment}
                      laboratory={selectedLab}
                      projects={projects}
                      bookings={bookings}
                      busySlots={busySlots}
                      user={user}
                      onBack={() => handleNavigate('discover')}
                      onOpenAuth={() => setAuthModalOpen(true)}
                      onBookingCreated={(bk) => {
                        setBookings((prev) => [bk, ...prev]);
                        loadBootstrap();
                      }}
                      onConflictSubmitted={(conflict) => {
                        setConflicts((prev) => [conflict, ...prev]);
                        loadBootstrap();
                      }}
                      onNavigate={handleNavigate}
                    />
                  )}

                  {route === 'my-reservations' && (
                    <ReservationsView
                      user={user}
                      bookings={bookings}
                      onBookingUpdated={(bk) => {
                        setBookings((prev) => prev.map((b) => (b.id === bk.id ? bk : b)));
                        loadBootstrap();
                      }}
                      onSelectEquipment={(id) => handleNavigate('equipment-detail', id)}
                      onNavigate={handleNavigate}
                      onOpenAuth={() => setAuthModalOpen(true)}
                    />
                  )}

                  {route === 'projects' && (
                    <ProjectsView
                      user={user}
                      projects={projects}
                      accessRequests={accessRequests}
                      equipment={equipment}
                      onProjectCreated={(proj) => setProjects((prev) => [proj, ...prev])}
                      onAccessRequestCreated={(req) => {
                        setAccessRequests((prev) => [req, ...prev]);
                      }}
                      onSelectEquipment={(id) => handleNavigate('equipment-detail', id)}
                      onOpenAuth={() => setAuthModalOpen(true)}
                    />
                  )}

                  {route === 'ai-assistant' && (
                    <FairSlotView
                      conflicts={conflicts}
                      equipment={equipment}
                      user={user}
                      onConflictResolved={(updatedConflict, createdBooking) => {
                        setConflicts((prev) =>
                          prev.map((c) => (c.id === updatedConflict.id ? updatedConflict : c)),
                        );
                        if (createdBooking) {
                          setBookings((prev) => [createdBooking, ...prev]);
                        }
                        loadBootstrap();
                      }}
                      onNavigate={handleNavigate}
                      onOpenAuth={() => setAuthModalOpen(true)}
                    />
                  )}

                  {(route === 'approvals' || route === 'admin-console') && (
                    <ApprovalsAdminView
                      mode={route === 'admin-console' ? 'admin-console' : 'approvals'}
                      user={user}
                      bookings={bookings}
                      accessRequests={accessRequests}
                      equipment={equipment}
                      laboratories={laboratories}
                      departments={departments}
                      maintenance={maintenance}
                      users={users}
                      analytics={analytics}
                      authorizedAdmins={authorizedAdmins}
                      onBookingUpdated={(bk) => {
                        setBookings((prev) => prev.map((b) => (b.id === bk.id ? bk : b)));
                        loadBootstrap();
                      }}
                      onAccessRequestUpdated={(req) => {
                        setAccessRequests((prev) =>
                          prev.map((item) => (item.id === req.id ? req : item)),
                        );
                        loadBootstrap();
                      }}
                      onEquipmentAdded={(eq) => setEquipment((prev) => [eq, ...prev])}
                      onEquipmentUpdated={(eq) =>
                        setEquipment((prev) => prev.map((item) => (item.id === eq.id ? eq : item)))
                      }
                      onEquipmentDeleted={(deletedId) =>
                        setEquipment((prev) => prev.filter((item) => item.id !== deletedId))
                      }
                      onEquipmentStatusUpdated={(eq) =>
                        setEquipment((prev) => prev.map((item) => (item.id === eq.id ? eq : item)))
                      }
                      onDepartmentAdded={(dept) => setDepartments((prev) => [...prev, dept])}
                      onLaboratoryAdded={(lab) => setLaboratories((prev) => [...prev, lab])}
                      onMaintenanceAdded={(log) => setMaintenance((prev) => [log, ...prev])}
                      onUserRoleUpdated={(u) =>
                        setUsers((prev) => prev.map((item) => (item.id === u.id ? u : item)))
                      }
                      onFacultyRequestDecided={(u) =>
                        setUsers((prev) => prev.map((item) => (item.id === u.id ? u : item)))
                      }
                      onUserCreated={(u) => setUsers((prev) => [...prev, u])}
                      onAuthorizedAdminsUpdated={(admins) => setAuthorizedAdmins(admins)}
                      onOpenAuth={() => setAuthModalOpen(true)}
                    />
                  )}

                  {route === 'lab-map' && (
                    <LabMapView
                      laboratories={laboratories}
                      equipment={equipment}
                      onSelectEquipment={(id) => handleNavigate('equipment-detail', id)}
                    />
                  )}

                  {route === 'settings' && (
                    <SettingsView
                      user={user}
                      onOpenAuth={() => setAuthModalOpen(true)}
                      onProfileUpdated={(updated) => setUser(updated)}
                      onSignOut={handleSignOut}
                    />
                  )}
                </motion.div>
              </AnimatePresence>
            </WorkspaceShell>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Global Floating LabBot AI Chatbot */}
      {route !== 'admin-login' && (
        <LabBotChatbot
          equipment={equipment}
          user={user}
          inWorkspace={route !== 'landing'}
          onOpenEquipment={(eqId) =>
            route === 'landing'
              ? handleEnterWorkspace('equipment-detail', eqId)
              : handleNavigate('equipment-detail', eqId)
          }
          onNavigateRoute={(next) =>
            route === 'landing' ? handleEnterWorkspace(next) : handleNavigate(next)
          }
        />
      )}

      <AuthModal
        open={authModalOpen}
        onClose={() => {
          setAuthModalOpen(false);
          setPendingProtectedRoute(null);
        }}
        onAuthenticated={async (authedUser) => {
          setUser(authedUser);
          setAccessDeniedNotice(null);
          await loadBootstrap();
          if (pendingProtectedRoute) {
            const target = pendingProtectedRoute;
            setPendingProtectedRoute(null);
            if (target === 'approvals' && authedUser.role === 'student') {
              setAccessDeniedNotice(
                'Only approved faculty or administrators can open approvals.',
              );
              setRoute('dashboard');
              syncUrl('dashboard');
            } else if (target === 'admin-console' && authedUser.role !== 'admin') {
              setAccessDeniedNotice('Only authorized administrators can open the Admin Console.');
              setRoute('dashboard');
              syncUrl('dashboard');
            } else {
              setRoute(target);
              syncUrl(target);
            }
          }
        }}
      />
    </MotionConfig>
  );
}
