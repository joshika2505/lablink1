import type {
  AllocationFactorBreakdown,
  Booking,
  Equipment,
  FairSlotAlternative,
  FairSlotCandidate,
  FairSlotConflictCase,
  FairSlotFactor,
  ResearchProject,
  UserProfile,
} from '../src/types/lablink.js';

function getInitials(name: string): string {
  return (
    name
      .split(' ')
      .filter(Boolean)
      .map((n) => n[0])
      .join('')
      .slice(0, 2)
      .toUpperCase() || 'ST'
  );
}

export function addDaysIso(baseDateIso: string, offsetDays: number): string {
  const parts = baseDateIso.split('-').map(Number);
  const d =
    parts.length === 3 && !parts.some(Number.isNaN)
      ? new Date(Date.UTC(parts[0], parts[1] - 1, parts[2]))
      : new Date();
  d.setUTCDate(d.getUTCDate() + offsetDays);
  return d.toISOString().slice(0, 10);
}

export function computeHoursUntilDeadline(deadlineIso?: string): number {
  if (!deadlineIso) return 168; // 7 days default if unset
  const deadlineMs = Date.parse(deadlineIso.length === 10 ? `${deadlineIso}T17:00:00Z` : deadlineIso);
  if (Number.isNaN(deadlineMs)) return 168;
  const diffHours = Math.round((deadlineMs - Date.now()) / (1000 * 60 * 60));
  return Math.max(4, Math.min(720, diffHours));
}

export function hasOverlap(
  bookings: Booking[],
  equipmentId: string,
  date: string,
  startHour: number,
  durationHours: number,
  excludeBookingId?: string,
): boolean {
  const reqEnd = startHour + durationHours;
  return bookings.some((b) => {
    if (excludeBookingId && b.id === excludeBookingId) return false;
    if (b.equipmentId !== equipmentId || b.date !== date) return false;
    if (b.status !== 'confirmed' && b.status !== 'pending') return false;
    const bEnd = b.startHour + b.durationHours;
    return startHour < bEnd && b.startHour < reqEnd;
  });
}

export interface CandidateScoreInput {
  bookingId: string;
  user: Pick<UserProfile, 'id' | 'name' | 'title' | 'weeklyQuotaHours' | 'usedHoursThisWeek' | 'certifications'>;
  project?: ResearchProject | null;
  projectTitleFallback?: string;
  equipment: Equipment;
  requestedStartHour: number;
  requestedDurationHours: number;
  recentBookingsOnToolCount: number;
}

export function scoreCandidateDeterministically(input: CandidateScoreInput): FairSlotCandidate {
  const { user, project, equipment } = input;
  const hoursUntilDeadline = computeHoursUntilDeadline(project?.deadline);

  // 1. Project Deadline Urgency (0..28 pts)
  let deadlineScore = 8;
  if (hoursUntilDeadline <= 24) deadlineScore = 28;
  else if (hoursUntilDeadline <= 48) deadlineScore = 24;
  else if (hoursUntilDeadline <= 72) deadlineScore = 19;
  else if (hoursUntilDeadline <= 168) deadlineScore = 13;
  else deadlineScore = 7;

  // 2. Weekly Fairness & Anti-Repeat Balance (0..22 pts)
  const quota = Math.max(1, Number(user.weeklyQuotaHours) || 6);
  const used = Math.max(0, Number(user.usedHoursThisWeek) || 0);
  const utilizationRatio = Math.min(1.5, used / quota);
  const baseFairness = Math.max(2, Math.round(16 * (1 - Math.min(1, utilizationRatio))));
  const repeatPenalty = Math.min(6, input.recentBookingsOnToolCount * 3);
  const fairnessScore = Math.max(1, Math.min(22, baseFairness + (6 - repeatPenalty)));

  // 3. Technical Compatibility & Safety Certification Match (0..18 pts)
  const requiredCert = (equipment.certificationRequired || 'General Lab Safety').toLowerCase();
  const userCerts = (user.certifications || []).map((c) => c.toLowerCase());
  const hasCert =
    requiredCert === 'general lab safety' ||
    userCerts.some((c) => c === requiredCert || c.includes(requiredCert) || requiredCert.includes(c));
  const compatibilityScore = hasCert ? 18 : 5;

  // 4. Duration & Schedule Efficiency Fit (0..16 pts)
  const dur = Math.max(1, Math.min(8, input.requestedDurationHours));
  const availabilityScore = dur <= 2 ? 16 : dur <= 4 ? 13 : 9;

  // 5. Project Requirements & Equipment Match (0..16 pts)
  let requirementScore = 5;
  if (project) {
    const matchedTool = project.recommendedEquipmentIds.includes(equipment.id);
    const hasDetailedDesc = project.description.trim().length >= 30;
    requirementScore = (matchedTool ? 9 : 4) + (hasDetailedDesc ? 7 : 3);
  }

  const breakdown: AllocationFactorBreakdown = {
    deadlineScore,
    fairnessScore,
    compatibilityScore,
    availabilityScore,
    requirementScore,
  };

  const priorityScore = Math.min(
    100,
    Math.max(
      1,
      deadlineScore + fairnessScore + compatibilityScore + availabilityScore + requirementScore,
    ),
  );

  const deadlineDescription = project
    ? `Project deadline ${project.deadline} (${hoursUntilDeadline <= 24 ? `${hoursUntilDeadline}h` : `${Math.round(hoursUntilDeadline / 24)}d`} left)`
    : 'No project deadline attached';

  return {
    bookingId: input.bookingId,
    studentId: user.id,
    studentName: user.name,
    studentInitials: getInitials(user.name),
    studentTitle: user.title,
    projectId: project?.id,
    projectTitle: project ? `${project.title} (${project.grantCode})` : input.projectTitleFallback || 'Lab Session',
    deadlineDescription,
    hoursUntilDeadline,
    priorityScore,
    weeklyUsedHours: used,
    weeklyQuotaHours: quota,
    requestedStartHour: input.requestedStartHour,
    requestedDurationHours: input.requestedDurationHours,
    recommended: false,
    scoreBreakdown: breakdown,
  };
}

export function findRealAlternativeSlots(params: {
  targetEquipment: Equipment;
  allEquipment: Equipment[];
  activeBookings: Booking[];
  date: string;
  requestedStartHour: number;
  durationHours: number;
  deadlineIso?: string;
}): FairSlotAlternative[] {
  const {
    targetEquipment,
    allEquipment,
    activeBookings,
    date,
    requestedStartHour,
    durationHours,
  } = params;

  const alternatives: FairSlotAlternative[] = [];
  const seenKeys = new Set<string>();
  const dur = Math.max(1, Math.min(8, durationHours));

  const tryAdd = (
    eq: Equipment,
    candDate: string,
    candHour: number,
    badge: string,
    score: number,
    rationale: string,
  ) => {
    if (alternatives.length >= 3) return;
    if (candHour < 8 || candHour + dur > 20) return;
    const key = `${eq.id}:${candDate}:${candHour}`;
    if (seenKeys.has(key)) return;
    if (hasOverlap(activeBookings, eq.id, candDate, candHour, dur)) return;
    seenKeys.add(key);
    alternatives.push({
      id: `alt-${alternatives.length + 1}`,
      badge,
      score,
      timeLabel: `${candDate}, ${String(candHour).padStart(2, '0')}:00 – ${String(candHour + dur).padStart(2, '0')}:00`,
      date: candDate,
      startHour: candHour,
      durationHours: dur,
      equipmentId: eq.id,
      equipmentName: eq.name,
      bayLabel: eq.locationLabel,
      rationale,
    });
  };

  // 1. Same equipment, same date — search closest free hours around requestedStartHour
  const sameDayHours = [8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18].sort(
    (a, b) => Math.abs(a - requestedStartHour) - Math.abs(b - requestedStartHour),
  );
  for (const h of sameDayHours) {
    if (h === requestedStartHour) continue;
    tryAdd(
      targetEquipment,
      date,
      h,
      'Same Day Open',
      Math.max(82, 96 - Math.abs(h - requestedStartHour) * 2),
      `Confirmed free window on ${targetEquipment.name} today with zero conflicting bookings.`,
    );
    if (alternatives.length >= 1) break;
  }

  // 2. Compatible equipment in the same category at the exact requested time (or nearby)
  const peerTools = allEquipment.filter(
    (e) =>
      e.id !== targetEquipment.id &&
      e.category === targetEquipment.category &&
      e.status !== 'maintenance',
  );
  for (const peer of peerTools) {
    if (!hasOverlap(activeBookings, peer.id, date, requestedStartHour, dur)) {
      tryAdd(
        peer,
        date,
        requestedStartHour,
        'Compatible Tool',
        90,
        `Keeps your exact ${String(requestedStartHour).padStart(2, '0')}:00 time on ${peer.name} (${peer.category}).`,
      );
      break;
    }
  }

  // 3. Same equipment over the next 3 days (morning & afternoon windows)
  for (let dayOffset = 1; dayOffset <= 3 && alternatives.length < 3; dayOffset++) {
    const nextDate = addDaysIso(date, dayOffset);
    for (const h of [9, 11, 14, 16]) {
      tryAdd(
        targetEquipment,
        nextDate,
        h,
        dayOffset === 1 ? 'Next Day Open' : `In ${dayOffset} Days`,
        Math.max(75, 88 - dayOffset * 3),
        `Open ${dur}h window on ${targetEquipment.name} (${nextDate}) with verified availability.`,
      );
      if (alternatives.length >= 3) break;
    }
  }

  // 4. Fill remaining slots if needed from additional same-day hours
  for (const h of sameDayHours) {
    if (alternatives.length >= 3) break;
    tryAdd(
      targetEquipment,
      date,
      h,
      'Same Day Open',
      80,
      `Free slot verified against current bookings on ${targetEquipment.name}.`,
    );
  }

  return alternatives;
}

export function buildEquipmentTimelineBlocks(params: {
  equipmentId: string;
  date: string;
  activeBookings: Booking[];
  conflictStartHour: number;
  conflictEndHour: number;
  suggestedAlt?: FairSlotAlternative;
}): FairSlotConflictCase['timelineBlocks'] {
  const slots = [8, 10, 12, 14, 16, 18];
  return slots.map((h) => {
    const hourLabel = `${String(h).padStart(2, '0')}:00`;
    if (h >= params.conflictStartHour && h < params.conflictEndHour) {
      return { hourLabel, startHour: h, label: 'Conflict (2)', kind: 'conflict' as const };
    }
    if (
      params.suggestedAlt &&
      params.suggestedAlt.equipmentId === params.equipmentId &&
      params.suggestedAlt.date === params.date &&
      h >= params.suggestedAlt.startHour &&
      h < params.suggestedAlt.startHour + params.suggestedAlt.durationHours
    ) {
      return { hourLabel, startHour: h, label: 'Suggested Slot', kind: 'ai_suggested' as const };
    }
    const booked = params.activeBookings.find(
      (b) =>
        b.equipmentId === params.equipmentId &&
        b.date === params.date &&
        (b.status === 'confirmed' || b.status === 'pending') &&
        h >= b.startHour &&
        h < b.startHour + b.durationHours,
    );
    if (booked) {
      return {
        hourLabel,
        startHour: h,
        label: booked.userName.split(' ')[0] || 'Booked',
        kind: 'booked' as const,
      };
    }
    return { hourLabel, startHour: h, label: 'Open', kind: 'open' as const };
  });
}

export function buildDeterministicConflictCase(params: {
  caseId: string;
  equipment: Equipment;
  allEquipment: Equipment[];
  allBookings: Booking[];
  date: string;
  conflictStartHour: number;
  conflictDurationHours: number;
  existingBooking: Booking;
  existingUser: Pick<
    UserProfile,
    'id' | 'name' | 'title' | 'weeklyQuotaHours' | 'usedHoursThisWeek' | 'certifications'
  >;
  existingProject?: ResearchProject | null;
  incomingUser: Pick<
    UserProfile,
    'id' | 'name' | 'title' | 'weeklyQuotaHours' | 'usedHoursThisWeek' | 'certifications'
  >;
  incomingProject?: ResearchProject | null;
  incomingProjectTitleFallback?: string;
}): FairSlotConflictCase {
  const {
    caseId,
    equipment,
    allEquipment,
    allBookings,
    date,
    conflictStartHour,
    conflictDurationHours,
    existingBooking,
    existingUser,
    existingProject,
    incomingUser,
    incomingProject,
    incomingProjectTitleFallback,
  } = params;

  const existingRecentCount = allBookings.filter(
    (b) =>
      b.userId === existingUser.id &&
      b.equipmentId === equipment.id &&
      (b.status === 'confirmed' || b.status === 'pending'),
  ).length;
  const incomingRecentCount = allBookings.filter(
    (b) =>
      b.userId === incomingUser.id &&
      b.equipmentId === equipment.id &&
      (b.status === 'confirmed' || b.status === 'pending'),
  ).length;

  const candExisting = scoreCandidateDeterministically({
    bookingId: existingBooking.id,
    user: existingUser,
    project: existingProject,
    projectTitleFallback: existingBooking.projectTitle,
    equipment,
    requestedStartHour: existingBooking.startHour,
    requestedDurationHours: existingBooking.durationHours,
    recentBookingsOnToolCount: existingRecentCount,
  });

  const candIncoming = scoreCandidateDeterministically({
    bookingId: `req-${caseId}`,
    user: incomingUser,
    project: incomingProject,
    projectTitleFallback: incomingProjectTitleFallback || 'Lab Research',
    equipment,
    requestedStartHour: conflictStartHour,
    requestedDurationHours: conflictDurationHours,
    recentBookingsOnToolCount: incomingRecentCount,
  });

  // Rank purely by computed priorityScore, tie-breaking by remaining weekly quota (NOT timestamp)
  const existingRemaining = Math.max(0, candExisting.weeklyQuotaHours - candExisting.weeklyUsedHours);
  const incomingRemaining = Math.max(0, candIncoming.weeklyQuotaHours - candIncoming.weeklyUsedHours);
  const incomingWins =
    candIncoming.priorityScore > candExisting.priorityScore ||
    (candIncoming.priorityScore === candExisting.priorityScore && incomingRemaining > existingRemaining);

  candExisting.recommended = !incomingWins;
  candIncoming.recommended = incomingWins;

  const winner = incomingWins ? candIncoming : candExisting;
  const runnerUp = incomingWins ? candExisting : candIncoming;

  const alternatives = findRealAlternativeSlots({
    targetEquipment: equipment,
    allEquipment,
    activeBookings: allBookings,
    date,
    requestedStartHour: runnerUp.requestedStartHour,
    durationHours: runnerUp.requestedDurationHours,
    deadlineIso: (incomingWins ? existingProject : incomingProject)?.deadline,
  });

  const primaryAlt = alternatives[0];
  const scoreGap = Math.max(0, winner.priorityScore - runnerUp.priorityScore);
  const fairnessScore = Math.min(99, Math.max(64, Math.round(74 + scoreGap * 0.65 + (primaryAlt ? 10 : 0))));

  const headlineRecommendation = primaryAlt
    ? `Keep ${winner.studentName} in ${String(conflictStartHour).padStart(2, '0')}:00–${String(conflictStartHour + conflictDurationHours).padStart(2, '0')}:00 & move ${runnerUp.studentName} to ${primaryAlt.timeLabel}`
    : `Assign ${String(conflictStartHour).padStart(2, '0')}:00–${String(conflictStartHour + conflictDurationHours).padStart(2, '0')}:00 to ${winner.studentName}`;

  const explanation = `${winner.studentName} scored ${winner.priorityScore}/100 vs ${runnerUp.studentName}'s ${runnerUp.priorityScore}/100 across deadline urgency, weekly quota fairness, safety training match, and project fit.${primaryAlt ? ` A real conflict-free slot (${primaryAlt.timeLabel} on ${primaryAlt.equipmentName}) is available for ${runnerUp.studentName}.` : ''} Faculty make the final approval decision.`;

  const factors: FairSlotFactor[] = [
    {
      title: 'Deadline Urgency',
      icon: 'schedule',
      tone: 'mint',
      detail: `${winner.studentName}: ${winner.scoreBreakdown?.deadlineScore ?? 0}/28 pts (${winner.deadlineDescription}).`,
    },
    {
      title: 'Quota Fairness',
      icon: 'balance',
      tone: 'blue',
      detail: `${winner.studentName} used ${winner.weeklyUsedHours.toFixed(1)}h/${winner.weeklyQuotaHours}h vs ${runnerUp.studentName}'s ${runnerUp.weeklyUsedHours.toFixed(1)}h/${runnerUp.weeklyQuotaHours}h.`,
    },
    {
      title: 'Safety & Tool Fit',
      icon: 'verified_user',
      tone: 'pink',
      detail: primaryAlt
        ? `Compatible cert & real open window found: ${primaryAlt.timeLabel}.`
        : 'Checked safety certification and project requirements.',
    },
  ];

  const timelineBlocks = buildEquipmentTimelineBlocks({
    equipmentId: equipment.id,
    date,
    activeBookings: allBookings,
    conflictStartHour,
    conflictEndHour: conflictStartHour + conflictDurationHours,
    suggestedAlt: primaryAlt,
  });

  return {
    id: caseId,
    caseCode: `CASE #FS-${caseId.slice(-4).toUpperCase()}`,
    equipmentId: equipment.id,
    equipmentName: equipment.name,
    bayLabel: equipment.locationLabel,
    date,
    conflictStartHour,
    conflictEndHour: conflictStartHour + conflictDurationHours,
    status: 'open',
    fairnessScore,
    headlineRecommendation,
    explanation,
    candidates: [winner, runnerUp],
    factors,
    alternatives,
    timelineBlocks,
    selectedAlternativeId: primaryAlt?.id,
  };
}
