import React, { useState } from 'react';
import { motion } from 'motion/react';
import type {
  Booking,
  Equipment,
  FairSlotConflictCase,
  UserProfile,
} from '../../types/lablink';
import { api } from '../../lib/api';
import {
  ClayTiltCard,
  SPRING_TACTILE,
  TactileButton,
} from '../motion/MotionPrimitives';
import { LabBotMascot } from '../motion/LabBotMascot';

interface FairSlotViewProps {
  conflicts: FairSlotConflictCase[];
  equipment: Equipment[];
  user: UserProfile | null;
  onConflictResolved: (conflict: FairSlotConflictCase, createdBooking?: Booking) => void;
  onNavigate: (route: string, equipmentId?: string) => void;
  onOpenAuth: () => void;
}

export const FairSlotView: React.FC<FairSlotViewProps> = ({
  conflicts,
  equipment,
  user,
  onConflictResolved,
  onNavigate,
  onOpenAuth,
}) => {
  const [activeTab, setActiveTab] = useState<'fairslot' | 'assistant'>('fairslot');
  const [selectedCaseIdx, setSelectedCaseIdx] = useState(0);
  const [selectedAltMap, setSelectedAltMap] = useState<Record<string, string>>({});
  const [analyzing, setAnalyzing] = useState(false);
  const [resolving, setResolving] = useState(false);
  const [aiError, setAiError] = useState<string | null>(null);
  const [actionMsg, setActionMsg] = useState<string | null>(null);
  const [localPatch, setLocalPatch] = useState<
    Record<
      string,
      {
        fairnessScore: number;
        headlineRecommendation: string;
        explanation: string;
        factors: Array<{ title: string; detail: string }>;
      }
    >
  >({});

  // LabBot Assistant state
  const [chatInput, setChatInput] = useState('');
  const [chatLoading, setChatLoading] = useState(false);
  const [chatHistory, setChatHistory] = useState<
    Array<{ role: 'bot' | 'user'; text: string; equipmentIds?: string[] }>
  >([
    {
      role: 'bot',
      text: 'Welcome to Smart Suggestions! Ask me which tools fit your project, what safety training is required, or when equipment is free.',
    },
  ]);

  const activeCase = conflicts[selectedCaseIdx] || conflicts[0];
  const patched = activeCase ? localPatch[activeCase.id] : undefined;
  const selectedAltId = activeCase
    ? selectedAltMap[activeCase.id] || activeCase.selectedAlternativeId || activeCase.alternatives[0]?.id
    : undefined;

  const canApprove = user?.role === 'faculty' || user?.role === 'admin';

  const handleAnalyzeWithGemini = async () => {
    if (!activeCase) return;
    if (!user) {
      onOpenAuth();
      return;
    }
    setAnalyzing(true);
    setAiError(null);
    try {
      const res = await api.aiFairSlotAnalyze(activeCase.id);
      setLocalPatch((prev) => ({
        ...prev,
        [activeCase.id]: {
          fairnessScore: res.fairnessScore,
          headlineRecommendation: res.headlineRecommendation,
          explanation: res.explanation,
          factors: res.factors,
        },
      }));
      if (res.recommendedAlternativeId) {
        setSelectedAltMap((prev) => ({ ...prev, [activeCase.id]: res.recommendedAlternativeId }));
      }
      setActionMsg('Smart suggestion updated. Faculty approval is needed to apply.');
    } catch (err) {
      setAiError(err instanceof Error ? err.message : 'Smart Booking check failed.');
    } finally {
      setAnalyzing(false);
    }
  };

  const handleResolve = async (mode: 'resolved_ai' | 'overridden_faculty') => {
    if (!activeCase) return;
    if (!user) {
      onOpenAuth();
      return;
    }
    if (!canApprove) {
      setAiError(
        'Only Faculty or Admins can approve or change booking conflict plans.',
      );
      return;
    }
    setResolving(true);
    setAiError(null);
    try {
      const res = await api.resolveFairSlot(activeCase.id, mode, selectedAltId);
      onConflictResolved(res.conflict, res.createdBooking);
      setActionMsg(
        mode === 'resolved_ai'
          ? 'Smart Booking plan approved and calendar updated.'
          : 'Faculty manual choice applied and new slot confirmed.',
      );
    } catch (err) {
      setAiError(err instanceof Error ? err.message : 'Could not apply booking update.');
    } finally {
      setResolving(false);
    }
  };

  const handleSendChat = async (e?: React.FormEvent, preset?: string) => {
    e?.preventDefault();
    const prompt = (preset ?? chatInput).trim();
    if (!prompt || chatLoading) return;
    if (!preset) setChatInput('');
    setChatHistory((prev) => [...prev, { role: 'user', text: prompt }]);
    setChatLoading(true);
    try {
      const history = chatHistory
        .slice(-6)
        .map((m) => ({ role: (m.role === 'bot' ? 'assistant' : 'user') as 'assistant' | 'user', text: m.text }));
      const res = await api.aiAssistant(prompt, history);
      setChatHistory((prev) => [
        ...prev,
        {
          role: 'bot',
          text: `${res.answer}${res.safetyNote ? ` — Safety: ${res.safetyNote}` : ''}`,
          equipmentIds: res.suggestedEquipmentIds,
        },
      ]);
    } catch (err) {
      setChatHistory((prev) => [
        ...prev,
        { role: 'bot', text: err instanceof Error ? err.message : 'AI assistant error.' },
      ]);
    } finally {
      setChatLoading(false);
    }
  };

  const score = patched?.fairnessScore ?? activeCase?.fairnessScore ?? 96;
  const dashOffset = 94.2 - (score / 100) * 94.2;

  return (
    <div className="flex flex-col w-full gap-6">
      {/* Mode Switcher */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="inline-flex items-center gap-1 p-1.5 rounded-full bg-[#f8f3e8] clay-well">
          <button
            type="button"
            onClick={() => setActiveTab('fairslot')}
            className={`px-5 py-2 rounded-full text-xs font-semibold transition-all cursor-pointer ${
              activeTab === 'fairslot'
                ? 'bg-[#ffffff] text-[#1d1c15] shadow-sm'
                : 'text-[#3f4945] hover:text-[#1d1c15]'
            }`}
          >
            Booking Conflicts ({conflicts.length})
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('assistant')}
            className={`px-5 py-2 rounded-full text-xs font-semibold transition-all cursor-pointer ${
              activeTab === 'assistant'
                ? 'bg-[#ffffff] text-[#1d1c15] shadow-sm'
                : 'text-[#3f4945] hover:text-[#1d1c15]'
            }`}
          >
            Smart Suggestions
          </button>
        </div>

        {activeTab === 'fairslot' && conflicts.length > 1 && (
          <div className="flex items-center gap-2">
            {conflicts.map((c, idx) => (
              <button
                key={c.id}
                type="button"
                onClick={() => setSelectedCaseIdx(idx)}
                className={`px-3.5 py-1.5 rounded-full text-xs font-semibold cursor-pointer ${
                  idx === selectedCaseIdx
                    ? 'bg-[#a8e8d5] text-[#2b6a5b]'
                    : 'bg-[#ffffff] text-[#3f4945]'
                }`}
              >
                {c.caseCode}
              </button>
            ))}
          </div>
        )}
      </div>

      {activeTab === 'fairslot' && activeCase ? (
        <div className="flex flex-col gap-8">
          {/* Top Context & Conflict Overview */}
          <section className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 bg-[#ffffff] rounded-[2rem] p-6 clay-card">
            <div className="flex flex-col gap-1.5 min-w-0">
              <div className="flex flex-wrap items-center gap-2.5">
                <span
                  className={`inline-flex items-center gap-1.5 px-3.5 py-1 rounded-full text-xs font-semibold ${
                    activeCase.status === 'open'
                      ? 'bg-[#ffcfd9] text-[#84515e]'
                      : 'bg-[#a8e8d5] text-[#2b6a5b]'
                  }`}
                >
                  <span className="material-symbols-outlined text-[15px]">
                    {activeCase.status === 'open' ? 'warning' : 'check_circle'}
                  </span>
                  <span>
                    {activeCase.status === 'open'
                      ? 'Booking Conflict'
                      : activeCase.status === 'resolved_ai'
                        ? 'Resolved (Smart Plan)'
                        : 'Faculty Chosen'}
                  </span>
                </span>
                <span className="text-xs font-semibold text-[#3f4945] tabular-nums">
                  {activeCase.caseCode} · {activeCase.date},{' '}
                  {String(activeCase.conflictStartHour).padStart(2, '0')}:00 –{' '}
                  {String(activeCase.conflictEndHour).padStart(2, '0')}:00
                </span>
              </div>
              <h1 className="text-2xl md:text-3xl font-bold text-[#1d1c15] truncate">
                {activeCase.equipmentName} — {activeCase.bayLabel}
              </h1>
              <p className="text-sm text-[#3f4945]">
                Two overlapping requests need review. Faculty make the final approval decision.
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-2.5 shrink-0">
              <TactileButton
                variant="soft"
                loading={analyzing}
                onClick={handleAnalyzeWithGemini}
                className="px-4 py-2.5 text-xs"
              >
                <span className="material-symbols-outlined text-[17px] text-[#2f6579]">
                  psychology
                </span>
                <span>Refresh Smart Plan</span>
              </TactileButton>

              <TactileButton
                variant="ghost"
                disabled={resolving || activeCase.status !== 'open'}
                onClick={() => handleResolve('overridden_faculty')}
                className="px-4 py-2.5 text-xs"
              >
                Choose Manually
              </TactileButton>

              <TactileButton
                variant="primary"
                loading={resolving}
                disabled={activeCase.status !== 'open'}
                onClick={() => handleResolve('resolved_ai')}
                className="px-5 py-2.5 text-xs"
              >
                <span className="material-symbols-outlined text-[18px]">auto_awesome</span>
                <span>
                  {activeCase.status === 'open'
                    ? 'Approve Smart Plan'
                    : 'Conflict Resolved'}
                </span>
              </TactileButton>
            </div>
          </section>

          {aiError && (
            <div className="rounded-2xl bg-[#ffdad6] text-[#93000a] px-4 py-3 text-xs font-semibold">
              {aiError}
            </div>
          )}

          {actionMsg && (
            <div className="rounded-2xl bg-[#a8e8d5]/70 text-[#2b6a5b] px-4 py-3 text-xs font-semibold">
              {actionMsg}
            </div>
          )}

          {/* Main Bento Grid */}
          <section className="grid grid-cols-1 xl:grid-cols-12 gap-6 items-stretch">
            {/* Left Column: Two Overlapping Student Requests */}
            <div className="xl:col-span-5 flex flex-col gap-6">
              {activeCase.candidates.map((cand) => (
                <ClayTiltCard
                  key={cand.bookingId}
                  tiltMax={4}
                  className="bg-[#ffffff] rounded-[2rem] p-6 clay-card flex flex-col gap-4"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-3 min-w-0">
                      <div
                        className={`w-12 h-12 rounded-full flex items-center justify-center font-bold shrink-0 ${
                          cand.recommended
                            ? 'bg-[#a8e8d5] text-[#2b6a5b]'
                            : 'bg-[#b0e4fd] text-[#32677c]'
                        }`}
                      >
                        {cand.studentInitials}
                      </div>
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <h3 className="text-lg font-semibold text-[#1d1c15] truncate">
                            {cand.studentName}
                          </h3>
                          <span
                            className={`px-2.5 py-0.5 rounded-full text-[11px] font-semibold ${
                              cand.recommended
                                ? 'bg-[#a8e8d5] text-[#2b6a5b]'
                                : 'bg-[#b0e4fd] text-[#32677c]'
                            }`}
                          >
                            {cand.recommended ? 'Recommended' : 'Reassignable'}
                          </span>
                        </div>
                        <p className="text-xs text-[#3f4945] truncate">{cand.studentTitle}</p>
                      </div>
                    </div>

                    <span
                      className={`inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-semibold shrink-0 tabular-nums ${
                        cand.hoursUntilDeadline <= 24
                          ? 'bg-[#ffcfd9] text-[#84515e]'
                          : 'bg-[#b0e4fd] text-[#32677c]'
                      }`}
                    >
                      <span className="material-symbols-outlined text-[15px]">schedule</span>
                      <span>
                        {cand.hoursUntilDeadline <= 24
                          ? `${cand.hoursUntilDeadline}h left`
                          : `${Math.round(cand.hoursUntilDeadline / 24)}d left`}
                      </span>
                    </span>
                  </div>

                  <div className="bg-[#f8f3e8] rounded-2xl p-4 clay-well flex flex-col gap-1">
                    <span className="text-[11px] font-semibold uppercase tracking-wider text-[#3f4945]">
                      Project & Deadline
                    </span>
                    <p className="text-sm font-semibold text-[#1d1c15]">{cand.projectTitle}</p>
                    <p className="text-xs text-[#3f4945]">{cand.deadlineDescription}</p>
                  </div>

                  <div className="grid grid-cols-3 gap-2.5 tabular-nums">
                    <div className="bg-[#f8f3e8] rounded-2xl p-3 flex flex-col">
                      <span className="text-[11px] text-[#3f4945]">Priority</span>
                      <span
                        className={`text-lg font-bold ${
                          cand.recommended ? 'text-[#29695a]' : 'text-[#2f6579]'
                        }`}
                      >
                        {cand.priorityScore}
                        <span className="text-xs font-normal text-[#3f4945]">/100</span>
                      </span>
                    </div>
                    <div className="bg-[#f8f3e8] rounded-2xl p-3 flex flex-col">
                      <span className="text-[11px] text-[#3f4945]">Weekly Quota</span>
                      <span className="text-lg font-bold text-[#1d1c15]">
                        {cand.weeklyUsedHours.toFixed(1)}
                        <span className="text-xs font-normal text-[#3f4945]">
                          h / {cand.weeklyQuotaHours}h
                        </span>
                      </span>
                    </div>
                    <div className="bg-[#f8f3e8] rounded-2xl p-3 flex flex-col">
                      <span className="text-[11px] text-[#3f4945]">Requested</span>
                      <span className="text-lg font-bold text-[#1d1c15]">
                        {String(cand.requestedStartHour).padStart(2, '0')}:00
                      </span>
                    </div>
                  </div>

                  {cand.scoreBreakdown && (
                    <div className="flex flex-wrap gap-1.5 text-[10px] font-semibold tabular-nums">
                      <span className="px-2.5 py-0.5 rounded-full bg-[#a8e8d5]/45 text-[#2b6a5b]">
                        Deadline {cand.scoreBreakdown.deadlineScore}/28
                      </span>
                      <span className="px-2.5 py-0.5 rounded-full bg-[#b0e4fd]/55 text-[#32677c]">
                        Fairness {cand.scoreBreakdown.fairnessScore}/22
                      </span>
                      <span className="px-2.5 py-0.5 rounded-full bg-[#f8f3e8] text-[#3f4945]">
                        Safety {cand.scoreBreakdown.compatibilityScore}/18
                      </span>
                      <span className="px-2.5 py-0.5 rounded-full bg-[#f8f3e8] text-[#3f4945]">
                        Fit {cand.scoreBreakdown.availabilityScore}/16
                      </span>
                      <span className="px-2.5 py-0.5 rounded-full bg-[#f8f3e8] text-[#3f4945]">
                        Project {cand.scoreBreakdown.requirementScore}/16
                      </span>
                    </div>
                  )}
                </ClayTiltCard>
              ))}
            </div>

            {/* Right Column: Prominent Baby-Blue FairSlot AI Recommendation Panel */}
            <div className="xl:col-span-7 bg-[#b0e4fd] rounded-[2rem] p-6 md:p-8 clay-card flex flex-col justify-between gap-6">
              <div className="flex flex-col md:flex-row items-center gap-6">
                <div className="w-44 h-44 md:w-48 md:h-48 rounded-[2rem] bg-[#ffffff]/90 p-3 shrink-0 clay-card flex items-center justify-center">
                  <LabBotMascot
                    size="md"
                    thinking={analyzing}
                    showSpeechBubble={false}
                    onMascotClick={handleAnalyzeWithGemini}
                  />
                </div>

                <div className="flex flex-col gap-3 flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-2 flex-wrap">
                    <span className="inline-flex items-center gap-1.5 px-3.5 py-1 rounded-full bg-[#ffffff] text-[#32677c] text-xs font-semibold shadow-sm">
                      <span className="material-symbols-outlined text-[16px]">smart_toy</span>
                      <span>Smart Booking Plan</span>
                    </span>

                    <div className="flex items-center gap-1.5 bg-[#ffffff]/85 px-3.5 py-1 rounded-full">
                      <svg className="w-7 h-7 -rotate-90 text-[#29695a]" viewBox="0 0 36 36">
                        <circle
                          cx="18"
                          cy="18"
                          fill="none"
                          r="15"
                          stroke="currentColor"
                          strokeOpacity="0.2"
                          strokeWidth="4"
                        />
                        <circle
                          cx="18"
                          cy="18"
                          fill="none"
                          r="15"
                          stroke="currentColor"
                          strokeDasharray="94.2"
                          strokeDashoffset={dashOffset}
                          strokeLinecap="round"
                          strokeWidth="4"
                        />
                      </svg>
                      <span className="text-sm font-bold text-[#1d1c15] tabular-nums">
                        {score}% Fair
                      </span>
                    </div>
                  </div>

                  <h2 className="text-2xl font-bold text-[#001f29] leading-snug">
                    {patched?.headlineRecommendation || activeCase.headlineRecommendation}
                  </h2>

                  <p className="text-sm text-[#114d61] leading-relaxed">
                    {patched?.explanation || activeCase.explanation}
                  </p>
                </div>
              </div>

              {/* 3 Explainable Decision Factors */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {(patched?.factors || activeCase.factors).slice(0, 3).map((factor, idx) => {
                  const defaultFactor = activeCase.factors[idx];
                  const icon = defaultFactor?.icon || 'auto_awesome';
                  const toneColor =
                    idx === 0
                      ? 'text-[#29695a]'
                      : idx === 1
                        ? 'text-[#2f6579]'
                        : 'text-[#82505d]';
                  return (
                    <div
                      key={factor.title}
                      className="bg-[#ffffff]/92 rounded-2xl p-4 clay-button-soft flex flex-col gap-1.5"
                    >
                      <div className={`flex items-center gap-1.5 ${toneColor}`}>
                        <span className="material-symbols-outlined text-[18px]">{icon}</span>
                        <span className="text-xs font-semibold">{factor.title}</span>
                      </div>
                      <p className="text-xs text-[#3f4945] leading-relaxed">{factor.detail}</p>
                    </div>
                  );
                })}
              </div>
            </div>
          </section>

          {/* Equipment Availability Timeline */}
          <section className="bg-[#ffffff] rounded-[2rem] p-6 clay-card flex flex-col gap-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <div>
                <span className="text-[11px] font-semibold uppercase tracking-wider text-[#3f4945]">
                  Available Now Schedule
                </span>
                <h3 className="text-xl font-bold text-[#1d1c15]">
                  {activeCase.equipmentName} — {activeCase.date}
                </h3>
              </div>
              <div className="flex flex-wrap items-center gap-4 text-xs font-semibold text-[#3f4945]">
                <span className="inline-flex items-center gap-1.5">
                  <span className="w-3 h-3 rounded-full bg-[#ede8dd]" /> Booked
                </span>
                <span className="inline-flex items-center gap-1.5">
                  <span className="w-3 h-3 rounded-full bg-[#ffcfd9]" /> Conflict
                </span>
                <span className="inline-flex items-center gap-1.5">
                  <span className="w-3 h-3 rounded-full bg-[#a8e8d5]" /> AI Suggested
                </span>
              </div>
            </div>

            <div className="bg-[#f8f3e8] rounded-2xl p-4 clay-well flex flex-col gap-2">
              <div className="grid grid-cols-6 gap-2 text-center text-[11px] font-semibold text-[#3f4945] tabular-nums">
                {activeCase.timelineBlocks.map((b) => (
                  <span key={b.hourLabel}>{b.hourLabel}</span>
                ))}
              </div>
              <div className="grid grid-cols-6 gap-2 h-14">
                {activeCase.timelineBlocks.map((b) => {
                  const blockClass =
                    b.kind === 'conflict'
                      ? 'bg-[#ffcfd9] text-[#84515e]'
                      : b.kind === 'ai_suggested'
                        ? 'bg-[#a8e8d5] text-[#2b6a5b]'
                        : b.kind === 'booked'
                          ? 'bg-[#ede8dd] text-[#3f4945]'
                          : 'bg-[#ffffff] text-[#3f4945]';
                  return (
                    <div
                      key={b.hourLabel}
                      className={`${blockClass} rounded-2xl flex items-center justify-center px-2 shadow-sm`}
                    >
                      <span className="text-[11px] font-semibold truncate">{b.label}</span>
                    </div>
                  );
                })}
              </div>
            </div>
          </section>

          {/* Alternative Slot Comparison */}
          <section className="flex flex-col gap-4">
            <div>
              <span className="text-[11px] font-semibold uppercase tracking-wider text-[#3f4945]">
                Alternative Slot Comparison
              </span>
              <h3 className="text-xl font-bold text-[#1d1c15]">
                Recommended Feasible Options for {activeCase.candidates[1]?.studentName}
              </h3>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {activeCase.alternatives.map((alt) => {
                const isSelected = selectedAltId === alt.id;
                return (
                  <motion.div
                    key={alt.id}
                    whileHover={{ y: -3 }}
                    transition={SPRING_TACTILE}
                    onClick={() =>
                      setSelectedAltMap((prev) => ({ ...prev, [activeCase.id]: alt.id }))
                    }
                    className={`bg-[#ffffff] rounded-[2rem] p-6 clay-card flex flex-col justify-between gap-4 cursor-pointer transition-all ${
                      isSelected ? 'ring-2 ring-[#29695a]' : ''
                    }`}
                  >
                    <div className="flex flex-col gap-2">
                      <div className="flex items-center justify-between gap-2">
                        <span
                          className={`px-3 py-1 rounded-full text-[11px] font-semibold ${
                            isSelected
                              ? 'bg-[#a8e8d5] text-[#2b6a5b]'
                              : 'bg-[#b0e4fd] text-[#32677c]'
                          }`}
                        >
                          {alt.badge}
                        </span>
                        <span className="text-xs font-bold text-[#29695a] tabular-nums">
                          {alt.score}% Score
                        </span>
                      </div>
                      <h4 className="text-lg font-semibold text-[#1d1c15] tabular-nums">
                        {alt.timeLabel}
                      </h4>
                      <p className="text-xs text-[#3f4945]">
                        {alt.equipmentName} · {alt.bayLabel}
                      </p>
                      <p className="text-xs text-[#1d1c15] leading-relaxed">{alt.rationale}</p>
                    </div>

                    <TactileButton
                      variant={isSelected ? 'primary' : 'ghost'}
                      onClick={(e) => {
                        e.stopPropagation();
                        setSelectedAltMap((prev) => ({ ...prev, [activeCase.id]: alt.id }));
                      }}
                      className="w-full py-2.5 text-xs"
                    >
                      {isSelected ? 'Selected Alternative' : 'Choose This Slot'}
                    </TactileButton>
                  </motion.div>
                );
              })}
            </div>
          </section>
        </div>
      ) : activeTab === 'fairslot' ? (
        <div className="bg-[#ffffff] rounded-[2rem] p-10 clay-card text-center flex flex-col items-center gap-4">
          <LabBotMascot size="md" showSpeechBubble={false} />
          <h2 className="text-2xl font-bold text-[#1d1c15]">No Active Booking Conflicts</h2>
          <p className="text-sm text-[#3f4945] max-w-md">
            When two students request overlapping time slots and choose Smart Booking arbitration,
            the fair-allocation breakdown and conflict-free alternatives appear here.
          </p>
          <div className="flex flex-wrap gap-2">
            <TactileButton
              variant="primary"
              onClick={() => onNavigate('discover')}
              className="px-5 py-2.5 text-xs"
            >
              Find Equipment
            </TactileButton>
            <TactileButton
              variant="soft"
              onClick={() => setActiveTab('assistant')}
              className="px-5 py-2.5 text-xs"
            >
              Ask Smart Suggestions
            </TactileButton>
          </div>
        </div>
      ) : (
        /* LabBot AI Research Assistant Workspace */
        <section className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          <div className="lg:col-span-4 bg-[#b0e4fd] rounded-[2rem] p-6 clay-card flex flex-col items-center text-center gap-4">
            <LabBotMascot
              size="lg"
              thinking={chatLoading}
              customGreeting={chatLoading ? 'Searching campus catalog...' : 'Ask about any instrument!'}
            />
            <p className="text-sm text-[#114d61] leading-relaxed">
              Powered by Google Gemini on the server. Ask for instrument specs, training rules, or
              protocol matching across all campus labs.
            </p>
            <div className="flex flex-col gap-2 w-full">
              {[
                'Is the Arduino Starter Kit or ESP32 Board free today?',
                'What safety training do I need for the CNC Machine?',
                'Suggest tools for building a mobile robot',
              ].map((preset) => (
                <button
                  key={preset}
                  type="button"
                  onClick={() => handleSendChat(undefined, preset)}
                  className="text-left text-xs px-4 py-2.5 rounded-2xl bg-[#ffffff]/90 hover:bg-[#ffffff] text-[#1d1c15] font-medium transition-colors cursor-pointer"
                >
                  {preset}
                </button>
              ))}
            </div>
          </div>

          <div className="lg:col-span-8 bg-[#ffffff] rounded-[2rem] p-6 clay-card flex flex-col gap-4 min-h-[460px]">
            <div className="flex-1 flex flex-col gap-3 overflow-y-auto max-h-[420px] pr-1">
              {chatHistory.map((msg, idx) => (
                <div
                  key={idx}
                  className={`p-4 rounded-2xl text-sm max-w-[85%] ${
                    msg.role === 'bot'
                      ? 'bg-[#f8f3e8] text-[#1d1c15] self-start'
                      : 'bg-[#a8e8d5] text-[#2b6a5b] self-end font-medium'
                  }`}
                >
                  <p className="leading-relaxed">{msg.text}</p>
                  {msg.equipmentIds && msg.equipmentIds.length > 0 && (
                    <div className="flex flex-wrap gap-2 mt-2.5">
                      {msg.equipmentIds.map((eqId) => {
                        const eq = equipment.find((item) => item.id === eqId);
                        if (!eq) return null;
                        return (
                          <button
                            key={eq.id}
                            type="button"
                            onClick={() => onNavigate('equipment-detail', eq.id)}
                            className="px-3 py-1 rounded-full bg-[#ffffff] text-[#29695a] text-xs font-semibold shadow-sm hover:brightness-95 cursor-pointer"
                          >
                            Book {eq.name} →
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>
              ))}
            </div>

            <form
              onSubmit={(e) => handleSendChat(e)}
              className="flex items-center gap-2 bg-[#f8f3e8] rounded-full p-2 pl-4 clay-well"
            >
              <input
                type="text"
                value={chatInput}
                onChange={(e) => setChatInput(e.target.value)}
                placeholder="Describe your experiment or ask a lab safety question..."
                className="flex-1 bg-transparent text-sm text-[#1d1c15] focus:outline-none"
              />
              <TactileButton
                type="submit"
                variant="primary"
                loading={chatLoading}
                className="px-5 py-2 text-xs"
              >
                Ask LabBot
              </TactileButton>
            </form>
          </div>
        </section>
      )}
    </div>
  );
};
