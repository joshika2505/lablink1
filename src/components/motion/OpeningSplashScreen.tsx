import React, { useEffect } from 'react';
import { motion } from 'motion/react';
import type { ClayEquipmentTheme } from '../../types/lablink';
import { ClayEquipmentArtwork } from '../clay/ClayEquipmentArtwork';
import {
  CursorParallaxLayer,
  FloatingClayObject,
  SPRING_TACTILE,
  useCursorParallax,
} from './MotionPrimitives';

interface OpeningSplashScreenProps {
  bootstrapDone: boolean;
  onComplete: () => void;
}

interface SplashToolItem {
  label: string;
  theme: ClayEquipmentTheme;
  desktopPos: string;
  mobileShow: boolean;
  depth: number;
  tilt: number;
  floatDelay: number;
}

const SPLASH_ITEMS: SplashToolItem[] = [
  {
    label: 'Robotic Arm',
    theme: 'robot',
    desktopPos: 'top-[7%] left-[8%] md:left-[12%]',
    mobileShow: true,
    depth: 18,
    tilt: -4,
    floatDelay: 0,
  },
  {
    label: 'Arduino Board',
    theme: 'arduino',
    desktopPos: 'top-[5%] left-[34%] lg:left-[32%]',
    mobileShow: true,
    depth: 12,
    tilt: 3,
    floatDelay: 0.25,
  },
  {
    label: '3D Printer',
    theme: 'printer',
    desktopPos: 'top-[5%] right-[32%] lg:right-[30%]',
    mobileShow: false,
    depth: 15,
    tilt: -2,
    floatDelay: 0.5,
  },
  {
    label: 'Microscope',
    theme: 'microscope',
    desktopPos: 'top-[8%] right-[8%] md:right-[11%]',
    mobileShow: true,
    depth: 20,
    tilt: 4,
    floatDelay: 0.15,
  },
  {
    label: 'Oscilloscope',
    theme: 'oscilloscope',
    desktopPos: 'top-[42%] left-[3%] lg:left-[6%]',
    mobileShow: false,
    depth: 22,
    tilt: -3,
    floatDelay: 0.4,
  },
  {
    label: 'Computer Workstation',
    theme: 'gpu',
    desktopPos: 'top-[42%] right-[3%] lg:right-[6%]',
    mobileShow: false,
    depth: 22,
    tilt: 3,
    floatDelay: 0.65,
  },
  {
    label: 'Digital Multimeter',
    theme: 'multimeter',
    desktopPos: 'bottom-[8%] left-[7%] md:left-[10%]',
    mobileShow: true,
    depth: 16,
    tilt: 3,
    floatDelay: 0.3,
  },
  {
    label: 'Mobile Robot',
    theme: 'mobile_robot',
    desktopPos: 'bottom-[6%] left-[33%] lg:left-[31%]',
    mobileShow: false,
    depth: 13,
    tilt: -3,
    floatDelay: 0.55,
  },
  {
    label: 'Laser Cutter',
    theme: 'laser',
    desktopPos: 'bottom-[6%] right-[33%] lg:right-[31%]',
    mobileShow: false,
    depth: 14,
    tilt: 2,
    floatDelay: 0.75,
  },
  {
    label: 'VR Headset',
    theme: 'vr',
    desktopPos: 'bottom-[8%] right-[7%] md:right-[10%]',
    mobileShow: true,
    depth: 19,
    tilt: -4,
    floatDelay: 0.2,
  },
];

export const OpeningSplashScreen: React.FC<OpeningSplashScreenProps> = ({
  bootstrapDone,
  onComplete,
}) => {
  const { smoothX, smoothY, reduced, handlePointerMove, handlePointerLeave } =
    useCursorParallax();

  useEffect(() => {
    if (!bootstrapDone) return;
    const minDurationMs = reduced ? 220 : 1250;
    const timer = setTimeout(() => {
      onComplete();
    }, minDurationMs);
    return () => clearTimeout(timer);
  }, [bootstrapDone, onComplete, reduced]);

  return (
    <motion.div
      role="status"
      aria-label="Loading LabLink"
      initial={{ opacity: 1 }}
      exit={{ opacity: 0, scale: 1.02 }}
      transition={{ duration: reduced ? 0.15 : 0.45, ease: [0.16, 1, 0.3, 1] }}
      onPointerMove={handlePointerMove}
      onPointerLeave={handlePointerLeave}
      className="fixed inset-0 z-[70] bg-[#fef9ee] flex items-center justify-center overflow-hidden select-none p-6"
    >
      {/* Ambient soft pastel clay blobs */}
      <div aria-hidden="true" className="absolute inset-0 pointer-events-none overflow-hidden">
        <div className="absolute -top-24 -left-24 w-96 h-96 rounded-full bg-[#a8e8d5]/35 blur-3xl" />
        <div className="absolute -bottom-24 -right-24 w-96 h-96 rounded-full bg-[#b0e4fd]/35 blur-3xl" />
        <div className="absolute top-1/3 right-1/4 w-72 h-72 rounded-full bg-[#ffcfd9]/25 blur-3xl" />
      </div>

      {/* 10 Perimeter Floating Clay Equipment Illustrations */}
      {SPLASH_ITEMS.map((item, idx) => (
        <div
          key={item.label}
          className={`absolute ${item.desktopPos} ${
            item.mobileShow ? 'block' : 'hidden md:block'
          } pointer-events-none z-10`}
        >
          <CursorParallaxLayer smoothX={smoothX} smoothY={smoothY} depth={item.depth}>
            <motion.div
              initial={reduced ? { opacity: 1 } : { opacity: 0, scale: 0.65, y: 16 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              transition={{ ...SPRING_TACTILE, delay: reduced ? 0 : idx * 0.055 }}
            >
              <FloatingClayObject
                amplitude={6}
                rotateRange={2.2}
                duration={4.6 + (idx % 3) * 0.6}
                delay={item.floatDelay}
              >
                <div
                  style={{ transform: `rotate(${item.tilt}deg)` }}
                  className="w-20 h-20 sm:w-24 sm:h-24 md:w-28 md:h-28 rounded-[1.75rem] bg-[#ffffff]/95 p-2 clay-card flex flex-col items-center justify-between"
                >
                  <div className="w-full flex-1 rounded-2xl overflow-hidden">
                    <ClayEquipmentArtwork theme={item.theme} compact />
                  </div>
                  <span className="text-[9px] sm:text-[10px] font-semibold text-[#3f4945] truncate max-w-full pt-1">
                    {item.label}
                  </span>
                </div>
              </FloatingClayObject>
            </motion.div>
          </CursorParallaxLayer>
        </div>
      ))}

      {/* Centered LabLink Logo & Tagline */}
      <motion.div
        initial={reduced ? { opacity: 1 } : { opacity: 0, scale: 0.9, y: 12 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        transition={SPRING_TACTILE}
        className="relative z-20 bg-[#ffffff]/95 rounded-[2.5rem] px-8 py-7 sm:px-12 sm:py-9 clay-card flex flex-col items-center text-center gap-3.5 max-w-sm w-full"
      >
        <div className="w-16 h-16 rounded-[1.5rem] bg-[#a8e8d5] flex items-center justify-center text-[#29695a] shadow-inner">
          <span className="material-symbols-outlined text-[34px]">science</span>
        </div>

        <div>
          <h1 className="text-3xl sm:text-4xl font-bold tracking-tight text-[#1d1c15]">
            LabLink
          </h1>
          <p className="text-sm sm:text-base font-medium text-[#3f4945] mt-1">
            Big ideas start in the right lab.
          </p>
        </div>

        {/* Subtle clay progress bar */}
        <div className="w-full max-w-[200px] h-2 rounded-full bg-[#f8f3e8] clay-well overflow-hidden mt-1">
          <motion.div
            initial={{ x: '-65%' }}
            animate={{ x: bootstrapDone ? '0%' : ['-65%', '65%', '-65%'] }}
            transition={
              bootstrapDone
                ? { duration: 0.35, ease: 'easeOut' }
                : { repeat: Infinity, duration: 1.4, ease: 'easeInOut' }
            }
            className="h-full w-full rounded-full bg-[#a8e8d5]"
          />
        </div>

        <span className="text-xs font-semibold text-[#29695a]">
          {bootstrapDone ? 'Campus labs ready' : 'Preparing campus labs...'}
        </span>
      </motion.div>
    </motion.div>
  );
};
