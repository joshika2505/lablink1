import React, { useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import {
  EQUIPMENT_CATEGORIES,
  type Department,
  type Equipment,
  type EquipmentCategory,
} from '../../types/lablink';
import { api } from '../../lib/api';
import { ClayEquipmentArtwork } from '../clay/ClayEquipmentArtwork';
import {
  ClayTiltCard,
  CursorParallaxLayer,
  FloatingClayObject,
  MagneticElement,
  ScrollReveal,
  SPRING_TACTILE,
  TactileButton,
  useCursorParallax,
} from '../motion/MotionPrimitives';
import { ParallaxHeroStage } from '../motion/ParallaxHeroStage';

interface LandingPageProps {
  equipment: Equipment[];
  departments: Department[];
  onEnterWorkspace: (targetRoute?: string, equipmentId?: string) => void;
  onOpenAuth: () => void;
  onOpenAdminLogin: () => void;
  accessDeniedNotice?: string | null;
  onDismissNotice?: () => void;
}

export const LandingPage: React.FC<LandingPageProps> = ({
  equipment,
  departments,
  onEnterWorkspace,
  onOpenAuth,
  onOpenAdminLogin,
  accessDeniedNotice,
  onDismissNotice,
}) => {
  const [filter, setFilter] = useState<'all' | EquipmentCategory>('all');
  const [aiQuery, setAiQuery] = useState('Arduino PCB testing or 3D printing...');
  const [aiLoading, setAiLoading] = useState(false);
  const [aiSummary, setAiSummary] = useState<string | null>(null);
  const [aiMatchName, setAiMatchName] = useState<string>('Arduino Starter Kit');
  const [aiMatchScore, setAiMatchScore] = useState<number>(98);
  const [aiError, setAiError] = useState<string | null>(null);

  const {
    smoothX,
    smoothY,
    handlePointerMove: handleHeroPointerMove,
    handlePointerLeave: handleHeroPointerLeave,
  } = useCursorParallax();

  const previewCards = equipment
    .filter((item) => (filter === 'all' ? true : item.category === filter))
    .slice(0, 3);

  const handleRunAiMatch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!aiQuery.trim()) return;
    setAiLoading(true);
    setAiError(null);
    try {
      const res = await api.aiDiscover(aiQuery);
      setAiSummary(res.summary);
      if (res.matches?.[0]) {
        const matched = equipment.find((eq) => eq.id === res.matches[0].equipmentId);
        if (matched) setAiMatchName(matched.name);
        setAiMatchScore(res.matches[0].matchScore);
      }
    } catch (err) {
      setAiError(err instanceof Error ? err.message : 'Smart suggestions are unavailable right now.');
    } finally {
      setAiLoading(false);
    }
  };

  return (
    <div className="min-h-screen w-full bg-[#fef9ee] text-[#1d1c15] overflow-x-hidden flex flex-col">
      {/* Floating Claymorphic Navigation Bar */}
      <header className="w-full max-w-[1360px] mx-auto px-4 md:px-8 py-4 sticky top-0 z-40">
        <nav className="bg-[#ffffff]/90 backdrop-blur-md rounded-full px-5 md:px-6 py-3 clay-card flex items-center justify-between gap-4">
          <button
            type="button"
            onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
            className="flex items-center gap-2.5 shrink-0 cursor-pointer group"
          >
            <div className="w-9 h-9 rounded-2xl bg-[#a8e8d5] flex items-center justify-center text-[#29695a] shadow-inner group-hover:scale-105 transition-transform">
              <span className="material-symbols-outlined text-[20px]">science</span>
            </div>
            <span className="font-bold text-lg tracking-tight text-[#1d1c15]">LabLink</span>
          </button>

          <div className="hidden lg:flex items-center gap-1.5 bg-[#f8f3e8]/80 p-1 rounded-full">
            {[
              { href: '#equipment', label: 'Find Equipment' },
              { href: '#departments', label: 'Explore Labs' },
              { href: '#how-it-works', label: 'How It Works' },
              { href: '#ai-matching', label: 'Smart Suggestions' },
            ].map((item) => (
              <MagneticElement key={item.href} strength={0.14}>
                <a
                  href={item.href}
                  className="px-4 py-1.5 rounded-full text-sm font-semibold text-[#3f4945] hover:bg-[#ffffff] hover:text-[#1d1c15] hover:shadow-sm transition-all whitespace-nowrap block"
                >
                  {item.label}
                </a>
              </MagneticElement>
            ))}
          </div>

          <div className="flex items-center gap-2.5 shrink-0">
            <TactileButton
              variant="ghost"
              onClick={onOpenAuth}
              className="hidden sm:inline-flex px-5 py-2 text-sm"
            >
              Sign In
            </TactileButton>
            <TactileButton
              variant="primary"
              onClick={() => onEnterWorkspace('dashboard')}
              className="px-5 py-2 text-sm"
            >
              Get Started
            </TactileButton>
          </div>
        </nav>
      </header>

      {accessDeniedNotice && (
        <div className="w-full max-w-[1360px] mx-auto px-4 md:px-8 pt-2">
          <div className="rounded-2xl bg-[#ffd9e0] text-[#673946] px-5 py-3 text-xs font-semibold flex items-center justify-between gap-3 clay-button-soft">
            <span>{accessDeniedNotice}</span>
            {onDismissNotice && (
              <button
                type="button"
                onClick={onDismissNotice}
                className="underline cursor-pointer shrink-0"
              >
                Dismiss
              </button>
            )}
          </div>
        </div>
      )}

      {/* Hero Section with Cursor-Reactive Multi-Layer Background & Parallax Diorama */}
      <section
        onPointerMove={handleHeroPointerMove}
        onPointerLeave={handleHeroPointerLeave}
        className="relative w-full overflow-hidden"
      >
        {/* Decorative Cursor-Reactive Pastel Lab Shapes Layer (subtle, opposite depth) */}
        <div aria-hidden="true" className="absolute inset-0 pointer-events-none overflow-hidden">
          <CursorParallaxLayer
            smoothX={smoothX}
            smoothY={smoothY}
            depth={26}
            className="hidden md:block absolute top-8 left-[4%]"
          >
            <FloatingClayObject amplitude={7} rotateRange={4} duration={5.6}>
              <div className="w-14 h-14 rounded-[1.25rem] bg-[#a8e8d5]/55 clay-button-soft flex items-center justify-center text-[#29695a]">
                <span className="material-symbols-outlined text-[24px]">memory</span>
              </div>
            </FloatingClayObject>
          </CursorParallaxLayer>

          <CursorParallaxLayer
            smoothX={smoothX}
            smoothY={smoothY}
            depth={18}
            opposite={false}
            className="hidden md:block absolute bottom-10 left-[8%]"
          >
            <FloatingClayObject amplitude={6} rotateRange={3} duration={6.2} delay={0.4}>
              <div className="w-12 h-12 rounded-full bg-[#f8de91]/65 clay-button-soft flex items-center justify-center text-[#4a3800]">
                <span className="material-symbols-outlined text-[20px]">bolt</span>
              </div>
            </FloatingClayObject>
          </CursorParallaxLayer>

          <CursorParallaxLayer
            smoothX={smoothX}
            smoothY={smoothY}
            depth={22}
            className="hidden lg:block absolute top-14 left-[44%]"
          >
            <FloatingClayObject amplitude={5} rotateRange={5} duration={5.0} delay={0.2}>
              <div className="w-11 h-11 rounded-2xl bg-[#ffcfd9]/60 clay-button-soft flex items-center justify-center text-[#84515e]">
                <span className="material-symbols-outlined text-[19px]">precision_manufacturing</span>
              </div>
            </FloatingClayObject>
          </CursorParallaxLayer>

          <CursorParallaxLayer
            smoothX={smoothX}
            smoothY={smoothY}
            depth={30}
            opposite={false}
            className="hidden lg:block absolute bottom-8 right-[4%]"
          >
            <FloatingClayObject amplitude={8} rotateRange={3} duration={5.8} delay={0.5}>
              <div className="w-14 h-14 rounded-[1.25rem] bg-[#d9c8f2]/60 clay-button-soft flex items-center justify-center text-[#3f3159]">
                <span className="material-symbols-outlined text-[24px]">view_in_ar</span>
              </div>
            </FloatingClayObject>
          </CursorParallaxLayer>
        </div>

        <div className="relative z-10 w-full max-w-[1360px] mx-auto px-4 md:px-8 pt-6 pb-16 lg:pt-10 lg:pb-24">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-12 items-center">
            <motion.div
              initial={{ opacity: 0, y: 18 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.55, ease: [0.16, 1, 0.3, 1] }}
              className="lg:col-span-6 flex flex-col items-start gap-6"
            >
              <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-[#b0e4fd] text-[#32677c] text-xs font-semibold clay-button-soft">
                <span className="material-symbols-outlined text-base">science</span>
                <span>Campus Lab Sharing</span>
              </div>

              <h1 className="text-4xl sm:text-5xl font-bold leading-[1.12] tracking-tight text-[#1d1c15]">
                Big ideas start in the right lab.
              </h1>

              <p className="text-base sm:text-lg text-[#3f4945] max-w-xl leading-relaxed">
                Find lab tools, check open times, and book equipment across campus in minutes.
              </p>

              <div className="flex flex-wrap items-center gap-4 pt-1">
                <MagneticElement>
                  <TactileButton
                    variant="primary"
                    onClick={() => onEnterWorkspace('discover')}
                    className="px-7 py-3.5 text-sm"
                  >
                    <span>Find Equipment</span>
                    <span className="material-symbols-outlined text-lg">arrow_forward</span>
                  </TactileButton>
                </MagneticElement>
                <MagneticElement>
                  <a
                    href="#how-it-works"
                    className="inline-flex items-center gap-2 px-7 py-3.5 rounded-full bg-[#ffffff] text-[#1d1c15] text-sm font-semibold clay-button-soft hover:-translate-y-0.5 transition-transform"
                  >
                    <span className="material-symbols-outlined text-lg text-[#29695a]">
                      play_circle
                    </span>
                    <span>How LabLink Works</span>
                  </a>
                </MagneticElement>
              </div>

              {/* Quick Trust Metrics */}
              <div className="grid grid-cols-3 gap-4 pt-3 w-full max-w-md">
                {[
                  { val: `${equipment.length || 18}`, label: 'Lab Tools', color: 'text-[#29695a]' },
                  { val: '6', label: 'Categories', color: 'text-[#2f6579]' },
                  { val: '24/7', label: 'Smart Booking', color: 'text-[#82505d]' },
                ].map((stat) => (
                  <motion.div
                    key={stat.label}
                    whileHover={{ y: -3 }}
                    transition={SPRING_TACTILE}
                    className="bg-[#ffffff] rounded-[1.5rem] p-4 clay-card"
                  >
                    <div className={`text-2xl font-bold tabular-nums ${stat.color}`}>{stat.val}</div>
                    <div className="text-xs text-[#3f4945] mt-0.5">{stat.label}</div>
                  </motion.div>
                ))}
              </div>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, scale: 0.96 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.6, delay: 0.1, ease: [0.16, 1, 0.3, 1] }}
              className="lg:col-span-6"
            >
              <ParallaxHeroStage onInteract={() => onEnterWorkspace('ai-assistant')} />
            </motion.div>
          </div>
        </div>
      </section>

      {/* Find Equipment Preview Cards */}
      <section id="equipment" className="w-full max-w-[1360px] mx-auto px-4 md:px-8 py-12 lg:py-16">
        <ScrollReveal>
          <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 mb-10">
            <div className="flex flex-col gap-1.5">
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-xs font-semibold uppercase tracking-wider text-[#29695a]">
                  01. Find Equipment
                </span>
                <span className="px-2.5 py-0.5 rounded-full bg-[#f8de91] text-[#4a3800] text-[10px] font-semibold">
                  Sample Lab Data
                </span>
              </div>
              <h2 className="text-3xl font-bold text-[#1d1c15]">Tools ready to book today</h2>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              {(['all', ...EQUIPMENT_CATEGORIES] as const).map((cat) => {
                const active = filter === cat;
                const label = cat === 'all' ? 'All Tools' : cat;
                return (
                  <button
                    key={cat}
                    type="button"
                    onClick={() => setFilter(cat)}
                    className={`relative px-3.5 py-2 rounded-full text-xs font-semibold transition-colors cursor-pointer whitespace-nowrap ${
                      active
                        ? 'text-[#2b6a5b]'
                        : 'bg-[#ffffff] text-[#1d1c15] clay-button-soft hover:bg-[#f8f3e8]'
                    }`}
                  >
                    {active && (
                      <motion.span
                        layoutId="landing-filter-pill"
                        transition={SPRING_TACTILE}
                        className="absolute inset-0 rounded-full bg-[#a8e8d5] clay-button-soft -z-0"
                      />
                    )}
                    <span className="relative z-10">{label}</span>
                  </button>
                );
              })}
            </div>
          </div>
        </ScrollReveal>

        <motion.div layout className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          <AnimatePresence mode="popLayout">
            {previewCards.map((item, idx) => (
              <motion.div
                key={item.id}
                layout
                initial={{ opacity: 0, y: 18, scale: 0.96 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, scale: 0.94 }}
                transition={{ ...SPRING_TACTILE, delay: idx * 0.05 }}
              >
                <ClayTiltCard
                  onClick={() => onEnterWorkspace('equipment-detail', item.id)}
                  className="bg-[#ffffff] rounded-[2rem] p-6 clay-card flex flex-col justify-between gap-4 h-full cursor-pointer group"
                >
                  <div className="flex flex-col gap-3.5">
                    <div className="relative h-40 w-full rounded-2xl overflow-hidden">
                      <div className="w-full h-full transition-transform duration-300 group-hover:scale-[1.04]">
                        <ClayEquipmentArtwork theme={item.clayTheme} />
                      </div>
                      <span
                        className={`absolute top-3 right-3 px-3 py-1 rounded-full text-[11px] font-semibold shadow-sm inline-flex items-center gap-1.5 ${
                          item.status === 'available'
                            ? 'bg-[#a8e8d5] text-[#2b6a5b]'
                            : 'bg-[#ffd9e0] text-[#673946]'
                        }`}
                      >
                        <span
                          className={`w-2 h-2 rounded-full ${
                            item.status === 'available' ? 'bg-[#29695a]' : 'bg-[#82505d]'
                          }`}
                        />
                        {item.status === 'available' ? 'Available Now' : 'In Use'}
                      </span>
                    </div>

                    <div className="flex items-center justify-between gap-2 text-xs font-semibold">
                      <span className="text-[#29695a]">{item.category}</span>
                      <span className="text-[#3f4945] truncate">{item.departmentName}</span>
                    </div>

                    <div>
                      <h3 className="text-lg font-semibold text-[#1d1c15] truncate">{item.name}</h3>
                      <p className="text-xs text-[#3f4945] mt-1 line-clamp-1">{item.shortPurpose}</p>
                    </div>

                    <p className="text-xs text-[#707975] truncate">{item.locationLabel}</p>
                  </div>

                  <div className="flex items-center justify-between pt-2 border-t border-[#f2ede2]">
                    <span className="text-xs font-semibold text-[#3f4945] tabular-nums truncate">
                      Next slot: {item.nextSlotLabel}
                    </span>
                    <TactileButton
                      variant={item.status === 'available' ? 'primary' : 'soft'}
                      onClick={(e) => {
                        e.stopPropagation();
                        onEnterWorkspace('equipment-detail', item.id);
                      }}
                      className="px-4 py-2 text-xs"
                    >
                      {item.status === 'available' ? 'Book Now' : 'View Details'}
                    </TactileButton>
                  </div>
                </ClayTiltCard>
              </motion.div>
            ))}
          </AnimatePresence>
        </motion.div>
      </section>

      {/* Explore Labs by Department */}
      <section id="departments" className="w-full max-w-[1360px] mx-auto px-4 md:px-8 py-12 lg:py-16">
        <ScrollReveal>
          <div className="bg-[#f8f3e8] rounded-[3rem] p-8 md:p-12 clay-card">
            <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 mb-10">
              <div className="flex flex-col gap-1.5">
                <span className="text-xs font-semibold uppercase tracking-wider text-[#2f6579]">
                  02. Explore Labs
                </span>
                <h2 className="text-3xl font-bold text-[#1d1c15]">
                  Departments across campus
                </h2>
              </div>
              <p className="text-sm text-[#3f4945] max-w-md">
                Use shared labs across electronics, robotics, computing, and workshops.
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
              {departments.map((dept) => {
                const badgeBg =
                  dept.accentColor === 'mint'
                    ? 'bg-[#a8e8d5] text-[#2b6a5b]'
                    : dept.accentColor === 'blue'
                      ? 'bg-[#b0e4fd] text-[#32677c]'
                      : dept.accentColor === 'pink'
                        ? 'bg-[#ffcfd9] text-[#84515e]'
                        : 'bg-[#f8de91] text-[#4a3800]';
                return (
                  <ClayTiltCard
                    key={dept.id}
                    tiltMax={5}
                    onClick={() => onEnterWorkspace('lab-map')}
                    className="bg-[#ffffff] rounded-[2rem] p-6 clay-card flex flex-col gap-3 cursor-pointer"
                  >
                    <div className={`w-11 h-11 rounded-full flex items-center justify-center ${badgeBg}`}>
                      <span className="material-symbols-outlined">{dept.icon}</span>
                    </div>
                    <h3 className="text-lg font-semibold text-[#1d1c15]">{dept.name}</h3>
                    <p className="text-xs text-[#3f4945] tabular-nums">
                      {dept.instrumentCount} tools · {dept.uptimePercent}% working
                    </p>
                  </ClayTiltCard>
                );
              })}
            </div>
          </div>
        </ScrollReveal>
      </section>

      {/* How It Works */}
      <section id="how-it-works" className="w-full max-w-[1360px] mx-auto px-4 md:px-8 py-12 lg:py-16">
        <ScrollReveal>
          <div className="text-center max-w-2xl mx-auto mb-12 flex flex-col gap-2">
            <span className="text-xs font-semibold uppercase tracking-wider text-[#29695a]">
              03. How It Works
            </span>
            <h2 className="text-3xl font-bold text-[#1d1c15]">Book a lab in three easy steps</h2>
          </div>
        </ScrollReveal>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          {[
            {
              step: 1,
              title: 'Tell us what you need',
              desc: 'Search by tool name or describe your project to get Smart Suggestions.',
              badge: 'bg-[#a8e8d5] text-[#2b6a5b]',
            },
            {
              step: 2,
              title: 'Pick an open time',
              desc: 'See when equipment is free, check safety training rules, and pick a time slot.',
              badge: 'bg-[#b0e4fd] text-[#32677c]',
            },
            {
              step: 3,
              title: 'Start your work',
              desc: 'Track your booking status and get quick faculty approval when required.',
              badge: 'bg-[#ffcfd9] text-[#84515e]',
            },
          ].map((item, idx) => (
            <ScrollReveal key={item.step} delay={idx * 0.08}>
              <ClayTiltCard
                tiltMax={4}
                className="bg-[#ffffff] rounded-[2rem] p-8 clay-card flex flex-col gap-4 h-full"
              >
                <div
                  className={`w-12 h-12 rounded-full font-bold text-lg flex items-center justify-center shadow-sm ${item.badge}`}
                >
                  {item.step}
                </div>
                <h3 className="text-xl font-semibold text-[#1d1c15]">{item.title}</h3>
                <p className="text-sm text-[#3f4945] leading-relaxed">{item.desc}</p>
              </ClayTiltCard>
            </ScrollReveal>
          ))}
        </div>
      </section>

      {/* Smart Suggestions & Smart Booking */}
      <section id="ai-matching" className="w-full max-w-[1360px] mx-auto px-4 md:px-8 py-12 lg:py-16">
        <ScrollReveal>
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-stretch">
            <div className="lg:col-span-7 bg-[#ffffff] rounded-[2.5rem] p-8 md:p-10 clay-card flex flex-col justify-between gap-6">
              <div className="flex flex-col gap-4">
                <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-[#a8e8d5] text-[#2b6a5b] text-xs font-semibold w-fit">
                  <span className="material-symbols-outlined text-base">auto_awesome</span>
                  <span>Smart Suggestions</span>
                </div>
                <h2 className="text-2xl font-bold text-[#1d1c15]">
                  Not sure which tool fits your project?
                </h2>
                <p className="text-sm text-[#3f4945]">
                  Describe what you are making or testing. LabLink matches your project with the
                  right campus tools.
                </p>
              </div>

              <form
                onSubmit={handleRunAiMatch}
                className="bg-[#f8f3e8] rounded-[2rem] p-5 clay-well flex flex-col gap-4"
              >
                <div className="flex items-center gap-2 bg-[#ffffff] rounded-full px-4 py-2 clay-well">
                  <span className="material-symbols-outlined text-[#29695a] text-[20px]">search</span>
                  <input
                    type="text"
                    value={aiQuery}
                    onChange={(e) => setAiQuery(e.target.value)}
                    placeholder="Example: Arduino PCB testing or 3D Printing..."
                    className="flex-1 bg-transparent text-sm text-[#1d1c15] focus:outline-none min-w-0"
                  />
                  <TactileButton
                    type="submit"
                    variant="primary"
                    loading={aiLoading}
                    className="px-4 py-1.5 text-xs"
                  >
                    Match
                  </TactileButton>
                </div>

                {aiError && <p className="text-xs text-[#93000a] font-medium px-2">{aiError}</p>}

                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div className="flex items-center gap-2">
                    <span className="px-3 py-1 rounded-full bg-[#b0e4fd] text-[#32677c] text-xs font-semibold tabular-nums">
                      {aiMatchScore}% Match
                    </span>
                    <span className="text-sm font-semibold text-[#1d1c15]">{aiMatchName}</span>
                  </div>
                  <button
                    type="button"
                    onClick={() => onEnterWorkspace('discover')}
                    className="text-xs text-[#29695a] font-semibold hover:underline cursor-pointer"
                  >
                    Find Equipment →
                  </button>
                </div>

                {aiSummary && <p className="text-xs text-[#3f4945] leading-relaxed">{aiSummary}</p>}
              </form>
            </div>

            <div className="lg:col-span-5 bg-[#a8e8d5] rounded-[2.5rem] p-8 md:p-10 clay-card flex flex-col justify-between gap-6 text-[#2b6a5b]">
              <div className="flex flex-col gap-3">
                <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-[#ffffff] text-[#1d1c15] text-xs font-semibold w-fit shadow-sm">
                  <span className="material-symbols-outlined text-base text-[#29695a]">
                    calendar_month
                  </span>
                  <span>Smart Booking</span>
                </div>
                <h2 className="text-2xl font-bold">Fair, conflict-free lab calendars</h2>
                <p className="text-sm opacity-90">
                  No double-bookings. If two students need the same slot, Smart Booking helps find
                  a fair alternative.
                </p>
              </div>

              <div className="bg-[#ffffff] rounded-[2rem] p-5 shadow-md text-[#1d1c15]">
                <div className="flex items-center justify-between mb-4">
                  <span className="text-sm font-semibold">November 2026</span>
                  <span className="px-2.5 py-1 rounded-full bg-[#b0e4fd] text-[#32677c] text-xs font-semibold">
                    3 Slots Free
                  </span>
                </div>
                <div className="grid grid-cols-7 gap-2 text-center text-[11px] font-semibold text-[#3f4945] mb-2">
                  <span>M</span>
                  <span>T</span>
                  <span>W</span>
                  <span>T</span>
                  <span>F</span>
                  <span>S</span>
                  <span>S</span>
                </div>
                <div className="grid grid-cols-7 gap-2 text-center text-xs font-semibold tabular-nums">
                  <span className="py-1.5 rounded-full text-[#707975]">23</span>
                  <span className="py-1.5 rounded-full bg-[#a8e8d5] text-[#2b6a5b] shadow-sm">24</span>
                  <span className="py-1.5 rounded-full bg-[#b0e4fd] text-[#32677c]">25</span>
                  <span className="py-1.5 rounded-full bg-[#b0e4fd] text-[#32677c]">26</span>
                  <span className="py-1.5 rounded-full hover:bg-[#f8f3e8] cursor-pointer">27</span>
                  <span className="py-1.5 rounded-full text-[#707975]">28</span>
                  <span className="py-1.5 rounded-full text-[#707975]">29</span>
                </div>
              </div>
            </div>
          </div>
        </ScrollReveal>
      </section>

      {/* Final CTA Banner */}
      <section className="w-full max-w-[1360px] mx-auto px-4 md:px-8 pt-4 pb-16">
        <ScrollReveal>
          <div className="bg-[#b0e4fd] rounded-[3rem] p-10 md:p-14 clay-card text-center flex flex-col items-center gap-5">
            <h2 className="text-3xl font-bold text-[#001f29] max-w-2xl">
              Ready to book your next lab session?
            </h2>
            <p className="text-base text-[#114d61] max-w-xl">
              Sign in with your university email to browse available equipment and book a time slot.
            </p>
            <div className="flex flex-wrap items-center justify-center gap-4 pt-2">
              <TactileButton
                variant="primary"
                onClick={() => onEnterWorkspace('dashboard')}
                className="px-8 py-3.5 text-sm"
              >
                Student Workspace
              </TactileButton>
              <TactileButton
                variant="soft"
                onClick={() => onEnterWorkspace('approvals')}
                className="px-8 py-3.5 text-sm"
              >
                Faculty Sign In
              </TactileButton>
            </div>
          </div>
        </ScrollReveal>
      </section>

      {/* Website Footer with Discreet Admin Login Link at the Very Bottom */}
      <footer className="w-full border-t border-[#e7e2d7] bg-[#f8f3e8]/60 mt-auto">
        <div className="w-full max-w-[1360px] mx-auto px-4 md:px-8 py-10 flex flex-col gap-6">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-6">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-xl bg-[#a8e8d5] flex items-center justify-center text-[#29695a]">
                <span className="material-symbols-outlined text-[18px]">science</span>
              </div>
              <div>
                <span className="font-bold text-sm text-[#1d1c15] block">LabLink</span>
                <span className="text-xs text-[#3f4945]">Campus Lab Sharing Platform</span>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-5 text-xs font-semibold text-[#3f4945]">
              <button
                type="button"
                onClick={() => onEnterWorkspace('discover')}
                className="hover:text-[#1d1c15] cursor-pointer"
              >
                Find Equipment
              </button>
              <button
                type="button"
                onClick={() => onEnterWorkspace('lab-map')}
                className="hover:text-[#1d1c15] cursor-pointer"
              >
                Explore Labs
              </button>
              <button
                type="button"
                onClick={() => onEnterWorkspace('projects')}
                className="hover:text-[#1d1c15] cursor-pointer"
              >
                Project Access
              </button>
              <button
                type="button"
                onClick={onOpenAuth}
                className="hover:text-[#1d1c15] cursor-pointer"
              >
                Sign In
              </button>
            </div>
          </div>

          <div className="pt-4 border-t border-[#e7e2d7]/80 flex flex-col sm:flex-row items-center justify-between gap-3 text-[11px] text-[#707975]">
            <span>© 2026 LabLink University Lab Network</span>
            <button
              type="button"
              onClick={onOpenAdminLogin}
              className="text-[11px] text-[#707975] hover:text-[#3f4945] underline-offset-2 hover:underline cursor-pointer"
            >
              Admin Login
            </button>
          </div>
        </div>
      </footer>
    </div>
  );
};
