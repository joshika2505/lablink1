import React, { useEffect, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import type { AppNotification, UserProfile } from '../../types/lablink';
import { MagneticElement, SPRING_TACTILE, TactileButton } from '../motion/MotionPrimitives';

export type WorkspaceRoute =
  | 'dashboard'
  | 'discover'
  | 'equipment-detail'
  | 'my-reservations'
  | 'projects'
  | 'approvals'
  | 'admin-console'
  | 'lab-map'
  | 'settings'
  | 'ai-assistant';

interface WorkspaceShellProps {
  activeRoute: WorkspaceRoute;
  user: UserProfile | null;
  notifications: AppNotification[];
  pendingApprovalsCount: number;
  openConflictsCount: number;
  onNavigate: (route: WorkspaceRoute) => void;
  onBackToLanding: () => void;
  onOpenAuth: () => void;
  onSignOut: () => void;
  onMarkNotificationRead: (id: string) => void;
  children: React.ReactNode;
}

const TOP_PILLS: Array<{ id: WorkspaceRoute; label: string }> = [
  { id: 'discover', label: 'Find Equipment' },
  { id: 'projects', label: 'Project Access' },
  { id: 'my-reservations', label: 'Manage Bookings' },
  { id: 'ai-assistant', label: 'Smart Booking' },
];

export const WorkspaceShell: React.FC<WorkspaceShellProps> = ({
  activeRoute,
  user,
  notifications,
  pendingApprovalsCount,
  openConflictsCount,
  onNavigate,
  onBackToLanding,
  onOpenAuth,
  onSignOut,
  onMarkNotificationRead,
  children,
}) => {
  const [notifOpen, setNotifOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const menuGroupRef = useRef<HTMLDivElement>(null);

  const unreadCount = notifications.filter((n) => !n.read).length;

  useEffect(() => {
    const onPointerDown = (e: PointerEvent) => {
      if (menuGroupRef.current && !menuGroupRef.current.contains(e.target as Node)) {
        setNotifOpen(false);
        setProfileOpen(false);
      }
    };
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setNotifOpen(false);
        setProfileOpen(false);
      }
    };
    window.addEventListener('pointerdown', onPointerDown);
    window.addEventListener('keydown', onKeyDown);
    return () => {
      window.removeEventListener('pointerdown', onPointerDown);
      window.removeEventListener('keydown', onKeyDown);
    };
  }, []);

  const isFacultyOrAdmin = user?.role === 'faculty' || user?.role === 'admin';
  const isAdmin = user?.role === 'admin';

  const sidebarItems: Array<{ id: WorkspaceRoute; label: string; icon: string }> = [
    { id: 'dashboard', label: 'Dashboard', icon: 'dashboard' },
    { id: 'discover', label: 'Find Equipment', icon: 'explore' },
    { id: 'my-reservations', label: 'Manage Bookings', icon: 'calendar_today' },
    { id: 'projects', label: 'Project Access', icon: 'science' },
    ...(isFacultyOrAdmin
      ? [{ id: 'approvals' as const, label: 'Waiting for Approval', icon: 'verified' }]
      : []),
    ...(isAdmin
      ? [{ id: 'admin-console' as const, label: 'Usage Reports', icon: 'admin_panel_settings' }]
      : []),
    { id: 'lab-map', label: 'Explore Labs', icon: 'map' },
    { id: 'ai-assistant', label: 'Booking Conflicts', icon: 'auto_awesome' },
    { id: 'settings', label: 'Settings', icon: 'settings' },
  ];

  const mobileItems: Array<{ id: WorkspaceRoute; icon: string; label: string }> = [
    { id: 'dashboard', icon: 'dashboard', label: 'Home' },
    { id: 'discover', icon: 'explore', label: 'Find' },
    { id: 'my-reservations', icon: 'calendar_today', label: 'Bookings' },
    { id: 'ai-assistant', icon: 'auto_awesome', label: 'Smart' },
    isAdmin
      ? { id: 'admin-console', icon: 'admin_panel_settings', label: 'Reports' }
      : isFacultyOrAdmin
        ? { id: 'approvals', icon: 'verified', label: 'Approvals' }
        : { id: 'lab-map', icon: 'map', label: 'Labs' },
  ];

  const profileMenuItems: Array<{ label: string; icon: string; route: WorkspaceRoute }> =
    user?.role === 'admin'
      ? [
          { label: 'My Profile', icon: 'person', route: 'settings' },
          { label: 'Admin Dashboard', icon: 'admin_panel_settings', route: 'admin-console' },
          { label: 'Settings', icon: 'settings', route: 'settings' },
        ]
      : user?.role === 'faculty'
        ? [
            { label: 'My Profile', icon: 'person', route: 'settings' },
            { label: 'Assigned Labs', icon: 'science', route: 'lab-map' },
            { label: 'Requests', icon: 'verified', route: 'approvals' },
          ]
        : [
            { label: 'My Profile', icon: 'person', route: 'settings' },
            { label: 'My Bookings', icon: 'calendar_today', route: 'my-reservations' },
            { label: 'Settings', icon: 'settings', route: 'settings' },
          ];

  const isSidebarActive = (id: WorkspaceRoute) => {
    if (id === 'discover' && activeRoute === 'equipment-detail') return true;
    return activeRoute === id;
  };

  const isTopPillActive = (id: WorkspaceRoute) => {
    if (id === 'discover' && (activeRoute === 'discover' || activeRoute === 'equipment-detail')) {
      return true;
    }
    return activeRoute === id;
  };

  return (
    <div className="min-h-screen w-full bg-[#fef9ee] text-[#1d1c15] flex p-3 sm:p-5 lg:p-6 gap-6 pb-24 lg:pb-6">
      {/* Left Floating Clay Sidebar */}
      <aside className="hidden lg:flex w-60 shrink-0 flex-col justify-between bg-[#ffffff] rounded-[2rem] p-5 clay-card sticky top-6 h-[calc(100vh-3rem)]">
        <div className="flex flex-col gap-5">
          <div className="flex items-center justify-between px-3 pt-1">
            <span className="text-[11px] font-bold uppercase tracking-widest text-[#3f4945]">
              Workspace
            </span>
            <button
              type="button"
              onClick={onBackToLanding}
              title="Back to Home Page"
              className="text-[11px] font-semibold text-[#29695a] hover:underline cursor-pointer"
            >
              Home
            </button>
          </div>

          <nav className="flex flex-col gap-1.5" aria-label="Workspace navigation">
            {sidebarItems.map((item) => {
              const active = isSidebarActive(item.id);
              return (
                <MagneticElement key={item.id} strength={0.1}>
                  <button
                    type="button"
                    onClick={() => onNavigate(item.id)}
                    className={`relative w-full flex items-center justify-between gap-3 px-4 py-2.5 rounded-full text-sm font-semibold transition-colors cursor-pointer ${
                      active ? 'text-[#2b6a5b]' : 'text-[#3f4945] hover:text-[#1d1c15]'
                    }`}
                  >
                    {active && (
                      <motion.span
                        layoutId="sidebar-active-pill"
                        transition={SPRING_TACTILE}
                        className="absolute inset-0 rounded-full bg-[#a8e8d5] clay-button-soft"
                      />
                    )}
                    <span className="relative z-10 flex items-center gap-3 min-w-0">
                      <span className="material-symbols-outlined text-[20px] shrink-0">
                        {item.icon}
                      </span>
                      <span className="truncate">{item.label}</span>
                    </span>
                    {item.id === 'approvals' && pendingApprovalsCount > 0 && (
                      <span className="relative z-10 px-2 py-0.5 rounded-full bg-[#ffcfd9] text-[#84515e] text-[10px] font-bold tabular-nums shrink-0">
                        {pendingApprovalsCount}
                      </span>
                    )}
                  </button>
                </MagneticElement>
              );
            })}
          </nav>
        </div>

        {/* Smart Booking Quick Access Card */}
        <div className="bg-[#b0e4fd]/45 rounded-[1.5rem] p-4 flex flex-col gap-2.5">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-[#001f29] flex items-center gap-1.5">
              <span className="material-symbols-outlined text-[17px] text-[#2f6579]">
                auto_awesome
              </span>
              Smart Booking
            </span>
            {openConflictsCount > 0 && (
              <span className="px-2 py-0.5 rounded-full bg-[#ffcfd9] text-[#84515e] text-[10px] font-bold tabular-nums">
                {openConflictsCount} open
              </span>
            )}
          </div>
          <p className="text-[11px] text-[#114d61] leading-snug">
            Fix booking conflicts or ask LabBot which tool fits your work.
          </p>
          <TactileButton
            variant={activeRoute === 'ai-assistant' ? 'primary' : 'soft'}
            onClick={() => onNavigate('ai-assistant')}
            className="w-full py-2 text-xs"
          >
            Open Smart Booking
          </TactileButton>
        </div>
      </aside>

      {/* Main Content Area */}
      <div className="flex-1 min-w-0 flex flex-col gap-6 max-w-[1220px] mx-auto w-full">
        {/* Top Floating Header Pill */}
        <header className="sticky top-3 z-30">
          <div className="bg-[#ffffff]/95 backdrop-blur-md rounded-full px-4 sm:px-6 py-2.5 clay-card flex items-center justify-between gap-3">
            <button
              type="button"
              onClick={onBackToLanding}
              className="flex items-center gap-2.5 shrink-0 cursor-pointer group"
            >
              <div className="w-9 h-9 rounded-2xl bg-[#a8e8d5] flex items-center justify-center text-[#29695a] shadow-inner group-hover:scale-105 transition-transform">
                <span className="material-symbols-outlined text-[20px]">science</span>
              </div>
              <span className="font-bold text-lg tracking-tight text-[#1d1c15]">LabLink</span>
            </button>

            <nav
              className="hidden md:flex items-center gap-1 bg-[#f8f3e8]/80 p-1 rounded-full"
              aria-label="Primary sections"
            >
              {TOP_PILLS.map((pill) => {
                const active = isTopPillActive(pill.id);
                return (
                  <MagneticElement key={pill.id} strength={0.12}>
                    <button
                      type="button"
                      onClick={() => onNavigate(pill.id)}
                      className={`relative px-4 py-1.5 rounded-full text-xs font-semibold transition-colors cursor-pointer whitespace-nowrap ${
                        active ? 'text-[#2b6a5b]' : 'text-[#3f4945] hover:text-[#1d1c15]'
                      }`}
                    >
                      {active && (
                        <motion.span
                          layoutId="topbar-active-pill"
                          transition={SPRING_TACTILE}
                          className="absolute inset-0 rounded-full bg-[#a8e8d5] shadow-sm"
                        />
                      )}
                      <span className="relative z-10">{pill.label}</span>
                    </button>
                  </MagneticElement>
                );
              })}
            </nav>

            <div ref={menuGroupRef} className="flex items-center gap-2 shrink-0 relative">
              {/* Notifications Bell */}
              <button
                type="button"
                aria-label="Toggle notifications"
                onClick={() => {
                  setNotifOpen((prev) => !prev);
                  setProfileOpen(false);
                }}
                className="relative w-10 h-10 rounded-full bg-[#f8f3e8] clay-button-soft flex items-center justify-center text-[#1d1c15] cursor-pointer"
              >
                <span className="material-symbols-outlined text-[20px]">notifications</span>
                {unreadCount > 0 && (
                  <span className="absolute -top-0.5 -right-0.5 w-4 h-4 rounded-full bg-[#f5b5c4] text-[#340e1b] text-[10px] font-bold flex items-center justify-center tabular-nums">
                    {unreadCount}
                  </span>
                )}
              </button>

              {/* Profile / Role Pill + Dropdown */}
              <button
                type="button"
                aria-haspopup={user ? 'menu' : undefined}
                aria-expanded={user ? profileOpen : undefined}
                onClick={() => {
                  if (!user) {
                    onOpenAuth();
                    return;
                  }
                  setProfileOpen((prev) => !prev);
                  setNotifOpen(false);
                }}
                className="flex items-center gap-2.5 pl-4 pr-2 py-1.5 rounded-full bg-[#f8f3e8] clay-button-soft cursor-pointer hover:bg-[#a8e8d5]/40 transition-colors"
              >
                <div className="text-left leading-tight">
                  <span className="text-xs font-bold text-[#1d1c15] block">
                    {user ? user.name.split(' ')[0] : 'Sign In'}
                  </span>
                  {user && (
                    <span className="text-[10px] font-semibold uppercase text-[#29695a] block">
                      {user.role}
                    </span>
                  )}
                </div>
                <div className="w-8 h-8 rounded-full bg-[#29695a] text-[#ffffff] flex items-center justify-center">
                  <span className="material-symbols-outlined text-[18px]">person</span>
                </div>
                {user && (
                  <span
                    className={`material-symbols-outlined text-[16px] text-[#3f4945] transition-transform ${
                      profileOpen ? 'rotate-180' : ''
                    }`}
                  >
                    expand_more
                  </span>
                )}
              </button>

              {/* Profile Dropdown Menu */}
              <AnimatePresence>
                {user && profileOpen && (
                  <motion.div
                    role="menu"
                    aria-label="Profile menu"
                    initial={{ opacity: 0, y: 10, scale: 0.96 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, y: 8, scale: 0.96 }}
                    transition={SPRING_TACTILE}
                    className="absolute right-0 top-14 w-64 bg-[#ffffff] rounded-[1.75rem] p-3.5 clay-card z-50 flex flex-col gap-2"
                  >
                    <div className="px-3 py-2 rounded-2xl bg-[#f8f3e8]/80">
                      <p className="text-xs font-bold text-[#1d1c15] truncate">{user.name}</p>
                      <p className="text-[11px] text-[#3f4945] truncate">{user.email}</p>
                      <span className="inline-block mt-1 px-2 py-0.5 rounded-full bg-[#a8e8d5] text-[#2b6a5b] text-[10px] font-bold uppercase">
                        {user.role}
                      </span>
                    </div>

                    <div className="flex flex-col gap-1">
                      {profileMenuItems.map((item) => (
                        <button
                          key={item.label}
                          type="button"
                          role="menuitem"
                          onClick={() => {
                            setProfileOpen(false);
                            onNavigate(item.route);
                          }}
                          className="flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs font-semibold text-[#1d1c15] hover:bg-[#f8f3e8] transition-colors cursor-pointer text-left"
                        >
                          <span className="material-symbols-outlined text-[18px] text-[#29695a]">
                            {item.icon}
                          </span>
                          <span>{item.label}</span>
                        </button>
                      ))}
                    </div>

                    <div className="pt-1.5 border-t border-[#e7e2d7]">
                      <button
                        type="button"
                        role="menuitem"
                        onClick={() => {
                          setProfileOpen(false);
                          onSignOut();
                        }}
                        className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs font-semibold text-[#93000a] hover:bg-[#ffdad6]/55 transition-colors cursor-pointer text-left"
                      >
                        <span className="material-symbols-outlined text-[18px]">logout</span>
                        <span>Sign Out</span>
                      </button>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>

              {/* Notifications Dropdown */}
              <AnimatePresence>
                {notifOpen && (
                  <motion.div
                    initial={{ opacity: 0, y: 10, scale: 0.96 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, y: 8, scale: 0.96 }}
                    transition={SPRING_TACTILE}
                    className="absolute right-0 top-14 w-80 bg-[#ffffff] rounded-[1.75rem] p-4 clay-card z-50 flex flex-col gap-3"
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-bold text-[#1d1c15]">Notifications</span>
                      <button
                        type="button"
                        onClick={() => setNotifOpen(false)}
                        className="text-xs font-semibold text-[#3f4945] hover:text-[#1d1c15] cursor-pointer"
                      >
                        Close
                      </button>
                    </div>
                    <div className="flex flex-col gap-2 max-h-64 overflow-y-auto">
                      {notifications.length === 0 ? (
                        <p className="text-xs text-[#3f4945] py-2">No new alerts.</p>
                      ) : (
                        notifications.map((n) => (
                          <button
                            key={n.id}
                            type="button"
                            onClick={() => onMarkNotificationRead(n.id)}
                            className={`text-left p-3 rounded-2xl transition-colors cursor-pointer ${
                              n.read ? 'bg-[#f8f3e8]/60 opacity-75' : 'bg-[#b0e4fd]/35'
                            }`}
                          >
                            <div className="flex items-center justify-between gap-2">
                              <span className="text-xs font-bold text-[#1d1c15]">{n.title}</span>
                              {!n.read && (
                                <span className="w-2 h-2 rounded-full bg-[#29695a] shrink-0" />
                              )}
                            </div>
                            <p className="text-[11px] text-[#3f4945] mt-1 leading-snug">
                              {n.message}
                            </p>
                          </button>
                        ))
                      )}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </div>
        </header>

        {/* Active Page Canvas */}
        <main className="flex-1 w-full pb-12">{children}</main>
      </div>

      {/* Mobile Bottom Dock */}
      <nav
        aria-label="Mobile navigation"
        className="lg:hidden fixed bottom-3 left-3 right-3 z-40 bg-[#ffffff]/95 backdrop-blur-md rounded-full px-3 py-2 clay-card flex items-center justify-around"
      >
        {mobileItems.map((item) => {
          const active = isSidebarActive(item.id);
          return (
            <button
              key={item.id}
              type="button"
              onClick={() => onNavigate(item.id)}
              className={`flex flex-col items-center gap-0.5 px-3 py-1 rounded-full text-[10px] font-semibold cursor-pointer ${
                active ? 'bg-[#a8e8d5] text-[#2b6a5b]' : 'text-[#3f4945]'
              }`}
            >
              <span className="material-symbols-outlined text-[18px]">{item.icon}</span>
              <span>{item.label}</span>
            </button>
          );
        })}
      </nav>
    </div>
  );
};
