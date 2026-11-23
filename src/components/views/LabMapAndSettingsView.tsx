import React, { useEffect, useState } from 'react';
import { motion } from 'motion/react';
import type { Equipment, Laboratory, UserProfile } from '../../types/lablink';
import { api } from '../../lib/api';
import { ClayTiltCard, SPRING_TACTILE, TactileButton } from '../motion/MotionPrimitives';

interface LabMapViewProps {
  laboratories: Laboratory[];
  equipment: Equipment[];
  onSelectEquipment: (equipmentId: string) => void;
}

export const LabMapView: React.FC<LabMapViewProps> = ({
  laboratories,
  equipment,
  onSelectEquipment,
}) => {
  const [selectedLabId, setSelectedLabId] = useState(laboratories[0]?.id || '');

  useEffect(() => {
    if (laboratories.length > 0 && !laboratories.some((l) => l.id === selectedLabId)) {
      setSelectedLabId(laboratories[0].id);
    }
  }, [laboratories, selectedLabId]);

  const selectedLab = laboratories.find((l) => l.id === selectedLabId) || laboratories[0];
  const labInstruments = equipment.filter((e) => e.laboratoryId === selectedLab?.id);

  const formatLabStatus = (status: Laboratory['status']) => {
    if (status === 'open') return 'Open';
    if (status === 'high_load') return 'Busy';
    return 'Maintenance';
  };

  return (
    <div className="flex flex-col w-full gap-8">
      <div className="flex flex-col gap-1">
        <span className="text-xs font-semibold uppercase tracking-widest text-[#29695a]">
          05 / Campus Labs
        </span>
        <h1 className="text-3xl font-bold text-[#1d1c15]">Explore Labs</h1>
        <p className="text-sm text-[#3f4945]">
          See which labs are open, check bench availability, and view tools in each room.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Stylized Claymorphic Campus Map */}
        <div className="lg:col-span-7 bg-[#ffffff] rounded-[2rem] p-6 clay-card flex flex-col gap-4">
          <div className="flex items-center justify-between">
            <span className="text-sm font-bold text-[#1d1c15]">Campus Science & Engineering Quad</span>
            <span className="px-3 py-1 rounded-full bg-[#a8e8d5] text-[#2b6a5b] text-xs font-semibold">
              {laboratories.length} Labs
            </span>
          </div>

          <div className="relative w-full h-80 sm:h-96 rounded-[1.75rem] bg-gradient-to-br from-[#fef9ee] via-[#e9f8f2] to-[#e5f4fd] clay-well overflow-hidden">
            {/* Campus decorative pathways */}
            <svg
              aria-hidden="true"
              className="absolute inset-0 w-full h-full opacity-55"
              viewBox="0 0 600 380"
              preserveAspectRatio="none"
            >
              <path
                d="M 40 280 Q 180 210 310 240 T 560 120"
                fill="none"
                stroke="#ffffff"
                strokeWidth="16"
                strokeLinecap="round"
              />
              <path
                d="M 110 40 Q 220 170 280 340"
                fill="none"
                stroke="#ffffff"
                strokeWidth="14"
                strokeLinecap="round"
              />
              <rect x="65" y="75" width="120" height="75" rx="22" fill="#f8f3e8" />
              <rect x="370" y="65" width="145" height="90" rx="22" fill="#f8f3e8" />
              <rect x="200" y="220" width="160" height="95" rx="22" fill="#f8f3e8" />
            </svg>

            {laboratories.map((lab) => {
              const active = lab.id === selectedLab?.id;
              const pinColor =
                lab.status === 'open'
                  ? 'bg-[#a8e8d5] text-[#2b6a5b]'
                  : lab.status === 'high_load'
                    ? 'bg-[#b0e4fd] text-[#32677c]'
                    : 'bg-[#ffcfd9] text-[#84515e]';
              return (
                <motion.button
                  key={lab.id}
                  type="button"
                  onClick={() => setSelectedLabId(lab.id)}
                  whileHover={{ scale: 1.08, y: -3 }}
                  whileTap={{ scale: 0.95 }}
                  transition={SPRING_TACTILE}
                  style={{
                    left: `${lab.coordinates.xPercent}%`,
                    top: `${lab.coordinates.yPercent}%`,
                  }}
                  className={`absolute -translate-x-1/2 -translate-y-1/2 flex items-center gap-2 px-3.5 py-2 rounded-full text-xs font-bold shadow-md cursor-pointer transition-all ${
                    active
                      ? 'bg-[#29695a] text-[#ffffff] ring-4 ring-[#a8e8d5]/70 z-20'
                      : `${pinColor} z-10`
                  }`}
                >
                  <span className="material-symbols-outlined text-[16px]">location_on</span>
                  <span className="whitespace-nowrap">{lab.room}</span>
                </motion.button>
              );
            })}
          </div>

          <div className="flex flex-wrap gap-3 text-xs text-[#3f4945]">
            <span className="inline-flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-full bg-[#a8e8d5]" /> Open
            </span>
            <span className="inline-flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-full bg-[#b0e4fd]" /> Busy
            </span>
            <span className="inline-flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-full bg-[#ffcfd9]" /> Maintenance
            </span>
          </div>
        </div>

        {/* Selected Lab Details */}
        <div className="lg:col-span-5 flex flex-col gap-5">
          {selectedLab && (
            <ClayTiltCard
              tiltMax={3}
              className="bg-[#ffffff] rounded-[2rem] p-6 clay-card flex flex-col gap-4"
            >
              <div className="flex items-start justify-between gap-2">
                <div>
                  <span className="text-[11px] font-semibold uppercase tracking-wider text-[#29695a]">
                    {selectedLab.departmentName}
                  </span>
                  <h2 className="text-2xl font-bold text-[#1d1c15]">{selectedLab.name}</h2>
                  <p className="text-xs text-[#3f4945] mt-0.5">
                    {selectedLab.building} · Room {selectedLab.room}
                  </p>
                </div>
                <span className="px-3 py-1 rounded-full bg-[#a8e8d5] text-[#2b6a5b] text-xs font-semibold shrink-0">
                  {formatLabStatus(selectedLab.status)}
                </span>
              </div>

              <div className="grid grid-cols-2 gap-3 bg-[#f8f3e8] rounded-2xl p-4 clay-well text-xs tabular-nums">
                <div>
                  <span className="text-[10px] font-semibold uppercase text-[#3f4945] block">
                    Benches Used
                  </span>
                  <span className="text-base font-bold text-[#1d1c15]">
                    {selectedLab.occupied} / {selectedLab.capacity} benches
                  </span>
                </div>
                <div>
                  <span className="text-[10px] font-semibold uppercase text-[#3f4945] block">
                    Safety Rule
                  </span>
                  <span className="text-sm font-bold text-[#29695a]">{selectedLab.accessLevel}</span>
                </div>
              </div>

              <div className="flex items-center gap-3 p-3.5 rounded-2xl bg-[#f8f3e8]">
                <div className="w-10 h-10 rounded-full bg-[#b0e4fd] text-[#32677c] flex items-center justify-center font-bold text-sm">
                  {selectedLab.managerName
                    .split(' ')
                    .map((n) => n[0])
                    .join('')
                    .slice(0, 2)}
                </div>
                <div>
                  <p className="text-sm font-bold text-[#1d1c15]">{selectedLab.managerName}</p>
                  <p className="text-xs text-[#3f4945]">{selectedLab.managerTitle}</p>
                </div>
              </div>

              <div className="flex flex-col gap-2">
                <span className="text-xs font-semibold uppercase tracking-wider text-[#3f4945]">
                  Equipment in This Lab ({labInstruments.length})
                </span>
                {labInstruments.length > 0 ? (
                  labInstruments.map((eq) => (
                    <div
                      key={eq.id}
                      onClick={() => onSelectEquipment(eq.id)}
                      className="flex items-center justify-between gap-2 p-3 rounded-2xl bg-[#f8f3e8] hover:bg-[#a8e8d5]/40 transition-colors cursor-pointer"
                    >
                      <div className="min-w-0">
                        <p className="text-sm font-semibold text-[#1d1c15] truncate">{eq.name}</p>
                        <p className="text-xs text-[#3f4945]">{eq.nextSlotLabel}</p>
                      </div>
                      <TactileButton variant="primary" className="px-3.5 py-1.5 text-xs shrink-0">
                        Book Now
                      </TactileButton>
                    </div>
                  ))
                ) : (
                  <p className="text-xs text-[#3f4945]">
                    Open Find Equipment to check tools and book times in this lab.
                  </p>
                )}
              </div>
            </ClayTiltCard>
          )}
        </div>
      </div>
    </div>
  );
};

interface SettingsViewProps {
  user: UserProfile | null;
  onOpenAuth: () => void;
  onProfileUpdated: (user: UserProfile) => void;
  onSignOut: () => void;
}

export const SettingsView: React.FC<SettingsViewProps> = ({
  user,
  onOpenAuth,
  onProfileUpdated,
  onSignOut,
}) => {
  const [health, setHealth] = useState<{
    ok: boolean;
    supabaseConfigured: boolean;
    supabaseSchemaReady: boolean;
    missingTables: string[];
    geminiConfigured: boolean;
  } | null>(null);

  const [editName, setEditName] = useState(user?.name || '');
  const [editDept, setEditDept] = useState(user?.department || 'Bioengineering');
  const [editTitle, setEditTitle] = useState(user?.title || '');
  const [saving, setSaving] = useState(false);
  const [saveMsg, setSaveMsg] = useState<string | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);

  useEffect(() => {
    if (user) {
      setEditName(user.name);
      setEditDept(user.department);
      setEditTitle(user.title);
    }
  }, [user]);

  useEffect(() => {
    api
      .health()
      .then(setHealth)
      .catch(() => setHealth(null));
  }, []);

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    setSaving(true);
    setSaveMsg(null);
    setSaveError(null);
    try {
      const res = await api.updateProfile({
        name: editName.trim(),
        department: editDept.trim(),
        title: editTitle.trim(),
      });
      onProfileUpdated(res.user);
      setSaveMsg('Profile details saved.');
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : 'Unable to save profile.');
    } finally {
      setSaving(false);
    }
  };

  const quotaPct = user
    ? Math.min(100, Math.round((user.usedHoursThisWeek / Math.max(1, user.weeklyQuotaHours)) * 100))
    : 0;

  return (
    <div className="flex flex-col w-full gap-8 max-w-4xl">
      <div className="flex flex-col gap-1">
        <span className="text-xs font-semibold uppercase tracking-widest text-[#29695a]">
          06 / Account
        </span>
        <h1 className="text-3xl font-bold text-[#1d1c15]">Settings</h1>
        <p className="text-sm text-[#3f4945]">
          Manage your profile details, safety training, weekly booking limit, and platform connection.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* User Profile Card */}
        <div className="bg-[#ffffff] rounded-[2rem] p-6 clay-card flex flex-col gap-5">
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 rounded-full bg-[#a8e8d5] text-[#2b6a5b] flex items-center justify-center text-xl font-bold">
              {user ? user.name.slice(0, 2).toUpperCase() : 'LL'}
            </div>
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <h2 className="text-xl font-bold text-[#1d1c15] truncate">
                  {user?.name || 'Visitor'}
                </h2>
                {user && (
                  <span className="px-2.5 py-0.5 rounded-full bg-[#b0e4fd] text-[#32677c] text-[11px] font-semibold capitalize">
                    {user.role}
                  </span>
                )}
              </div>
              <p className="text-xs text-[#3f4945] truncate">
                {user ? `${user.title} · ${user.department}` : 'Sign in to save your bookings'}
              </p>
            </div>
          </div>

          {user?.facultyApprovalStatus && user.facultyApprovalStatus !== 'none' && (
            <div
              className={`rounded-2xl px-4 py-2.5 text-xs font-semibold ${
                user.facultyApprovalStatus === 'approved'
                  ? 'bg-[#a8e8d5]/55 text-[#2b6a5b]'
                  : user.facultyApprovalStatus === 'pending'
                    ? 'bg-[#f8de91]/70 text-[#4a3800]'
                    : 'bg-[#ffd9e0] text-[#673946]'
              }`}
            >
              {user.facultyApprovalStatus === 'pending'
                ? 'Faculty Role Request: Pending Admin Approval'
                : user.facultyApprovalStatus === 'approved'
                  ? 'Faculty Status: Approved by Administrator'
                  : 'Faculty Role Request: Declined'}
            </div>
          )}

          {user && (
            <>
              <div className="bg-[#f8f3e8] rounded-2xl p-4 clay-well flex flex-col gap-2">
                <div className="flex items-center justify-between text-xs font-semibold tabular-nums">
                  <span className="text-[#3f4945]">Weekly Booking Limit</span>
                  <span className="text-[#29695a]">
                    {user.usedHoursThisWeek}h / {user.weeklyQuotaHours}h
                  </span>
                </div>
                <div className="w-full h-2.5 rounded-full bg-[#ffffff] overflow-hidden">
                  <div
                    className="h-full rounded-full bg-[#29695a]"
                    style={{ width: `${quotaPct}%` }}
                  />
                </div>
              </div>

              <div className="flex flex-col gap-2">
                <span className="text-xs font-semibold uppercase tracking-wider text-[#3f4945]">
                  Completed Safety Training
                </span>
                <div className="flex flex-wrap gap-2">
                  {user.certifications.map((cert) => (
                    <span
                      key={cert}
                      className="px-3 py-1 rounded-full bg-[#b0e4fd] text-[#32677c] text-xs font-semibold"
                    >
                      {cert}
                    </span>
                  ))}
                </div>
              </div>
            </>
          )}

          <div className="pt-2 flex flex-wrap gap-2">
            <TactileButton variant="primary" onClick={onOpenAuth} className="px-5 py-2.5 text-xs">
              {user ? 'Switch Account' : 'Sign In'}
            </TactileButton>
            {user && (
              <TactileButton variant="ghost" onClick={onSignOut} className="px-5 py-2.5 text-xs">
                Sign Out
              </TactileButton>
            )}
          </div>
        </div>

        {/* Profile Editor + Platform Security Status */}
        <div className="bg-[#ffffff] rounded-[2rem] p-6 clay-card flex flex-col gap-5">
          {user ? (
            <form onSubmit={handleSaveProfile} className="flex flex-col gap-3">
              <div>
                <span className="text-xs font-semibold uppercase tracking-wider text-[#3f4945]">
                  Edit Profile
                </span>
                <h2 className="text-xl font-bold text-[#1d1c15]">Your Details</h2>
              </div>

              <div>
                <label className="block text-xs font-semibold text-[#3f4945] mb-1">Full Name</label>
                <input
                  required
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  className="w-full rounded-full bg-[#f8f3e8] px-4 py-2 text-sm clay-well focus:outline-none"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                <div>
                  <label className="block text-xs font-semibold text-[#3f4945] mb-1">
                    Department
                  </label>
                  <input
                    required
                    value={editDept}
                    onChange={(e) => setEditDept(e.target.value)}
                    className="w-full rounded-full bg-[#f8f3e8] px-4 py-2 text-sm clay-well focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-[#3f4945] mb-1">Title</label>
                  <input
                    required
                    value={editTitle}
                    onChange={(e) => setEditTitle(e.target.value)}
                    className="w-full rounded-full bg-[#f8f3e8] px-4 py-2 text-sm clay-well focus:outline-none"
                  />
                </div>
              </div>

              {saveMsg && (
                <p className="text-xs font-semibold text-[#2b6a5b] bg-[#a8e8d5]/55 rounded-2xl px-3.5 py-2">
                  {saveMsg}
                </p>
              )}
              {saveError && (
                <p className="text-xs font-semibold text-[#93000a] bg-[#ffdad6] rounded-2xl px-3.5 py-2">
                  {saveError}
                </p>
              )}

              <TactileButton
                type="submit"
                variant="secondary"
                loading={saving}
                className="py-2.5 text-xs"
              >
                Save Profile
              </TactileButton>
            </form>
          ) : (
            <div>
              <span className="text-xs font-semibold uppercase tracking-wider text-[#3f4945]">
                Account Security
              </span>
              <h2 className="text-xl font-bold text-[#1d1c15]">Role Access Controls</h2>
              <p className="text-xs text-[#3f4945] mt-1">
                Faculty and administrator access are verified by backend permissions and cannot be
                switched from public controls.
              </p>
            </div>
          )}

          <div className="bg-[#f8f3e8] rounded-2xl p-4 clay-well flex flex-col gap-2.5 text-xs">
            <span className="font-bold text-[#1d1c15]">Platform Status</span>
            <div className="flex items-center justify-between gap-2">
              <span className="text-[#3f4945]">Smart Suggestions (AI)</span>
              <span
                className={`px-2.5 py-0.5 rounded-full font-semibold ${
                  health?.geminiConfigured
                    ? 'bg-[#a8e8d5] text-[#2b6a5b]'
                    : 'bg-[#f8de91] text-[#4a3800]'
                }`}
              >
                {health?.geminiConfigured ? 'Connected' : 'Pending API Key'}
              </span>
            </div>
            <div className="flex items-center justify-between gap-2">
              <span className="text-[#3f4945]">Supabase Database & Auth</span>
              <span
                className={`px-2.5 py-0.5 rounded-full font-semibold ${
                  health?.supabaseConfigured && health?.supabaseSchemaReady
                    ? 'bg-[#a8e8d5] text-[#2b6a5b]'
                    : 'bg-[#f8de91] text-[#4a3800]'
                }`}
              >
                {health?.supabaseConfigured
                  ? health.supabaseSchemaReady
                    ? 'Auth & RLS Active'
                    : 'Schema Setup Required'
                  : 'Local Server Mode'}
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
