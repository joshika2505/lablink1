import React from 'react';
import type { Equipment, EquipmentCategory } from '../../types/lablink';

interface ClayArtworkProps {
  theme: Equipment['clayTheme'];
  className?: string;
  compact?: boolean;
}

const PALETTE_BG: Record<Equipment['clayTheme'], string> = {
  arduino: 'from-[#e5f8f2] via-[#fef9ee] to-[#dff3fd]',
  esp32: 'from-[#ede6fb] via-[#fef9ee] to-[#dff3fd]',
  oscilloscope: 'from-[#ffe8ee] via-[#fef9ee] to-[#dff3fd]',
  printer: 'from-[#fff3d1] via-[#fef9ee] to-[#e7f8f3]',
  laser: 'from-[#ffe8ee] via-[#fef9ee] to-[#fff3d1]',
  cnc: 'from-[#e7f8f3] via-[#fef9ee] to-[#fff3d1]',
  robot: 'from-[#dff3fd] via-[#fef9ee] to-[#e7f8f3]',
  mobile_robot: 'from-[#e7f8f3] via-[#fef9ee] to-[#ede6fb]',
  line_follower: 'from-[#fff3d1] via-[#fef9ee] to-[#dff3fd]',
  pc: 'from-[#dff3fd] via-[#fef9ee] to-[#ede6fb]',
  gpu: 'from-[#ede6fb] via-[#fef9ee] to-[#e7f8f3]',
  vr: 'from-[#ffe8ee] via-[#fef9ee] to-[#ede6fb]',
  multimeter: 'from-[#fff3d1] via-[#fef9ee] to-[#ffe8ee]',
  caliper: 'from-[#dff3fd] via-[#fef9ee] to-[#e7f8f3]',
  power_supply: 'from-[#e7f8f3] via-[#fef9ee] to-[#fff3d1]',
  lathe: 'from-[#ede6fb] via-[#fef9ee] to-[#fff3d1]',
  mill: 'from-[#e7f8f3] via-[#fef9ee] to-[#dff3fd]',
  drill_press: 'from-[#ffe8ee] via-[#fef9ee] to-[#e7f8f3]',
  microscope: 'from-[#e7f8f3] via-[#fef9ee] to-[#dff3fd]',
};

export const ClayEquipmentArtwork: React.FC<ClayArtworkProps> = ({
  theme,
  className = '',
  compact = false,
}) => {
  const svgSize = compact ? 'w-full h-full' : 'w-44 h-36';
  const bg = PALETTE_BG[theme] || PALETTE_BG.microscope;

  const renderSvg = () => {
    switch (theme) {
      case 'arduino':
        return (
          <svg viewBox="0 0 220 160" className={`${svgSize} drop-shadow-md`} aria-hidden="true">
            {/* Soft clay circuit board */}
            <rect x="42" y="34" width="136" height="92" rx="20" fill="#a8e8d5" stroke="#ffffff" strokeWidth="3" />
            <rect x="52" y="44" width="116" height="72" rx="14" fill="#29695a" fillOpacity="0.14" />
            {/* USB Port */}
            <rect x="28" y="62" width="24" height="28" rx="7" fill="#ffffff" stroke="#d4edf9" strokeWidth="2" />
            <rect x="32" y="68" width="12" height="16" rx="3" fill="#b0e4fd" />
            {/* Power barrel jack */}
            <rect x="34" y="100" width="22" height="16" rx="5" fill="#1d242b" />
            {/* Microcontroller chip */}
            <rect x="78" y="66" width="66" height="28" rx="7" fill="#1d242b" stroke="#ffffff" strokeWidth="1.5" />
            <circle cx="88" cy="80" r="3" fill="#a8e8d5" />
            <circle cx="98" cy="80" r="3" fill="#b0e4fd" />
            {/* Header pins top & bottom */}
            {[70, 84, 98, 112, 126, 140, 154].map((x) => (
              <g key={x}>
                <rect x={x} y="42" width="8" height="10" rx="2.5" fill="#ffffff" />
                <rect x={x} y="108" width="8" height="10" rx="2.5" fill="#ffffff" />
              </g>
            ))}
            {/* Glowing LEDs + Reset button */}
            <circle cx="158" cy="64" r="7" fill="#ffcfd9" stroke="#ffffff" strokeWidth="2" />
            <circle cx="158" cy="88" r="5" fill="#f8de91" />
          </svg>
        );

      case 'esp32':
        return (
          <svg viewBox="0 0 220 160" className={`${svgSize} drop-shadow-md`} aria-hidden="true">
            {/* Compact PCB */}
            <rect x="56" y="24" width="108" height="114" rx="20" fill="#d9c8f2" stroke="#ffffff" strokeWidth="3" />
            {/* Metal RF Shield */}
            <rect x="74" y="34" width="72" height="48" rx="12" fill="#ffffff" stroke="#b0e4fd" strokeWidth="2.5" />
            {/* PCB Antenna trace */}
            <path
              d="M 86 24 L 86 14 L 98 14 L 98 20 L 110 20 L 110 14 L 122 14 L 122 20 L 134 20 L 134 24"
              fill="none"
              stroke="#f8de91"
              strokeWidth="4"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
            {/* Dual WiFi Signal Arcs */}
            <path d="M 96 58 Q 110 46 124 58" fill="none" stroke="#2f6579" strokeWidth="3.5" strokeLinecap="round" />
            <path d="M 102 65 Q 110 58 118 65" fill="none" stroke="#29695a" strokeWidth="3" strokeLinecap="round" />
            <circle cx="110" cy="72" r="3" fill="#ffcfd9" />
            {/* Side Pin Rows */}
            {[40, 56, 72, 88, 104].map((y) => (
              <g key={y}>
                <circle cx="65" cy={y} r="3.5" fill="#f8de91" />
                <circle cx="155" cy={y} r="3.5" fill="#f8de91" />
              </g>
            ))}
            {/* USB-C + Buttons */}
            <rect x="96" y="122" width="28" height="16" rx="6" fill="#ffffff" stroke="#e7e2d7" strokeWidth="2" />
            <circle cx="88" cy="106" r="6" fill="#a8e8d5" stroke="#ffffff" strokeWidth="1.5" />
            <circle cx="132" cy="106" r="6" fill="#ffcfd9" stroke="#ffffff" strokeWidth="1.5" />
          </svg>
        );

      case 'oscilloscope':
        return (
          <svg viewBox="0 0 220 160" className={`${svgSize} drop-shadow-md`} aria-hidden="true">
            <rect x="34" y="28" width="152" height="104" rx="20" fill="#ffffff" stroke="#f2ede2" strokeWidth="3" />
            <rect x="46" y="42" width="90" height="74" rx="12" fill="#1d2b2a" />
            <path
              d="M 52 78 Q 64 52, 76 78 T 100 78 T 124 78"
              fill="none"
              stroke="#a8e8d5"
              strokeWidth="3.5"
              strokeLinecap="round"
            />
            <path
              d="M 52 92 Q 68 106, 84 92 T 116 92 T 132 92"
              fill="none"
              stroke="#b0e4fd"
              strokeWidth="2.5"
              strokeLinecap="round"
            />
            <circle cx="156" cy="54" r="9" fill="#b0e4fd" stroke="#ffffff" strokeWidth="2" />
            <circle cx="156" cy="80" r="9" fill="#a8e8d5" stroke="#ffffff" strokeWidth="2" />
            <circle cx="156" cy="106" r="7" fill="#ffcfd9" stroke="#ffffff" strokeWidth="2" />
            <rect x="148" y="118" width="24" height="6" rx="3" fill="#f8de91" />
          </svg>
        );

      case 'printer':
        return (
          <svg viewBox="0 0 220 160" className={`${svgSize} drop-shadow-md`} aria-hidden="true">
            <rect x="50" y="114" width="120" height="24" rx="10" fill="#ffffff" stroke="#e7e2d7" strokeWidth="2" />
            <rect x="62" y="24" width="96" height="94" rx="16" fill="#f8de91" fillOpacity="0.6" stroke="#ffffff" strokeWidth="2.5" />
            <rect x="82" y="38" width="56" height="8" rx="4" fill="#2f6579" />
            <rect x="105" y="46" width="10" height="14" rx="3" fill="#ffcfd9" />
            <polygon points="110,64 130,102 90,102" fill="#a8e8d5" stroke="#ffffff" strokeWidth="2" />
            <rect x="92" y="121" width="36" height="10" rx="5" fill="#29695a" />
          </svg>
        );

      case 'laser':
        return (
          <svg viewBox="0 0 220 160" className={`${svgSize} drop-shadow-md`} aria-hidden="true">
            <rect x="34" y="34" width="152" height="96" rx="20" fill="#ffffff" stroke="#e7e2d7" strokeWidth="2.5" />
            {/* Viewing hood */}
            <rect x="48" y="44" width="110" height="58" rx="14" fill="#ffcfd9" fillOpacity="0.45" stroke="#ffffff" strokeWidth="2" />
            {/* Laser gantry */}
            <rect x="54" y="60" width="98" height="7" rx="3.5" fill="#2f6579" />
            <rect x="98" y="54" width="16" height="18" rx="5" fill="#b0e4fd" stroke="#ffffff" strokeWidth="1.5" />
            {/* Laser beam + cut spark */}
            <line x1="106" y1="72" x2="106" y2="92" stroke="#82505d" strokeWidth="3" strokeLinecap="round" />
            <circle cx="106" cy="94" r="5" fill="#f8de91" />
            {/* Honeycomb bed & workpiece */}
            <rect x="62" y="92" width="84" height="7" rx="3.5" fill="#a8e8d5" />
            {/* Side control pad */}
            <circle cx="170" cy="60" r="6" fill="#a8e8d5" />
            <circle cx="170" cy="78" r="6" fill="#ffcfd9" />
          </svg>
        );

      case 'cnc':
        return (
          <svg viewBox="0 0 220 160" className={`${svgSize} drop-shadow-md`} aria-hidden="true">
            <rect x="42" y="24" width="136" height="112" rx="18" fill="#ffffff" stroke="#e7e2d7" strokeWidth="2.5" />
            <rect x="56" y="38" width="108" height="68" rx="12" fill="#2f6579" fillOpacity="0.14" stroke="#b0e4fd" strokeWidth="2" />
            <rect x="102" y="42" width="16" height="30" rx="5" fill="#29695a" />
            <rect x="107" y="72" width="6" height="14" rx="2" fill="#3f4945" />
            <rect x="84" y="88" width="52" height="14" rx="4" fill="#a8e8d5" stroke="#ffffff" strokeWidth="1.5" />
            <circle cx="70" cy="120" r="6" fill="#ffcfd9" />
            <circle cx="90" cy="120" r="6" fill="#a8e8d5" />
          </svg>
        );

      case 'robot':
        return (
          <svg viewBox="0 0 220 160" className={`${svgSize} drop-shadow-md`} aria-hidden="true">
            <rect x="38" y="128" width="144" height="16" rx="8" fill="#ffffff" stroke="#e7e2d7" strokeWidth="2" />
            <rect x="66" y="114" width="44" height="16" rx="8" fill="#b0e4fd" stroke="#ffffff" strokeWidth="2" />
            <path d="M 88 114 L 116 74" stroke="#ffffff" strokeWidth="18" strokeLinecap="round" />
            <path d="M 88 114 L 116 74" stroke="#d4edf9" strokeWidth="10" strokeLinecap="round" />
            <circle cx="88" cy="114" r="11" fill="#29695a" stroke="#ffffff" strokeWidth="2.5" />
            <path d="M 116 74 L 154 54" stroke="#ffffff" strokeWidth="14" strokeLinecap="round" />
            <circle cx="116" cy="74" r="10" fill="#a8e8d5" stroke="#ffffff" strokeWidth="2.5" />
            <circle cx="154" cy="54" r="8" fill="#ffcfd9" stroke="#ffffff" strokeWidth="2" />
            <path d="M 160 56 L 172 68 M 150 60 L 160 74" stroke="#2f6579" strokeWidth="4.5" strokeLinecap="round" />
            <rect x="150" y="96" width="22" height="22" rx="6" fill="#f8de91" stroke="#ffffff" strokeWidth="2" />
          </svg>
        );

      case 'mobile_robot':
        return (
          <svg viewBox="0 0 220 160" className={`${svgSize} drop-shadow-md`} aria-hidden="true">
            {/* Ground floor */}
            <rect x="36" y="126" width="148" height="10" rx="5" fill="#ffffff" fillOpacity="0.85" />
            {/* Chassis body */}
            <rect x="52" y="74" width="116" height="36" rx="16" fill="#a8e8d5" stroke="#ffffff" strokeWidth="2.5" />
            <rect x="68" y="60" width="84" height="18" rx="9" fill="#ffffff" stroke="#b0e4fd" strokeWidth="2" />
            {/* Lidar dome */}
            <rect x="92" y="38" width="36" height="24" rx="10" fill="#2f6579" stroke="#ffffff" strokeWidth="2" />
            <circle cx="110" cy="50" r="6" fill="#b0e4fd" />
            {/* Ultrasonic front eyes */}
            <circle cx="150" cy="92" r="6" fill="#1d242b" />
            <circle cx="150" cy="92" r="2.5" fill="#f8de91" />
            {/* Four chunky rover wheels */}
            <circle cx="72" cy="116" r="15" fill="#29695a" stroke="#ffffff" strokeWidth="2.5" />
            <circle cx="72" cy="116" r="6" fill="#f8de91" />
            <circle cx="148" cy="116" r="15" fill="#29695a" stroke="#ffffff" strokeWidth="2.5" />
            <circle cx="148" cy="116" r="6" fill="#f8de91" />
          </svg>
        );

      case 'line_follower':
        return (
          <svg viewBox="0 0 220 160" className={`${svgSize} drop-shadow-md`} aria-hidden="true">
            {/* Curved track mat */}
            <rect x="30" y="26" width="160" height="108" rx="22" fill="#ffffff" stroke="#e7e2d7" strokeWidth="2.5" />
            <path
              d="M 46 106 Q 82 52, 118 88 T 174 52"
              fill="none"
              stroke="#1d242b"
              strokeWidth="9"
              strokeLinecap="round"
            />
            {/* Compact bot car sitting on the track */}
            <g transform="translate(86, 52) rotate(-14)">
              <rect x="0" y="0" width="48" height="36" rx="12" fill="#f8de91" stroke="#ffffff" strokeWidth="2.5" />
              <rect x="10" y="8" width="26" height="20" rx="6" fill="#a8e8d5" />
              <rect x="-4" y="6" width="8" height="24" rx="3" fill="#2f6579" />
              <rect x="44" y="6" width="8" height="24" rx="3" fill="#2f6579" />
              <circle cx="16" cy="3" r="3.5" fill="#ffcfd9" />
              <circle cx="32" cy="3" r="3.5" fill="#ffcfd9" />
            </g>
          </svg>
        );

      case 'pc':
        return (
          <svg viewBox="0 0 220 160" className={`${svgSize} drop-shadow-md`} aria-hidden="true">
            {/* Stand */}
            <rect x="96" y="108" width="28" height="18" rx="6" fill="#b0e4fd" />
            <rect x="76" y="122" width="68" height="12" rx="6" fill="#ffffff" stroke="#e7e2d7" strokeWidth="2" />
            {/* Curved monitor */}
            <rect x="38" y="26" width="144" height="86" rx="18" fill="#ffffff" stroke="#e7e2d7" strokeWidth="2.5" />
            <rect x="48" y="36" width="124" height="66" rx="12" fill="#1d242b" />
            {/* Friendly CAD / Code blocks on screen */}
            <rect x="58" y="46" width="44" height="46" rx="8" fill="#2f6579" />
            <polygon points="80,54 94,82 66,82" fill="#a8e8d5" />
            <rect x="110" y="46" width="52" height="10" rx="4" fill="#b0e4fd" />
            <rect x="110" y="64" width="40" height="8" rx="4" fill="#f8de91" />
            <rect x="110" y="79" width="48" height="8" rx="4" fill="#ffcfd9" />
          </svg>
        );

      case 'gpu':
        return (
          <svg viewBox="0 0 220 160" className={`${svgSize} drop-shadow-md`} aria-hidden="true">
            {/* Clay workstation tower + AI card */}
            <rect x="54" y="22" width="112" height="116" rx="20" fill="#ffffff" stroke="#e7e2d7" strokeWidth="2.5" />
            <rect x="66" y="34" width="88" height="44" rx="12" fill="#1d242b" />
            {/* Dual cooling fans */}
            <circle cx="88" cy="56" r="14" fill="#d9c8f2" stroke="#ffffff" strokeWidth="2" />
            <circle cx="88" cy="56" r="5" fill="#29695a" />
            <circle cx="132" cy="56" r="14" fill="#a8e8d5" stroke="#ffffff" strokeWidth="2" />
            <circle cx="132" cy="56" r="5" fill="#2f6579" />
            {/* Telemetry bars */}
            <rect x="66" y="88" width="88" height="16" rx="7" fill="#f8f3e8" />
            <rect x="72" y="92" width="52" height="8" rx="4" fill="#a8e8d5" />
            <rect x="66" y="110" width="88" height="16" rx="7" fill="#f8f3e8" />
            <rect x="72" y="114" width="66" height="8" rx="4" fill="#b0e4fd" />
          </svg>
        );

      case 'vr':
        return (
          <svg viewBox="0 0 220 160" className={`${svgSize} drop-shadow-md`} aria-hidden="true">
            {/* Head strap */}
            <path d="M 48 64 C 48 26, 172 26, 172 64" fill="none" stroke="#d9c8f2" strokeWidth="14" strokeLinecap="round" />
            {/* Visor body */}
            <rect x="44" y="54" width="132" height="58" rx="26" fill="#ffffff" stroke="#e7e2d7" strokeWidth="2.5" />
            {/* Glowing face plate */}
            <rect x="56" y="64" width="108" height="38" rx="18" fill="#1d242b" />
            <path d="M 68 83 Q 84 72 96 83" fill="none" stroke="#a8e8d5" strokeWidth="4" strokeLinecap="round" />
            <path d="M 124 83 Q 136 72 152 83" fill="none" stroke="#b0e4fd" strokeWidth="4" strokeLinecap="round" />
            {/* Dual pastel controllers below */}
            <rect x="64" y="120" width="24" height="14" rx="7" fill="#ffcfd9" stroke="#ffffff" strokeWidth="1.5" />
            <rect x="132" y="120" width="24" height="14" rx="7" fill="#a8e8d5" stroke="#ffffff" strokeWidth="1.5" />
          </svg>
        );

      case 'multimeter':
        return (
          <svg viewBox="0 0 220 160" className={`${svgSize} drop-shadow-md`} aria-hidden="true">
            {/* Yellow protective boot */}
            <rect x="68" y="18" width="84" height="124" rx="22" fill="#f8de91" stroke="#ffffff" strokeWidth="2.5" />
            <rect x="76" y="26" width="68" height="108" rx="16" fill="#ffffff" />
            {/* Digital screen */}
            <rect x="84" y="34" width="52" height="28" rx="8" fill="#a8e8d5" />
            <rect x="92" y="44" width="28" height="7" rx="3" fill="#1d242b" />
            {/* Rotary dial */}
            <circle cx="110" cy="84" r="18" fill="#b0e4fd" stroke="#ffffff" strokeWidth="2" />
            <line x1="110" y1="71" x2="110" y2="84" stroke="#2f6579" strokeWidth="4" strokeLinecap="round" />
            {/* Probe sockets */}
            <circle cx="92" cy="118" r="6" fill="#1d242b" />
            <circle cx="110" cy="118" r="6" fill="#82505d" />
            <circle cx="128" cy="118" r="6" fill="#ffcfd9" />
          </svg>
        );

      case 'caliper':
        return (
          <svg viewBox="0 0 220 160" className={`${svgSize} drop-shadow-md`} aria-hidden="true">
            {/* Main stainless-clay beam */}
            <rect x="30" y="64" width="160" height="20" rx="8" fill="#ffffff" stroke="#d4edf9" strokeWidth="2.5" />
            {/* Fixed jaw left */}
            <path d="M 38 64 L 54 64 L 54 124 L 40 112 Z" fill="#b0e4fd" stroke="#ffffff" strokeWidth="2" />
            {/* Sliding jaw & digital readout */}
            <path d="M 86 64 L 102 64 L 102 124 L 88 112 Z" fill="#a8e8d5" stroke="#ffffff" strokeWidth="2" />
            <rect x="76" y="42" width="64" height="32" rx="10" fill="#29695a" stroke="#ffffff" strokeWidth="2" />
            <rect x="84" y="49" width="48" height="18" rx="5" fill="#d9f5ec" />
            {/* Scale ticks */}
            {[112, 124, 136, 148, 160, 172].map((x) => (
              <line key={x} x1={x} y1="74" x2={x} y2="80" stroke="#707975" strokeWidth="2" strokeLinecap="round" />
            ))}
          </svg>
        );

      case 'power_supply':
        return (
          <svg viewBox="0 0 220 160" className={`${svgSize} drop-shadow-md`} aria-hidden="true">
            <rect x="34" y="34" width="152" height="96" rx="20" fill="#ffffff" stroke="#e7e2d7" strokeWidth="2.5" />
            {/* Dual digital readouts */}
            <rect x="48" y="48" width="58" height="34" rx="10" fill="#1d242b" />
            <rect x="56" y="59" width="32" height="8" rx="3" fill="#a8e8d5" />
            <rect x="114" y="48" width="58" height="34" rx="10" fill="#1d242b" />
            <rect x="122" y="59" width="32" height="8" rx="3" fill="#f8de91" />
            {/* Adjustment dials & Banana jacks */}
            <circle cx="66" cy="104" r="11" fill="#b0e4fd" stroke="#ffffff" strokeWidth="2" />
            <circle cx="96" cy="104" r="11" fill="#a8e8d5" stroke="#ffffff" strokeWidth="2" />
            <circle cx="132" cy="106" r="7" fill="#ffcfd9" stroke="#82505d" strokeWidth="2" />
            <circle cx="156" cy="106" r="7" fill="#1d242b" />
          </svg>
        );

      case 'lathe':
        return (
          <svg viewBox="0 0 220 160" className={`${svgSize} drop-shadow-md`} aria-hidden="true">
            {/* Lathe bed */}
            <rect x="30" y="106" width="160" height="24" rx="10" fill="#ffffff" stroke="#e7e2d7" strokeWidth="2.5" />
            <rect x="42" y="96" width="136" height="12" rx="5" fill="#d9c8f2" />
            {/* Headstock */}
            <rect x="36" y="46" width="48" height="52" rx="12" fill="#2f6579" stroke="#ffffff" strokeWidth="2" />
            <circle cx="60" cy="70" r="12" fill="#f8de91" />
            {/* Spinning cylindrical rod */}
            <rect x="84" y="64" width="66" height="14" rx="5" fill="#b0e4fd" stroke="#ffffff" strokeWidth="1.5" />
            {/* Tool carriage + Tailstock */}
            <rect x="108" y="80" width="24" height="20" rx="6" fill="#ffcfd9" stroke="#ffffff" strokeWidth="1.5" />
            <rect x="150" y="56" width="26" height="40" rx="9" fill="#a8e8d5" stroke="#ffffff" strokeWidth="2" />
          </svg>
        );

      case 'mill':
        return (
          <svg viewBox="0 0 220 160" className={`${svgSize} drop-shadow-md`} aria-hidden="true">
            {/* Base & Column */}
            <rect x="50" y="114" width="120" height="22" rx="9" fill="#ffffff" stroke="#e7e2d7" strokeWidth="2.5" />
            <rect x="122" y="28" width="32" height="90" rx="12" fill="#a8e8d5" stroke="#ffffff" strokeWidth="2" />
            {/* Milling head */}
            <rect x="74" y="28" width="70" height="28" rx="11" fill="#ffffff" stroke="#b0e4fd" strokeWidth="2.5" />
            <rect x="86" y="56" width="16" height="22" rx="5" fill="#29695a" />
            <rect x="91" y="78" width="6" height="14" rx="2" fill="#3f4945" />
            {/* Work table */}
            <rect x="62" y="96" width="66" height="12" rx="5" fill="#b0e4fd" stroke="#ffffff" strokeWidth="2" />
            <circle cx="56" cy="102" r="7" fill="#ffcfd9" />
            <circle cx="134" cy="102" r="7" fill="#f8de91" />
          </svg>
        );

      case 'drill_press':
        return (
          <svg viewBox="0 0 220 160" className={`${svgSize} drop-shadow-md`} aria-hidden="true">
            {/* Base */}
            <rect x="62" y="118" width="96" height="18" rx="8" fill="#ffffff" stroke="#e7e2d7" strokeWidth="2" />
            {/* Vertical column */}
            <rect x="118" y="34" width="14" height="86" rx="7" fill="#b0e4fd" />
            {/* Top motor head */}
            <rect x="76" y="24" width="68" height="30" rx="12" fill="#ffcfd9" stroke="#ffffff" strokeWidth="2" />
            {/* Handle spokes */}
            <line x1="144" y1="38" x2="162" y2="26" stroke="#29695a" strokeWidth="4" strokeLinecap="round" />
            <circle cx="164" cy="25" r="5" fill="#f8de91" />
            {/* Chuck & drill bit */}
            <rect x="86" y="54" width="16" height="16" rx="4" fill="#2f6579" />
            <line x1="94" y1="70" x2="94" y2="90" stroke="#3f4945" strokeWidth="4" strokeLinecap="round" />
            {/* Work table */}
            <rect x="74" y="94" width="58" height="10" rx="5" fill="#a8e8d5" stroke="#ffffff" strokeWidth="2" />
          </svg>
        );

      case 'microscope':
      default:
        return (
          <svg viewBox="0 0 220 160" className={`${svgSize} drop-shadow-md`} aria-hidden="true">
            <rect x="48" y="124" width="124" height="20" rx="10" fill="#a8e8d5" stroke="#fff" strokeWidth="2" />
            <rect x="64" y="116" width="92" height="10" rx="5" fill="#b0e4fd" />
            <path d="M 136 118 C 164 118, 168 42, 126 36" fill="none" stroke="#d9f5ec" strokeWidth="16" strokeLinecap="round" />
            <rect x="62" y="92" width="66" height="9" rx="4.5" fill="#3f4945" />
            <rect x="86" y="28" width="22" height="44" rx="8" fill="#ffffff" stroke="#d9f5ec" strokeWidth="2" />
            <rect x="82" y="20" width="30" height="12" rx="6" fill="#29695a" />
            <circle cx="148" cy="90" r="10" fill="#ffcfd9" stroke="#ffffff" strokeWidth="2" />
          </svg>
        );
    }
  };

  return (
    <div
      className={`relative w-full h-full flex items-center justify-center bg-gradient-to-br ${bg} overflow-hidden ${className}`}
    >
      <div className="absolute -top-6 -right-6 w-24 h-24 rounded-full bg-[#ffffff]/45 blur-xl pointer-events-none" />
      <div className="absolute -bottom-6 -left-6 w-24 h-24 rounded-full bg-[#a8e8d5]/30 blur-xl pointer-events-none" />
      {renderSvg()}
    </div>
  );
};

interface CategoryClayProps {
  category: 'All' | EquipmentCategory;
  className?: string;
}

export const CategoryClayIllustration: React.FC<CategoryClayProps> = ({
  category,
  className = '',
}) => {
  switch (category) {
    case 'Electronics & Circuits':
      return <ClayEquipmentArtwork theme="arduino" compact className={className} />;
    case '3D Printing & Making':
      return <ClayEquipmentArtwork theme="printer" compact className={className} />;
    case 'Robotics':
      return <ClayEquipmentArtwork theme="robot" compact className={className} />;
    case 'Computers & Software':
      return <ClayEquipmentArtwork theme="gpu" compact className={className} />;
    case 'Testing & Measurement':
      return <ClayEquipmentArtwork theme="multimeter" compact className={className} />;
    case 'Mechanical Workshop':
      return <ClayEquipmentArtwork theme="mill" compact className={className} />;
    case 'All':
    default:
      return (
        <div
          className={`relative w-full h-full flex items-center justify-center bg-gradient-to-br from-[#e7f8f3] via-[#fef9ee] to-[#dff3fd] overflow-hidden ${className}`}
        >
          <svg viewBox="0 0 120 100" className="w-full h-full drop-shadow-sm" aria-hidden="true">
            <rect x="20" y="16" width="34" height="30" rx="10" fill="#a8e8d5" stroke="#ffffff" strokeWidth="2" />
            <rect x="64" y="16" width="34" height="30" rx="10" fill="#b0e4fd" stroke="#ffffff" strokeWidth="2" />
            <rect x="20" y="54" width="34" height="30" rx="10" fill="#ffcfd9" stroke="#ffffff" strokeWidth="2" />
            <rect x="64" y="54" width="34" height="30" rx="10" fill="#f8de91" stroke="#ffffff" strokeWidth="2" />
          </svg>
        </div>
      );
  }
};
