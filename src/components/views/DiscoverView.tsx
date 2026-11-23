import React, { useMemo, useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import {
  EQUIPMENT_CATEGORIES,
  type Equipment,
  type EquipmentCategory,
} from '../../types/lablink';
import { api } from '../../lib/api';
import { CategoryClayIllustration, ClayEquipmentArtwork } from '../clay/ClayEquipmentArtwork';
import {
  ClayTiltCard,
  FloatingClayObject,
  SPRING_TACTILE,
  TactileButton,
  usePrefersReducedMotion,
} from '../motion/MotionPrimitives';

interface DiscoverViewProps {
  equipment: Equipment[];
  onSelectEquipment: (equipmentId: string) => void;
}

const CATEGORY_CARDS: Array<{
  id: 'All' | EquipmentCategory;
  subtitle: string;
  toneBg: string;
}> = [
  { id: 'All', subtitle: 'Browse every campus tool', toneBg: 'bg-[#f8f3e8]' },
  {
    id: 'Electronics & Circuits',
    subtitle: 'Microcontrollers & signals',
    toneBg: 'bg-[#e7f8f3]',
  },
  {
    id: '3D Printing & Making',
    subtitle: 'Printers, lasers & routers',
    toneBg: 'bg-[#fff3d1]',
  },
  { id: 'Robotics', subtitle: 'Arms, rovers & sensors', toneBg: 'bg-[#dff3fd]' },
  {
    id: 'Computers & Software',
    subtitle: 'CAD, AI compute & VR',
    toneBg: 'bg-[#ede6fb]',
  },
  {
    id: 'Testing & Measurement',
    subtitle: 'Meters, calipers & power',
    toneBg: 'bg-[#ffe8ee]',
  },
  {
    id: 'Mechanical Workshop',
    subtitle: 'Lathes, mills & drills',
    toneBg: 'bg-[#e7f8f3]',
  },
];

export const DiscoverView: React.FC<DiscoverViewProps> = ({ equipment, onSelectEquipment }) => {
  const reduced = usePrefersReducedMotion();
  const [search, setSearch] = useState('');
  const [activeCategory, setActiveCategory] = useState<'All' | EquipmentCategory>('All');
  const [onlyAvailable, setOnlyAvailable] = useState(false);

  // Gemini AI Match state
  const [aiLoading, setAiLoading] = useState(false);
  const [aiSummary, setAiSummary] = useState<string | null>(null);
  const [aiError, setAiError] = useState<string | null>(null);
  const [aiScores, setAiScores] = useState<
    Record<string, { score: number; reason: string; slotHint: string }>
  >({});

  const categoryCounts = useMemo(() => {
    const counts: Record<string, number> = { All: equipment.length };
    for (const cat of EQUIPMENT_CATEGORIES) {
      counts[cat] = 0;
    }
    for (const item of equipment) {
      counts[item.category] = (counts[item.category] || 0) + 1;
    }
    return counts;
  }, [equipment]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    const list = equipment.filter((item) => {
      const catOk = activeCategory === 'All' || item.category === activeCategory;
      const availOk = !onlyAvailable || item.status === 'available';
      const queryOk =
        !q ||
        Boolean(aiScores[item.id]) ||
        `${item.name} ${item.shortPurpose} ${item.description} ${item.departmentName} ${item.specsPreview} ${item.category} ${item.locationLabel}`
          .toLowerCase()
          .includes(q);
      return catOk && availOk && queryOk;
    });

    if (Object.keys(aiScores).length > 0) {
      return [...list].sort((a, b) => (aiScores[b.id]?.score || 0) - (aiScores[a.id]?.score || 0));
    }
    return list;
  }, [activeCategory, aiScores, equipment, onlyAvailable, search]);

  const handleAiMatch = async () => {
    const query = search.trim();
    if (!query) {
      setAiError('Type what you need (e.g., "Arduino project", "3D Printer", or "CNC").');
      return;
    }
    setAiLoading(true);
    setAiError(null);
    try {
      const res = await api.aiDiscover(query);
      setAiSummary(res.summary);
      const map: Record<string, { score: number; reason: string; slotHint: string }> = {};
      for (const m of res.matches) {
        map[m.equipmentId] = {
          score: m.matchScore,
          reason: m.reason,
          slotHint: m.recommendedSlotHint,
        };
      }
      setAiScores(map);
    } catch (err) {
      setAiError(err instanceof Error ? err.message : 'Smart suggestions failed.');
    } finally {
      setAiLoading(false);
    }
  };

  const clearAiAndSearch = () => {
    setSearch('');
    setAiScores({});
    setAiSummary(null);
    setAiError(null);
  };

  return (
    <div className="flex flex-col w-full">
      {/* Header & Search Bar */}
      <section className="pt-4 pb-6">
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 mb-6">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-xs font-semibold uppercase tracking-wider text-[#29695a]">
                01. Campus Equipment
              </span>
              <span className="px-2.5 py-0.5 rounded-full bg-[#f8de91] text-[#4a3800] text-[10px] font-semibold">
                Sample Lab Data
              </span>
            </div>
            <h1 className="text-3xl font-bold text-[#1d1c15] mt-1">Find Equipment</h1>
          </div>

          <TactileButton
            variant={onlyAvailable ? 'primary' : 'soft'}
            onClick={() => setOnlyAvailable((prev) => !prev)}
            className="px-4 py-2 text-xs self-start md:self-auto"
          >
            <span
              className={`w-2.5 h-2.5 rounded-full ${
                onlyAvailable ? 'bg-[#29695a]' : 'bg-[#707975]'
              }`}
            />
            <span>Available Now Only</span>
          </TactileButton>
        </div>

        <form
          onSubmit={(e) => {
            e.preventDefault();
            handleAiMatch();
          }}
          className="relative w-full bg-[#ffffff] rounded-full p-2 clay-card flex items-center gap-2 focus-within:ring-2 focus-within:ring-[#a8e8d5] transition-shadow"
        >
          <div className="w-11 h-11 rounded-full bg-[#a8e8d5] flex items-center justify-center shrink-0 text-[#2b6a5b]">
            <span className="material-symbols-outlined text-[22px]">search</span>
          </div>
          <input
            type="text"
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              if (!e.target.value.trim()) {
                setAiScores({});
                setAiSummary(null);
              }
            }}
            placeholder="Search tools like Arduino, 3D Printer, CNC, Multimeter, VR Headset..."
            className="w-full bg-transparent text-sm md:text-base text-[#1d1c15] placeholder:text-[#707975] focus:outline-none px-2 min-w-0"
          />
          {search && (
            <button
              type="button"
              onClick={clearAiAndSearch}
              aria-label="Clear search"
              className="w-9 h-9 rounded-full bg-[#f8f3e8] text-[#3f4945] flex items-center justify-center hover:bg-[#ede8dd] shrink-0 cursor-pointer"
            >
              <span className="material-symbols-outlined text-[18px]">close</span>
            </button>
          )}
          <TactileButton
            type="submit"
            variant="primary"
            loading={aiLoading}
            className="px-5 py-2.5 text-sm"
          >
            <span className="material-symbols-outlined text-[18px]">auto_awesome</span>
            <span>Smart Match</span>
          </TactileButton>
        </form>

        {aiError && (
          <div className="mt-3 rounded-2xl bg-[#ffdad6] text-[#93000a] px-4 py-2.5 text-xs font-medium">
            {aiError}
          </div>
        )}

        {aiSummary && (
          <motion.div
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            className="mt-3 rounded-2xl bg-[#b0e4fd]/60 text-[#001f29] px-4 py-3 text-xs font-medium flex items-center justify-between gap-3"
          >
            <div className="flex items-center gap-2">
              <span className="material-symbols-outlined text-[18px] text-[#2f6579]">
                auto_awesome
              </span>
              <span>{aiSummary}</span>
            </div>
            <button
              type="button"
              onClick={clearAiAndSearch}
              className="underline font-semibold shrink-0 cursor-pointer"
            >
              Reset
            </button>
          </motion.div>
        )}
      </section>

      {/* Interactive Clay Category Cards */}
      <section className="pb-8" aria-label="Equipment categories">
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-7 gap-3">
          {CATEGORY_CARDS.map((cat, idx) => {
            const active = activeCategory === cat.id;
            const count = categoryCounts[cat.id] ?? 0;
            return (
              <motion.button
                key={cat.id}
                type="button"
                whileHover={reduced ? undefined : { y: -3, scale: 1.015 }}
                whileTap={reduced ? undefined : { scale: 0.96 }}
                transition={SPRING_TACTILE}
                onClick={() => setActiveCategory(cat.id)}
                className={`relative rounded-[1.5rem] p-3 text-left flex flex-col gap-2.5 cursor-pointer transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#29695a] ${
                  active
                    ? 'bg-[#a8e8d5] text-[#1c4b40] ring-2 ring-[#29695a] clay-button'
                    : 'bg-[#ffffff] text-[#1d1c15] clay-card hover:bg-[#fef9ee]'
                }`}
              >
                <div className="flex items-center justify-between gap-2 w-full">
                  <motion.div
                    animate={active && !reduced ? { rotate: [0, -6, 6, 0], scale: [1, 1.08, 1] } : undefined}
                    transition={{ duration: 0.45 }}
                    className={`w-12 h-11 rounded-2xl overflow-hidden shrink-0 ${cat.toneBg}`}
                  >
                    <FloatingClayObject amplitude={3} rotateRange={1.2} duration={4.5 + idx * 0.3}>
                      <CategoryClayIllustration category={cat.id} />
                    </FloatingClayObject>
                  </motion.div>

                  <span
                    className={`px-2 py-0.5 rounded-full text-[11px] font-bold tabular-nums ${
                      active ? 'bg-[#ffffff] text-[#29695a]' : 'bg-[#f8f3e8] text-[#3f4945]'
                    }`}
                  >
                    {count}
                  </span>
                </div>

                <div className="min-w-0">
                  <p className="text-xs font-bold leading-snug line-clamp-2">{cat.id}</p>
                  <p
                    className={`text-[10px] mt-0.5 line-clamp-1 ${
                      active ? 'text-[#2b6a5b]' : 'text-[#707975]'
                    }`}
                  >
                    {cat.subtitle}
                  </p>
                </div>
              </motion.button>
            );
          })}
        </div>
      </section>

      {/* Results Grid with Smooth Transitions */}
      <section>
        <div className="flex flex-wrap items-center justify-between gap-2 mb-4">
          <p className="text-xs font-semibold text-[#3f4945] tabular-nums">
            Showing {filtered.length} tool{filtered.length === 1 ? '' : 's'}
            {activeCategory !== 'All' ? ` in ${activeCategory}` : ''}
          </p>
          <span className="text-xs text-[#707975]">
            Sample schedules shown · Ready to connect to Supabase
          </span>
        </div>

        {filtered.length > 0 ? (
          <motion.div
            layout
            className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6"
          >
            <AnimatePresence mode="popLayout">
              {filtered.map((item, idx) => {
                const aiMatch = aiScores[item.id];
                return (
                  <motion.div
                    key={item.id}
                    layout
                    initial={reduced ? { opacity: 1 } : { opacity: 0, y: 16, scale: 0.96 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={reduced ? { opacity: 0 } : { opacity: 0, scale: 0.94 }}
                    transition={{ ...SPRING_TACTILE, delay: Math.min(idx * 0.035, 0.21) }}
                  >
                    <ClayTiltCard
                      onClick={() => onSelectEquipment(item.id)}
                      className="bg-[#ffffff] rounded-[2rem] p-6 clay-card flex flex-col justify-between gap-4 h-full cursor-pointer group"
                    >
                      <div>
                        <div className="relative h-44 w-full rounded-2xl overflow-hidden mb-4">
                          <div className="w-full h-full transition-transform duration-300 group-hover:scale-[1.04]">
                            <ClayEquipmentArtwork theme={item.clayTheme} />
                          </div>
                          <span
                            className={`absolute top-3 right-3 px-3 py-1 rounded-full text-[11px] font-semibold shadow-sm flex items-center gap-1.5 ${
                              item.status === 'available'
                                ? 'bg-[#a8e8d5] text-[#2b6a5b]'
                                : item.status === 'maintenance'
                                  ? 'bg-[#f8de91] text-[#4a3800]'
                                  : 'bg-[#ffd9e0] text-[#673946]'
                            }`}
                          >
                            <span
                              className={`w-2 h-2 rounded-full ${
                                item.status === 'available'
                                  ? 'bg-[#29695a]'
                                  : item.status === 'maintenance'
                                    ? 'bg-[#4a3800]'
                                    : 'bg-[#82505d]'
                              }`}
                            />
                            {item.status === 'available'
                              ? 'Available Now'
                              : item.status === 'maintenance'
                                ? 'Maintenance'
                                : 'In Use'}
                          </span>
                          {aiMatch ? (
                            <span className="absolute top-3 left-3 px-3 py-1 rounded-full bg-[#ffffff]/95 text-[#29695a] text-[11px] font-bold shadow-sm tabular-nums">
                              {aiMatch.score}% Match
                            </span>
                          ) : item.isSampleData !== false ? (
                            <span className="absolute bottom-2.5 left-2.5 px-2.5 py-0.5 rounded-full bg-[#ffffff]/90 text-[#3f4945] text-[10px] font-semibold shadow-sm">
                              Sample Lab Data
                            </span>
                          ) : null}
                        </div>

                        <div className="flex items-center justify-between gap-2 text-xs mb-1.5">
                          <span className="font-semibold text-[#29695a]">{item.category}</span>
                          <span className="text-[#3f4945] truncate">{item.departmentName}</span>
                        </div>

                        <h3 className="text-lg font-semibold text-[#1d1c15] mb-1">{item.name}</h3>

                        <p className="text-xs text-[#3f4945] line-clamp-1 mb-2.5">
                          {item.shortPurpose || item.description}
                        </p>

                        <div className="flex items-center gap-1 text-xs text-[#707975] mb-3">
                          <span className="material-symbols-outlined text-[16px] text-[#29695a]">
                            location_on
                          </span>
                          <span className="truncate">{item.locationLabel}</span>
                        </div>

                        <div className="bg-[#f8f3e8] rounded-2xl p-3 clay-well">
                          <p className="text-[11px] font-semibold text-[#3f4945] mb-0.5">
                            {aiMatch ? 'Why It Fits' : 'Quick Specs'}
                          </p>
                          <p className="text-xs text-[#1d1c15]">
                            {aiMatch ? aiMatch.reason : item.specsPreview}
                          </p>
                        </div>
                      </div>

                      <div className="flex items-center justify-between gap-3 pt-1">
                        <div className="min-w-0">
                          {item.nextSlotLabel && (
                            <>
                              <span className="block text-[11px] text-[#707975]">Next Slot</span>
                              <span className="text-xs font-semibold text-[#1d1c15] truncate block">
                                {aiMatch ? aiMatch.slotHint : item.nextSlotLabel}
                              </span>
                            </>
                          )}
                        </div>
                        <TactileButton
                          variant={item.status === 'available' ? 'primary' : 'soft'}
                          onClick={(e) => {
                            e.stopPropagation();
                            onSelectEquipment(item.id);
                          }}
                          className="px-5 py-2 text-xs"
                        >
                          {item.status === 'available' ? 'Book Now' : 'View Details'}
                        </TactileButton>
                      </div>
                    </ClayTiltCard>
                  </motion.div>
                );
              })}
            </AnimatePresence>
          </motion.div>
        ) : (
          <motion.div
            initial={{ opacity: 0, scale: 0.97 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={SPRING_TACTILE}
            className="flex flex-col items-center justify-center py-14 text-center bg-[#f8f3e8] rounded-[2rem] clay-well px-4"
          >
            <div className="w-16 h-16 rounded-full bg-[#a8e8d5] flex items-center justify-center mb-4 text-[#2b6a5b]">
              <span className="material-symbols-outlined text-[28px]">search_off</span>
            </div>
            <h3 className="text-lg font-semibold text-[#1d1c15] mb-1">
              No matching tools found
            </h3>
            <p className="text-sm text-[#3f4945] mb-4 max-w-md">
              Try a simpler tool name like Arduino, 3D Printer, or Robot, or reset your filters.
            </p>
            <TactileButton
              variant="primary"
              onClick={() => {
                clearAiAndSearch();
                setActiveCategory('All');
                setOnlyAvailable(false);
              }}
              className="px-6 py-2.5 text-sm"
            >
              Reset Filters
            </TactileButton>
          </motion.div>
        )}
      </section>
    </div>
  );
};
