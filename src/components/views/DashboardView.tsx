import React, { useState } from 'react';
import { motion } from 'motion/react';
import type {
  Booking,
  Equipment,
  ResearchProject,
  UserProfile,
} from '../../types/lablink';
import { api } from '../../lib/api';
import {
  ClayTiltCard,
  ScrollReveal,
  SPRING_TACTILE,
  TactileButton,
} from '../motion/MotionPrimitives';
import { LabBotMascot } from '../motion/LabBotMascot';

interface DashboardViewProps {
  user: UserProfile;
  equipment: Equipment[];
  projects: ResearchProject[];
  bookings: Booking[];
  onNavigate: (route: string, equipmentId?: string) => void;
}

export const DashboardView: React.FC<DashboardViewProps> = ({
  user,
  equipment,
  projects,
  bookings,
  onNavigate,
}) => {
  const [aiInput, setAiInput] = useState('');
  const [aiThinking, setAiThinking] = useState(false);
  const [aiReply, setAiReply] = useState<string | null>(null);
  const [aiError, setAiError] = useState<string | null>(null);
  const [aiSuggestedIds, setAiSuggestedIds] = useState<string[]>([]);
  const [selectedCalIso, setSelectedCalIso] = useState(() => new Date().toISOString().slice(0, 10));

  const upcomingCalendarDays = Array.from({ length: 14 }, (_, idx) => {
    const d = new Date();
    d.setDate(d.getDate() + idx);
    return {
      iso: d.toISOString().slice(0, 10),
      dayNum: d.getDate(),
      monthLabel: d.toLocaleDateString('en-US', { month: 'short', year: 'numeric' }),
    };
  });

  const availableCount = equipment.filter((e) => e.status === 'available').length;
  const activeBookings = bookings.filter(
    (b) => (b.userId === user.id || user.role !== 'student') && b.status === 'confirmed',
  );
  const pendingBookings = bookings.filter((b) =>
    user.role === 'student' ? b.userId === user.id && b.status === 'pending' : b.status === 'pending',
  );

  const handleAskAssistant = async (e?: React.FormEvent, overridePrompt?: string) => {
    e?.preventDefault();
    const prompt = (overridePrompt ?? aiInput).trim();
    if (!prompt || aiThinking) return;
    if (overridePrompt) setAiInput(overridePrompt);
    setAiThinking(true);
    setAiError(null);
    try {
      const res = await api.aiAssistant(prompt);
      setAiReply(`${res.answer} ${res.safetyNote ? `Safety tip: ${res.safetyNote}` : ''}`);
      setAiSuggestedIds(res.suggestedEquipmentIds || []);
    } catch (err) {
      setAiError(err instanceof Error ? err.message : 'Unable to reach Smart Suggestions.');
    } finally {
      setAiThinking(false);
    }
  };

  const firstName = user.name.split(' ')[0];

  return (
    <div className="flex flex-col w-full gap-8">
      {/* Greeting Hero */}
      <motion.section
        initial={{ opacity: 0, y: 14 }}
        animate={{ opacity: 1, y: 0 }}
        transition={SPRING_TACTILE}
        className="relative overflow-hidden bg-[#ffffff] rounded-[2rem] p-6 md:p-10 clay-card mt-2"
      >
        <div className="absolute -top-24 -right-24 w-72 h-72 rounded-full bg-[#a8e8d5]/30 blur-3xl pointer-events-none" />
        <div className="absolute -bottom-24 left-1/3 w-64 h-64 rounded-full bg-[#b0e4fd]/30 blur-3xl pointer-events-none" />

        <div className="relative z-10 flex flex-col md:flex-row items-center justify-between gap-6">
          <div className="flex flex-col items-start gap-4 max-w-2xl">
            <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-[#f8f3e8] clay-well">
              <span className="w-2 h-2 rounded-full bg-[#29695a]" />
              <span className="text-[11px] font-semibold uppercase tracking-wider text-[#3f4945]">
                Spring Semester · {user.department}
              </span>
            </div>

            <h1 className="text-3xl md:text-4xl font-bold text-[#1d1c15] leading-tight">
              Hello, {firstName}! Ready to book a lab?
            </h1>

            <p className="text-base text-[#3f4945]">
              Find available tools, check your bookings, or get Smart Suggestions for your next
              project.
            </p>

            <div className="flex flex-wrap items-center gap-3 pt-1">
              <TactileButton
                variant="primary"
                onClick={() => onNavigate('discover')}
                className="px-6 py-3 text-sm"
              >
                <span className="material-symbols-outlined text-[20px]">explore</span>
                <span>Find Equipment</span>
              </TactileButton>
              <TactileButton
                variant="soft"
                onClick={() => onNavigate('equipment-detail', equipment[0]?.id)}
                className="px-6 py-3 text-sm"
              >
                <span className="material-symbols-outlined text-[20px]">add_circle</span>
                <span>Book Now</span>
              </TactileButton>
            </div>
          </div>

          <div className="relative flex-shrink-0 flex items-center justify-center">
            <div className="w-48 h-48 md:w-56 md:h-56 rounded-full bg-[#f8f3e8]/85 clay-well flex items-center justify-center p-4">
              <LabBotMascot
                size="lg"
                thinking={aiThinking}
                showSpeechBubble={false}
                onMascotClick={() => onNavigate('ai-assistant')}
              />
            </div>
          </div>
        </div>
      </motion.section>

      {/* 3 Live KPI Clay Cards */}
      <section className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <ClayTiltCard
          tiltMax={4}
          onClick={() => onNavigate('discover')}
          className="bg-[#ffffff] rounded-[2rem] p-6 clay-card flex items-center justify-between gap-4 cursor-pointer"
        >
          <div className="flex flex-col gap-1 min-w-0">
            <span className="text-xs font-semibold uppercase tracking-wider text-[#3f4945]">
              Available Now
            </span>
            <div className="flex items-baseline gap-2.5">
              <span className="text-4xl font-bold text-[#1d1c15] tabular-nums">
                {availableCount}
              </span>
              <span className="px-2.5 py-0.5 rounded-full bg-[#a8e8d5] text-[#2b6a5b] text-[11px] font-semibold">
                Ready today
              </span>
            </div>
            <span className="text-xs text-[#3f4945] truncate">
              Out of {equipment.length} campus tools
            </span>
          </div>
          <div className="w-16 h-16 rounded-full bg-[#a8e8d5]/35 flex items-center justify-center flex-shrink-0 text-[#29695a]">
            <svg className="w-12 h-12 -rotate-90" viewBox="0 0 36 36" aria-hidden="true">
              <circle
                cx="18"
                cy="18"
                fill="none"
                r="15"
                stroke="currentColor"
                strokeOpacity="0.2"
                strokeWidth="3.5"
              />
              <circle
                cx="18"
                cy="18"
                fill="none"
                r="15"
                stroke="currentColor"
                strokeDasharray="94.2"
                strokeDashoffset={94.2 - (availableCount / Math.max(1, equipment.length)) * 94.2}
                strokeLinecap="round"
                strokeWidth="3.5"
              />
            </svg>
          </div>
        </ClayTiltCard>

        <ClayTiltCard
          tiltMax={4}
          onClick={() => onNavigate('my-reservations')}
          className="bg-[#ffffff] rounded-[2rem] p-6 clay-card flex items-center justify-between gap-4 cursor-pointer"
        >
          <div className="flex flex-col gap-1 min-w-0">
            <span className="text-xs font-semibold uppercase tracking-wider text-[#3f4945]">
              Confirmed Bookings
            </span>
            <div className="flex items-baseline gap-2.5">
              <span className="text-4xl font-bold text-[#1d1c15] tabular-nums">
                {activeBookings.length}
              </span>
              <span className="px-2.5 py-0.5 rounded-full bg-[#b0e4fd] text-[#32677c] text-[11px] font-semibold">
                Upcoming
              </span>
            </div>
            <span className="text-xs text-[#3f4945] truncate">
              {activeBookings[0]?.equipmentName || 'No active bookings'}
            </span>
          </div>
          <div className="w-16 h-16 rounded-full bg-[#b0e4fd]/50 flex items-center justify-center flex-shrink-0 text-[#2f6579]">
            <span className="material-symbols-outlined text-[28px]">calendar_month</span>
          </div>
        </ClayTiltCard>

        <ClayTiltCard
          tiltMax={4}
          onClick={() => onNavigate(user.role === 'student' ? 'my-reservations' : 'approvals')}
          className="bg-[#ffffff] rounded-[2rem] p-6 clay-card flex items-center justify-between gap-4 cursor-pointer"
        >
          <div className="flex flex-col gap-1 min-w-0">
            <span className="text-xs font-semibold uppercase tracking-wider text-[#3f4945]">
              Waiting for Approval
            </span>
            <div className="flex items-baseline gap-2.5">
              <span className="text-4xl font-bold text-[#1d1c15] tabular-nums">
                {pendingBookings.length}
              </span>
              <span className="px-2.5 py-0.5 rounded-full bg-[#ffcfd9] text-[#84515e] text-[11px] font-semibold">
                In review
              </span>
            </div>
            <span className="text-xs text-[#3f4945] truncate">
              {user.role === 'student' ? 'Waiting for faculty sign-off' : 'Requests to review'}
            </span>
          </div>
          <div className="w-16 h-16 rounded-full bg-[#ffcfd9]/60 flex items-center justify-center flex-shrink-0 text-[#82505d]">
            <span className="material-symbols-outlined text-[28px]">verified</span>
          </div>
        </ClayTiltCard>
      </section>

      {/* Main 12-Col Bento Split */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        <div className="lg:col-span-8 flex flex-col gap-8">
          {/* My Projects Pastel Cards */}
          <ScrollReveal>
            <section className="flex flex-col gap-4">
              <div className="flex items-center justify-between">
                <div>
                  <span className="text-xs font-semibold uppercase tracking-wider text-[#3f4945]">
                    01. Project Access
                  </span>
                  <h2 className="text-2xl font-bold text-[#1d1c15]">My Projects</h2>
                </div>
                <TactileButton
                  variant="soft"
                  onClick={() => onNavigate('projects')}
                  className="px-4 py-1.5 text-xs"
                >
                  <span>View All</span>
                  <span className="material-symbols-outlined text-[16px]">arrow_forward</span>
                </TactileButton>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                {projects.length === 0 ? (
                  <div className="md:col-span-3 bg-[#ffffff] rounded-[2rem] p-6 clay-card flex flex-wrap items-center justify-between gap-4">
                    <div>
                      <p className="text-base font-bold text-[#1d1c15]">No projects yet</p>
                      <p className="text-xs text-[#3f4945]">
                        Create a project to match instruments and request lab access.
                      </p>
                    </div>
                    <TactileButton
                      variant="primary"
                      onClick={() => onNavigate('projects')}
                      className="px-5 py-2 text-xs"
                    >
                      Add Project
                    </TactileButton>
                  </div>
                ) : (
                  projects.slice(0, 3).map((proj) => {
                    const bgClass =
                      proj.tone === 'mint'
                        ? 'bg-[#a8e8d5] text-[#2b6a5b]'
                        : proj.tone === 'blue'
                          ? 'bg-[#b0e4fd] text-[#32677c]'
                          : 'bg-[#ffcfd9] text-[#84515e]';
                    const barClass =
                      proj.tone === 'mint'
                        ? 'bg-[#29695a]'
                        : proj.tone === 'blue'
                          ? 'bg-[#2f6579]'
                          : 'bg-[#82505d]';
                    return (
                      <ClayTiltCard
                        key={proj.id}
                        tiltMax={5}
                        onClick={() => onNavigate('projects')}
                        className={`${bgClass} rounded-[2rem] p-6 clay-card flex flex-col justify-between gap-6 cursor-pointer`}
                      >
                        <div className="flex items-start justify-between gap-2">
                          <span className="px-2.5 py-0.5 rounded-full bg-[#ffffff]/75 text-[11px] font-semibold">
                            {proj.category}
                          </span>
                          <span className="material-symbols-outlined text-[20px]">{proj.icon}</span>
                        </div>
                        <div className="flex flex-col gap-1">
                          <h3 className="text-lg font-semibold">{proj.title}</h3>
                          <p className="text-xs opacity-85 line-clamp-2">{proj.description}</p>
                        </div>
                        <div className="flex flex-col gap-1.5">
                          <div className="flex items-center justify-between text-[11px] font-semibold tabular-nums">
                            <span>Progress</span>
                            <span>{proj.progress}%</span>
                          </div>
                          <div className="w-full h-2 rounded-full bg-[#ffffff]/60 overflow-hidden">
                            <div
                              className={`h-full rounded-full ${barClass}`}
                              style={{ width: `${proj.progress}%` }}
                            />
                          </div>
                        </div>
                      </ClayTiltCard>
                    );
                  })
                )}
              </div>
            </section>
          </ScrollReveal>

          {/* Recent Activity Log */}
          <ScrollReveal delay={0.08}>
            <section className="bg-[#f8f3e8] rounded-[2rem] p-6 clay-card flex flex-col gap-4">
              <div className="flex items-center justify-between">
                <div>
                  <span className="text-xs font-semibold uppercase tracking-wider text-[#3f4945]">
                    02. Recent Activity
                  </span>
                  <h2 className="text-2xl font-bold text-[#1d1c15]">Latest Bookings</h2>
                </div>
                <TactileButton
                  variant="soft"
                  onClick={() => onNavigate('my-reservations')}
                  className="px-3.5 py-1 text-[11px]"
                >
                  Manage Bookings
                </TactileButton>
              </div>

              <div className="flex flex-col gap-3">
                {bookings.length === 0 ? (
                  <p className="text-xs text-[#3f4945] bg-[#ffffff] rounded-2xl p-4">
                    No bookings recorded yet. Pick an instrument in Find Equipment to reserve a slot.
                  </p>
                ) : (
                  bookings.slice(0, 4).map((bk) => {
                  const iconBg =
                    bk.status === 'confirmed'
                      ? 'bg-[#a8e8d5] text-[#2b6a5b]'
                      : bk.status === 'pending'
                        ? 'bg-[#f8de91] text-[#4a3800]'
                        : 'bg-[#ffcfd9] text-[#84515e]';
                  const statusText =
                    bk.status === 'pending'
                      ? 'Waiting for Approval'
                      : bk.status === 'alternative_suggested'
                        ? 'New Time Suggested'
                        : bk.status;
                  return (
                    <div
                      key={bk.id}
                      onClick={() => onNavigate('equipment-detail', bk.equipmentId)}
                      className="flex items-start gap-4 p-4 rounded-2xl bg-[#ffffff] clay-button-soft hover:-translate-y-0.5 transition-transform cursor-pointer"
                    >
                      <div
                        className={`w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 ${iconBg}`}
                      >
                        <span className="material-symbols-outlined text-[20px]">
                          {bk.status === 'confirmed'
                            ? 'check_circle'
                            : bk.status === 'pending'
                              ? 'schedule'
                              : 'info'}
                        </span>
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between gap-2">
                          <p className="text-sm font-semibold text-[#1d1c15] truncate">
                            {bk.equipmentName} — {statusText}
                          </p>
                          <span className="text-xs text-[#3f4945] flex-shrink-0 tabular-nums">
                            {bk.date}
                          </span>
                        </div>
                        <p className="text-xs text-[#3f4945] truncate mt-0.5">
                          {bk.userName} · {String(bk.startHour).padStart(2, '0')}:00 –{' '}
                          {String(bk.startHour + bk.durationHours).padStart(2, '0')}:00 ·{' '}
                          {bk.projectTitle}
                        </p>
                      </div>
                    </div>
                  );
                })
                )}
              </div>
            </section>
          </ScrollReveal>
        </div>

        {/* Right Column: Smart Suggestions & Calendar */}
        <div className="lg:col-span-4 flex flex-col gap-8">
          <section className="bg-[#bce9ff] text-[#001f29] rounded-[2rem] p-6 clay-card flex flex-col gap-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-[#ffffff] text-[#2f6579] flex items-center justify-center shadow-sm">
                <span className="material-symbols-outlined text-[22px]">smart_toy</span>
              </div>
              <div>
                <span className="text-[11px] font-semibold uppercase tracking-wider opacity-75">
                  Smart Suggestions
                </span>
                <h2 className="text-lg font-semibold leading-snug">
                  What are you building today?
                </h2>
              </div>
            </div>

            <div className="flex flex-wrap gap-1.5">
              {[
                'Which 3D printer is free today?',
                'Safety training for CNC Machine',
                'Suggest tools for Arduino & PCB',
              ].map((chip) => (
                <button
                  key={chip}
                  type="button"
                  onClick={() => handleAskAssistant(undefined, chip)}
                  className="px-3 py-1 rounded-full bg-[#ffffff]/80 text-[#1d1c15] text-[11px] font-semibold hover:bg-[#ffffff] transition-colors cursor-pointer"
                >
                  {chip}
                </button>
              ))}
            </div>

            <form
              onSubmit={(e) => handleAskAssistant(e)}
              className="flex items-center gap-1.5 bg-[#ffffff] rounded-full p-1.5 pl-4 clay-well"
            >
              <input
                type="text"
                value={aiInput}
                onChange={(e) => setAiInput(e.target.value)}
                placeholder="Ask LabBot..."
                className="flex-1 min-w-0 bg-transparent text-sm text-[#1d1c15] placeholder:text-[#3f4945] focus:outline-none"
              />
              <TactileButton
                type="submit"
                variant="primary"
                loading={aiThinking}
                className="w-9 h-9 p-0"
                aria-label="Send question"
              >
                <span className="material-symbols-outlined text-[18px]">arrow_upward</span>
              </TactileButton>
            </form>

            {aiError && (
              <p className="text-xs bg-[#ffdad6] text-[#93000a] rounded-2xl p-3 font-medium">
                {aiError}
              </p>
            )}

            {aiReply && (
              <div className="text-xs bg-[#ffffff]/85 rounded-2xl p-3.5 text-[#1d1c15] flex flex-col gap-2">
                <p className="leading-relaxed">{aiReply}</p>
                {aiSuggestedIds.length > 0 && (
                  <div className="flex flex-wrap gap-1.5 pt-1">
                    {aiSuggestedIds.map((eqId) => {
                      const eq = equipment.find((item) => item.id === eqId);
                      if (!eq) return null;
                      return (
                        <button
                          key={eq.id}
                          type="button"
                          onClick={() => onNavigate('equipment-detail', eq.id)}
                          className="px-2.5 py-1 rounded-full bg-[#a8e8d5] text-[#2b6a5b] text-[11px] font-semibold hover:brightness-95 cursor-pointer"
                        >
                          View Details: {eq.name} →
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
            )}
          </section>

          {/* Upcoming Bookings Calendar Widget */}
          <section className="bg-[#ffffff] rounded-[2rem] p-6 clay-card flex flex-col gap-4">
            <div className="flex items-center justify-between">
              <div>
                <span className="text-[11px] font-semibold uppercase tracking-wider text-[#3f4945]">
                  Schedule
                </span>
                <h2 className="text-xl font-bold text-[#1d1c15]">Upcoming Bookings</h2>
              </div>
              <span className="text-xs font-semibold text-[#29695a]">
                {upcomingCalendarDays[0]?.monthLabel}
              </span>
            </div>

            <div className="grid grid-cols-7 gap-1 text-center text-xs font-semibold tabular-nums">
              {upcomingCalendarDays.map((day) => {
                const isSelected = day.iso === selectedCalIso;
                const hasBooking = bookings.some(
                  (b) => b.date === day.iso && (b.status === 'confirmed' || b.status === 'pending'),
                );
                return (
                  <button
                    key={day.iso}
                    type="button"
                    onClick={() => setSelectedCalIso(day.iso)}
                    className={`h-8 rounded-full transition-colors cursor-pointer ${
                      isSelected
                        ? 'bg-[#a8e8d5] text-[#2b6a5b] shadow-sm'
                        : hasBooking
                          ? 'bg-[#b0e4fd] text-[#32677c]'
                          : 'hover:bg-[#f8f3e8] text-[#1d1c15]'
                    }`}
                  >
                    {day.dayNum}
                  </button>
                );
              })}
            </div>

            <div className="flex flex-col gap-2.5 pt-1">
              {activeBookings.slice(0, 2).map((bk, idx) => (
                <div
                  key={bk.id}
                  onClick={() => onNavigate('equipment-detail', bk.equipmentId)}
                  className={`p-3.5 rounded-2xl flex items-center justify-between gap-2 cursor-pointer ${
                    idx === 0 ? 'bg-[#a8e8d5]/35' : 'bg-[#b0e4fd]/35'
                  }`}
                >
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-[#1d1c15] truncate">
                      {bk.equipmentName}
                    </p>
                    <p className="text-xs text-[#3f4945] tabular-nums">
                      {bk.date} · {String(bk.startHour).padStart(2, '0')}:00 –{' '}
                      {String(bk.startHour + bk.durationHours).padStart(2, '0')}:00
                    </p>
                  </div>
                  <span
                    className={`px-2.5 py-0.5 rounded-full text-[11px] font-semibold flex-shrink-0 ${
                      idx === 0
                        ? 'bg-[#a8e8d5] text-[#2b6a5b]'
                        : 'bg-[#b0e4fd] text-[#32677c]'
                    }`}
                  >
                    Confirmed
                  </span>
                </div>
              ))}
            </div>
          </section>
        </div>
      </div>
    </div>
  );
};
