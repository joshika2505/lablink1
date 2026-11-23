import type {
  AccessRequest,
  AccessRequestStatus,
  AppNotification,
  AuthorizedAdminEntry,
  Booking,
  BusySlot,
  Department,
  Equipment,
  FairSlotConflictCase,
  Laboratory,
  MaintenanceLog,
  ResearchProject,
  UserProfile,
  UserRole,
  UtilizationAnalytics,
} from '../src/types/lablink.js';
import { getSupabaseAdmin } from './auth.js';
import { buildDeterministicConflictCase, findRealAlternativeSlots, hasOverlap } from './allocation.js';
import { computeRealUtilizationAnalytics } from './analytics.js';

export class DbConflictError extends Error {
  public readonly status = 409;
  public readonly conflictDetected = true;
}

export class DbForbiddenError extends Error {
  public readonly status = 403;
}

export class DbSchemaError extends Error {
  public readonly status = 503;
}

const REQUIRED_TABLES = [
  'profiles',
  'authorized_admins',
  'departments',
  'laboratories',
  'equipment',
  'projects',
  'access_requests',
  'bookings',
  'conflict_resolutions',
  'maintenance_logs',
  'notifications',
] as const;

function requireSb() {
  const sb = getSupabaseAdmin();
  if (!sb) {
    throw new DbSchemaError('Supabase server client is not configured.');
  }
  return sb;
}

function throwIfError(err: { code?: string; message?: string } | null, context: string): void {
  if (!err) return;
  if (err.code === '23P01') {
    throw new DbConflictError(
      'That time slot overlaps with an existing booking. Please choose another open time or send it to Smart Booking.',
    );
  }
  if (err.code === '42P01' || err.code === 'PGRST205') {
    throw new DbSchemaError(
      'Supabase tables are not initialized yet. Run supabase/schema.sql in your Supabase SQL Editor.',
    );
  }
  throw new Error(`${context}: ${err.message || 'Database operation failed.'}`);
}

const SEED_DEPT_IDS = {
  ece: '11111111-1111-4111-8111-111111110101',
  rob: '11111111-1111-4111-8111-111111110102',
  fab: '11111111-1111-4111-8111-111111110103',
  cs: '11111111-1111-4111-8111-111111110104',
};

const SEED_LAB_IDS = {
  electronics: '22222222-2222-4222-8222-222222220201',
  making: '22222222-2222-4222-8222-222222220202',
  robotics: '22222222-2222-4222-8222-222222220203',
  computing: '22222222-2222-4222-8222-222222220204',
  testing: '22222222-2222-4222-8222-222222220205',
  workshop: '22222222-2222-4222-8222-222222220206',
};

function mapProfileRow(r: Record<string, unknown>): UserProfile {
  return {
    id: String(r.id),
    email: String(r.email || ''),
    name: String(r.full_name || r.email || 'Campus User'),
    role: (r.role === 'faculty' || r.role === 'admin' ? r.role : 'student') as UserRole,
    facultyApprovalStatus: (r.faculty_approval_status || 'none') as UserProfile['facultyApprovalStatus'],
    department: String(r.department || 'Bioengineering'),
    title: String(r.title || 'Student Researcher'),
    weeklyQuotaHours: Number(r.weekly_quota_hours ?? 6),
    usedHoursThisWeek: Number(r.used_hours_this_week ?? 0),
    certifications: Array.isArray(r.certifications)
      ? (r.certifications as string[])
      : ['General Lab Safety'],
    assignedLabIds: Array.isArray(r.assigned_lab_ids)
      ? (r.assigned_lab_ids as string[])
      : [],
    avatarUrl: typeof r.avatar_url === 'string' ? r.avatar_url : undefined,
  };
}

function mapEquipmentRow(
  r: Record<string, unknown>,
  deptMap: Map<string, Department>,
): Equipment {
  const deptId = String(r.department_id);
  const dept = deptMap.get(deptId);
  return {
    id: String(r.id),
    code: String(r.code || ''),
    name: String(r.name || ''),
    category: r.category as Equipment['category'],
    departmentId: deptId,
    departmentName: dept?.name || 'Campus Lab',
    laboratoryId: String(r.laboratory_id),
    locationLabel: String(r.location_label || ''),
    status: (r.status || 'available') as Equipment['status'],
    hourlyRate: Number(r.hourly_rate ?? 15),
    requiresFacultyApproval: Boolean(r.requires_faculty_approval),
    certificationRequired: String(r.certification_required || 'General Lab Safety'),
    biosafetyLevel: String(r.biosafety_level || 'Sample Lab Data'),
    nextSlotLabel: String(r.next_slot_label || 'Today, 1:00 PM'),
    lastCalibrated: String(r.last_calibrated_label || 'Nov 15'),
    totalBookings: Number(r.total_bookings ?? 0),
    shortPurpose: String(r.short_purpose || r.description || ''),
    description: String(r.description || ''),
    specsPreview: String(r.specs_preview || ''),
    specs: Array.isArray(r.specs) ? (r.specs as Equipment['specs']) : [],
    guidelines: Array.isArray(r.guidelines) ? (r.guidelines as Equipment['guidelines']) : [],
    imageUrl: String(r.image_url || ''),
    clayTheme: (r.clay_theme || 'arduino') as Equipment['clayTheme'],
    isSampleData: r.is_sample_data !== false,
  };
}

export const supabaseDb = {
  async checkSchemaStatus(): Promise<{
    connected: boolean;
    schemaReady: boolean;
    missingTables: string[];
  }> {
    const sb = getSupabaseAdmin();
    if (!sb) {
      return { connected: false, schemaReady: false, missingTables: [...REQUIRED_TABLES] };
    }
    const missingTables: string[] = [];
    for (const table of REQUIRED_TABLES) {
      const { error } = await sb.from(table).select('*', { count: 'estimated' }).limit(1);
      if (error) {
        if (
          error.code === '42P01' ||
          error.code === 'PGRST205' ||
          error.message?.includes('schema cache') ||
          error.message?.includes('does not exist') ||
          !error.code
        ) {
          missingTables.push(table);
        }
      }
    }
    return {
      connected: true,
      schemaReady: missingTables.length === 0,
      missingTables,
    };
  },

  async ensureSeedCatalogIfEmpty(): Promise<void> {
    const sb = requireSb();
    const { count, error } = await sb.from('equipment').select('id', { head: true, count: 'exact' });
    if (error) {
      if (error.code === '42P01' || error.code === 'PGRST205') return;
      throwIfError(error, 'Check equipment count');
    }
    if ((count ?? 0) > 0) return;

    const depts = [
      { id: SEED_DEPT_IDS.ece, name: 'Electrical & Circuits', code: 'ECE', head_name: 'Dr. Kevin Wu', uptime_percent: 99.1, accent_color: 'pink', icon: 'memory' },
      { id: SEED_DEPT_IDS.rob, name: 'Robotics & Automation', code: 'ROBO', head_name: 'Prof. Arjun Patel', uptime_percent: 98.7, accent_color: 'blue', icon: 'precision_manufacturing' },
      { id: SEED_DEPT_IDS.fab, name: 'Making & Workshop', code: 'MAKE', head_name: 'Prof. Lucas Meyer', uptime_percent: 97.9, accent_color: 'mint', icon: 'layers' },
      { id: SEED_DEPT_IDS.cs, name: 'Computing & VR', code: 'COMP', head_name: 'Dr. Elena Rostova', uptime_percent: 99.4, accent_color: 'butter', icon: 'computer' },
    ];
    await sb.from('departments').upsert(depts, { onConflict: 'code', ignoreDuplicates: true });

    const labs = [
      { id: SEED_LAB_IDS.electronics, department_id: SEED_DEPT_IDS.ece, name: 'Electronics & Circuits Lab (Sample)', building: 'Sample Building A', room: 'Room 104', access_level: 'Open Student Access', capacity: 14, occupied: 7, status: 'open', manager_name: 'Dr. Kevin Wu', manager_title: 'Electronics Lab Advisor', lat: 42.3616, lng: -71.0906, x_percent: 26, y_percent: 32 },
      { id: SEED_LAB_IDS.making, department_id: SEED_DEPT_IDS.fab, name: '3D Printing & Making Hub (Sample)', building: 'Sample Maker Hall', room: 'Room 08', access_level: 'Safety Briefing Required', capacity: 12, occupied: 9, status: 'high_load', manager_name: 'Prof. Lucas Meyer', manager_title: 'Maker Lab Coordinator', lat: 42.3588, lng: -71.0935, x_percent: 46, y_percent: 64 },
      { id: SEED_LAB_IDS.robotics, department_id: SEED_DEPT_IDS.rob, name: 'Robotics Studio (Sample)', building: 'Sample Robotics Wing', room: 'Room 204', access_level: 'Badge Access', capacity: 10, occupied: 5, status: 'open', manager_name: 'Prof. Arjun Patel', manager_title: 'Robotics Studio Lead', lat: 42.3602, lng: -71.0921, x_percent: 56, y_percent: 25 },
      { id: SEED_LAB_IDS.computing, department_id: SEED_DEPT_IDS.cs, name: 'Computers & VR Studio (Sample)', building: 'Sample Tech Center', room: 'Room 302', access_level: 'Open Student Access', capacity: 16, occupied: 6, status: 'open', manager_name: 'Dr. Elena Rostova', manager_title: 'Computing Lab Lead', lat: 42.3595, lng: -71.089, x_percent: 76, y_percent: 44 },
      { id: SEED_LAB_IDS.testing, department_id: SEED_DEPT_IDS.ece, name: 'Testing & Measurement Bench (Sample)', building: 'Sample Building A', room: 'Room 112', access_level: 'General Lab Safety', capacity: 10, occupied: 4, status: 'open', manager_name: 'Dr. Kevin Wu', manager_title: 'Testing Bench Coordinator', lat: 42.3621, lng: -71.0875, x_percent: 72, y_percent: 74 },
      { id: SEED_LAB_IDS.workshop, department_id: SEED_DEPT_IDS.fab, name: 'Mechanical Workshop (Sample)', building: 'Sample Foundry', room: 'Bay 03', access_level: 'Workshop Safety Training', capacity: 8, occupied: 3, status: 'calibrating', manager_name: 'Prof. Lucas Meyer', manager_title: 'Workshop Supervisor', lat: 42.3629, lng: -71.0882, x_percent: 22, y_percent: 72 },
    ];
    await sb.from('laboratories').upsert(labs, { onConflict: 'id', ignoreDuplicates: true });

    const equipRows = [
      { id: '33333333-3333-4333-8333-333333330101', code: 'EC-101', name: 'Arduino Starter Kit', category: 'Electronics & Circuits', department_id: SEED_DEPT_IDS.ece, laboratory_id: SEED_LAB_IDS.electronics, location_label: 'Sample Lab · Electronics Lab, Room 104', status: 'available', hourly_rate: 5, requires_faculty_approval: false, certification_required: 'General Lab Safety', biosafety_level: 'Sample Lab Data', next_slot_label: 'Today, 1:00 PM', last_calibrated_label: 'Nov 10', total_bookings: 0, short_purpose: 'Build quick circuits, sensor prototypes, and LED or motor projects.', description: 'Complete Arduino Uno starter box with breadboard, jumper wires, sensors, servos, and USB cable.', specs_preview: 'Arduino Uno R3 • Breadboard • 20+ Sensors & Motors', specs: [{ label: 'Board', value: 'Arduino Uno R3 (5V)', icon: 'memory', tone: 'mint' }, { label: 'Included Parts', value: 'Sensors, LEDs, Servos', icon: 'extension', tone: 'blue' }], guidelines: [{ title: 'Check Polarity', detail: 'Double-check 5V and GND wires before plugging in USB.', icon: 'bolt' }], clay_theme: 'arduino', is_sample_data: true },
      { id: '33333333-3333-4333-8333-333333330102', code: 'EC-102', name: 'ESP32 Board', category: 'Electronics & Circuits', department_id: SEED_DEPT_IDS.ece, laboratory_id: SEED_LAB_IDS.electronics, location_label: 'Sample Lab · Electronics Lab, Room 104', status: 'available', hourly_rate: 5, requires_faculty_approval: false, certification_required: 'General Lab Safety', biosafety_level: 'Sample Lab Data', next_slot_label: 'Today, 2:00 PM', last_calibrated_label: 'Nov 12', total_bookings: 0, short_purpose: 'Create wireless Wi-Fi and Bluetooth IoT projects with fast microcontrollers.', description: 'Dual-core Wi-Fi & Bluetooth microcontroller dev board with USB-C.', specs_preview: 'Wi-Fi + Bluetooth • Dual Core • 3.3V Logic', specs: [{ label: 'Wireless', value: 'Wi-Fi & Bluetooth LE', icon: 'wifi', tone: 'blue' }, { label: 'Voltage', value: '3.3V GPIO Pins', icon: 'bolt', tone: 'mint' }], guidelines: [{ title: '3.3V Pin Limit', detail: 'Never connect 5V sensors directly to 3.3V ESP32 GPIO pins.', icon: 'warning' }], clay_theme: 'esp32', is_sample_data: true },
      { id: '33333333-3333-4333-8333-333333330103', code: 'EC-103', name: 'Digital Oscilloscope', category: 'Electronics & Circuits', department_id: SEED_DEPT_IDS.ece, laboratory_id: SEED_LAB_IDS.electronics, location_label: 'Sample Lab · Electronics Lab, Room 104', status: 'available', hourly_rate: 15, requires_faculty_approval: false, certification_required: 'General Lab Safety', biosafety_level: 'Sample Lab Data', next_slot_label: 'Today, 1:30 PM', last_calibrated_label: 'Nov 08', total_bookings: 0, short_purpose: 'See voltage signals, waves, and circuit timing live on a color screen.', description: '4-channel benchtop digital oscilloscope for debugging sensor signals.', specs_preview: '100 MHz • 4 Analog Channels • Built-in Signal Check', specs: [{ label: 'Channels', value: '4 Analog Inputs', icon: 'waves', tone: 'pink' }, { label: 'Bandwidth', value: '100 MHz', icon: 'speed', tone: 'blue' }], guidelines: [{ title: 'Ground Clip Safety', detail: 'Connect probe ground clips only to circuit ground.', icon: 'electric_bolt' }], clay_theme: 'oscilloscope', is_sample_data: true },
      { id: '33333333-3333-4333-8333-333333330201', code: 'MK-201', name: '3D Printer', category: '3D Printing & Making', department_id: SEED_DEPT_IDS.fab, laboratory_id: SEED_LAB_IDS.making, location_label: 'Sample Lab · 3D Printing Hub, Room 08', status: 'available', hourly_rate: 12, requires_faculty_approval: false, certification_required: 'General Lab Safety', biosafety_level: 'Sample Lab Data', next_slot_label: 'Today, 3:00 PM', last_calibrated_label: 'Nov 14', total_bookings: 0, short_purpose: 'Print custom plastic parts, robot brackets, and project cases from CAD files.', description: 'Fast auto-leveling desktop 3D printer supporting PLA and PETG filaments.', specs_preview: '250 × 210 × 210 mm • PLA & PETG • Auto Bed Level', specs: [{ label: 'Print Size', value: '250 × 210 × 210 mm', icon: 'view_in_ar', tone: 'mint' }, { label: 'Materials', value: 'PLA, PETG', icon: 'layers', tone: 'blue' }], guidelines: [{ title: 'Watch First Layer', detail: 'Stay for the first 5 minutes to confirm bed adhesion.', icon: 'visibility' }], clay_theme: 'printer', is_sample_data: true },
      { id: '33333333-3333-4333-8333-333333330202', code: 'MK-202', name: 'Laser Cutter', category: '3D Printing & Making', department_id: SEED_DEPT_IDS.fab, laboratory_id: SEED_LAB_IDS.making, location_label: 'Sample Lab · 3D Printing Hub, Room 08', status: 'in_use', hourly_rate: 20, requires_faculty_approval: true, certification_required: 'Laser Safety Briefing', biosafety_level: 'Sample Lab Data', next_slot_label: 'Tomorrow, 10:00 AM', last_calibrated_label: 'Nov 11', total_bookings: 0, short_purpose: 'Cut and engrave clean shapes into wood, acrylic sheets, and cardboard.', description: 'Enclosed CO2 laser cutter with exhaust fan for panels and chassis plates.', specs_preview: '600 × 400 mm Bed • Wood & Acrylic • Exhaust Filtered', specs: [{ label: 'Bed Area', value: '600 × 400 mm', icon: 'crop_free', tone: 'pink' }, { label: 'Materials', value: 'Plywood, Acrylic', icon: 'layers', tone: 'mint' }], guidelines: [{ title: 'Approved Materials Only', detail: 'Never cut PVC or vinyl. Stay beside the machine while cutting.', icon: 'verified_user' }], clay_theme: 'laser', is_sample_data: true },
      { id: '33333333-3333-4333-8333-333333330203', code: 'MK-203', name: 'CNC Machine', category: '3D Printing & Making', department_id: SEED_DEPT_IDS.fab, laboratory_id: SEED_LAB_IDS.making, location_label: 'Sample Lab · 3D Printing Hub, Room 08', status: 'available', hourly_rate: 30, requires_faculty_approval: true, certification_required: 'CNC Safety Check', biosafety_level: 'Sample Lab Data', next_slot_label: 'Today, 4:00 PM', last_calibrated_label: 'Nov 09', total_bookings: 0, short_purpose: 'Carve solid aluminum, wood, or PCB boards using computer-guided cutting tools.', description: '3-axis CNC router for mechanical brackets, enclosures, and milled parts.', specs_preview: '3-Axis Router • Aluminum & Wood • Enclosed Guard', specs: [{ label: 'Work Area', value: '400 × 300 × 120 mm', icon: 'open_with', tone: 'mint' }, { label: 'Spindle', value: '12,000 RPM', icon: 'cyclone', tone: 'blue' }], guidelines: [{ title: 'Dry Run First', detail: 'Check tool height and run an air pass before cutting solid stock.', icon: 'fact_check' }], clay_theme: 'cnc', is_sample_data: true },
      { id: '33333333-3333-4333-8333-333333330301', code: 'RB-301', name: 'Robotic Arm', category: 'Robotics', department_id: SEED_DEPT_IDS.rob, laboratory_id: SEED_LAB_IDS.robotics, location_label: 'Sample Lab · Robotics Studio, Room 204', status: 'available', hourly_rate: 25, requires_faculty_approval: false, certification_required: 'General Lab Safety', biosafety_level: 'Sample Lab Data', next_slot_label: 'Today, 2:00 PM', last_calibrated_label: 'Nov 15', total_bookings: 0, short_purpose: 'Program pick-and-place movements, gripper tasks, and ROS motion paths.', description: '6-axis tabletop collaborative robotic arm with Python/ROS support.', specs_preview: '6-Axis • Python & ROS 2 • Adaptive Gripper', specs: [{ label: 'Motion', value: '6-Axis Joint Control', icon: 'precision_manufacturing', tone: 'blue' }, { label: 'Coding', value: 'Python / ROS 2', icon: 'terminal', tone: 'mint' }], guidelines: [{ title: 'Keep E-Stop Close', detail: 'Keep the red emergency stop within reach while testing code.', icon: 'verified_user' }], clay_theme: 'robot', is_sample_data: true },
      { id: '33333333-3333-4333-8333-333333330302', code: 'RB-302', name: 'Mobile Robot Kit', category: 'Robotics', department_id: SEED_DEPT_IDS.rob, laboratory_id: SEED_LAB_IDS.robotics, location_label: 'Sample Lab · Robotics Studio, Room 204', status: 'available', hourly_rate: 15, requires_faculty_approval: false, certification_required: 'General Lab Safety', biosafety_level: 'Sample Lab Data', next_slot_label: 'Today, 1:00 PM', last_calibrated_label: 'Nov 13', total_bookings: 0, short_purpose: 'Test self-driving navigation, LiDAR mapping, and obstacle avoidance.', description: 'Wheeled autonomous robot platform with 2D LiDAR and depth camera.', specs_preview: '2D LiDAR • Depth Camera • ROS Navigation Ready', specs: [{ label: 'Sensors', value: '2D LiDAR + Camera', icon: 'sensors', tone: 'mint' }, { label: 'Battery', value: '3 hrs Run Time', icon: 'battery_charging_full', tone: 'pink' }], guidelines: [{ title: 'Floor Arena Only', detail: 'Test autonomous driving inside the padded floor mat area.', icon: 'map' }], clay_theme: 'mobile_robot', is_sample_data: true },
      { id: '33333333-3333-4333-8333-333333330303', code: 'RB-303', name: 'Line Follower Kit', category: 'Robotics', department_id: SEED_DEPT_IDS.rob, laboratory_id: SEED_LAB_IDS.robotics, location_label: 'Sample Lab · Robotics Studio, Room 204', status: 'available', hourly_rate: 8, requires_faculty_approval: false, certification_required: 'General Lab Safety', biosafety_level: 'Sample Lab Data', next_slot_label: 'Today, 11:30 AM', last_calibrated_label: 'Nov 14', total_bookings: 0, short_purpose: 'Learn PID speed control and IR sensor tracking on a campus test track.', description: 'Beginner-friendly robot car kit with 5-channel IR array and track mat.', specs_preview: '5-Sensor IR Array • Arduino Compatible • Practice Track', specs: [{ label: 'Sensors', value: '5× IR Track Sensors', icon: 'linear_scale', tone: 'pink' }, { label: 'Controller', value: 'Arduino Nano', icon: 'memory', tone: 'mint' }], guidelines: [{ title: 'Recharge After Use', detail: 'Switch off the battery pack and place on charger after use.', icon: 'battery_std' }], clay_theme: 'line_follower', is_sample_data: true },
      { id: '33333333-3333-4333-8333-333333330401', code: 'CS-401', name: 'Engineering PC', category: 'Computers & Software', department_id: SEED_DEPT_IDS.cs, laboratory_id: SEED_LAB_IDS.computing, location_label: 'Sample Lab · Computing Studio, Room 302', status: 'available', hourly_rate: 10, requires_faculty_approval: false, certification_required: 'General Lab Safety', biosafety_level: 'Sample Lab Data', next_slot_label: 'Today, 12:00 PM', last_calibrated_label: 'Nov 15', total_bookings: 0, short_purpose: 'Run CAD modeling, MATLAB simulations, PCB layout, and engineering software.', description: 'Dual-monitor desktop workstation with SolidWorks, Fusion 360, MATLAB, and KiCad.', specs_preview: '64GB RAM • Dual 27" Displays • CAD & MATLAB Installed', specs: [{ label: 'Memory', value: '64 GB DDR5 RAM', icon: 'memory', tone: 'blue' }, { label: 'Software', value: 'CAD, MATLAB, KiCad', icon: 'apps', tone: 'mint' }], guidelines: [{ title: 'Save to Cloud Drive', detail: 'Save files to your student cloud folder before signing out.', icon: 'cloud_upload' }], clay_theme: 'pc', is_sample_data: true },
      { id: '33333333-3333-4333-8333-333333330402', code: 'CS-402', name: 'GPU Workstation', category: 'Computers & Software', department_id: SEED_DEPT_IDS.cs, laboratory_id: SEED_LAB_IDS.computing, location_label: 'Sample Lab · Computing Studio, Room 302', status: 'available', hourly_rate: 30, requires_faculty_approval: true, certification_required: 'Cluster Access Check', biosafety_level: 'Sample Lab Data', next_slot_label: 'Now (Remote or Desk)', last_calibrated_label: 'Nov 16', total_bookings: 0, short_purpose: 'Train machine learning models, computer vision tools, and 3D renders fast.', description: 'Dedicated deep learning tower with dual high-VRAM GPUs and PyTorch/CUDA.', specs_preview: 'Dual High-VRAM GPUs • 128GB RAM • PyTorch & CUDA', specs: [{ label: 'Graphics', value: 'Dual 24GB VRAM GPUs', icon: 'developer_board', tone: 'pink' }, { label: 'AI Stack', value: 'PyTorch, CUDA, Jupyter', icon: 'terminal', tone: 'blue' }], guidelines: [{ title: 'Save Checkpoints', detail: 'Save model weights regularly during long training runs.', icon: 'save' }], clay_theme: 'gpu', is_sample_data: true },
      { id: '33333333-3333-4333-8333-333333330403', code: 'CS-403', name: 'VR Headset', category: 'Computers & Software', department_id: SEED_DEPT_IDS.cs, laboratory_id: SEED_LAB_IDS.computing, location_label: 'Sample Lab · Computing Studio, Room 302', status: 'in_use', hourly_rate: 15, requires_faculty_approval: false, certification_required: 'General Lab Safety', biosafety_level: 'Sample Lab Data', next_slot_label: 'Today, 4:30 PM', last_calibrated_label: 'Nov 13', total_bookings: 0, short_purpose: 'Test virtual 3D spaces, Unity/Unreal apps, and interactive simulations.', description: 'PC-tethered virtual reality headset with hand controllers and playspace mat.', specs_preview: '4K Per-Eye • Hand Tracking • Unity & Unreal Ready', specs: [{ label: 'Tracking', value: '6-DOF Inside-Out', icon: '360', tone: 'mint' }, { label: 'Engines', value: 'Unity, Unreal, WebXR', icon: 'view_in_ar', tone: 'blue' }], guidelines: [{ title: 'Wipe Foam Pad', detail: 'Use provided sanitizer wipes on the face cushion after use.', icon: 'cleaning_services' }], clay_theme: 'vr', is_sample_data: true },
      { id: '33333333-3333-4333-8333-333333330501', code: 'TM-501', name: 'Digital Multimeter', category: 'Testing & Measurement', department_id: SEED_DEPT_IDS.ece, laboratory_id: SEED_LAB_IDS.testing, location_label: 'Sample Lab · Testing Bench, Room 112', status: 'available', hourly_rate: 5, requires_faculty_approval: false, certification_required: 'General Lab Safety', biosafety_level: 'Sample Lab Data', next_slot_label: 'Today, 12:30 PM', last_calibrated_label: 'Nov 12', total_bookings: 0, short_purpose: 'Measure voltage, current, resistance, and check circuit connections safely.', description: 'True-RMS digital multimeter with continuity beep and fused current inputs.', specs_preview: 'True-RMS • Voltage, Current, Ohms • Continuity Beep', specs: [{ label: 'Modes', value: 'V, A, Ω, Continuity', icon: 'electric_meter', tone: 'mint' }, { label: 'Accuracy', value: 'True-RMS Auto-Range', icon: 'tune', tone: 'blue' }], guidelines: [{ title: 'Check Probe Jacks', detail: 'Move red lead back to V/Ω jack after current measurements.', icon: 'verified_user' }], clay_theme: 'multimeter', is_sample_data: true },
      { id: '33333333-3333-4333-8333-333333330502', code: 'TM-502', name: 'Digital Vernier Caliper', category: 'Testing & Measurement', department_id: SEED_DEPT_IDS.ece, laboratory_id: SEED_LAB_IDS.testing, location_label: 'Sample Lab · Testing Bench, Room 112', status: 'available', hourly_rate: 5, requires_faculty_approval: false, certification_required: 'General Lab Safety', biosafety_level: 'Sample Lab Data', next_slot_label: 'Today, 12:00 PM', last_calibrated_label: 'Nov 15', total_bookings: 0, short_purpose: 'Measure small part sizes, hole diameters, and thicknesses down to 0.01 mm.', description: 'Stainless steel digital sliding caliper with instant mm/inch toggle.', specs_preview: '0–150 mm Range • ±0.02 mm Accuracy • mm / inch Switch', specs: [{ label: 'Range', value: '0 – 150 mm (6 in)', icon: 'straighten', tone: 'blue' }, { label: 'Resolution', value: '0.01 mm', icon: 'center_focus_strong', tone: 'mint' }], guidelines: [{ title: 'Zero Before Measuring', detail: 'Close jaws gently and press Zero before measuring parts.', icon: 'tune' }], clay_theme: 'caliper', is_sample_data: true },
      { id: '33333333-3333-4333-8333-333333330503', code: 'TM-503', name: 'Power Supply', category: 'Testing & Measurement', department_id: SEED_DEPT_IDS.ece, laboratory_id: SEED_LAB_IDS.testing, location_label: 'Sample Lab · Testing Bench, Room 112', status: 'available', hourly_rate: 8, requires_faculty_approval: false, certification_required: 'General Lab Safety', biosafety_level: 'Sample Lab Data', next_slot_label: 'Today, 2:30 PM', last_calibrated_label: 'Nov 11', total_bookings: 0, short_purpose: 'Give steady, adjustable DC voltage and current limits to your circuits.', description: 'Triple-output programmable DC bench power supply with current limiting.', specs_preview: '0–30V DC • 0–5A Current Limit • Digital Readout', specs: [{ label: 'Output', value: '0–30V DC (3 Channels)', icon: 'bolt', tone: 'pink' }, { label: 'Protection', value: 'Adjustable Current Cap', icon: 'shield', tone: 'mint' }], guidelines: [{ title: 'Set Current Limit First', detail: 'Set voltage and current limit before pressing Output On.', icon: 'power_settings_new' }], clay_theme: 'power_supply', is_sample_data: true },
      { id: '33333333-3333-4333-8333-333333330601', code: 'MW-601', name: 'Lathe Machine', category: 'Mechanical Workshop', department_id: SEED_DEPT_IDS.fab, laboratory_id: SEED_LAB_IDS.workshop, location_label: 'Sample Lab · Mechanical Workshop, Bay 03', status: 'available', hourly_rate: 35, requires_faculty_approval: true, certification_required: 'Workshop Safety Training', biosafety_level: 'Sample Lab Data', next_slot_label: 'Tomorrow, 9:00 AM', last_calibrated_label: 'Nov 07', total_bookings: 0, short_purpose: 'Spin and shape smooth round metal rods, shafts, threads, and bushings.', description: 'Precision benchtop metal lathe with variable spindle speed and chuck shield.', specs_preview: 'Variable RPM • Digital Readout • Safety Chuck Shield', specs: [{ label: 'Swing', value: '250 mm Over Bed', icon: 'cyclone', tone: 'mint' }, { label: 'Speed', value: '100–2500 RPM', icon: 'speed', tone: 'blue' }], guidelines: [{ title: 'Remove Chuck Key', detail: 'Never leave the chuck key inside the chuck. Wear safety glasses.', icon: 'warning' }], clay_theme: 'lathe', is_sample_data: true },
      { id: '33333333-3333-4333-8333-333333330602', code: 'MW-602', name: 'Milling Machine', category: 'Mechanical Workshop', department_id: SEED_DEPT_IDS.fab, laboratory_id: SEED_LAB_IDS.workshop, location_label: 'Sample Lab · Mechanical Workshop, Bay 03', status: 'maintenance', hourly_rate: 35, requires_faculty_approval: true, certification_required: 'Workshop Safety Training', biosafety_level: 'Sample Lab Data', next_slot_label: 'Thu, 1:00 PM', last_calibrated_label: 'Nov 04', total_bookings: 0, short_purpose: 'Cut flat surfaces, slots, and precise holes into aluminum or steel blocks.', description: 'Vertical manual & DRO milling machine for slotted mounts and flat stock.', specs_preview: '3-Axis DRO • Precision Vise • Safety Shield', specs: [{ label: 'Table Travel', value: '450 × 200 mm', icon: 'open_with', tone: 'blue' }, { label: 'Readout', value: '3-Axis Digital Scale', icon: 'straighten', tone: 'mint' }], guidelines: [{ title: 'Lock Unused Axes', detail: 'Clamp workpiece tightly in vise and lock idle axes.', icon: 'fact_check' }], clay_theme: 'mill', is_sample_data: true },
      { id: '33333333-3333-4333-8333-333333330603', code: 'MW-603', name: 'Drill Press', category: 'Mechanical Workshop', department_id: SEED_DEPT_IDS.fab, laboratory_id: SEED_LAB_IDS.workshop, location_label: 'Sample Lab · Mechanical Workshop, Bay 03', status: 'available', hourly_rate: 15, requires_faculty_approval: false, certification_required: 'Workshop Safety Briefing', biosafety_level: 'Sample Lab Data', next_slot_label: 'Today, 3:30 PM', last_calibrated_label: 'Nov 14', total_bookings: 0, short_purpose: 'Drill straight, accurate holes in wood, plastic plates, and metal parts.', description: 'Floor-standing variable-speed drill press with laser guide and table vise.', specs_preview: '16-Speed • Laser Crosshair • Depth Stop & Vise', specs: [{ label: 'Chuck Size', value: '1.5 – 16 mm Bits', icon: 'build', tone: 'pink' }, { label: 'Guide', value: 'Laser Center Dot', icon: 'gps_fixed', tone: 'mint' }], guidelines: [{ title: 'Always Clamp Parts', detail: 'Never hold parts by hand while drilling—always use a clamp.', icon: 'verified_user' }], clay_theme: 'drill_press', is_sample_data: true },
    ];
    await sb.from('equipment').upsert(equipRows, { onConflict: 'code', ignoreDuplicates: true });
  },

  async ensureProfileForAuthUser(
    user: { id: string; email: string; name?: string; department?: string },
    extra?: { requestFaculty?: boolean },
  ): Promise<UserProfile> {
    const sb = requireSb();
    const { data: existing, error: selErr } = await sb
      .from('profiles')
      .select('*')
      .eq('id', user.id)
      .maybeSingle();
    throwIfError(selErr, 'Load user profile');
    if (existing) {
      return mapProfileRow(existing);
    }

    const facultyStatus = extra?.requestFaculty ? 'pending' : 'none';
    const dept = user.department || 'Bioengineering';
    const fullName = user.name || user.email.split('@')[0] || 'Campus User';

    const { data: adminEntry } = await sb
      .from('authorized_admins')
      .select('email')
      .ilike('email', user.email)
      .maybeSingle();
    const initialRole: UserRole = adminEntry ? 'admin' : 'student';

    const { data: inserted, error: insErr } = await sb
      .from('profiles')
      .insert({
        id: user.id,
        email: user.email.toLowerCase(),
        full_name: fullName,
        role: initialRole,
        faculty_approval_status: facultyStatus,
        department: dept,
        title:
          initialRole === 'admin'
            ? 'Platform Administrator'
            : facultyStatus === 'pending'
              ? `Faculty Applicant • ${dept}`
              : `Student Researcher • ${dept}`,
        weekly_quota_hours: initialRole === 'admin' ? 40 : 6,
      })
      .select('*')
      .single();
    throwIfError(insErr, 'Create user profile');
    return mapProfileRow(inserted);
  },

  async registerAuthUser(payload: {
    email: string;
    name: string;
    password: string;
    department: string;
    requestFaculty?: boolean;
  }): Promise<UserProfile> {
    const sb = requireSb();
    const email = payload.email.trim().toLowerCase();
    const { data, error } = await sb.auth.admin.createUser({
      email,
      password: payload.password,
      email_confirm: true,
      user_metadata: {
        full_name: payload.name.trim(),
        department: payload.department.trim() || 'Bioengineering',
        requested_role: payload.requestFaculty ? 'faculty' : 'student',
      },
    });
    if (error || !data.user) {
      throw new Error(error?.message || 'Unable to register account.');
    }
    return this.ensureProfileForAuthUser(
      {
        id: data.user.id,
        email,
        name: payload.name.trim(),
        department: payload.department.trim() || 'Bioengineering',
      },
      { requestFaculty: payload.requestFaculty },
    );
  },

  async updateProfile(
    userId: string,
    patch: { name?: string; department?: string; title?: string },
  ): Promise<UserProfile> {
    const sb = requireSb();
    const updates: Record<string, unknown> = { updated_at: new Date().toISOString() };
    if (patch.name && patch.name.trim()) updates.full_name = patch.name.trim();
    if (patch.department && patch.department.trim()) updates.department = patch.department.trim();
    if (patch.title && patch.title.trim()) updates.title = patch.title.trim();

    const { data, error } = await sb
      .from('profiles')
      .update(updates)
      .eq('id', userId)
      .select('*')
      .single();
    throwIfError(error, 'Update profile');
    return mapProfileRow(data);
  },

  async getDepartmentsAndLabsAndEquipment(): Promise<{
    departments: Department[];
    laboratories: Laboratory[];
    equipment: Equipment[];
  }> {
    const sb = requireSb();
    await this.ensureSeedCatalogIfEmpty();

    const [deptRes, labRes, eqRes] = await Promise.all([
      sb.from('departments').select('*').order('created_at', { ascending: true }),
      sb.from('laboratories').select('*').order('created_at', { ascending: true }),
      sb.from('equipment').select('*').order('created_at', { ascending: false }),
    ]);

    throwIfError(deptRes.error, 'Load departments');
    throwIfError(labRes.error, 'Load laboratories');
    throwIfError(eqRes.error, 'Load equipment');

    const rawEq = (eqRes.data || []) as Array<Record<string, unknown>>;
    const countByDept = new Map<string, number>();
    for (const eq of rawEq) {
      const did = String(eq.department_id);
      countByDept.set(did, (countByDept.get(did) || 0) + 1);
    }

    const departments: Department[] = ((deptRes.data || []) as Array<Record<string, unknown>>).map(
      (d) => ({
        id: String(d.id),
        name: String(d.name),
        code: String(d.code),
        headName: String(d.head_name),
        instrumentCount: countByDept.get(String(d.id)) || 0,
        uptimePercent: Number(d.uptime_percent ?? 98),
        accentColor: (d.accent_color || 'mint') as Department['accentColor'],
        icon: String(d.icon || 'science'),
      }),
    );

    const deptMap = new Map(departments.map((d) => [d.id, d]));
    const laboratories: Laboratory[] = ((labRes.data || []) as Array<Record<string, unknown>>).map(
      (l) => ({
        id: String(l.id),
        name: String(l.name),
        departmentId: String(l.department_id),
        departmentName: deptMap.get(String(l.department_id))?.name || 'Campus Lab',
        building: String(l.building),
        room: String(l.room),
        accessLevel: String(l.access_level || 'General Lab Safety'),
        capacity: Number(l.capacity ?? 10),
        occupied: Number(l.occupied ?? 0),
        status: (l.status || 'open') as Laboratory['status'],
        managerName: String(l.manager_name),
        managerTitle: String(l.manager_title || 'Lab Coordinator'),
        coordinates: {
          lat: Number(l.lat ?? 42.36),
          lng: Number(l.lng ?? -71.09),
          xPercent: Number(l.x_percent ?? 50),
          yPercent: Number(l.y_percent ?? 50),
        },
      }),
    );

    const equipment = rawEq.map((row) => mapEquipmentRow(row, deptMap));
    return { departments, laboratories, equipment };
  },

  async getBusySlots(): Promise<BusySlot[]> {
    const sb = requireSb();
    const { data, error } = await sb
      .from('bookings')
      .select('equipment_id, booking_date, start_hour, duration_hours, status')
      .in('status', ['confirmed', 'pending']);
    throwIfError(error, 'Load equipment schedule slots');
    return ((data || []) as Array<Record<string, unknown>>).map((r) => ({
      equipmentId: String(r.equipment_id),
      date: String(r.booking_date),
      startHour: Number(r.start_hour),
      durationHours: Number(r.duration_hours),
      status: (r.status === 'confirmed' ? 'confirmed' : 'pending') as BusySlot['status'],
    }));
  },

  async getMaintenance(equipmentMap?: Map<string, Equipment>): Promise<MaintenanceLog[]> {
    const sb = requireSb();
    const { data, error } = await sb
      .from('maintenance_logs')
      .select('*')
      .order('created_at', { ascending: false });
    throwIfError(error, 'Load maintenance logs');
    return ((data || []) as Array<Record<string, unknown>>).map((m) => ({
      id: String(m.id),
      equipmentId: String(m.equipment_id),
      equipmentName: equipmentMap?.get(String(m.equipment_id))?.name || 'Lab Equipment',
      technician: String(m.technician),
      taskTitle: String(m.task_title),
      status: (m.status || 'scheduled') as MaintenanceLog['status'],
      scheduledDate: String(m.scheduled_date),
      notes: String(m.notes || ''),
    }));
  },

  async getAllBookingsMapped(
    equipmentMap: Map<string, Equipment>,
    profileMap: Map<string, UserProfile>,
    projectMap: Map<string, ResearchProject>,
  ): Promise<Booking[]> {
    const sb = requireSb();
    const { data, error } = await sb
      .from('bookings')
      .select('*')
      .order('created_at', { ascending: false });
    throwIfError(error, 'Load bookings');
    return ((data || []) as Array<Record<string, unknown>>).map((b) => {
      const eq = equipmentMap.get(String(b.equipment_id));
      const usr = profileMap.get(String(b.user_id));
      const proj = b.project_id ? projectMap.get(String(b.project_id)) : undefined;
      return {
        id: String(b.id),
        equipmentId: String(b.equipment_id),
        equipmentName: eq?.name || 'Lab Equipment',
        userId: String(b.user_id),
        userName: usr?.name || 'Student Researcher',
        userRoleTitle: usr?.title || 'Campus User',
        projectId: b.project_id ? String(b.project_id) : '',
        projectTitle: proj ? `${proj.title} (${proj.grantCode})` : 'General Lab Research',
        date: String(b.booking_date),
        startHour: Number(b.start_hour),
        durationHours: Number(b.duration_hours),
        status: b.status as Booking['status'],
        totalCost: Number(b.total_cost ?? 0),
        urgencyTag: (b.urgency_tag || undefined) as Booking['urgencyTag'],
        aiNote: typeof b.ai_note === 'string' ? b.ai_note : undefined,
        suggestedAlternative: b.suggested_alternative as Booking['suggestedAlternative'] | undefined,
        facultyReviewerName:
          typeof b.faculty_reviewer_name === 'string' ? b.faculty_reviewer_name : undefined,
        createdAt: String(b.created_at),
      };
    });
  },

  async getProjects(userId?: string, role?: UserRole): Promise<ResearchProject[]> {
    const sb = requireSb();
    let query = sb.from('projects').select('*').order('created_at', { ascending: false });
    if (role === 'student' && userId) {
      query = query.eq('owner_id', userId);
    }
    const { data, error } = await query;
    throwIfError(error, 'Load projects');
    return ((data || []) as Array<Record<string, unknown>>).map((p) => ({
      id: String(p.id),
      ownerId: String(p.owner_id),
      ownerName: String(p.owner_name || 'Student'),
      title: String(p.title),
      grantCode: String(p.grant_code || 'CAMPUS-LAB'),
      department: String(p.department || 'Bioengineering'),
      category: String(p.category || 'Research'),
      description: String(p.description || ''),
      deadline: String(p.deadline).slice(0, 10),
      progress: Number(p.progress ?? 15),
      tone: (p.tone || 'mint') as ResearchProject['tone'],
      icon: String(p.icon || 'science'),
      recommendedEquipmentIds: Array.isArray(p.recommended_equipment_ids)
        ? (p.recommended_equipment_ids as string[])
        : [],
      aiAnalysisSummary:
        typeof p.ai_analysis_summary === 'string' ? p.ai_analysis_summary : undefined,
      status: (p.status || 'active') as ResearchProject['status'],
    }));
  },

  async getAccessRequests(
    actor: { id: string; role: UserRole; assignedLabIds?: string[] },
    equipmentMap: Map<string, Equipment>,
    profileMap: Map<string, UserProfile>,
    projectMap: Map<string, ResearchProject>,
  ): Promise<AccessRequest[]> {
    const sb = requireSb();
    let query = sb.from('access_requests').select('*').order('created_at', { ascending: false });
    if (actor.role === 'student') {
      query = query.eq('user_id', actor.id);
    }
    const { data, error } = await query;
    throwIfError(error, 'Load access requests');

    const rows = ((data || []) as Array<Record<string, unknown>>).map((r) => {
      const eq = equipmentMap.get(String(r.equipment_id));
      const usr = profileMap.get(String(r.user_id));
      const proj = projectMap.get(String(r.project_id));
      return {
        id: String(r.id),
        projectId: String(r.project_id),
        projectTitle: proj?.title || 'Research Project',
        userId: String(r.user_id),
        userName: usr?.name || 'Student',
        userDepartment: usr?.department || 'Engineering',
        equipmentId: String(r.equipment_id),
        equipmentName: eq?.name || 'Equipment',
        requestedHours: Number(r.requested_hours ?? 2),
        preferredDate: String(r.preferred_date),
        deadline: proj?.deadline || '',
        justification: String(r.justification || ''),
        status: r.status as AccessRequestStatus,
        suggestedAlternative: r.suggested_alternative as AccessRequest['suggestedAlternative'],
        facultyReviewerName:
          typeof r.faculty_reviewer_name === 'string' ? r.faculty_reviewer_name : undefined,
        reviewerNotes: typeof r.reviewer_notes === 'string' ? r.reviewer_notes : undefined,
        createdAt: String(r.created_at),
      };
    });

    if (actor.role === 'faculty' && actor.assignedLabIds && actor.assignedLabIds.length > 0) {
      const labSet = new Set(actor.assignedLabIds);
      return rows.filter((r) => {
        const eq = equipmentMap.get(r.equipmentId);
        return eq ? labSet.has(eq.laboratoryId) : false;
      });
    }
    return rows;
  },

  async getConflicts(
    actor?: { id: string; role: UserRole; assignedLabIds?: string[] },
    equipmentMap?: Map<string, Equipment>,
  ): Promise<FairSlotConflictCase[]> {
    const sb = requireSb();
    const { data, error } = await sb
      .from('conflict_resolutions')
      .select('*')
      .order('created_at', { ascending: false });
    throwIfError(error, 'Load conflict resolutions');
    const all = ((data || []) as Array<Record<string, unknown>>).map((c) => {
      const eq = equipmentMap?.get(String(c.equipment_id));
      return {
        id: String(c.id),
        caseCode: String(c.case_code),
        equipmentId: String(c.equipment_id),
        equipmentName: eq?.name || 'Lab Equipment',
        bayLabel: eq?.locationLabel || 'Campus Lab',
        date: String(c.booking_date),
        conflictStartHour: Number(c.conflict_start_hour),
        conflictEndHour: Number(c.conflict_end_hour),
        status: c.status as FairSlotConflictCase['status'],
        fairnessScore: Number(c.fairness_score),
        headlineRecommendation: String(c.headline_recommendation),
        explanation: String(c.explanation),
        candidates: c.candidates as FairSlotConflictCase['candidates'],
        factors: c.factors as FairSlotConflictCase['factors'],
        alternatives: c.alternatives as FairSlotConflictCase['alternatives'],
        timelineBlocks: c.timeline_blocks as FairSlotConflictCase['timelineBlocks'],
        selectedAlternativeId:
          typeof c.selected_alternative_id === 'string' ? c.selected_alternative_id : undefined,
        resolvedBy: typeof c.resolved_by_name === 'string' ? c.resolved_by_name : undefined,
      };
    });

    if (!actor) return [];
    if (actor.role === 'admin') return all;
    if (actor.role === 'faculty') {
      if (actor.assignedLabIds && actor.assignedLabIds.length > 0 && equipmentMap) {
        const labSet = new Set(actor.assignedLabIds);
        return all.filter((c) => {
          const eq = equipmentMap.get(c.equipmentId);
          return eq ? labSet.has(eq.laboratoryId) : false;
        });
      }
      return all;
    }
    return all.filter((c) => c.candidates.some((cand) => cand.studentId === actor.id));
  },

  async getNotifications(userId: string): Promise<AppNotification[]> {
    const sb = requireSb();
    const { data, error } = await sb
      .from('notifications')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(30);
    throwIfError(error, 'Load notifications');
    return ((data || []) as Array<Record<string, unknown>>).map((n) => ({
      id: String(n.id),
      userId: String(n.user_id),
      title: String(n.title),
      message: String(n.message),
      type: (n.type || 'info') as AppNotification['type'],
      read: Boolean(n.read),
      createdAt: String(n.created_at),
    }));
  },

  async getBootstrapForUser(authUser: {
    id: string;
    email: string;
    name: string;
    role: UserRole;
  } | null): Promise<{
    user: UserProfile | null;
    departments: Department[];
    laboratories: Laboratory[];
    equipment: Equipment[];
    projects: ResearchProject[];
    accessRequests: AccessRequest[];
    bookings: Booking[];
    busySlots: BusySlot[];
    conflicts: FairSlotConflictCase[];
    maintenance: MaintenanceLog[];
    notifications: AppNotification[];
    analytics: UtilizationAnalytics | null;
    users: UserProfile[];
    authorizedAdmins: AuthorizedAdminEntry[];
  }> {
    const sb = requireSb();
    const { departments, laboratories, equipment } = await this.getDepartmentsAndLabsAndEquipment();
    const equipmentMap = new Map(equipment.map((e) => [e.id, e]));
    const busySlots = await this.getBusySlots();
    const maintenance = await this.getMaintenance(equipmentMap);

    if (!authUser) {
      return {
        user: null,
        departments,
        laboratories,
        equipment,
        projects: [],
        accessRequests: [],
        bookings: [],
        busySlots,
        conflicts: [],
        maintenance,
        notifications: [],
        analytics: null,
        users: [],
        authorizedAdmins: [],
      };
    }

    const userProfile = await this.ensureProfileForAuthUser(authUser);

    // Load profiles & projects needed to hydrate bookings/requests
    const [profilesRes, adminsRes] = await Promise.all([
      sb.from('profiles').select('*').order('created_at', { ascending: false }),
      userProfile.role === 'admin'
        ? sb.from('authorized_admins').select('*').order('created_at', { ascending: true })
        : Promise.resolve({ data: [], error: null }),
    ]);
    throwIfError(profilesRes.error, 'Load profiles');
    throwIfError(adminsRes.error, 'Load authorized admins');

    const allProfiles = ((profilesRes.data || []) as Array<Record<string, unknown>>).map(
      mapProfileRow,
    );
    const profileMap = new Map(allProfiles.map((p) => [p.id, p]));

    const projects = await this.getProjects(userProfile.id, userProfile.role);
    const projectMap = new Map(projects.map((p) => [p.id, p]));

    const allBookings = await this.getAllBookingsMapped(equipmentMap, profileMap, projectMap);

    // Scope bookings strictly by role + faculty assigned labs
    let scopedBookings = allBookings;
    if (userProfile.role === 'student') {
      scopedBookings = allBookings.filter((b) => b.userId === userProfile.id);
    } else if (
      userProfile.role === 'faculty' &&
      userProfile.assignedLabIds &&
      userProfile.assignedLabIds.length > 0
    ) {
      const labSet = new Set(userProfile.assignedLabIds);
      scopedBookings = allBookings.filter((b) => {
        const eq = equipmentMap.get(b.equipmentId);
        return eq ? labSet.has(eq.laboratoryId) : false;
      });
    }

    const accessRequests = await this.getAccessRequests(
      {
        id: userProfile.id,
        role: userProfile.role,
        assignedLabIds: userProfile.assignedLabIds,
      },
      equipmentMap,
      profileMap,
      projectMap,
    );

    const conflicts = await this.getConflicts(
      {
        id: userProfile.id,
        role: userProfile.role,
        assignedLabIds: userProfile.assignedLabIds,
      },
      equipmentMap,
    );

    const notifications = await this.getNotifications(userProfile.id);

    const isAdmin = userProfile.role === 'admin';
    const analytics = isAdmin
      ? computeRealUtilizationAnalytics({ equipment, bookings: allBookings, maintenance })
      : null;

    const authorizedAdmins: AuthorizedAdminEntry[] = isAdmin
      ? ((adminsRes.data || []) as Array<Record<string, unknown>>).map((a) => ({
          email: String(a.email),
          name: String(a.name || a.email),
          grantedBy: String(a.granted_by || 'System Setup'),
          createdAt: String(a.created_at),
        }))
      : [];

    return {
      user: userProfile,
      departments,
      laboratories,
      equipment,
      projects,
      accessRequests,
      bookings: scopedBookings,
      busySlots,
      conflicts,
      maintenance,
      notifications,
      analytics,
      users: isAdmin ? allProfiles : [],
      authorizedAdmins,
    };
  },

  async getAllUsers(): Promise<UserProfile[]> {
    const sb = requireSb();
    const { data, error } = await sb
      .from('profiles')
      .select('*')
      .order('created_at', { ascending: false });
    throwIfError(error, 'Load users');
    return ((data || []) as Array<Record<string, unknown>>).map(mapProfileRow);
  },

  async getAnalytics(): Promise<UtilizationAnalytics> {
    const { equipment } = await this.getDepartmentsAndLabsAndEquipment();
    const equipmentMap = new Map(equipment.map((e) => [e.id, e]));
    const allProfiles = await this.getAllUsers();
    const profileMap = new Map(allProfiles.map((p) => [p.id, p]));
    const projects = await this.getProjects(undefined, 'admin');
    const projectMap = new Map(projects.map((p) => [p.id, p]));
    const [allBookings, maintenance] = await Promise.all([
      this.getAllBookingsMapped(equipmentMap, profileMap, projectMap),
      this.getMaintenance(equipmentMap),
    ]);
    return computeRealUtilizationAnalytics({ equipment, bookings: allBookings, maintenance });
  },

  async getBookingsForActor(actor: { id: string; role: UserRole }): Promise<Booking[]> {
    const sb = requireSb();
    const { equipment } = await this.getDepartmentsAndLabsAndEquipment();
    const equipmentMap = new Map(equipment.map((e) => [e.id, e]));
    const allProfiles = await this.getAllUsers();
    const profileMap = new Map(allProfiles.map((p) => [p.id, p]));
    const projects = await this.getProjects(actor.id, actor.role);
    const projectMap = new Map(projects.map((p) => [p.id, p]));
    const allBookings = await this.getAllBookingsMapped(equipmentMap, profileMap, projectMap);
    if (actor.role === 'student') {
      return allBookings.filter((b) => b.userId === actor.id);
    }
    if (actor.role === 'faculty') {
      const { data: prof } = await sb
        .from('profiles')
        .select('assigned_lab_ids')
        .eq('id', actor.id)
        .maybeSingle();
      const labIds = Array.isArray(prof?.assigned_lab_ids)
        ? (prof.assigned_lab_ids as string[])
        : [];
      if (labIds.length > 0) {
        const labSet = new Set(labIds);
        return allBookings.filter((b) => {
          const eq = equipmentMap.get(b.equipmentId);
          return eq ? labSet.has(eq.laboratoryId) : false;
        });
      }
    }
    return allBookings;
  },

  async getAccessRequestsForActor(actor: { id: string; role: UserRole }): Promise<AccessRequest[]> {
    const sb = requireSb();
    const { equipment } = await this.getDepartmentsAndLabsAndEquipment();
    const equipmentMap = new Map(equipment.map((e) => [e.id, e]));
    const allProfiles = await this.getAllUsers();
    const profileMap = new Map(allProfiles.map((p) => [p.id, p]));
    const projects = await this.getProjects(actor.id, actor.role);
    const projectMap = new Map(projects.map((p) => [p.id, p]));
    const { data: prof } = await sb
      .from('profiles')
      .select('assigned_lab_ids')
      .eq('id', actor.id)
      .maybeSingle();
    const assignedLabIds = Array.isArray(prof?.assigned_lab_ids)
      ? (prof.assigned_lab_ids as string[])
      : [];
    return this.getAccessRequests(
      { id: actor.id, role: actor.role, assignedLabIds },
      equipmentMap,
      profileMap,
      projectMap,
    );
  },

  async getConflictsForActor(actor: { id: string; role: UserRole }): Promise<FairSlotConflictCase[]> {
    const sb = requireSb();
    const { equipment } = await this.getDepartmentsAndLabsAndEquipment();
    const equipmentMap = new Map(equipment.map((e) => [e.id, e]));
    const { data: prof } = await sb
      .from('profiles')
      .select('assigned_lab_ids')
      .eq('id', actor.id)
      .maybeSingle();
    const assignedLabIds = Array.isArray(prof?.assigned_lab_ids)
      ? (prof.assigned_lab_ids as string[])
      : [];
    return this.getConflicts({ id: actor.id, role: actor.role, assignedLabIds }, equipmentMap);
  },

  async assertFacultyScopeForEquipment(
    actorId: string,
    actorRole: UserRole,
    equipmentId: string,
  ): Promise<Equipment> {
    const sb = requireSb();
    const { equipment } = await this.getDepartmentsAndLabsAndEquipment();
    const targetEq = equipment.find((e) => e.id === equipmentId);
    if (!targetEq) throw new Error('Equipment not found.');
    if (actorRole === 'admin') return targetEq;
    if (actorRole !== 'faculty') {
      throw new DbForbiddenError('Faculty or admin role required.');
    }

    const { data: prof } = await sb
      .from('profiles')
      .select('assigned_lab_ids')
      .eq('id', actorId)
      .maybeSingle();
    const assigned = Array.isArray(prof?.assigned_lab_ids)
      ? (prof.assigned_lab_ids as string[])
      : [];
    const { data: lab } = await sb
      .from('laboratories')
      .select('manager_id')
      .eq('id', targetEq.laboratoryId)
      .maybeSingle();

    if (
      assigned.length > 0 &&
      !assigned.includes(targetEq.laboratoryId) &&
      lab?.manager_id !== actorId
    ) {
      throw new DbForbiddenError(
        'Access denied. Faculty can only manage equipment and approvals in their assigned labs.',
      );
    }
    return targetEq;
  },

  async createProject(input: {
    ownerId: string;
    ownerName: string;
    title: string;
    grantCode: string;
    department: string;
    category: string;
    description: string;
    deadline: string;
    recommendedEquipmentIds?: string[];
    aiAnalysisSummary?: string;
  }): Promise<ResearchProject> {
    const sb = requireSb();
    const validUuidIds = (input.recommendedEquipmentIds || []).filter((id) =>
      /^[0-9a-f-]{36}$/i.test(id),
    );
    const { data, error } = await sb
      .from('projects')
      .insert({
        owner_id: input.ownerId,
        owner_name: input.ownerName,
        title: input.title,
        grant_code: input.grantCode,
        department: input.department,
        category: input.category,
        description: input.description,
        deadline: input.deadline,
        progress: 15,
        tone: 'mint',
        icon: 'science',
        recommended_equipment_ids: validUuidIds,
        ai_analysis_summary: input.aiAnalysisSummary || null,
        status: 'active',
      })
      .select('*')
      .single();
    throwIfError(error, 'Create project');

    return {
      id: String(data.id),
      ownerId: String(data.owner_id),
      ownerName: String(data.owner_name),
      title: String(data.title),
      grantCode: String(data.grant_code),
      department: String(data.department),
      category: String(data.category),
      description: String(data.description),
      deadline: String(data.deadline).slice(0, 10),
      progress: Number(data.progress),
      tone: data.tone as ResearchProject['tone'],
      icon: String(data.icon),
      recommendedEquipmentIds: (data.recommended_equipment_ids as string[]) || [],
      aiAnalysisSummary: data.ai_analysis_summary || undefined,
      status: data.status as ResearchProject['status'],
    };
  },

  async createAccessRequest(input: {
    userId: string;
    projectId: string;
    equipmentId: string;
    requestedHours: number;
    preferredDate: string;
    justification: string;
  }): Promise<AccessRequest> {
    const sb = requireSb();
    const { data: proj, error: pErr } = await sb
      .from('projects')
      .select('*')
      .eq('id', input.projectId)
      .single();
    throwIfError(pErr, 'Verify project');
    if (proj.owner_id !== input.userId) {
      throw new DbForbiddenError('You can only submit access requests for your own projects.');
    }

    const { data: eq, error: eErr } = await sb
      .from('equipment')
      .select('id, name')
      .eq('id', input.equipmentId)
      .single();
    throwIfError(eErr, 'Verify equipment');
    if (!eq) throw new Error('Equipment not found.');

    const { data: usr } = await sb
      .from('profiles')
      .select('full_name, department')
      .eq('id', input.userId)
      .single();

    const { data: inserted, error } = await sb
      .from('access_requests')
      .insert({
        project_id: input.projectId,
        user_id: input.userId,
        equipment_id: input.equipmentId,
        requested_hours: input.requestedHours,
        preferred_date: input.preferredDate,
        justification: input.justification,
        status: 'pending',
      })
      .select('*')
      .single();
    throwIfError(error, 'Create access request');

    return {
      id: String(inserted.id),
      projectId: String(inserted.project_id),
      projectTitle: String(proj.title),
      userId: String(inserted.user_id),
      userName: String(usr?.full_name || proj.owner_name || 'Student'),
      userDepartment: String(usr?.department || proj.department),
      equipmentId: String(inserted.equipment_id),
      equipmentName: String(eq.name),
      requestedHours: Number(inserted.requested_hours),
      preferredDate: String(inserted.preferred_date),
      deadline: String(proj.deadline).slice(0, 10),
      justification: String(inserted.justification),
      status: inserted.status as AccessRequestStatus,
      createdAt: String(inserted.created_at),
    };
  },

  async decideAccessRequest(input: {
    requestId: string;
    actorId: string;
    actorRole: UserRole;
    actorName: string;
    decision: 'approved' | 'rejected' | 'alternative_suggested';
    reviewerNotes?: string;
    alternative?: AccessRequest['suggestedAlternative'];
  }): Promise<AccessRequest> {
    const sb = requireSb();
    const { data: existing, error: fErr } = await sb
      .from('access_requests')
      .select('*')
      .eq('id', input.requestId)
      .single();
    throwIfError(fErr, 'Find access request');

    const eq = await this.assertFacultyScopeForEquipment(
      input.actorId,
      input.actorRole,
      String(existing.equipment_id),
    );

    const { data: updated, error: uErr } = await sb
      .from('access_requests')
      .update({
        status: input.decision,
        faculty_reviewer_id: input.actorId,
        faculty_reviewer_name: input.actorName,
        reviewer_notes: input.reviewerNotes || null,
        suggested_alternative: input.alternative || null,
        updated_at: new Date().toISOString(),
      })
      .eq('id', input.requestId)
      .select('*')
      .single();
    throwIfError(uErr, 'Update access request');

    await sb.from('notifications').insert({
      user_id: existing.user_id,
      title:
        input.decision === 'approved'
          ? 'Project Access Approved'
          : input.decision === 'alternative_suggested'
            ? 'Alternative Suggested for Project Access'
            : 'Project Access Declined',
      message: `${eq.name} request reviewed by ${input.actorName}${input.reviewerNotes ? `: ${input.reviewerNotes}` : '.'}`,
      type:
        input.decision === 'approved'
          ? 'confirmed'
          : input.decision === 'rejected'
            ? 'warning'
            : 'ai',
      read: false,
    });

    const [{ data: proj }, { data: usr }] = await Promise.all([
      sb.from('projects').select('title, deadline').eq('id', existing.project_id).single(),
      sb.from('profiles').select('full_name, department').eq('id', existing.user_id).single(),
    ]);

    return {
      id: String(updated.id),
      projectId: String(updated.project_id),
      projectTitle: String(proj?.title || 'Research Project'),
      userId: String(updated.user_id),
      userName: String(usr?.full_name || 'Student'),
      userDepartment: String(usr?.department || 'Engineering'),
      equipmentId: String(updated.equipment_id),
      equipmentName: eq.name,
      requestedHours: Number(updated.requested_hours),
      preferredDate: String(updated.preferred_date),
      deadline: proj?.deadline ? String(proj.deadline).slice(0, 10) : '',
      justification: String(updated.justification),
      status: updated.status as AccessRequestStatus,
      suggestedAlternative: updated.suggested_alternative as AccessRequest['suggestedAlternative'],
      facultyReviewerName: String(updated.faculty_reviewer_name || input.actorName),
      reviewerNotes: updated.reviewer_notes || undefined,
      createdAt: String(updated.created_at),
    };
  },

  async createBookingAtomic(input: {
    equipmentId: string;
    userId: string;
    projectId?: string;
    date: string;
    startHour: number;
    durationHours: number;
    submitToFairSlotOnConflict?: boolean;
  }): Promise<{
    booking?: Booking;
    conflictCase?: FairSlotConflictCase;
    conflictError?: string;
    suggestedAlternative?: FairSlotConflictCase['alternatives'][number];
  }> {
    const sb = requireSb();
    const { equipment } = await this.getDepartmentsAndLabsAndEquipment();
    const equipmentMap = new Map(equipment.map((e) => [e.id, e]));
    const eq = equipmentMap.get(input.equipmentId);
    if (!eq) throw new Error('Selected equipment was not found.');
    if (eq.status === 'maintenance') {
      throw new Error(`${eq.name} is currently under maintenance and cannot be booked.`);
    }

    const { data: profilesData, error: pErr } = await sb.from('profiles').select('*');
    throwIfError(pErr, 'Load user profiles');
    const profiles = ((profilesData || []) as Array<Record<string, unknown>>).map(mapProfileRow);
    const profileMap = new Map(profiles.map((p) => [p.id, p]));
    const user = profileMap.get(input.userId);
    if (!user) throw new Error('Authenticated user profile not found.');

    const allProjects = await this.getProjects(undefined, 'admin');
    const projectMap = new Map(allProjects.map((p) => [p.id, p]));
    const project = input.projectId ? projectMap.get(input.projectId) : undefined;

    const allBookings = await this.getAllBookingsMapped(equipmentMap, profileMap, projectMap);
    const conflicts = allBookings.filter((b) => {
      if (b.equipmentId !== input.equipmentId || b.date !== input.date) return false;
      if (b.status !== 'confirmed' && b.status !== 'pending') return false;
      const bEnd = b.startHour + b.durationHours;
      return input.startHour < bEnd && b.startHour < input.startHour + input.durationHours;
    });

    if (conflicts.length > 0) {
      const existing = conflicts[0];
      if (!input.submitToFairSlotOnConflict) {
        const realAlts = findRealAlternativeSlots({
          targetEquipment: eq,
          allEquipment: equipment,
          activeBookings: allBookings,
          date: input.date,
          requestedStartHour: input.startHour,
          durationHours: input.durationHours,
          deadlineIso: project?.deadline,
        });
        const bestAlt = realAlts[0];
        return {
          conflictError: `Time ${String(input.startHour).padStart(2, '0')}:00–${String(input.startHour + input.durationHours).padStart(2, '0')}:00 on ${input.date} is already booked.${bestAlt ? ` Next open option: ${bestAlt.timeLabel} (${bestAlt.equipmentName}).` : ''} Send to Smart Booking for fair review.`,
          suggestedAlternative: bestAlt,
        };
      }

      const existingUser = profileMap.get(existing.userId) || {
        id: existing.userId,
        name: existing.userName,
        title: existing.userRoleTitle,
        weeklyQuotaHours: 6,
        usedHoursThisWeek: 2,
        certifications: ['General Lab Safety'],
      };
      const existingProj = existing.projectId ? projectMap.get(existing.projectId) : undefined;
      const tempCode = `FS-${Date.now().toString().slice(-5)}`;
      const conflictDraft = buildDeterministicConflictCase({
        caseId: tempCode.toLowerCase(),
        equipment: eq,
        allEquipment: equipment,
        allBookings,
        date: input.date,
        conflictStartHour: input.startHour,
        conflictDurationHours: input.durationHours,
        existingBooking: existing,
        existingUser,
        existingProject: existingProj,
        incomingUser: user,
        incomingProject: project,
        incomingProjectTitleFallback: project ? project.title : 'Lab Session',
      });
      conflictDraft.caseCode = `CASE #${tempCode}`;

      const { data: insertedConflict, error: cErr } = await sb
        .from('conflict_resolutions')
        .insert({
          case_code: conflictDraft.caseCode,
          equipment_id: eq.id,
          booking_date: input.date,
          conflict_start_hour: conflictDraft.conflictStartHour,
          conflict_end_hour: conflictDraft.conflictEndHour,
          status: 'open',
          fairness_score: conflictDraft.fairnessScore,
          headline_recommendation: conflictDraft.headlineRecommendation,
          explanation: conflictDraft.explanation,
          candidates: conflictDraft.candidates,
          factors: conflictDraft.factors,
          alternatives: conflictDraft.alternatives,
          timeline_blocks: conflictDraft.timelineBlocks,
          selected_alternative_id: conflictDraft.selectedAlternativeId || null,
        })
        .select('*')
        .single();
      throwIfError(cErr, 'Save Smart Booking conflict');

      return {
        conflictCase: {
          ...conflictDraft,
          id: String(insertedConflict.id),
        },
      };
    }

    // Attempt atomic INSERT protected by PostgreSQL exclusion constraint `no_overlapping_active_bookings`
    const status: Booking['status'] =
      eq.requiresFacultyApproval && user.role === 'student' ? 'pending' : 'confirmed';
    const totalCost = eq.hourlyRate * input.durationHours;
    const aiNote =
      status === 'pending'
        ? 'No conflicts found. Waiting for faculty sign-off.'
        : undefined;

    const validProjectId = project?.id || null;
    const { data: insertedBooking, error: bErr } = await sb
      .from('bookings')
      .insert({
        equipment_id: eq.id,
        user_id: user.id,
        project_id: validProjectId,
        booking_date: input.date,
        start_hour: input.startHour,
        duration_hours: input.durationHours,
        status,
        total_cost: totalCost,
        urgency_tag: status === 'pending' ? 'Routine' : null,
        ai_note: aiNote || null,
      })
      .select('*')
      .single();

    if (bErr) {
      throwIfError(bErr, 'Create booking');
    }

    await Promise.all([
      sb
        .from('equipment')
        .update({ total_bookings: eq.totalBookings + 1 })
        .eq('id', eq.id),
      sb
        .from('profiles')
        .update({ used_hours_this_week: user.usedHoursThisWeek + input.durationHours })
        .eq('id', user.id),
      sb.from('notifications').insert({
        user_id: user.id,
        title: status === 'confirmed' ? 'Booking Confirmed' : 'Booking Request Sent',
        message: `${eq.name} · ${input.date} at ${String(input.startHour).padStart(2, '0')}:00 (${input.durationHours}h).`,
        type: status === 'confirmed' ? 'confirmed' : 'info',
        read: false,
      }),
    ]);

    return {
      booking: {
        id: String(insertedBooking.id),
        equipmentId: eq.id,
        equipmentName: eq.name,
        userId: user.id,
        userName: user.name,
        userRoleTitle: user.title,
        projectId: validProjectId || '',
        projectTitle: project ? `${project.title} (${project.grantCode})` : 'General Lab Research',
        date: String(insertedBooking.booking_date),
        startHour: Number(insertedBooking.start_hour),
        durationHours: Number(insertedBooking.duration_hours),
        status,
        totalCost,
        urgencyTag: status === 'pending' ? 'Routine' : undefined,
        aiNote,
        createdAt: String(insertedBooking.created_at),
      },
    };
  },

  async decideBooking(params: {
    bookingId: string;
    decision: 'confirmed' | 'rejected' | 'alternative_suggested';
    actorId: string;
    actorRole: UserRole;
    actorName: string;
    alternative?: Booking['suggestedAlternative'];
  }): Promise<Booking> {
    const sb = requireSb();
    const { data: existing, error: fErr } = await sb
      .from('bookings')
      .select('*')
      .eq('id', params.bookingId)
      .single();
    throwIfError(fErr, 'Find booking');

    const eq = await this.assertFacultyScopeForEquipment(
      params.actorId,
      params.actorRole,
      String(existing.equipment_id),
    );

    const { data: updated, error: uErr } = await sb
      .from('bookings')
      .update({
        status: params.decision,
        faculty_reviewer_id: params.actorId,
        faculty_reviewer_name: params.actorName,
        suggested_alternative: params.alternative || null,
        updated_at: new Date().toISOString(),
      })
      .eq('id', params.bookingId)
      .select('*')
      .single();
    throwIfError(uErr, 'Decide booking');

    await sb.from('notifications').insert({
      user_id: existing.user_id,
      title:
        params.decision === 'confirmed'
          ? 'Faculty Approved Booking'
          : params.decision === 'alternative_suggested'
            ? 'New Time Suggested'
            : 'Booking Declined',
      message: `${eq.name} (${existing.booking_date}) reviewed by ${params.actorName}.`,
      type:
        params.decision === 'confirmed'
          ? 'confirmed'
          : params.decision === 'rejected'
            ? 'warning'
            : 'ai',
      read: false,
    });

    const { data: usr } = await sb
      .from('profiles')
      .select('full_name, title')
      .eq('id', existing.user_id)
      .single();
    const proj = existing.project_id
      ? (await sb.from('projects').select('title, grant_code').eq('id', existing.project_id).single()).data
      : null;

    return {
      id: String(updated.id),
      equipmentId: eq.id,
      equipmentName: eq.name,
      userId: String(updated.user_id),
      userName: String(usr?.full_name || 'Student'),
      userRoleTitle: String(usr?.title || 'Student Researcher'),
      projectId: updated.project_id ? String(updated.project_id) : '',
      projectTitle: proj ? `${proj.title} (${proj.grant_code})` : 'General Lab Research',
      date: String(updated.booking_date),
      startHour: Number(updated.start_hour),
      durationHours: Number(updated.duration_hours),
      status: updated.status as Booking['status'],
      totalCost: Number(updated.total_cost),
      urgencyTag: updated.urgency_tag || undefined,
      aiNote: updated.ai_note || undefined,
      suggestedAlternative: updated.suggested_alternative || undefined,
      facultyReviewerName: String(updated.faculty_reviewer_name || params.actorName),
      createdAt: String(updated.created_at),
    };
  },

  async cancelBooking(bookingId: string, actorUserId: string, actorRole: UserRole): Promise<Booking> {
    const sb = requireSb();
    const { data: existing, error: fErr } = await sb
      .from('bookings')
      .select('*')
      .eq('id', bookingId)
      .single();
    throwIfError(fErr, 'Find booking');

    if (existing.user_id !== actorUserId && actorRole !== 'admin') {
      await this.assertFacultyScopeForEquipment(
        actorUserId,
        actorRole,
        String(existing.equipment_id),
      );
    }

    const { data: updated, error: uErr } = await sb
      .from('bookings')
      .update({ status: 'cancelled', updated_at: new Date().toISOString() })
      .eq('id', bookingId)
      .select('*')
      .single();
    throwIfError(uErr, 'Cancel booking');

    const { data: prof } = await sb
      .from('profiles')
      .select('full_name, title, used_hours_this_week')
      .eq('id', existing.user_id)
      .single();
    if (prof) {
      const nextUsed = Math.max(0, Number(prof.used_hours_this_week || 0) - Number(existing.duration_hours || 0));
      await sb.from('profiles').update({ used_hours_this_week: nextUsed }).eq('id', existing.user_id);
    }

    const { data: eq } = await sb
      .from('equipment')
      .select('name')
      .eq('id', existing.equipment_id)
      .single();

    return {
      id: String(updated.id),
      equipmentId: String(updated.equipment_id),
      equipmentName: String(eq?.name || 'Equipment'),
      userId: String(updated.user_id),
      userName: String(prof?.full_name || 'Student'),
      userRoleTitle: String(prof?.title || 'Student Researcher'),
      projectId: updated.project_id ? String(updated.project_id) : '',
      projectTitle: 'Lab Booking',
      date: String(updated.booking_date),
      startHour: Number(updated.start_hour),
      durationHours: Number(updated.duration_hours),
      status: 'cancelled',
      totalCost: Number(updated.total_cost),
      createdAt: String(updated.created_at),
    };
  },

  async resolveConflict(params: {
    conflictId: string;
    mode: 'resolved_ai' | 'overridden_faculty';
    alternativeId?: string;
    actorId: string;
    actorRole: UserRole;
    actorName: string;
  }): Promise<{ conflict: FairSlotConflictCase; createdBooking?: Booking }> {
    const sb = requireSb();
    const { data: existing, error: fErr } = await sb
      .from('conflict_resolutions')
      .select('*')
      .eq('id', params.conflictId)
      .single();
    throwIfError(fErr, 'Find conflict case');

    await this.assertFacultyScopeForEquipment(
      params.actorId,
      params.actorRole,
      String(existing.equipment_id),
    );

    const alternatives = (existing.alternatives || []) as FairSlotConflictCase['alternatives'];
    const candidates = (existing.candidates || []) as FairSlotConflictCase['candidates'];
    const chosenAlt =
      alternatives.find((a) => a.id === params.alternativeId) || alternatives[0];
    const displacedCandidate = candidates[1];

    let createdBooking: Booking | undefined;
    if (chosenAlt && displacedCandidate) {
      const { equipment } = await this.getDepartmentsAndLabsAndEquipment();
      const targetEq = equipment.find((e) => e.id === chosenAlt.equipmentId);
      const validProjId =
        displacedCandidate.projectId && /^[0-9a-f-]{36}$/i.test(displacedCandidate.projectId)
          ? displacedCandidate.projectId
          : null;

      const { data: insertedBk, error: bkErr } = await sb
        .from('bookings')
        .insert({
          equipment_id: chosenAlt.equipmentId,
          user_id: displacedCandidate.studentId,
          project_id: validProjId,
          booking_date: chosenAlt.date,
          start_hour: chosenAlt.startHour,
          duration_hours: chosenAlt.durationHours,
          status: 'confirmed',
          total_cost: (targetEq?.hourlyRate || 15) * chosenAlt.durationHours,
          faculty_reviewer_id: params.actorId,
          faculty_reviewer_name: params.actorName,
          ai_note: `Scheduled via Smart Booking (${params.mode === 'resolved_ai' ? 'Smart Plan Approved' : 'Faculty Choice'}).`,
        })
        .select('*')
        .single();
      throwIfError(bkErr, 'Confirm alternative slot booking');

      createdBooking = {
        id: String(insertedBk.id),
        equipmentId: chosenAlt.equipmentId,
        equipmentName: chosenAlt.equipmentName,
        userId: displacedCandidate.studentId,
        userName: displacedCandidate.studentName,
        userRoleTitle: displacedCandidate.studentTitle,
        projectId: validProjId || '',
        projectTitle: displacedCandidate.projectTitle,
        date: chosenAlt.date,
        startHour: chosenAlt.startHour,
        durationHours: chosenAlt.durationHours,
        status: 'confirmed',
        totalCost: Number(insertedBk.total_cost),
        facultyReviewerName: params.actorName,
        aiNote: insertedBk.ai_note || undefined,
        createdAt: String(insertedBk.created_at),
      };

      await sb.from('notifications').insert({
        user_id: displacedCandidate.studentId,
        title: 'New Booking Slot Confirmed',
        message: `${chosenAlt.equipmentName} scheduled for ${chosenAlt.timeLabel} by ${params.actorName}.`,
        type: 'confirmed',
        read: false,
      });
    }

    const { data: updated, error: uErr } = await sb
      .from('conflict_resolutions')
      .update({
        status: params.mode,
        resolved_by: params.actorId,
        resolved_by_name: params.actorName,
        selected_alternative_id: chosenAlt?.id || existing.selected_alternative_id,
        updated_at: new Date().toISOString(),
      })
      .eq('id', params.conflictId)
      .select('*')
      .single();
    throwIfError(uErr, 'Update conflict resolution');

    const { equipment } = await this.getDepartmentsAndLabsAndEquipment();
    const eq = equipment.find((e) => e.id === String(updated.equipment_id));

    return {
      conflict: {
        id: String(updated.id),
        caseCode: String(updated.case_code),
        equipmentId: String(updated.equipment_id),
        equipmentName: eq?.name || 'Lab Equipment',
        bayLabel: eq?.locationLabel || 'Campus Lab',
        date: String(updated.booking_date),
        conflictStartHour: Number(updated.conflict_start_hour),
        conflictEndHour: Number(updated.conflict_end_hour),
        status: updated.status as FairSlotConflictCase['status'],
        fairnessScore: Number(updated.fairness_score),
        headlineRecommendation: String(updated.headline_recommendation),
        explanation: String(updated.explanation),
        candidates,
        factors: (updated.factors || []) as FairSlotConflictCase['factors'],
        alternatives,
        timelineBlocks: (updated.timeline_blocks || []) as FairSlotConflictCase['timelineBlocks'],
        selectedAlternativeId: updated.selected_alternative_id || undefined,
        resolvedBy: updated.resolved_by_name || undefined,
      },
      createdBooking,
    };
  },

  async addEquipment(input: Omit<Equipment, 'id' | 'totalBookings'>): Promise<Equipment> {
    const sb = requireSb();
    const { data, error } = await sb
      .from('equipment')
      .insert({
        code: input.code,
        name: input.name,
        category: input.category,
        department_id: input.departmentId,
        laboratory_id: input.laboratoryId,
        location_label: input.locationLabel,
        status: input.status,
        hourly_rate: input.hourlyRate,
        requires_faculty_approval: input.requiresFacultyApproval,
        certification_required: input.certificationRequired,
        biosafety_level: input.biosafetyLevel,
        next_slot_label: input.nextSlotLabel,
        last_calibrated_label: input.lastCalibrated,
        total_bookings: 0,
        short_purpose: input.shortPurpose,
        description: input.description,
        specs_preview: input.specsPreview,
        specs: input.specs,
        guidelines: input.guidelines,
        image_url: input.imageUrl,
        clay_theme: input.clayTheme,
        is_sample_data: false,
      })
      .select('*')
      .single();
    throwIfError(error, 'Insert equipment');

    return {
      ...input,
      id: String(data.id),
      totalBookings: 0,
      isSampleData: false,
    };
  },

  async updateEquipment(
    id: string,
    patch: Partial<
      Pick<
        Equipment,
        | 'name'
        | 'category'
        | 'departmentId'
        | 'departmentName'
        | 'laboratoryId'
        | 'locationLabel'
        | 'hourlyRate'
        | 'requiresFacultyApproval'
        | 'certificationRequired'
        | 'description'
        | 'specsPreview'
        | 'status'
      >
    >,
  ): Promise<Equipment> {
    const sb = requireSb();
    const dbPatch: Record<string, unknown> = {};
    if (patch.name !== undefined) dbPatch.name = patch.name;
    if (patch.category !== undefined) dbPatch.category = patch.category;
    if (patch.departmentId !== undefined) dbPatch.department_id = patch.departmentId;
    if (patch.laboratoryId !== undefined) dbPatch.laboratory_id = patch.laboratoryId;
    if (patch.locationLabel !== undefined) dbPatch.location_label = patch.locationLabel;
    if (patch.hourlyRate !== undefined) dbPatch.hourly_rate = patch.hourlyRate;
    if (patch.requiresFacultyApproval !== undefined) {
      dbPatch.requires_faculty_approval = patch.requiresFacultyApproval;
    }
    if (patch.certificationRequired !== undefined) {
      dbPatch.certification_required = patch.certificationRequired;
    }
    if (patch.description !== undefined) dbPatch.description = patch.description;
    if (patch.specsPreview !== undefined) dbPatch.specs_preview = patch.specsPreview;
    if (patch.status !== undefined) dbPatch.status = patch.status;

    const { error } = await sb.from('equipment').update(dbPatch).eq('id', id);
    throwIfError(error, 'Update equipment');
    const { equipment } = await this.getDepartmentsAndLabsAndEquipment();
    const updated = equipment.find((e) => e.id === id);
    if (!updated) throw new Error('Equipment not found.');
    return updated;
  },

  async deleteEquipment(id: string): Promise<void> {
    const sb = requireSb();
    const { error } = await sb.from('equipment').delete().eq('id', id);
    throwIfError(error, 'Delete equipment');
  },

  async updateEquipmentStatus(
    id: string,
    status: Equipment['status'],
    actorId?: string,
    actorRole?: UserRole,
  ): Promise<Equipment> {
    if (actorId && actorRole) {
      await this.assertFacultyScopeForEquipment(actorId, actorRole, id);
    }
    return this.updateEquipment(id, { status });
  },

  async addDepartment(input: Omit<Department, 'id'>): Promise<Department> {
    const sb = requireSb();
    const { data, error } = await sb
      .from('departments')
      .insert({
        name: input.name,
        code: input.code,
        head_name: input.headName,
        uptime_percent: input.uptimePercent,
        accent_color: input.accentColor,
        icon: input.icon,
      })
      .select('*')
      .single();
    throwIfError(error, 'Create department');
    return {
      ...input,
      id: String(data.id),
    };
  },

  async addLaboratory(input: Omit<Laboratory, 'id'>): Promise<Laboratory> {
    const sb = requireSb();
    const { data, error } = await sb
      .from('laboratories')
      .insert({
        name: input.name,
        department_id: input.departmentId,
        building: input.building,
        room: input.room,
        access_level: input.accessLevel,
        capacity: input.capacity,
        occupied: input.occupied,
        status: input.status,
        manager_name: input.managerName,
        manager_title: input.managerTitle,
        lat: input.coordinates.lat,
        lng: input.coordinates.lng,
        x_percent: input.coordinates.xPercent,
        y_percent: input.coordinates.yPercent,
      })
      .select('*')
      .single();
    throwIfError(error, 'Create laboratory');
    return {
      ...input,
      id: String(data.id),
    };
  },

  async addMaintenance(input: Omit<MaintenanceLog, 'id'>): Promise<MaintenanceLog> {
    const sb = requireSb();
    const { data, error } = await sb
      .from('maintenance_logs')
      .insert({
        equipment_id: input.equipmentId,
        technician: input.technician,
        task_title: input.taskTitle,
        status: input.status,
        scheduled_date: input.scheduledDate,
        notes: input.notes,
      })
      .select('*')
      .single();
    throwIfError(error, 'Create maintenance log');

    if (input.status === 'in_progress') {
      await sb.from('equipment').update({ status: 'maintenance' }).eq('id', input.equipmentId);
    } else if (input.status === 'cleared') {
      await sb.from('equipment').update({ status: 'available' }).eq('id', input.equipmentId);
    }

    return {
      ...input,
      id: String(data.id),
    };
  },

  async markNotificationRead(id: string, userId: string): Promise<void> {
    const sb = requireSb();
    const { error } = await sb
      .from('notifications')
      .update({ read: true })
      .eq('id', id)
      .eq('user_id', userId);
    throwIfError(error, 'Mark notification read');
  },

  async updateUserRole(userId: string, newRole: UserRole): Promise<UserProfile> {
    const sb = requireSb();
    const { data: userRow, error: fErr } = await sb
      .from('profiles')
      .select('*')
      .eq('id', userId)
      .single();
    throwIfError(fErr, 'Find user');

    if (newRole === 'admin') {
      const { data: allowRow } = await sb
        .from('authorized_admins')
        .select('email')
        .ilike('email', String(userRow.email))
        .maybeSingle();
      if (!allowRow) {
        throw new Error(
          'This email must be added to the Authorized Admin List before granting admin role.',
        );
      }
    }

    const { data: updated, error: uErr } = await sb
      .from('profiles')
      .update({
        role: newRole,
        faculty_approval_status: newRole === 'faculty' ? 'approved' : userRow.faculty_approval_status,
        weekly_quota_hours: newRole === 'student' ? 6 : newRole === 'faculty' ? 20 : 40,
        updated_at: new Date().toISOString(),
      })
      .eq('id', userId)
      .select('*')
      .single();
    throwIfError(uErr, 'Update user role');
    return mapProfileRow(updated);
  },

  async decideFacultyRequest(params: {
    userId: string;
    decision: 'approved' | 'rejected';
    assignedLabIds?: string[];
    reviewerName: string;
  }): Promise<UserProfile> {
    const sb = requireSb();
    const { data: userRow, error: fErr } = await sb
      .from('profiles')
      .select('*')
      .eq('id', params.userId)
      .single();
    throwIfError(fErr, 'Find applicant');

    const isApproved = params.decision === 'approved';
    const labIds = (params.assignedLabIds || []).filter((id) => /^[0-9a-f-]{36}$/i.test(id));
    const { data: updated, error: uErr } = await sb
      .from('profiles')
      .update({
        role: isApproved ? 'faculty' : 'student',
        faculty_approval_status: params.decision,
        assigned_lab_ids: isApproved ? labIds : [],
        weekly_quota_hours: isApproved ? 20 : 6,
        title: isApproved
          ? `Faculty Lead • ${userRow.department}`
          : `Student Researcher • ${userRow.department}`,
        updated_at: new Date().toISOString(),
      })
      .eq('id', params.userId)
      .select('*')
      .single();
    throwIfError(uErr, 'Review faculty request');

    await sb.from('notifications').insert({
      user_id: params.userId,
      title: isApproved ? 'Faculty Account Approved' : 'Faculty Request Declined',
      message: isApproved
        ? `Your faculty role was approved by ${params.reviewerName}. You can now review lab requests.`
        : `Your faculty account request was declined by ${params.reviewerName}.`,
      type: isApproved ? 'confirmed' : 'warning',
      read: false,
    });

    return mapProfileRow(updated);
  },

  async createFacultyAccount(payload: {
    email: string;
    name: string;
    department: string;
    password: string;
    assignedLabIds?: string[];
  }): Promise<UserProfile> {
    const sb = requireSb();
    const email = payload.email.trim().toLowerCase();
    const { data, error } = await sb.auth.admin.createUser({
      email,
      password: payload.password,
      email_confirm: true,
      user_metadata: {
        full_name: payload.name.trim(),
        department: payload.department.trim() || 'Bioengineering',
      },
    });
    if (error || !data.user) {
      throw new Error(error?.message || 'Unable to create faculty account.');
    }

    const labIds = (payload.assignedLabIds || []).filter((id) => /^[0-9a-f-]{36}$/i.test(id));
    const { data: updated, error: uErr } = await sb
      .from('profiles')
      .upsert(
        {
          id: data.user.id,
          email,
          full_name: payload.name.trim(),
          role: 'faculty',
          faculty_approval_status: 'approved',
          department: payload.department.trim() || 'Bioengineering',
          title: `Faculty Lead • ${payload.department.trim() || 'Bioengineering'}`,
          weekly_quota_hours: 20,
          assigned_lab_ids: labIds,
          certifications: ['General Lab Safety', 'Faculty Approver'],
        },
        { onConflict: 'id' },
      )
      .select('*')
      .single();
    throwIfError(uErr, 'Save faculty profile');
    return mapProfileRow(updated);
  },

  async isAuthorizedAdmin(email: string): Promise<boolean> {
    const sb = requireSb();
    const { data, error } = await sb
      .from('authorized_admins')
      .select('email')
      .ilike('email', email.trim().toLowerCase())
      .maybeSingle();
    if (error) {
      if (error.code === '42P01' || error.code === 'PGRST205') return false;
      throwIfError(error, 'Check authorized admin');
    }
    return Boolean(data);
  },

  async getAuthorizedAdmins(): Promise<AuthorizedAdminEntry[]> {
    const sb = requireSb();
    const { data, error } = await sb
      .from('authorized_admins')
      .select('*')
      .order('created_at', { ascending: true });
    throwIfError(error, 'Load authorized admins');
    return ((data || []) as Array<Record<string, unknown>>).map((a) => ({
      email: String(a.email),
      name: String(a.name || a.email),
      grantedBy: String(a.granted_by || 'System Setup'),
      createdAt: String(a.created_at),
    }));
  },

  async grantAuthorizedAdmin(
    email: string,
    name: string,
    grantedBy: string,
  ): Promise<AuthorizedAdminEntry[]> {
    const sb = requireSb();
    const normalized = email.trim().toLowerCase();
    const { data: matchingProfile } = await sb
      .from('profiles')
      .select('id')
      .ilike('email', normalized)
      .maybeSingle();

    const { error } = await sb.from('authorized_admins').upsert(
      {
        email: normalized,
        name: name.trim() || normalized,
        user_id: matchingProfile?.id || null,
        granted_by: grantedBy,
      },
      { onConflict: 'email' },
    );
    throwIfError(error, 'Grant authorized admin');

    if (matchingProfile?.id) {
      await sb
        .from('profiles')
        .update({ role: 'admin', weekly_quota_hours: 40 })
        .eq('id', matchingProfile.id);
    }

    return this.getAuthorizedAdmins();
  },

  async revokeAuthorizedAdmin(
    email: string,
    actorEmail: string,
  ): Promise<AuthorizedAdminEntry[]> {
    const sb = requireSb();
    const normalized = email.trim().toLowerCase();
    if (normalized === actorEmail.trim().toLowerCase()) {
      throw new Error('You cannot remove your own active administrator email.');
    }
    const current = await this.getAuthorizedAdmins();
    if (current.length <= 1) {
      throw new Error('At least one authorized administrator must remain.');
    }
    const { error } = await sb.from('authorized_admins').delete().ilike('email', normalized);
    throwIfError(error, 'Revoke authorized admin');

    await sb.from('profiles').update({ role: 'faculty' }).ilike('email', normalized);
    return this.getAuthorizedAdmins();
  },
};
