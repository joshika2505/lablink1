import {
  EQUIPMENT_CATEGORIES,
  type Booking,
  type Equipment,
  type EquipmentUsageMetric,
  type MaintenanceLog,
  type UtilizationAnalytics,
} from '../src/types/lablink.js';

const CATEGORY_COLORS: Record<string, string> = {
  'Electronics & Circuits': '#a8e8d5',
  '3D Printing & Making': '#f8de91',
  Robotics: '#b0e4fd',
  'Computers & Software': '#d9c8f2',
  'Testing & Measurement': '#ffcfd9',
  'Mechanical Workshop': '#bde6d9',
};

const WEEKDAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'] as const;

export function computeRealUtilizationAnalytics(params: {
  equipment: Equipment[];
  bookings: Booking[];
  maintenance: MaintenanceLog[];
}): UtilizationAnalytics {
  const { equipment, bookings, maintenance } = params;

  const totalInstruments = equipment.length;
  const onlineInstruments = equipment.filter((e) => e.status !== 'maintenance').length;
  const uptimePercent =
    totalInstruments > 0
      ? Number(((onlineInstruments / totalInstruments) * 100).toFixed(1))
      : 100;

  const activeBookings = bookings.filter(
    (b) => b.status === 'confirmed' || b.status === 'pending',
  );

  // Weekly nominal capacity per tool: 40h/week (8h/day × 5 weekdays)
  const NOMINAL_TOOL_WEEKLY_HOURS = 40;

  // 1. Per-equipment usage & idle hours
  const hoursByEq = new Map<string, number>();
  const countByEq = new Map<string, number>();
  for (const b of activeBookings) {
    hoursByEq.set(b.equipmentId, (hoursByEq.get(b.equipmentId) || 0) + Number(b.durationHours || 0));
    countByEq.set(b.equipmentId, (countByEq.get(b.equipmentId) || 0) + 1);
  }

  const equipmentUsage: EquipmentUsageMetric[] = equipment.map((eq) => {
    const bookedHours = Number((hoursByEq.get(eq.id) || 0).toFixed(1));
    const bookingCount = countByEq.get(eq.id) || 0;
    const idleHours = Math.max(0, Number((NOMINAL_TOOL_WEEKLY_HOURS - bookedHours).toFixed(1)));
    const utilizationPercent = Math.min(
      100,
      Math.round((bookedHours / NOMINAL_TOOL_WEEKLY_HOURS) * 100),
    );
    const demandTier: 'high' | 'normal' | 'low' =
      bookedHours >= 6 || bookingCount >= 3
        ? 'high'
        : bookedHours <= 1 && bookingCount === 0
          ? 'low'
          : 'normal';

    return {
      equipmentId: eq.id,
      name: eq.name,
      category: eq.category,
      bookedHours,
      idleHours,
      bookingCount,
      utilizationPercent,
      demandTier,
    };
  });

  const sortedByBooked = [...equipmentUsage].sort(
    (a, b) => b.bookedHours - a.bookedHours || b.bookingCount - a.bookingCount,
  );
  const highDemandTools = sortedByBooked.slice(0, 3).map((e) => ({
    name: e.name,
    bookedHours: e.bookedHours,
    bookingCount: e.bookingCount,
    utilizationPercent: e.utilizationPercent,
  }));
  const lowDemandTools = [...equipmentUsage]
    .sort((a, b) => a.bookedHours - b.bookedHours || a.bookingCount - b.bookingCount)
    .slice(0, 3)
    .map((e) => ({
      name: e.name,
      bookedHours: e.bookedHours,
      bookingCount: e.bookingCount,
      utilizationPercent: e.utilizationPercent,
    }));

  const totalBookedHours = Number(
    equipmentUsage.reduce((acc, item) => acc + item.bookedHours, 0).toFixed(1),
  );
  const totalIdleHours = Number(
    equipmentUsage.reduce((acc, item) => acc + item.idleHours, 0).toFixed(1),
  );

  // 2. Weekday demand distribution from real booking dates
  const hoursByDay: Record<string, number> = {
    Mon: 0,
    Tue: 0,
    Wed: 0,
    Thu: 0,
    Fri: 0,
    Sat: 0,
    Sun: 0,
  };
  for (const b of activeBookings) {
    const parsed = new Date(`${b.date}T12:00:00Z`);
    if (!Number.isNaN(parsed.getTime())) {
      const jsDay = parsed.getUTCDay(); // 0 Sun .. 6 Sat
      const mapIdx = jsDay === 0 ? 6 : jsDay - 1;
      const dayLabel = WEEKDAYS[mapIdx];
      hoursByDay[dayLabel] = (hoursByDay[dayLabel] || 0) + Number(b.durationHours || 0);
    }
  }

  const maxDayHours = Math.max(1, ...Object.values(hoursByDay));
  const dailyCapacityDenominator = Math.max(6, Math.round(totalInstruments * 1.5));

  const weeklyBars = WEEKDAYS.map((day) => {
    const hrs = hoursByDay[day] || 0;
    const rawPct = Math.round((hrs / Math.max(dailyCapacityDenominator, maxDayHours)) * 100);
    const percent = hrs > 0 ? Math.max(12, Math.min(100, rawPct)) : 4;
    return {
      day,
      percent,
      bookedHours: hrs,
      isPeak: hrs > 0 && hrs === maxDayHours,
    };
  });

  const peakBar = weeklyBars.reduce(
    (best, cur) => (cur.percent > best.percent ? cur : best),
    weeklyBars[0],
  );
  const peakCapacityPercent = peakBar ? peakBar.percent : 0;

  // 3. Peak Hours histogram (08:00..19:00)
  const hourBuckets = new Map<number, number>();
  for (const b of activeBookings) {
    for (let h = b.startHour; h < b.startHour + b.durationHours; h++) {
      hourBuckets.set(h, (hourBuckets.get(h) || 0) + 1);
    }
  }
  const peakHours = Array.from(hourBuckets.entries())
    .sort((a, b) => b[1] - a[1] || a[0] - b[0])
    .slice(0, 4)
    .map(([hour, count]) => ({
      hourLabel: `${String(hour).padStart(2, '0')}:00`,
      count,
    }));

  // 4. Usage Split across real Equipment Categories
  const categoryHours = new Map<string, number>();
  for (const cat of EQUIPMENT_CATEGORIES) {
    categoryHours.set(cat, 0);
  }
  for (const eq of equipmentUsage) {
    categoryHours.set(eq.category, (categoryHours.get(eq.category) || 0) + eq.bookedHours);
  }

  const totalCatHours = Array.from(categoryHours.values()).reduce((s, v) => s + v, 0);
  const zoneSplit = EQUIPMENT_CATEGORIES.map((cat) => {
    const hrs = categoryHours.get(cat) || 0;
    const percent =
      totalCatHours > 0
        ? Math.round((hrs / totalCatHours) * 100)
        : Math.round(100 / EQUIPMENT_CATEGORIES.length);
    return {
      zone: cat,
      percent,
      bookedHours: hrs,
      color: CATEGORY_COLORS[cat] || '#a8e8d5',
    };
  }).sort((a, b) => b.percent - a.percent);

  // 5. Actionable Deterministic Admin Recommendations
  const recommendations: string[] = [];
  if (highDemandTools[0] && highDemandTools[0].bookedHours > 0) {
    recommendations.push(
      `High demand on ${highDemandTools[0].name} (${highDemandTools[0].bookedHours}h across ${highDemandTools[0].bookingCount} bookings). Keep Smart Booking enabled during peak hours.`,
    );
  }
  if (peakHours[0]) {
    recommendations.push(
      `Peak lab demand occurs around ${peakHours[0].hourLabel} (${peakHours[0].count} concurrent tool hours). Encourage flexible projects to pick morning slots.`,
    );
  }
  const idleZeroTools = equipmentUsage.filter((e) => e.bookedHours === 0);
  if (idleZeroTools.length > 0) {
    const sampleNames = idleZeroTools
      .slice(0, 2)
      .map((e) => e.name)
      .join(' & ');
    recommendations.push(
      `${idleZeroTools.length} tool${idleZeroTools.length === 1 ? ' is' : 's are'} currently unused (${sampleNames}). Highlight them in Smart Suggestions to balance load.`,
    );
  }
  const activeMaint = maintenance.filter((m) => m.status === 'in_progress');
  if (activeMaint.length > 0) {
    recommendations.push(
      `${activeMaint.length} maintenance task${activeMaint.length === 1 ? ' is' : 's are'} active (${activeMaint[0].equipmentName}). Confirm backup tools in the same category stay open.`,
    );
  }
  if (recommendations.length === 0) {
    recommendations.push(
      'All labs are balanced with low conflict load. Continue monitoring weekly student bookings.',
    );
  }

  const deltaVsLastWeek =
    activeBookings.length > 0
      ? `${activeBookings.length} active bookings · ${totalBookedHours}h booked`
      : 'No active bookings yet';

  return {
    peakCapacityPercent,
    deltaVsLastWeek,
    weeklyBars,
    zoneSplit,
    onlineInstruments,
    totalInstruments,
    uptimePercent,
    totalBookedHours,
    totalIdleHours,
    totalActiveBookings: activeBookings.length,
    peakHours,
    equipmentUsage,
    highDemandTools,
    lowDemandTools,
    recommendations,
  };
}
