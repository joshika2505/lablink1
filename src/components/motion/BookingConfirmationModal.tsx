import React from 'react';
import { motion } from 'motion/react';
import type { Booking } from '../../types/lablink';
import { ClayModal, SPRING_TACTILE, TactileButton } from './MotionPrimitives';

interface BookingConfirmationModalProps {
  booking: Booking | null;
  onClose: () => void;
  onViewReservations: () => void;
}

const CONFETTI_DOTS = [
  { x: -72, y: -38, color: '#a8e8d5', size: 10 },
  { x: 76, y: -32, color: '#b0e4fd', size: 12 },
  { x: -58, y: 34, color: '#ffcfd9', size: 9 },
  { x: 66, y: 36, color: '#f8de91', size: 11 },
  { x: 0, y: -64, color: '#d9c8f2', size: 8 },
  { x: -94, y: 2, color: '#f8de91', size: 7 },
  { x: 96, y: 4, color: '#a8e8d5', size: 8 },
];

export const BookingConfirmationModal: React.FC<BookingConfirmationModalProps> = ({
  booking,
  onClose,
  onViewReservations,
}) => {
  if (!booking) return null;

  const startLabel = `${String(booking.startHour).padStart(2, '0')}:00`;
  const endLabel = `${String(booking.startHour + booking.durationHours).padStart(2, '0')}:00`;
  const isPending = booking.status === 'pending';

  return (
    <ClayModal open={Boolean(booking)} onClose={onClose} ariaLabel="Booking Confirmation">
      <div className="flex flex-col items-center text-center gap-5 py-2">
        {/* Animated Success Checkmark & Subtle Celebratory Clay Dots */}
        <div className="relative flex items-center justify-center w-24 h-24">
          {CONFETTI_DOTS.map((dot, idx) => (
            <motion.span
              key={idx}
              aria-hidden="true"
              initial={{ opacity: 0, scale: 0, x: 0, y: 0 }}
              animate={{
                opacity: [0, 1, 0.85],
                scale: [0, 1.15, 1],
                x: dot.x,
                y: dot.y,
              }}
              transition={{ delay: 0.14 + idx * 0.04, duration: 0.55, ease: [0.16, 1, 0.3, 1] }}
              style={{
                backgroundColor: dot.color,
                width: dot.size,
                height: dot.size,
              }}
              className="absolute rounded-full shadow-sm"
            />
          ))}

          <motion.div
            initial={{ scale: 0.4, rotate: -16 }}
            animate={{ scale: 1, rotate: 0 }}
            transition={SPRING_TACTILE}
            className={`w-20 h-20 rounded-full flex items-center justify-center clay-button ${
              isPending ? 'bg-[#f8de91] text-[#4a3800]' : 'bg-[#a8e8d5] text-[#29695a]'
            }`}
          >
            <svg viewBox="0 0 36 36" className="w-10 h-10" aria-hidden="true">
              {isPending ? (
                <motion.path
                  d="M18 10v9l5 3"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="3.2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  initial={{ pathLength: 0 }}
                  animate={{ pathLength: 1 }}
                  transition={{ duration: 0.45, delay: 0.15 }}
                />
              ) : (
                <motion.path
                  d="M9 18.5l6.2 6.2L27 12"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="3.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  initial={{ pathLength: 0 }}
                  animate={{ pathLength: 1 }}
                  transition={{ duration: 0.45, delay: 0.12 }}
                />
              )}
            </svg>
          </motion.div>
        </div>

        <div className="flex flex-col gap-1.5">
          <span className="text-xs font-semibold uppercase tracking-wider text-[#29695a]">
            {isPending ? 'Waiting for Approval' : 'Booking Confirmed'}
          </span>
          <h3 className="text-2xl font-bold text-[#1d1c15]">{booking.equipmentName}</h3>
          <p className="text-sm text-[#3f4945]">
            {isPending
              ? 'Your booking request has been sent for faculty approval.'
              : 'Your lab access is ready for this time slot.'}
          </p>
        </div>

        {/* Summary Well */}
        <div className="w-full bg-[#f8f3e8] rounded-2xl p-4 clay-well flex flex-col gap-2.5 text-left">
          <div className="flex items-center justify-between text-sm">
            <span className="text-[#3f4945]">Date</span>
            <span className="font-semibold text-[#1d1c15] tabular-nums">{booking.date}</span>
          </div>
          <div className="flex items-center justify-between text-sm">
            <span className="text-[#3f4945]">Time Slot</span>
            <span className="font-semibold text-[#1d1c15] tabular-nums">
              {startLabel} – {endLabel} ({booking.durationHours}h)
            </span>
          </div>
          <div className="flex items-center justify-between text-sm">
            <span className="text-[#3f4945]">Project</span>
            <span className="font-semibold text-[#1d1c15] truncate max-w-[220px]">
              {booking.projectTitle}
            </span>
          </div>
          <div className="flex items-center justify-between text-sm pt-1 border-t border-[#e7e2d7]">
            <span className="text-[#3f4945]">Status</span>
            <span
              className={`px-3 py-0.5 rounded-full text-xs font-semibold ${
                isPending
                  ? 'bg-[#f8de91] text-[#4a3800]'
                  : 'bg-[#a8e8d5] text-[#2b6a5b]'
              }`}
            >
              {isPending ? 'Waiting for Approval' : 'Confirmed'}
            </span>
          </div>
        </div>

        <div className="flex flex-wrap items-center justify-center gap-3 w-full pt-1">
          <TactileButton variant="soft" onClick={onClose} className="px-6 py-2.5 text-sm">
            Keep Browsing
          </TactileButton>
          <TactileButton
            variant="primary"
            onClick={() => {
              onClose();
              onViewReservations();
            }}
            className="px-6 py-2.5 text-sm"
          >
            <span className="material-symbols-outlined text-[18px]">calendar_month</span>
            <span>Manage Bookings</span>
          </TactileButton>
        </div>
      </div>
    </ClayModal>
  );
};
