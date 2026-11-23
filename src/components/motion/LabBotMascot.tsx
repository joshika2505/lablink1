import React, { useEffect, useRef, useState } from 'react';
import { AnimatePresence, motion, useMotionValue, useSpring } from 'motion/react';
import { SPRING_TACTILE, usePrefersReducedMotion } from './MotionPrimitives';

interface LabBotMascotProps {
  size?: 'sm' | 'md' | 'lg';
  thinking?: boolean;
  customGreeting?: string;
  showSpeechBubble?: boolean;
  onMascotClick?: () => void;
  className?: string;
}

const GREETINGS = [
  'Ready to book lab equipment?',
  'Ask me to match your project!',
  'Smart Booking keeps slots fair.',
  'Safety training synced!',
];

export const LabBotMascot: React.FC<LabBotMascotProps> = ({
  size = 'md',
  thinking = false,
  customGreeting,
  showSpeechBubble = true,
  onMascotClick,
  className = '',
}) => {
  const reduced = usePrefersReducedMotion();
  const rootRef = useRef<HTMLDivElement>(null);
  const [greetingIndex, setGreetingIndex] = useState(0);
  const [isWaving, setIsWaving] = useState(false);
  const [blinking, setBlinking] = useState(false);

  // MotionValues updated directly on pointermove — zero React re-renders
  const pupilX = useMotionValue(0);
  const pupilY = useMotionValue(0);
  const headTilt = useMotionValue(0);

  const smoothPupilX = useSpring(pupilX, { stiffness: 320, damping: 24 });
  const smoothPupilY = useSpring(pupilY, { stiffness: 320, damping: 24 });
  const smoothTilt = useSpring(headTilt, { stiffness: 180, damping: 20 });

  useEffect(() => {
    if (reduced) return;

    const handlePointerMove = (e: PointerEvent) => {
      if (e.pointerType === 'touch') return;
      const el = rootRef.current;
      if (!el) return;
      const rect = el.getBoundingClientRect();
      const cx = rect.left + rect.width / 2;
      const cy = rect.top + rect.height * 0.36;
      const dx = e.clientX - cx;
      const dy = e.clientY - cy;
      const angle = Math.atan2(dy, dx);
      const dist = Math.min(2.6, Math.hypot(dx, dy) * 0.012);
      pupilX.set(Math.cos(angle) * dist);
      pupilY.set(Math.sin(angle) * dist);
      headTilt.set(Math.max(-7, Math.min(7, dx * 0.014)));
    };

    window.addEventListener('pointermove', handlePointerMove, { passive: true });
    return () => window.removeEventListener('pointermove', handlePointerMove);
  }, [headTilt, pupilX, pupilY, reduced]);

  // Occasional natural idle blink
  useEffect(() => {
    if (reduced) return;
    let t: ReturnType<typeof setTimeout> | undefined;
    const interval = setInterval(() => {
      setBlinking(true);
      t = setTimeout(() => setBlinking(false), 160);
    }, 4400);
    return () => {
      clearInterval(interval);
      if (t) clearTimeout(t);
    };
  }, [reduced]);

  const triggerReaction = () => {
    setIsWaving(true);
    setGreetingIndex((prev) => (prev + 1) % GREETINGS.length);
    setTimeout(() => setIsWaving(false), 900);
    onMascotClick?.();
  };

  const sizeClass =
    size === 'sm' ? 'w-16 h-20' : size === 'lg' ? 'w-40 h-44 md:w-44 md:h-48' : 'w-28 h-32';

  const activeMessage = thinking
    ? 'Checking campus labs...'
    : customGreeting || GREETINGS[greetingIndex];

  return (
    <div
      ref={rootRef}
      className={`relative inline-flex flex-col items-center select-none ${className}`}
    >
      {showSpeechBubble && (
        <AnimatePresence mode="wait">
          <motion.div
            key={activeMessage}
            initial={{ opacity: 0, y: 6, scale: 0.92 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -4, scale: 0.94 }}
            transition={SPRING_TACTILE}
            className="mb-1.5 px-3.5 py-1.5 rounded-full bg-[#ffffff] text-[#1d1c15] text-xs font-semibold clay-button-soft flex items-center gap-1.5 whitespace-nowrap"
          >
            <motion.span
              animate={
                thinking && !reduced ? { scale: [1, 1.35, 1], opacity: [0.6, 1, 0.6] } : undefined
              }
              transition={thinking && !reduced ? { repeat: Infinity, duration: 0.9 } : undefined}
              className={`w-2 h-2 rounded-full ${thinking ? 'bg-[#2f6579]' : 'bg-[#29695a]'}`}
            />
            <span>{activeMessage}</span>
          </motion.div>
        </AnimatePresence>
      )}

      <motion.button
        type="button"
        onClick={triggerReaction}
        onHoverStart={() => !reduced && setIsWaving(true)}
        onHoverEnd={() => setIsWaving(false)}
        whileHover={reduced ? undefined : { scale: 1.05 }}
        whileTap={reduced ? undefined : { scale: 0.94 }}
        aria-label="Interact with LabLink robot mascot"
        className={`${sizeClass} relative cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#29695a] rounded-3xl`}
      >
        <motion.div
          animate={reduced ? undefined : { y: [0, -6, 0] }}
          transition={reduced ? undefined : { repeat: Infinity, duration: 3.8, ease: 'easeInOut' }}
          className="w-full h-full"
        >
          <svg viewBox="0 0 120 138" className="w-full h-full drop-shadow-md overflow-visible">
            <defs>
              <radialGradient id="labbotBody" cx="35%" cy="25%" r="75%">
                <stop offset="0%" stopColor="#d8f7ee" />
                <stop offset="55%" stopColor="#a8e8d5" />
                <stop offset="100%" stopColor="#6bbda7" />
              </radialGradient>
              <radialGradient id="labbotHead" cx="32%" cy="25%" r="72%">
                <stop offset="0%" stopColor="#ffffff" />
                <stop offset="72%" stopColor="#f2ede2" />
                <stop offset="100%" stopColor="#dfd8c8" />
              </radialGradient>
              <radialGradient id="labbotBlue" cx="35%" cy="30%" r="70%">
                <stop offset="0%" stopColor="#e2f5ff" />
                <stop offset="65%" stopColor="#b0e4fd" />
                <stop offset="100%" stopColor="#77c4e8" />
              </radialGradient>
            </defs>

            {/* Soft ground shadow */}
            <ellipse cx="60" cy="128" rx="28" ry="6" fill="#263044" fillOpacity="0.09" />

            {/* Robot Head Group (tilts gently toward pointer) */}
            <motion.g style={{ rotate: smoothTilt, originX: '60px', originY: '42px' }}>
              {/* Antenna */}
              <line
                x1="60"
                y1="20"
                x2="60"
                y2="8"
                stroke="#29695a"
                strokeWidth="4"
                strokeLinecap="round"
              />
              <motion.circle
                cx="60"
                cy="7"
                r="5.5"
                fill={thinking ? '#f8de91' : '#ffcfd9'}
                stroke="#ffffff"
                strokeWidth="1.5"
                animate={thinking ? { scale: [1, 1.35, 1] } : undefined}
                transition={thinking ? { repeat: Infinity, duration: 0.7 } : undefined}
              />

              {/* Ear Pods */}
              <rect x="18" y="34" width="10" height="18" rx="5" fill="#b0e4fd" stroke="#ffffff" strokeWidth="1.5" />
              <rect x="92" y="34" width="10" height="18" rx="5" fill="#b0e4fd" stroke="#ffffff" strokeWidth="1.5" />

              {/* Head Shell */}
              <rect
                x="24"
                y="18"
                width="72"
                height="48"
                rx="20"
                fill="url(#labbotHead)"
                stroke="#ffffff"
                strokeWidth="2.5"
              />

              {/* Face Visor */}
              <rect x="33" y="28" width="54" height="28" rx="12" fill="#1d242b" />

              {/* Left Eye */}
              <g transform="translate(47, 42)">
                <motion.ellipse
                  cx="0"
                  cy="0"
                  rx="6"
                  ry={blinking ? 1 : 6}
                  fill="#a8e8d5"
                />
                {!blinking && (
                  <motion.circle
                    cx="0"
                    cy="0"
                    r="3"
                    fill="#002019"
                    style={{ x: smoothPupilX, y: smoothPupilY }}
                  />
                )}
                {!blinking && (
                  <motion.circle
                    cx="-1.5"
                    cy="-1.5"
                    r="1.2"
                    fill="#ffffff"
                    style={{ x: smoothPupilX, y: smoothPupilY }}
                  />
                )}
              </g>

              {/* Right Eye */}
              <g transform="translate(73, 42)">
                <motion.ellipse
                  cx="0"
                  cy="0"
                  rx="6"
                  ry={blinking ? 1 : 6}
                  fill="#a8e8d5"
                />
                {!blinking && (
                  <motion.circle
                    cx="0"
                    cy="0"
                    r="3"
                    fill="#002019"
                    style={{ x: smoothPupilX, y: smoothPupilY }}
                  />
                )}
                {!blinking && (
                  <motion.circle
                    cx="-1.5"
                    cy="-1.5"
                    r="1.2"
                    fill="#ffffff"
                    style={{ x: smoothPupilX, y: smoothPupilY }}
                  />
                )}
              </g>

              {/* Friendly Smile */}
              <path
                d="M 54 50 Q 60 54 66 50"
                fill="none"
                stroke="#a8e8d5"
                strokeWidth="2.2"
                strokeLinecap="round"
              />
            </motion.g>

            {/* Left Waving Arm */}
            <motion.g
              animate={
                isWaving
                  ? { rotate: [0, -28, 16, -22, 0] }
                  : { rotate: [0, -4, 0] }
              }
              transition={
                isWaving
                  ? { duration: 0.8, ease: 'easeInOut' }
                  : { repeat: Infinity, duration: 3.4, ease: 'easeInOut' }
              }
              style={{ originX: '28px', originY: '78px' }}
            >
              <path
                d="M 28 78 Q 12 72 14 55"
                fill="none"
                stroke="#ffffff"
                strokeWidth="9"
                strokeLinecap="round"
              />
              <circle cx="14" cy="54" r="6" fill="#ffcfd9" stroke="#ffffff" strokeWidth="1.8" />
            </motion.g>

            {/* Right Arm */}
            <motion.g
              animate={{ rotate: [0, 4, 0] }}
              transition={{ repeat: Infinity, duration: 3.4, ease: 'easeInOut', delay: 0.4 }}
              style={{ originX: '92px', originY: '78px' }}
            >
              <path
                d="M 92 78 Q 106 84 102 98"
                fill="none"
                stroke="#ffffff"
                strokeWidth="9"
                strokeLinecap="round"
              />
              <circle cx="102" cy="99" r="6" fill="#f8de91" stroke="#ffffff" strokeWidth="1.8" />
            </motion.g>

            {/* Torso */}
            <rect
              x="30"
              y="69"
              width="60"
              height="48"
              rx="18"
              fill="url(#labbotBody)"
              stroke="#ffffff"
              strokeWidth="2.5"
            />

            {/* Chest Display Badge */}
            <rect x="42" y="81" width="36" height="22" rx="9" fill="#ffffff" fillOpacity="0.85" />
            <motion.circle
              cx="53"
              cy="92"
              r="4.5"
              fill="url(#labbotBlue)"
              animate={thinking ? { opacity: [0.4, 1, 0.4] } : undefined}
              transition={thinking ? { repeat: Infinity, duration: 0.8 } : undefined}
            />
            <rect x="61" y="89" width="12" height="3" rx="1.5" fill="#29695a" />
            <rect x="61" y="94" width="8" height="2.5" rx="1.25" fill="#707975" />

            {/* Rounded Clay Base / Feet */}
            <rect x="38" y="114" width="18" height="10" rx="5" fill="#2f6579" />
            <rect x="64" y="114" width="18" height="10" rx="5" fill="#2f6579" />
          </svg>
        </motion.div>
      </motion.button>
    </div>
  );
};
