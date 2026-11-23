import React from 'react';
import { motion } from 'motion/react';
import { LabBotMascot } from './LabBotMascot';
import {
  CursorParallaxLayer,
  FloatingClayObject,
  useCursorParallax,
} from './MotionPrimitives';

export const ParallaxHeroStage: React.FC<{ onInteract?: () => void }> = ({ onInteract }) => {
  const { smoothX, smoothY, reduced, handlePointerMove, handlePointerLeave } =
    useCursorParallax();

  return (
    <div
      onPointerMove={handlePointerMove}
      onPointerLeave={handlePointerLeave}
      style={{ perspective: 1200 }}
      className="relative w-full py-4"
    >
      {/* Interactive LabBot Mascot perched at top-right */}
      <div className="absolute -top-6 right-4 sm:right-8 z-30">
        <LabBotMascot size="sm" onMascotClick={onInteract} />
      </div>

      {/* Main Claymorphic Hero Diorama Card */}
      <div className="relative bg-[#ffffff] rounded-[2.5rem] p-5 md:p-7 clay-card overflow-visible">
        {/* Background Ambient Pastel Blobs (Deep Layer) */}
        <CursorParallaxLayer
          smoothX={smoothX}
          smoothY={smoothY}
          depth={14}
          className="absolute inset-0 overflow-hidden rounded-[2.5rem] pointer-events-none"
        >
          <div className="absolute -top-12 -right-12 w-56 h-56 rounded-full bg-[#a8e8d5]/40 blur-2xl" />
          <div className="absolute -bottom-12 -left-12 w-56 h-56 rounded-full bg-[#b0e4fd]/45 blur-2xl" />
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-64 h-64 rounded-full bg-[#f8de91]/25 blur-3xl" />
        </CursorParallaxLayer>

        {/* Central Isometric Clay Lab Ecosystem */}
        <div className="relative z-10 rounded-[2rem] bg-gradient-to-br from-[#fef9ee] via-[#f8f3e8] to-[#eef9f6] p-6 md:p-8 clay-well min-h-[320px] sm:min-h-[360px] flex items-center justify-center overflow-hidden">
          {/* Central Smart Hub */}
          <motion.div
            animate={reduced ? undefined : { scale: [1, 1.03, 1] }}
            transition={reduced ? undefined : { repeat: Infinity, duration: 4.5, ease: 'easeInOut' }}
            className="w-28 h-28 rounded-[2rem] bg-[#ffffff] clay-card flex flex-col items-center justify-center gap-1.5 z-20"
          >
            <div className="w-12 h-12 rounded-full bg-[#a8e8d5] flex items-center justify-center text-[#29695a] shadow-inner">
              <span className="material-symbols-outlined text-[26px]">hub</span>
            </div>
            <span className="text-xs font-bold text-[#1d1c15]">LabLink Core</span>
            <span className="text-[11px] font-medium text-[#29695a]">6 Lab Categories</span>
          </motion.div>

          {/* Floating Clay Robotic Arm (Top Left) */}
          <CursorParallaxLayer
            smoothX={smoothX}
            smoothY={smoothY}
            depth={18}
            opposite={false}
            className="absolute top-5 left-5 sm:left-8"
          >
            <FloatingClayObject amplitude={8} rotateRange={1.6} duration={5.2}>
              <div className="w-28 sm:w-32 h-24 rounded-2xl bg-[#ffffff]/95 p-2.5 clay-card flex flex-col items-center justify-center">
                <svg viewBox="0 0 80 54" className="w-16 h-12" aria-hidden="true">
                  <rect x="16" y="42" width="48" height="8" rx="4" fill="#b0e4fd" />
                  <path
                    d="M 32 42 L 42 24 L 58 18"
                    fill="none"
                    stroke="#29695a"
                    strokeWidth="7"
                    strokeLinecap="round"
                  />
                  <circle cx="32" cy="42" r="5" fill="#ffffff" stroke="#29695a" strokeWidth="2" />
                  <circle cx="42" cy="24" r="5" fill="#a8e8d5" stroke="#ffffff" strokeWidth="2" />
                  <circle cx="58" cy="18" r="4" fill="#ffcfd9" />
                </svg>
                <span className="text-[11px] font-semibold text-[#1d1c15] mt-0.5">Robotic Arm</span>
              </div>
            </FloatingClayObject>
          </CursorParallaxLayer>

          {/* Floating Clay Arduino Board (Top Right) */}
          <CursorParallaxLayer
            smoothX={smoothX}
            smoothY={smoothY}
            depth={24}
            className="absolute top-6 right-5 sm:right-8"
          >
            <FloatingClayObject amplitude={7} rotateRange={1.4} duration={4.8} delay={0.3}>
              <div className="w-28 sm:w-32 h-24 rounded-2xl bg-[#ffffff]/95 p-2.5 clay-card flex flex-col items-center justify-center">
                <svg viewBox="0 0 80 54" className="w-16 h-12" aria-hidden="true">
                  <rect x="14" y="10" width="52" height="34" rx="8" fill="#a8e8d5" stroke="#ffffff" strokeWidth="2" />
                  <rect x="9" y="19" width="10" height="12" rx="3" fill="#b0e4fd" />
                  <rect x="26" y="21" width="24" height="11" rx="3" fill="#1d242b" />
                  <circle cx="57" cy="22" r="3.5" fill="#ffcfd9" />
                  <circle cx="57" cy="32" r="3" fill="#f8de91" />
                </svg>
                <span className="text-[11px] font-semibold text-[#1d1c15] mt-0.5">Arduino Kit</span>
              </div>
            </FloatingClayObject>
          </CursorParallaxLayer>

          {/* Floating Clay 3D Printer (Bottom Left) */}
          <CursorParallaxLayer
            smoothX={smoothX}
            smoothY={smoothY}
            depth={22}
            className="absolute bottom-5 left-5 sm:left-8"
          >
            <FloatingClayObject amplitude={8} rotateRange={1.2} duration={5.6} delay={0.6}>
              <div className="w-28 sm:w-32 h-24 rounded-2xl bg-[#ffffff]/95 p-2.5 clay-card flex flex-col items-center justify-center">
                <svg viewBox="0 0 80 54" className="w-16 h-12" aria-hidden="true">
                  <rect x="20" y="38" width="40" height="10" rx="4" fill="#29695a" />
                  <rect
                    x="24"
                    y="10"
                    width="32"
                    height="28"
                    rx="6"
                    fill="#f8de91"
                    fillOpacity="0.7"
                    stroke="#ffffff"
                    strokeWidth="2"
                  />
                  <polygon points="40,18 48,34 32,34" fill="#a8e8d5" />
                </svg>
                <span className="text-[11px] font-semibold text-[#1d1c15] mt-0.5">3D Printer</span>
              </div>
            </FloatingClayObject>
          </CursorParallaxLayer>

          {/* Floating Clay Oscilloscope (Bottom Right) */}
          <CursorParallaxLayer
            smoothX={smoothX}
            smoothY={smoothY}
            depth={16}
            opposite={false}
            className="absolute bottom-5 right-5 sm:right-8"
          >
            <FloatingClayObject amplitude={7} rotateRange={1.4} duration={5.0} delay={0.2}>
              <div className="w-28 sm:w-32 h-24 rounded-2xl bg-[#ffffff]/95 p-2.5 clay-card flex flex-col items-center justify-center">
                <svg viewBox="0 0 80 54" className="w-16 h-12" aria-hidden="true">
                  <rect
                    x="14"
                    y="10"
                    width="52"
                    height="34"
                    rx="8"
                    fill="#d9c8f2"
                    fillOpacity="0.45"
                    stroke="#ffffff"
                    strokeWidth="2"
                  />
                  <rect x="20" y="16" width="28" height="22" rx="5" fill="#1d2b2a" />
                  <path
                    d="M 22 28 Q 28 19, 34 28 T 46 28"
                    fill="none"
                    stroke="#a8e8d5"
                    strokeWidth="2.5"
                    strokeLinecap="round"
                  />
                  <circle cx="56" cy="22" r="4" fill="#b0e4fd" />
                  <circle cx="56" cy="33" r="4" fill="#ffcfd9" />
                </svg>
                <span className="text-[11px] font-semibold text-[#1d1c15] mt-0.5">Oscilloscope</span>
              </div>
            </FloatingClayObject>
          </CursorParallaxLayer>
        </div>

        {/* Floating Depth Labels around card perimeter */}
        <CursorParallaxLayer
          smoothX={smoothX}
          smoothY={smoothY}
          depth={20}
          className="hidden sm:flex absolute -top-3 left-6 z-20 px-3.5 py-1.5 rounded-full bg-[#ffffff] clay-button-soft items-center gap-2 text-xs font-semibold text-[#29695a]"
        >
          <span className="w-2 h-2 rounded-full bg-[#29695a]" />
          <span>Sample Lab Data</span>
        </CursorParallaxLayer>

        <CursorParallaxLayer
          smoothX={smoothX}
          smoothY={smoothY}
          depth={16}
          opposite={false}
          className="hidden sm:flex absolute -bottom-3 left-1/2 -translate-x-1/2 z-20 px-3.5 py-1.5 rounded-full bg-[#ffd9e0] clay-button-soft items-center gap-1.5 text-xs font-semibold text-[#673946]"
        >
          <span className="material-symbols-outlined text-[15px]">verified_user</span>
          <span>18 Campus Tools</span>
        </CursorParallaxLayer>
      </div>
    </div>
  );
};
