import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import type {
  AccessRequest,
  AccessRequestStatus,
  AppNotification,
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
import { buildDeterministicConflictCase, findRealAlternativeSlots } from './allocation.js';
import { computeRealUtilizationAnalytics } from './analytics.js';
import { hashPassword, verifyPassword } from './auth.js';

export interface StoredUser extends UserProfile {
  passwordHash: string;
}

export interface LabLinkDatabase {
  catalogVersion?: number;
  users: StoredUser[];
  authorizedAdmins: Array<{
    email: string;
    name: string;
    grantedBy: string;
    createdAt: string;
  }>;
  departments: Department[];
  laboratories: Laboratory[];
  equipment: Equipment[];
  projects: ResearchProject[];
  accessRequests: AccessRequest[];
  bookings: Booking[];
  conflicts: FairSlotConflictCase[];
  maintenance: MaintenanceLog[];
  notifications: AppNotification[];
}

const CURRENT_CATALOG_VERSION = 2;
const DATA_DIR = path.resolve(process.cwd(), '.data');
const DATA_FILE = path.join(DATA_DIR, 'lablink-db.json');

export function getSupabaseAdminClient(): SupabaseClient | null {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return null;
  return createClient(url, key, { auth: { persistSession: false } });
}

function getTodayDateString(offsetDays = 0): string {
  const d = new Date();
  d.setDate(d.getDate() + offsetDays);
  return d.toISOString().slice(0, 10);
}

function createInitialSeed(): LabLinkDatabase {
  const defaultPassHash = hashPassword('lablink2026');
  const today = getTodayDateString(0);
  const tomorrow = getTodayDateString(1);
  const inTwoDays = getTodayDateString(2);

  const users: StoredUser[] = [
    {
      id: 'usr-alex',
      email: 'alex.rivera@lablink.edu',
      name: 'Alex Rivera',
      role: 'student',
      department: 'Bioengineering',
      title: 'Graduate Researcher • Bioengineering',
      weeklyQuotaHours: 6,
      usedHoursThisWeek: 2.5,
      certifications: ['General Lab Safety', '3D Printer & Laser Intro', 'Robotics Lab Safety'],
      passwordHash: defaultPassHash,
    },
    {
      id: 'usr-maya',
      email: 'maya.lin@lablink.edu',
      name: 'Maya Lin',
      role: 'student',
      department: 'Materials Science',
      title: 'PhD Candidate • Materials Science',
      weeklyQuotaHours: 6,
      usedHoursThisWeek: 2.0,
      certifications: ['General Lab Safety', 'CNC Machine Safety', 'Laser Cutter Certified'],
      passwordHash: defaultPassHash,
    },
    {
      id: 'usr-liam',
      email: 'liam.vance@lablink.edu',
      name: 'Liam Vance',
      role: 'student',
      department: 'Chemical Engineering',
      title: 'M.S. Researcher • Chemical Eng.',
      weeklyQuotaHours: 6,
      usedHoursThisWeek: 4.5,
      certifications: ['General Lab Safety', 'NMR Cryogen Safety', 'XRD Radiation Safety'],
      passwordHash: defaultPassHash,
    },
    {
      id: 'usr-elena',
      email: 'elena.rostova@lablink.edu',
      name: 'Dr. Elena Rostova',
      role: 'faculty',
      department: 'Electronics & Robotics',
      title: 'Faculty Lead • Robotics & Circuits',
      weeklyQuotaHours: 20,
      usedHoursThisWeek: 4.0,
      certifications: ['General Lab Safety', 'Workshop Green Tag', 'Laser Safety', 'Faculty Approver'],
      assignedLabIds: ['lab-electronics', 'lab-robotics', 'lab-testing'],
      passwordHash: defaultPassHash,
    },
    {
      id: 'usr-admin',
      email: (process.env.ADMIN_EMAIL || 'admin@lablink.edu').trim().toLowerCase(),
      name: 'Marcus Chen',
      role: 'admin',
      department: 'Campus Lab Operations',
      title: 'Platform Administrator',
      weeklyQuotaHours: 40,
      usedHoursThisWeek: 1.0,
      certifications: ['System Administrator', 'Safety Officer', 'Calibration Lead'],
      passwordHash: '',
    },
  ];

  const authorizedAdmins = [
    {
      email: (process.env.ADMIN_EMAIL || 'admin@lablink.edu').trim().toLowerCase(),
      name: 'Marcus Chen',
      grantedBy: 'System Setup',
      createdAt: new Date().toISOString(),
    },
  ];

  const departments: Department[] = [
    {
      id: 'dept-ece',
      name: 'Electrical & Circuits',
      code: 'ECE',
      headName: 'Dr. Kevin Wu',
      instrumentCount: 6,
      uptimePercent: 99.1,
      accentColor: 'pink',
      icon: 'memory',
    },
    {
      id: 'dept-rob',
      name: 'Robotics & Automation',
      code: 'ROBO',
      headName: 'Prof. Arjun Patel',
      instrumentCount: 3,
      uptimePercent: 98.7,
      accentColor: 'blue',
      icon: 'precision_manufacturing',
    },
    {
      id: 'dept-fab',
      name: 'Making & Workshop',
      code: 'MAKE',
      headName: 'Prof. Lucas Meyer',
      instrumentCount: 6,
      uptimePercent: 97.9,
      accentColor: 'mint',
      icon: 'layers',
    },
    {
      id: 'dept-cs',
      name: 'Computing & VR',
      code: 'COMP',
      headName: 'Dr. Elena Rostova',
      instrumentCount: 3,
      uptimePercent: 99.4,
      accentColor: 'butter',
      icon: 'computer',
    },
  ];

  const laboratories: Laboratory[] = [
    {
      id: 'lab-electronics',
      name: 'Electronics & Circuits Lab (Sample)',
      departmentId: 'dept-ece',
      departmentName: 'Electrical & Circuits',
      building: 'Sample Building A',
      room: 'Room 104',
      accessLevel: 'Open Student Access',
      capacity: 14,
      occupied: 7,
      status: 'open',
      managerName: 'Dr. Kevin Wu',
      managerTitle: 'Electronics Lab Advisor',
      coordinates: { lat: 42.3616, lng: -71.0906, xPercent: 26, yPercent: 32 },
    },
    {
      id: 'lab-making',
      name: '3D Printing & Making Hub (Sample)',
      departmentId: 'dept-fab',
      departmentName: 'Making & Workshop',
      building: 'Sample Maker Hall',
      room: 'Room 08',
      accessLevel: 'Safety Briefing Required',
      capacity: 12,
      occupied: 9,
      status: 'high_load',
      managerName: 'Prof. Lucas Meyer',
      managerTitle: 'Maker Lab Coordinator',
      coordinates: { lat: 42.3588, lng: -71.0935, xPercent: 46, yPercent: 64 },
    },
    {
      id: 'lab-robotics',
      name: 'Robotics Studio (Sample)',
      departmentId: 'dept-rob',
      departmentName: 'Robotics & Automation',
      building: 'Sample Robotics Wing',
      room: 'Room 204',
      accessLevel: 'Badge Access',
      capacity: 10,
      occupied: 5,
      status: 'open',
      managerName: 'Prof. Arjun Patel',
      managerTitle: 'Robotics Studio Lead',
      coordinates: { lat: 42.3602, lng: -71.0921, xPercent: 56, yPercent: 25 },
    },
    {
      id: 'lab-computing',
      name: 'Computers & VR Studio (Sample)',
      departmentId: 'dept-cs',
      departmentName: 'Computing & VR',
      building: 'Sample Tech Center',
      room: 'Room 302',
      accessLevel: 'Open Student Access',
      capacity: 16,
      occupied: 6,
      status: 'open',
      managerName: 'Dr. Elena Rostova',
      managerTitle: 'Computing Lab Lead',
      coordinates: { lat: 42.3595, lng: -71.089, xPercent: 76, yPercent: 44 },
    },
    {
      id: 'lab-testing',
      name: 'Testing & Measurement Bench (Sample)',
      departmentId: 'dept-ece',
      departmentName: 'Electrical & Circuits',
      building: 'Sample Building A',
      room: 'Room 112',
      accessLevel: 'General Lab Safety',
      capacity: 10,
      occupied: 4,
      status: 'open',
      managerName: 'Dr. Kevin Wu',
      managerTitle: 'Testing Bench Coordinator',
      coordinates: { lat: 42.3621, lng: -71.0875, xPercent: 72, yPercent: 74 },
    },
    {
      id: 'lab-workshop',
      name: 'Mechanical Workshop (Sample)',
      departmentId: 'dept-fab',
      departmentName: 'Making & Workshop',
      building: 'Sample Foundry',
      room: 'Bay 03',
      accessLevel: 'Workshop Safety Training',
      capacity: 8,
      occupied: 3,
      status: 'calibrating',
      managerName: 'Prof. Lucas Meyer',
      managerTitle: 'Workshop Supervisor',
      coordinates: { lat: 42.3629, lng: -71.0882, xPercent: 22, yPercent: 72 },
    },
  ];

  const equipment: Equipment[] = [
    // CATEGORY 1 — ELECTRONICS & CIRCUITS
    {
      id: 'eq-arduino-kit',
      code: 'EC-101',
      name: 'Arduino Starter Kit',
      category: 'Electronics & Circuits',
      departmentId: 'dept-ece',
      departmentName: 'Electrical & Circuits',
      laboratoryId: 'lab-electronics',
      locationLabel: 'Sample Lab · Electronics Lab, Room 104',
      status: 'available',
      hourlyRate: 5,
      requiresFacultyApproval: false,
      certificationRequired: 'General Lab Safety',
      biosafetyLevel: 'Sample Lab Data',
      nextSlotLabel: 'Today, 1:00 PM',
      lastCalibrated: 'Nov 10',
      totalBookings: 420,
      shortPurpose: 'Build quick circuits, sensor prototypes, and LED or motor projects.',
      description:
        'Complete Arduino Uno starter box with breadboard, jumper wires, sensors, servos, and USB cable for class projects and prototypes.',
      specsPreview: 'Arduino Uno R3 • Breadboard • 20+ Sensors & Motors',
      imageUrl: '',
      clayTheme: 'arduino',
      isSampleData: true,
      specs: [
        { label: 'Board', value: 'Arduino Uno R3 (5V)', icon: 'memory', tone: 'mint' },
        { label: 'Included Parts', value: 'Sensors, LEDs, Servos', icon: 'extension', tone: 'blue' },
        { label: 'Software', value: 'Arduino IDE (USB)', icon: 'code', tone: 'pink' },
      ],
      guidelines: [
        {
          title: 'Check Polarity',
          detail: 'Double-check 5V and GND wires before plugging in the USB cable.',
          icon: 'bolt',
        },
        {
          title: 'Pack All Parts',
          detail: 'Place resistors, jumpers, and boards back into the organizer tray after use.',
          icon: 'inventory_2',
        },
      ],
    },
    {
      id: 'eq-esp32-board',
      code: 'EC-102',
      name: 'ESP32 Board',
      category: 'Electronics & Circuits',
      departmentId: 'dept-ece',
      departmentName: 'Electrical & Circuits',
      laboratoryId: 'lab-electronics',
      locationLabel: 'Sample Lab · Electronics Lab, Room 104',
      status: 'available',
      hourlyRate: 5,
      requiresFacultyApproval: false,
      certificationRequired: 'General Lab Safety',
      biosafetyLevel: 'Sample Lab Data',
      nextSlotLabel: 'Today, 2:00 PM',
      lastCalibrated: 'Nov 12',
      totalBookings: 318,
      shortPurpose: 'Create wireless Wi-Fi and Bluetooth IoT projects with fast microcontrollers.',
      description:
        'Dual-core Wi-Fi & Bluetooth microcontroller dev board mounted on an easy-access breakout with USB-C.',
      specsPreview: 'Wi-Fi + Bluetooth • Dual Core • 3.3V Logic',
      imageUrl: '',
      clayTheme: 'esp32',
      isSampleData: true,
      specs: [
        { label: 'Wireless', value: 'Wi-Fi & Bluetooth LE', icon: 'wifi', tone: 'blue' },
        { label: 'Voltage', value: '3.3V GPIO Pins', icon: 'bolt', tone: 'mint' },
        { label: 'Connection', value: 'USB-C Programming', icon: 'cable', tone: 'pink' },
      ],
      guidelines: [
        {
          title: '3.3V Pin Limit',
          detail: 'Never connect 5V sensors directly to ESP32 signal pins without a level shifter.',
          icon: 'warning',
        },
      ],
    },
    {
      id: 'eq-digital-oscilloscope',
      code: 'EC-103',
      name: 'Digital Oscilloscope',
      category: 'Electronics & Circuits',
      departmentId: 'dept-ece',
      departmentName: 'Electrical & Circuits',
      laboratoryId: 'lab-electronics',
      locationLabel: 'Sample Lab · Electronics Lab, Room 104',
      status: 'available',
      hourlyRate: 15,
      requiresFacultyApproval: false,
      certificationRequired: 'General Lab Safety',
      biosafetyLevel: 'Sample Lab Data',
      nextSlotLabel: 'Today, 1:30 PM',
      lastCalibrated: 'Nov 08',
      totalBookings: 512,
      shortPurpose: 'See voltage signals, waves, and circuit timing live on a color screen.',
      description:
        '4-channel benchtop digital oscilloscope for debugging Arduino/ESP32 signals, audio circuits, and sensor pulses.',
      specsPreview: '100 MHz • 4 Analog Channels • Built-in Signal Check',
      imageUrl: '',
      clayTheme: 'oscilloscope',
      isSampleData: true,
      specs: [
        { label: 'Channels', value: '4 Analog Inputs', icon: 'waves', tone: 'pink' },
        { label: 'Bandwidth', value: '100 MHz', icon: 'speed', tone: 'blue' },
        { label: 'Probes', value: '4× 10x Passive Probes', icon: 'cable', tone: 'mint' },
      ],
      guidelines: [
        {
          title: 'Ground Clip Safety',
          detail: 'Connect probe ground clips only to circuit ground to avoid short circuits.',
          icon: 'electric_bolt',
        },
      ],
    },

    // CATEGORY 2 — 3D PRINTING & MAKING
    {
      id: 'eq-3d-printer',
      code: 'MK-201',
      name: '3D Printer',
      category: '3D Printing & Making',
      departmentId: 'dept-fab',
      departmentName: 'Making & Workshop',
      laboratoryId: 'lab-making',
      locationLabel: 'Sample Lab · 3D Printing Hub, Room 08',
      status: 'available',
      hourlyRate: 12,
      requiresFacultyApproval: false,
      certificationRequired: 'General Lab Safety',
      biosafetyLevel: 'Sample Lab Data',
      nextSlotLabel: 'Today, 3:00 PM',
      lastCalibrated: 'Nov 14',
      totalBookings: 685,
      shortPurpose: 'Print custom plastic parts, robot brackets, and project cases from CAD files.',
      description:
        'Fast auto-leveling desktop 3D printer supporting PLA and PETG filaments for rapid student prototypes.',
      specsPreview: '250 × 210 × 210 mm • PLA & PETG • Auto Bed Level',
      imageUrl: '',
      clayTheme: 'printer',
      isSampleData: true,
      specs: [
        { label: 'Print Size', value: '250 × 210 × 210 mm', icon: 'view_in_ar', tone: 'mint' },
        { label: 'Materials', value: 'PLA, PETG', icon: 'layers', tone: 'blue' },
        { label: 'File Type', value: '.STL / .3MF', icon: 'folder_open', tone: 'pink' },
      ],
      guidelines: [
        {
          title: 'Watch First Layer',
          detail: 'Stay for the first 5 minutes of your print to confirm the first layer sticks cleanly.',
          icon: 'visibility',
        },
      ],
    },
    {
      id: 'eq-laser-cutter',
      code: 'MK-202',
      name: 'Laser Cutter',
      category: '3D Printing & Making',
      departmentId: 'dept-fab',
      departmentName: 'Making & Workshop',
      laboratoryId: 'lab-making',
      locationLabel: 'Sample Lab · 3D Printing Hub, Room 08',
      status: 'in_use',
      hourlyRate: 20,
      requiresFacultyApproval: true,
      certificationRequired: 'Laser Safety Briefing',
      biosafetyLevel: 'Sample Lab Data',
      nextSlotLabel: 'Tomorrow, 10:00 AM',
      lastCalibrated: 'Nov 11',
      totalBookings: 340,
      shortPurpose: 'Cut and engrave clean shapes into wood, acrylic sheets, and cardboard.',
      description:
        'Enclosed CO2 laser cutter with exhaust fan for fast, accurate panels, robot chassis plates, and engravings.',
      specsPreview: '600 × 400 mm Bed • Wood & Acrylic • Exhaust Filtered',
      imageUrl: '',
      clayTheme: 'laser',
      isSampleData: true,
      specs: [
        { label: 'Bed Area', value: '600 × 400 mm', icon: 'crop_free', tone: 'pink' },
        { label: 'Materials', value: 'Plywood, Acrylic, Paper', icon: 'layers', tone: 'mint' },
        { label: 'Design Files', value: '.SVG / .DXF', icon: 'draw', tone: 'blue' },
      ],
      guidelines: [
        {
          title: 'Approved Materials Only',
          detail: 'Never cut PVC or vinyl. Stay beside the machine at all times while cutting.',
          icon: 'verified_user',
        },
      ],
    },
    {
      id: 'eq-cnc-machine',
      code: 'MK-203',
      name: 'CNC Machine',
      category: '3D Printing & Making',
      departmentId: 'dept-fab',
      departmentName: 'Making & Workshop',
      laboratoryId: 'lab-making',
      locationLabel: 'Sample Lab · 3D Printing Hub, Room 08',
      status: 'available',
      hourlyRate: 30,
      requiresFacultyApproval: true,
      certificationRequired: 'CNC Safety Check',
      biosafetyLevel: 'Sample Lab Data',
      nextSlotLabel: 'Today, 4:00 PM',
      lastCalibrated: 'Nov 09',
      totalBookings: 210,
      shortPurpose: 'Carve solid aluminum, wood, or PCB boards using computer-guided cutting tools.',
      description:
        '3-axis desktop & shop CNC router for accurate mechanical brackets, enclosures, and milled parts.',
      specsPreview: '3-Axis Router • Aluminum & Wood • Enclosed Guard',
      imageUrl: '',
      clayTheme: 'cnc',
      isSampleData: true,
      specs: [
        { label: 'Work Area', value: '400 × 300 × 120 mm', icon: 'open_with', tone: 'mint' },
        { label: 'Spindle', value: '12,000 RPM', icon: 'cyclone', tone: 'blue' },
        { label: 'Safety', value: 'Full Door Interlock', icon: 'shield', tone: 'pink' },
      ],
      guidelines: [
        {
          title: 'Dry Run First',
          detail: 'Check tool height and run an air pass before cutting solid stock.',
          icon: 'fact_check',
        },
      ],
    },

    // CATEGORY 3 — ROBOTICS
    {
      id: 'eq-robotic-arm',
      code: 'RB-301',
      name: 'Robotic Arm',
      category: 'Robotics',
      departmentId: 'dept-rob',
      departmentName: 'Robotics & Automation',
      laboratoryId: 'lab-robotics',
      locationLabel: 'Sample Lab · Robotics Studio, Room 204',
      status: 'available',
      hourlyRate: 25,
      requiresFacultyApproval: false,
      certificationRequired: 'General Lab Safety',
      biosafetyLevel: 'Sample Lab Data',
      nextSlotLabel: 'Today, 2:00 PM',
      lastCalibrated: 'Nov 15',
      totalBookings: 294,
      shortPurpose: 'Program pick-and-place movements, gripper tasks, and ROS motion paths.',
      description:
        '6-axis tabletop collaborative robotic arm with Python/ROS support and soft adaptive gripper.',
      specsPreview: '6-Axis • Python & ROS 2 • Adaptive Gripper',
      imageUrl: '',
      clayTheme: 'robot',
      isSampleData: true,
      specs: [
        { label: 'Motion', value: '6-Axis Joint Control', icon: 'precision_manufacturing', tone: 'blue' },
        { label: 'Coding', value: 'Python / ROS 2', icon: 'terminal', tone: 'mint' },
        { label: 'Reach', value: '650 mm Benchtop', icon: 'straighten', tone: 'pink' },
      ],
      guidelines: [
        {
          title: 'Keep E-Stop Close',
          detail: 'Keep the red emergency stop button within reach while testing new robot code.',
          icon: 'verified_user',
        },
      ],
    },
    {
      id: 'eq-mobile-robot',
      code: 'RB-302',
      name: 'Mobile Robot Kit',
      category: 'Robotics',
      departmentId: 'dept-rob',
      departmentName: 'Robotics & Automation',
      laboratoryId: 'lab-robotics',
      locationLabel: 'Sample Lab · Robotics Studio, Room 204',
      status: 'available',
      hourlyRate: 15,
      requiresFacultyApproval: false,
      certificationRequired: 'General Lab Safety',
      biosafetyLevel: 'Sample Lab Data',
      nextSlotLabel: 'Today, 1:00 PM',
      lastCalibrated: 'Nov 13',
      totalBookings: 256,
      shortPurpose: 'Test self-driving navigation, LiDAR mapping, and obstacle avoidance.',
      description:
        'Wheeled autonomous robot platform equipped with 2D LiDAR scanner, depth camera, and onboard computer.',
      specsPreview: '2D LiDAR • Depth Camera • ROS Navigation Ready',
      imageUrl: '',
      clayTheme: 'mobile_robot',
      isSampleData: true,
      specs: [
        { label: 'Sensors', value: '2D LiDAR + Camera', icon: 'sensors', tone: 'mint' },
        { label: 'Drive', value: '2WD + Encoders', icon: 'directions_car', tone: 'blue' },
        { label: 'Battery', value: '3 hrs Run Time', icon: 'battery_charging_full', tone: 'pink' },
      ],
      guidelines: [
        {
          title: 'Floor Arena Only',
          detail: 'Test autonomous driving inside the padded floor mat area in Room 204.',
          icon: 'map',
        },
      ],
    },
    {
      id: 'eq-line-follower',
      code: 'RB-303',
      name: 'Line Follower Kit',
      category: 'Robotics',
      departmentId: 'dept-rob',
      departmentName: 'Robotics & Automation',
      laboratoryId: 'lab-robotics',
      locationLabel: 'Sample Lab · Robotics Studio, Room 204',
      status: 'available',
      hourlyRate: 8,
      requiresFacultyApproval: false,
      certificationRequired: 'General Lab Safety',
      biosafetyLevel: 'Sample Lab Data',
      nextSlotLabel: 'Today, 11:30 AM',
      lastCalibrated: 'Nov 14',
      totalBookings: 390,
      shortPurpose: 'Learn PID speed control and IR sensor tracking on a campus test track.',
      description:
        'Beginner-friendly robot car kit with 5-channel IR array, geared DC motors, and rechargeable battery pack.',
      specsPreview: '5-Sensor IR Array • Arduino Compatible • Practice Track',
      imageUrl: '',
      clayTheme: 'line_follower',
      isSampleData: true,
      specs: [
        { label: 'Sensors', value: '5× IR Track Sensors', icon: 'linear_scale', tone: 'pink' },
        { label: 'Controller', value: 'Arduino Nano', icon: 'memory', tone: 'mint' },
        { label: 'Track', value: 'Included Test Mat', icon: 'route', tone: 'blue' },
      ],
      guidelines: [
        {
          title: 'Recharge After Use',
          detail: 'Switch off the battery pack and plug it into the charging dock when finished.',
          icon: 'battery_std',
        },
      ],
    },

    // CATEGORY 4 — COMPUTERS & SOFTWARE
    {
      id: 'eq-engineering-pc',
      code: 'CS-401',
      name: 'Engineering PC',
      category: 'Computers & Software',
      departmentId: 'dept-cs',
      departmentName: 'Computing & VR',
      laboratoryId: 'lab-computing',
      locationLabel: 'Sample Lab · Computing Studio, Room 302',
      status: 'available',
      hourlyRate: 10,
      requiresFacultyApproval: false,
      certificationRequired: 'General Lab Safety',
      biosafetyLevel: 'Sample Lab Data',
      nextSlotLabel: 'Today, 12:00 PM',
      lastCalibrated: 'Nov 15',
      totalBookings: 740,
      shortPurpose: 'Run CAD modeling, MATLAB simulations, PCB layout, and engineering software.',
      description:
        'High-memory dual-monitor desktop workstation preloaded with SolidWorks, Fusion 360, MATLAB, KiCad, and VS Code.',
      specsPreview: '64GB RAM • Dual 27" Displays • CAD & MATLAB Installed',
      imageUrl: '',
      clayTheme: 'pc',
      isSampleData: true,
      specs: [
        { label: 'Memory', value: '64 GB DDR5 RAM', icon: 'memory', tone: 'blue' },
        { label: 'Software', value: 'CAD, MATLAB, KiCad', icon: 'apps', tone: 'mint' },
        { label: 'Displays', value: 'Dual 4K Monitors', icon: 'desktop_windows', tone: 'pink' },
      ],
      guidelines: [
        {
          title: 'Save to Cloud Drive',
          detail: 'Save project files to your student cloud folder before signing out.',
          icon: 'cloud_upload',
        },
      ],
    },
    {
      id: 'eq-gpu-workstation',
      code: 'CS-402',
      name: 'GPU Workstation',
      category: 'Computers & Software',
      departmentId: 'dept-cs',
      departmentName: 'Computing & VR',
      laboratoryId: 'lab-computing',
      locationLabel: 'Sample Lab · Computing Studio, Room 302',
      status: 'available',
      hourlyRate: 30,
      requiresFacultyApproval: true,
      certificationRequired: 'Cluster Access Check',
      biosafetyLevel: 'Sample Lab Data',
      nextSlotLabel: 'Now (Remote or Desk)',
      lastCalibrated: 'Nov 16',
      totalBookings: 530,
      shortPurpose: 'Train machine learning models, computer vision tools, and 3D renders fast.',
      description:
        'Dedicated deep learning tower with dual high-VRAM GPUs, CUDA toolkit, PyTorch, and TensorFlow.',
      specsPreview: 'Dual High-VRAM GPUs • 128GB RAM • PyTorch & CUDA',
      imageUrl: '',
      clayTheme: 'gpu',
      isSampleData: true,
      specs: [
        { label: 'Graphics', value: 'Dual 24GB VRAM GPUs', icon: 'developer_board', tone: 'pink' },
        { label: 'AI Stack', value: 'PyTorch, CUDA, Jupyter', icon: 'terminal', tone: 'blue' },
        { label: 'Access', value: 'In-Lab or Campus SSH', icon: 'lan', tone: 'mint' },
      ],
      guidelines: [
        {
          title: 'Save Checkpoints',
          detail: 'Save training weights regularly so long jobs stay safe if time expires.',
          icon: 'save',
        },
      ],
    },
    {
      id: 'eq-vr-headset',
      code: 'CS-403',
      name: 'VR Headset',
      category: 'Computers & Software',
      departmentId: 'dept-cs',
      departmentName: 'Computing & VR',
      laboratoryId: 'lab-computing',
      locationLabel: 'Sample Lab · Computing Studio, Room 302',
      status: 'in_use',
      hourlyRate: 15,
      requiresFacultyApproval: false,
      certificationRequired: 'General Lab Safety',
      biosafetyLevel: 'Sample Lab Data',
      nextSlotLabel: 'Today, 4:30 PM',
      lastCalibrated: 'Nov 13',
      totalBookings: 215,
      shortPurpose: 'Test virtual 3D spaces, Unity/Unreal apps, and interactive simulations.',
      description:
        'Standalone & PC-tethered virtual reality headset with hand controllers and dedicated playspace mat.',
      specsPreview: '4K Per-Eye • Hand Tracking • Unity & Unreal Ready',
      imageUrl: '',
      clayTheme: 'vr',
      isSampleData: true,
      specs: [
        { label: 'Tracking', value: '6-DOF Inside-Out', icon: '360', tone: 'mint' },
        { label: 'Engines', value: 'Unity, Unreal, WebXR', icon: 'view_in_ar', tone: 'blue' },
        { label: 'Controllers', value: '2× Haptic Handsets', icon: 'sports_esports', tone: 'pink' },
      ],
      guidelines: [
        {
          title: 'Wipe Foam Pad',
          detail: 'Use the provided sanitizer wipes on the face cushion after each session.',
          icon: 'cleaning_services',
        },
      ],
    },

    // CATEGORY 5 — TESTING & MEASUREMENT
    {
      id: 'eq-digital-multimeter',
      code: 'TM-501',
      name: 'Digital Multimeter',
      category: 'Testing & Measurement',
      departmentId: 'dept-ece',
      departmentName: 'Electrical & Circuits',
      laboratoryId: 'lab-testing',
      locationLabel: 'Sample Lab · Testing Bench, Room 112',
      status: 'available',
      hourlyRate: 5,
      requiresFacultyApproval: false,
      certificationRequired: 'General Lab Safety',
      biosafetyLevel: 'Sample Lab Data',
      nextSlotLabel: 'Today, 12:30 PM',
      lastCalibrated: 'Nov 12',
      totalBookings: 820,
      shortPurpose: 'Measure voltage, current, resistance, and check circuit connections safely.',
      description:
        'True-RMS bench & handheld digital multimeter with backlit screen, continuity beep, and fused current inputs.',
      specsPreview: 'True-RMS • Voltage, Current, Ohms • Continuity Beep',
      imageUrl: '',
      clayTheme: 'multimeter',
      isSampleData: true,
      specs: [
        { label: 'Modes', value: 'V, A, Ω, Continuity', icon: 'electric_meter', tone: 'mint' },
        { label: 'Accuracy', value: 'True-RMS Auto-Range', icon: 'tune', tone: 'blue' },
        { label: 'Probes', value: 'Alligator + Needle Leads', icon: 'cable', tone: 'pink' },
      ],
      guidelines: [
        {
          title: 'Check Probe Jacks',
          detail: 'Move the red lead back to the V/Ω jack after measuring current to protect fuses.',
          icon: 'verified_user',
        },
      ],
    },
    {
      id: 'eq-vernier-caliper',
      code: 'TM-502',
      name: 'Digital Vernier Caliper',
      category: 'Testing & Measurement',
      departmentId: 'dept-ece',
      departmentName: 'Electrical & Circuits',
      laboratoryId: 'lab-testing',
      locationLabel: 'Sample Lab · Testing Bench, Room 112',
      status: 'available',
      hourlyRate: 5,
      requiresFacultyApproval: false,
      certificationRequired: 'General Lab Safety',
      biosafetyLevel: 'Sample Lab Data',
      nextSlotLabel: 'Today, 12:00 PM',
      lastCalibrated: 'Nov 15',
      totalBookings: 645,
      shortPurpose: 'Measure small part sizes, hole diameters, and thicknesses down to 0.01 mm.',
      description:
        'Stainless steel digital sliding caliper with instant millimeter/inch toggle and zero reset button.',
      specsPreview: '0–150 mm Range • ±0.02 mm Accuracy • mm / inch Switch',
      imageUrl: '',
      clayTheme: 'caliper',
      isSampleData: true,
      specs: [
        { label: 'Range', value: '0 – 150 mm (6 in)', icon: 'straighten', tone: 'blue' },
        { label: 'Resolution', value: '0.01 mm / 0.0005 in', icon: 'center_focus_strong', tone: 'mint' },
        { label: 'Modes', value: 'Outer, Inner & Depth', icon: 'architecture', tone: 'pink' },
      ],
      guidelines: [
        {
          title: 'Zero Before Measuring',
          detail: 'Close the jaws gently and press Zero before taking part measurements.',
          icon: 'tune',
        },
      ],
    },
    {
      id: 'eq-power-supply',
      code: 'TM-503',
      name: 'Power Supply',
      category: 'Testing & Measurement',
      departmentId: 'dept-ece',
      departmentName: 'Electrical & Circuits',
      laboratoryId: 'lab-testing',
      locationLabel: 'Sample Lab · Testing Bench, Room 112',
      status: 'available',
      hourlyRate: 8,
      requiresFacultyApproval: false,
      certificationRequired: 'General Lab Safety',
      biosafetyLevel: 'Sample Lab Data',
      nextSlotLabel: 'Today, 2:30 PM',
      lastCalibrated: 'Nov 11',
      totalBookings: 472,
      shortPurpose: 'Give steady, adjustable DC voltage and current limits to your circuits.',
      description:
        'Triple-output programmable DC bench power supply with current limiting to protect breadboards from shorts.',
      specsPreview: '0–30V DC • 0–5A Current Limit • Digital Readout',
      imageUrl: '',
      clayTheme: 'power_supply',
      isSampleData: true,
      specs: [
        { label: 'Output', value: '0–30V DC (3 Channels)', icon: 'bolt', tone: 'pink' },
        { label: 'Protection', value: 'Adjustable Current Cap', icon: 'shield', tone: 'mint' },
        { label: 'Leads', value: 'Banana-to-Clip Cables', icon: 'cable', tone: 'blue' },
      ],
      guidelines: [
        {
          title: 'Set Current Limit First',
          detail: 'Set your voltage and current limit before pressing the Output On button.',
          icon: 'power_settings_new',
        },
      ],
    },

    // CATEGORY 6 — MECHANICAL WORKSHOP
    {
      id: 'eq-lathe-machine',
      code: 'MW-601',
      name: 'Lathe Machine',
      category: 'Mechanical Workshop',
      departmentId: 'dept-fab',
      departmentName: 'Making & Workshop',
      laboratoryId: 'lab-workshop',
      locationLabel: 'Sample Lab · Mechanical Workshop, Bay 03',
      status: 'available',
      hourlyRate: 35,
      requiresFacultyApproval: true,
      certificationRequired: 'Workshop Safety Training',
      biosafetyLevel: 'Sample Lab Data',
      nextSlotLabel: 'Tomorrow, 9:00 AM',
      lastCalibrated: 'Nov 07',
      totalBookings: 164,
      shortPurpose: 'Spin and shape smooth round metal rods, shafts, threads, and bushings.',
      description:
        'Precision benchtop metal lathe with variable spindle speed, digital readout, and safety chuck guard.',
      specsPreview: 'Variable RPM • Digital Readout • Safety Chuck Shield',
      imageUrl: '',
      clayTheme: 'lathe',
      isSampleData: true,
      specs: [
        { label: 'Swing', value: '250 mm Over Bed', icon: 'cyclone', tone: 'mint' },
        { label: 'Speed', value: '100–2500 RPM', icon: 'speed', tone: 'blue' },
        { label: 'Safety', value: 'Goggles & Guard Required', icon: 'shield', tone: 'pink' },
      ],
      guidelines: [
        {
          title: 'Remove Chuck Key',
          detail: 'Never leave the chuck key inside the chuck. Tie back hair and wear safety glasses.',
          icon: 'warning',
        },
      ],
    },
    {
      id: 'eq-milling-machine',
      code: 'MW-602',
      name: 'Milling Machine',
      category: 'Mechanical Workshop',
      departmentId: 'dept-fab',
      departmentName: 'Making & Workshop',
      laboratoryId: 'lab-workshop',
      locationLabel: 'Sample Lab · Mechanical Workshop, Bay 03',
      status: 'maintenance',
      hourlyRate: 35,
      requiresFacultyApproval: true,
      certificationRequired: 'Workshop Safety Training',
      biosafetyLevel: 'Sample Lab Data',
      nextSlotLabel: 'Thu, 1:00 PM',
      lastCalibrated: 'Nov 04',
      totalBookings: 148,
      shortPurpose: 'Cut flat surfaces, slots, and precise holes into aluminum or steel blocks.',
      description:
        'Vertical manual & DRO knee milling machine for heavy-duty brackets, slotted mounts, and flat stock.',
      specsPreview: '3-Axis DRO • Precision Vise • Safety Shield',
      imageUrl: '',
      clayTheme: 'mill',
      isSampleData: true,
      specs: [
        { label: 'Table Travel', value: '450 × 200 mm', icon: 'open_with', tone: 'blue' },
        { label: 'Readout', value: '3-Axis Digital Scale', icon: 'straighten', tone: 'mint' },
        { label: 'Holding', value: '6-Inch Precision Vise', icon: 'build', tone: 'pink' },
      ],
      guidelines: [
        {
          title: 'Lock Unused Axes',
          detail: 'Clamp your workpiece tightly in the vise and lock idle table axes before cutting.',
          icon: 'fact_check',
        },
      ],
    },
    {
      id: 'eq-drill-press',
      code: 'MW-603',
      name: 'Drill Press',
      category: 'Mechanical Workshop',
      departmentId: 'dept-fab',
      departmentName: 'Making & Workshop',
      laboratoryId: 'lab-workshop',
      locationLabel: 'Sample Lab · Mechanical Workshop, Bay 03',
      status: 'available',
      hourlyRate: 15,
      requiresFacultyApproval: false,
      certificationRequired: 'Workshop Safety Briefing',
      biosafetyLevel: 'Sample Lab Data',
      nextSlotLabel: 'Today, 3:30 PM',
      lastCalibrated: 'Nov 14',
      totalBookings: 405,
      shortPurpose: 'Drill straight, accurate holes in wood, plastic plates, and metal parts.',
      description:
        'Floor-standing variable-speed drill press with laser center guide, depth stop, and table vise.',
      specsPreview: '16-Speed • Laser Crosshair • Depth Stop & Vise',
      imageUrl: '',
      clayTheme: 'drill_press',
      isSampleData: true,
      specs: [
        { label: 'Chuck Size', value: '1.5 – 16 mm Bits', icon: 'build', tone: 'pink' },
        { label: 'Guide', value: 'Laser Center Dot', icon: 'gps_fixed', tone: 'mint' },
        { label: 'Table', value: 'Tilting + Clamp Slots', icon: 'layers', tone: 'blue' },
      ],
      guidelines: [
        {
          title: 'Always Clamp Parts',
          detail: 'Never hold small metal or plastic parts by hand while drilling—always use a clamp.',
          icon: 'verified_user',
        },
      ],
    },
  ];

  const projects: ResearchProject[] = [
    {
      id: 'proj-arduino',
      ownerId: 'usr-alex',
      ownerName: 'Alex Rivera',
      title: 'Smart Weather Sensor Node',
      grantCode: 'EE-101',
      department: 'Electrical & Circuits',
      category: 'Electronics & Circuits',
      description: 'Build and test a solar-powered temperature and air sensor node using ESP32 and Arduino.',
      deadline: inTwoDays,
      progress: 78,
      tone: 'mint',
      icon: 'memory',
      recommendedEquipmentIds: ['eq-arduino-kit', 'eq-esp32-board', 'eq-digital-oscilloscope'],
      aiAnalysisSummary: 'Great fit for ESP32 Board, Digital Oscilloscope, and Power Supply testing.',
      status: 'active',
    },
    {
      id: 'proj-rover',
      ownerId: 'usr-alex',
      ownerName: 'Alex Rivera',
      title: 'Campus Delivery Robot',
      grantCode: 'ROBO-22',
      department: 'Robotics & Automation',
      category: 'Robotics',
      description: '3D-print custom sensor mounts and test autonomous navigation on the studio floor.',
      deadline: getTodayDateString(5),
      progress: 52,
      tone: 'blue',
      icon: 'precision_manufacturing',
      recommendedEquipmentIds: ['eq-3d-printer', 'eq-mobile-robot', 'eq-robotic-arm'],
      aiAnalysisSummary: 'Use 3D Printer for brackets and Mobile Robot Kit for LiDAR path testing.',
      status: 'active',
    },
    {
      id: 'proj-gripper',
      ownerId: 'usr-alex',
      ownerName: 'Alex Rivera',
      title: 'Lightweight Arm Gripper',
      grantCode: 'MECH-09',
      department: 'Making & Workshop',
      category: 'Mechanical Workshop',
      description: 'Machine aluminum links and verify tolerances with digital calipers before assembly.',
      deadline: getTodayDateString(7),
      progress: 90,
      tone: 'pink',
      icon: 'build',
      recommendedEquipmentIds: ['eq-cnc-machine', 'eq-vernier-caliper', 'eq-drill-press'],
      aiAnalysisSummary: 'Pair CNC Machine cutting with Digital Vernier Caliper checks.',
      status: 'active',
    },
  ];

  const bookings: Booking[] = [
    {
      id: 'bk-101',
      equipmentId: 'eq-arduino-kit',
      equipmentName: 'Arduino Starter Kit',
      userId: 'usr-alex',
      userName: 'Alex Rivera',
      userRoleTitle: 'Student Researcher • Bioengineering',
      projectId: 'proj-arduino',
      projectTitle: 'Smart Weather Sensor Node (EE-101)',
      date: today,
      startHour: 14,
      durationHours: 2,
      status: 'confirmed',
      totalCost: 10,
      facultyReviewerName: 'Dr. Elena Rostova',
      createdAt: new Date().toISOString(),
    },
    {
      id: 'bk-102',
      equipmentId: 'eq-robotic-arm',
      equipmentName: 'Robotic Arm',
      userId: 'usr-alex',
      userName: 'Alex Rivera',
      userRoleTitle: 'Student Researcher • Bioengineering',
      projectId: 'proj-rover',
      projectTitle: 'Campus Delivery Robot (ROBO-22)',
      date: tomorrow,
      startHour: 9,
      durationHours: 3,
      status: 'confirmed',
      totalCost: 75,
      createdAt: new Date().toISOString(),
    },
    {
      id: 'bk-201',
      equipmentId: 'eq-laser-cutter',
      equipmentName: 'Laser Cutter',
      userId: 'usr-maya',
      userName: 'Maya Lin',
      userRoleTitle: 'PhD Candidate • Materials Science',
      projectId: 'proj-rover',
      projectTitle: 'Acrylic Sensor Enclosure',
      date: inTwoDays,
      startHour: 14,
      durationHours: 2,
      status: 'pending',
      totalCost: 40,
      urgencyTag: 'Urgent',
      aiNote: 'No overlaps found. Laser Safety Briefing is already on file.',
      createdAt: new Date().toISOString(),
    },
    {
      id: 'bk-202',
      equipmentId: 'eq-cnc-machine',
      equipmentName: 'CNC Machine',
      userId: 'usr-liam',
      userName: 'Liam Vance',
      userRoleTitle: 'M.S. Researcher • Mechanical',
      projectId: 'proj-gripper',
      projectTitle: 'Aluminum Motor Mounts',
      date: inTwoDays,
      startHour: 9,
      durationHours: 2,
      status: 'pending',
      totalCost: 60,
      urgencyTag: 'Routine',
      aiNote: 'Spindle warm-up window is free at 09:00. Good open slot.',
      createdAt: new Date().toISOString(),
    },
    {
      id: 'bk-203',
      equipmentId: 'eq-gpu-workstation',
      equipmentName: 'GPU Workstation',
      userId: 'usr-maya',
      userName: 'Maya Lin',
      userRoleTitle: 'PhD Candidate • Materials Science',
      projectId: 'proj-arduino',
      projectTitle: 'Vision Model Training Run',
      date: getTodayDateString(3),
      startHour: 13,
      durationHours: 3,
      status: 'pending',
      totalCost: 90,
      urgencyTag: 'Certified',
      aiNote: 'Remote SSH access verified and 128GB RAM is open.',
      createdAt: new Date().toISOString(),
    },
    {
      id: 'bk-301',
      equipmentId: 'eq-3d-printer',
      equipmentName: '3D Printer',
      userId: 'usr-maya',
      userName: 'Maya Lin',
      userRoleTitle: 'PhD Candidate • Materials Science',
      projectId: 'proj-rover',
      projectTitle: 'Bracket Prototype v2',
      date: today,
      startHour: 8,
      durationHours: 2,
      status: 'confirmed',
      totalCost: 24,
      createdAt: new Date().toISOString(),
    },
  ];

  const conflicts: FairSlotConflictCase[] = [
    {
      id: 'fs-2048',
      caseCode: 'CASE #FS-2048',
      equipmentId: 'eq-cnc-machine',
      equipmentName: 'CNC Machine',
      bayLabel: 'Room 08',
      date: today,
      conflictStartHour: 14,
      conflictEndHour: 16,
      status: 'open',
      fairnessScore: 96,
      headlineRecommendation: 'Keep Maya Lin in 14:00–16:00 & move Liam Vance to 16:30–18:30',
      explanation:
        'Maya has a class demo tomorrow morning and has used less weekly workshop time. Moving Liam to 16:30 keeps both projects on track with zero tool changes.',
      candidates: [
        {
          bookingId: 'bk-fs-maya',
          studentId: 'usr-maya',
          studentName: 'Maya Lin',
          studentInitials: 'ML',
          studentTitle: 'PhD Candidate • Materials Science',
          projectTitle: 'Sensor Bracket Prototype',
          deadlineDescription: 'Demo due tomorrow at 08:00 AM.',
          hoursUntilDeadline: 18,
          priorityScore: 94,
          weeklyUsedHours: 2.0,
          weeklyQuotaHours: 6.0,
          requestedStartHour: 14,
          requestedDurationHours: 2,
          recommended: true,
        },
        {
          bookingId: 'bk-fs-liam',
          studentId: 'usr-liam',
          studentName: 'Liam Vance',
          studentInitials: 'LV',
          studentTitle: 'M.S. Researcher • Mechanical',
          projectTitle: 'Robotic Arm Mounting Plate',
          deadlineDescription: 'Lab milestone due in 5 days.',
          hoursUntilDeadline: 120,
          priorityScore: 72,
          weeklyUsedHours: 4.5,
          weeklyQuotaHours: 6.0,
          requestedStartHour: 14,
          requestedDurationHours: 2,
          recommended: false,
        },
      ],
      factors: [
        {
          title: 'Closer Deadline',
          icon: 'bolt',
          tone: 'mint',
          detail: 'Maya’s demo is in 18 hours while Liam has 5 days left.',
        },
        {
          title: 'Fair Weekly Hours',
          icon: 'balance',
          tone: 'blue',
          detail: 'Maya has 4.0h remaining this week; Liam has 1.5h left.',
        },
        {
          title: 'Same Setup',
          icon: 'tune',
          tone: 'pink',
          detail: 'The 16:30 slot keeps the same aluminum tool bit loaded.',
        },
      ],
      alternatives: [
        {
          id: 'alt-1',
          badge: 'Best Match',
          score: 96,
          timeLabel: 'Today, 16:30 – 18:30',
          date: today,
          startHour: 16,
          durationHours: 2,
          equipmentId: 'eq-cnc-machine',
          equipmentName: 'CNC Machine',
          bayLabel: 'Room 08',
          rationale: 'Finish today right after Maya’s run with no setup change.',
        },
        {
          id: 'alt-2',
          badge: 'Next Tool',
          score: 89,
          timeLabel: 'Today, 14:00 – 16:00',
          date: today,
          startHour: 14,
          durationHours: 2,
          equipmentId: 'eq-lathe-machine',
          equipmentName: 'Lathe Machine',
          bayLabel: 'Bay 03',
          rationale: 'Same afternoon time in the Mechanical Workshop.',
        },
        {
          id: 'alt-3',
          badge: 'Next Morning',
          score: 84,
          timeLabel: 'Tomorrow, 09:00 – 11:00',
          date: tomorrow,
          startHour: 9,
          durationHours: 2,
          equipmentId: 'eq-cnc-machine',
          equipmentName: 'CNC Machine',
          bayLabel: 'Room 08',
          rationale: 'Fresh morning session with plenty of time before deadline.',
        },
      ],
      timelineBlocks: [
        { hourLabel: '08:00', startHour: 8, label: 'Dr. Patel', kind: 'booked' },
        { hourLabel: '10:00', startHour: 10, label: 'Check', kind: 'booked' },
        { hourLabel: '12:00', startHour: 12, label: 'Open', kind: 'open' },
        { hourLabel: '14:00', startHour: 14, label: 'Conflict (2)', kind: 'conflict' },
        { hourLabel: '16:00', startHour: 16, label: 'Liam (Smart)', kind: 'ai_suggested' },
        { hourLabel: '18:00', startHour: 18, label: 'Open', kind: 'open' },
      ],
      selectedAlternativeId: 'alt-1',
    },
  ];

  const maintenance: MaintenanceLog[] = [
    {
      id: 'mnt-1',
      equipmentId: 'eq-3d-printer',
      equipmentName: '3D Printer',
      technician: 'Prof. Lucas Meyer',
      taskTitle: 'Nozzle & Bed Level Check',
      status: 'cleared',
      scheduledDate: today,
      notes: 'First-layer calibration passed.',
    },
    {
      id: 'mnt-2',
      equipmentId: 'eq-cnc-machine',
      equipmentName: 'CNC Machine',
      technician: 'R. Gomez',
      taskTitle: 'Spindle Bit Inspection',
      status: 'scheduled',
      scheduledDate: inTwoDays,
      notes: 'Routine 20-minute morning check.',
    },
    {
      id: 'mnt-3',
      equipmentId: 'eq-milling-machine',
      equipmentName: 'Milling Machine',
      technician: 'M. Alvarez',
      taskTitle: 'Axis Lubrication & Guard Check',
      status: 'in_progress',
      scheduledDate: today,
      notes: 'Scheduled to reopen Thursday afternoon.',
    },
  ];

  const notifications: AppNotification[] = [
    {
      id: 'ntf-1',
      userId: 'usr-alex',
      title: 'Arduino Starter Kit Confirmed',
      message: 'Booked for Electronics Lab, Room 104 • Today 2:00 PM – 4:00 PM.',
      type: 'confirmed',
      read: false,
      createdAt: new Date(Date.now() - 1000 * 60 * 45).toISOString(),
    },
    {
      id: 'ntf-2',
      userId: 'usr-alex',
      title: 'Safety Training Active',
      message: 'General Lab Safety verified for Spring Semester.',
      type: 'info',
      read: false,
      createdAt: new Date(Date.now() - 1000 * 60 * 60 * 5).toISOString(),
    },
    {
      id: 'ntf-3',
      userId: 'usr-elena',
      title: 'Booking Conflict #FS-2048 Ready',
      message: 'CNC Machine overlap between Maya Lin & Liam Vance has a suggested alternative.',
      type: 'ai',
      read: false,
      createdAt: new Date(Date.now() - 1000 * 60 * 20).toISOString(),
    },
  ];

  const accessRequests: AccessRequest[] = [
    {
      id: 'ar-101',
      projectId: 'proj-arduino',
      projectTitle: 'Smart Weather Sensor Node',
      userId: 'usr-alex',
      userName: 'Alex Rivera',
      userDepartment: 'Bioengineering',
      equipmentId: 'eq-digital-oscilloscope',
      equipmentName: 'Digital Oscilloscope',
      requestedHours: 3,
      preferredDate: tomorrow,
      deadline: inTwoDays,
      justification: 'Verify solar charge controller ripple and ESP32 sensor timing before field test.',
      status: 'pending',
      createdAt: new Date(Date.now() - 1000 * 60 * 90).toISOString(),
    },
  ];

  return {
    catalogVersion: CURRENT_CATALOG_VERSION,
    users,
    authorizedAdmins,
    departments,
    laboratories,
    equipment,
    projects,
    accessRequests,
    bookings,
    conflicts,
    maintenance,
    notifications,
  };
}

class LabLinkStore {
  private db: LabLinkDatabase;
  private writeQueue: Promise<void> = Promise.resolve();

  constructor() {
    this.db = this.load();
  }

  private load(): LabLinkDatabase {
    try {
      if (fs.existsSync(DATA_FILE)) {
        const raw = fs.readFileSync(DATA_FILE, 'utf8');
        const parsed = JSON.parse(raw) as LabLinkDatabase;
        if (
          parsed &&
          parsed.catalogVersion === CURRENT_CATALOG_VERSION &&
          Array.isArray(parsed.equipment) &&
          Array.isArray(parsed.users)
        ) {
          if (!Array.isArray(parsed.authorizedAdmins)) {
            parsed.authorizedAdmins = parsed.users
              .filter((u) => u.role === 'admin')
              .map((u) => ({
                email: u.email.toLowerCase(),
                name: u.name,
                grantedBy: 'System Setup',
                createdAt: new Date().toISOString(),
              }));
          }
          if (!Array.isArray(parsed.accessRequests)) {
            parsed.accessRequests = [];
          }
          return parsed;
        }
      }
    } catch {
      // Fallback to fresh seed if file corrupt or outdated schema
    }
    const seed = createInitialSeed();
    this.persistSync(seed);
    return seed;
  }

  private persistSync(data: LabLinkDatabase): void {
    try {
      fs.mkdirSync(DATA_DIR, { recursive: true });
      fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2), 'utf8');
    } catch {
      // Ignore write failures in read-only serverless containers; in-memory state still operates
    }
  }

  private enqueuePersist(): void {
    const snapshot = this.db;
    this.writeQueue = this.writeQueue.then(async () => {
      this.persistSync(snapshot);
    });
  }

  public getPublicUsers(): UserProfile[] {
    return this.db.users.map(({ passwordHash: _pw, ...rest }) => rest);
  }

  public findUserByEmail(email: string): StoredUser | undefined {
    return this.db.users.find((u) => u.email.toLowerCase() === email.trim().toLowerCase());
  }

  public findUserById(id: string): StoredUser | undefined {
    return this.db.users.find((u) => u.id === id);
  }

  public toPublicUser(user: StoredUser): UserProfile {
    const { passwordHash: _pw, ...rest } = user;
    return rest;
  }

  public getAuthorizedAdmins() {
    return this.db.authorizedAdmins;
  }

  public isAuthorizedAdmin(email: string): boolean {
    const normalized = email.trim().toLowerCase();
    const envAdmin = process.env.ADMIN_EMAIL?.trim().toLowerCase();
    if (envAdmin && normalized === envAdmin) return true;
    return this.db.authorizedAdmins.some((a) => a.email.toLowerCase() === normalized);
  }

  public isAdminClaimRequired(): boolean {
    if (process.env.ADMIN_INITIAL_PASSWORD && process.env.ADMIN_INITIAL_PASSWORD.trim().length > 0) {
      return false;
    }
    return !this.db.users.some((u) => u.role === 'admin' && Boolean(u.passwordHash));
  }

  public claimInitialAdmin(email: string, name: string, password: string): UserProfile {
    if (!this.isAdminClaimRequired()) {
      throw new Error('Admin account has already been set up. Please sign in with your admin credentials.');
    }
    const normalizedEmail = email.trim().toLowerCase();
    if (!normalizedEmail || !password || password.length < 8) {
      throw new Error('Provide a valid admin email and a password of at least 8 characters.');
    }
    const existingAdmin = this.db.users.find((u) => u.role === 'admin');
    const hashed = hashPassword(password);
    let target: StoredUser;
    if (existingAdmin) {
      existingAdmin.email = normalizedEmail;
      existingAdmin.name = name.trim() || existingAdmin.name;
      existingAdmin.passwordHash = hashed;
      target = existingAdmin;
    } else {
      target = {
        id: `usr-admin-${Date.now()}`,
        email: normalizedEmail,
        name: name.trim() || 'Platform Administrator',
        role: 'admin',
        department: 'Campus Lab Operations',
        title: 'Platform Administrator',
        weeklyQuotaHours: 40,
        usedHoursThisWeek: 0,
        certifications: ['System Administrator', 'Safety Officer'],
        passwordHash: hashed,
      };
      this.db.users.push(target);
    }

    this.db.authorizedAdmins = [
      {
        email: normalizedEmail,
        name: target.name,
        grantedBy: 'Initial Setup',
        createdAt: new Date().toISOString(),
      },
    ];
    this.enqueuePersist();
    return this.toPublicUser(target);
  }

  public verifyAdminCredentials(email: string, password: string): UserProfile | null {
    const normalizedEmail = email.trim().toLowerCase();
    if (!this.isAuthorizedAdmin(normalizedEmail)) {
      return null;
    }
    const user = this.findUserByEmail(normalizedEmail);
    const envPass = process.env.ADMIN_INITIAL_PASSWORD?.trim();
    if (envPass && envPass.length > 0 && password === envPass) {
      if (user) {
        user.role = 'admin';
        return this.toPublicUser(user);
      }
      const created: StoredUser = {
        id: `usr-admin-${Date.now()}`,
        email: normalizedEmail,
        name: 'Platform Administrator',
        role: 'admin',
        department: 'Campus Lab Operations',
        title: 'Platform Administrator',
        weeklyQuotaHours: 40,
        usedHoursThisWeek: 0,
        certifications: ['System Administrator'],
        passwordHash: hashPassword(envPass),
      };
      this.db.users.push(created);
      this.enqueuePersist();
      return this.toPublicUser(created);
    }
    if (!user || user.role !== 'admin' || !user.passwordHash) {
      return null;
    }
    if (verifyPassword(password, user.passwordHash)) {
      return this.toPublicUser(user);
    }
    return null;
  }

  public grantAuthorizedAdmin(email: string, name: string, grantedBy: string) {
    const normalized = email.trim().toLowerCase();
    if (!this.db.authorizedAdmins.some((a) => a.email.toLowerCase() === normalized)) {
      this.db.authorizedAdmins.push({
        email: normalized,
        name: name.trim() || normalized,
        grantedBy,
        createdAt: new Date().toISOString(),
      });
    }
    const user = this.findUserByEmail(normalized);
    if (user) {
      user.role = 'admin';
    }
    this.enqueuePersist();
    return this.db.authorizedAdmins;
  }

  public revokeAuthorizedAdmin(email: string, actorEmail: string) {
    const normalized = email.trim().toLowerCase();
    if (normalized === actorEmail.trim().toLowerCase()) {
      throw new Error('You cannot remove your own admin access.');
    }
    if (this.db.authorizedAdmins.length <= 1) {
      throw new Error('At least one authorized administrator must remain active.');
    }
    this.db.authorizedAdmins = this.db.authorizedAdmins.filter(
      (a) => a.email.toLowerCase() !== normalized,
    );
    const user = this.findUserByEmail(normalized);
    if (user && user.role === 'admin') {
      user.role = 'faculty';
    }
    this.enqueuePersist();
    return this.db.authorizedAdmins;
  }

  public createUser(input: {
    email: string;
    name: string;
    password: string;
    department: string;
    role?: UserRole;
    requestFaculty?: boolean;
  }): UserProfile {
    const existing = this.findUserByEmail(input.email);
    if (existing) {
      throw new Error('An account with that university email already exists.');
    }
    // Public registration can never create an admin or auto-approve faculty directly
    const safeRole: UserRole = input.role === 'faculty' ? 'faculty' : 'student';
    const facultyApprovalStatus: UserProfile['facultyApprovalStatus'] =
      safeRole === 'faculty'
        ? 'approved'
        : input.requestFaculty
          ? 'pending'
          : 'none';
    const newUser: StoredUser = {
      id: `usr-${Date.now()}`,
      email: input.email.trim().toLowerCase(),
      name: input.name.trim(),
      role: safeRole,
      facultyApprovalStatus,
      department: input.department.trim() || 'Bioengineering',
      title:
        safeRole === 'faculty'
          ? `Faculty Member • ${input.department}`
          : facultyApprovalStatus === 'pending'
            ? `Faculty Applicant • ${input.department}`
            : `Student • ${input.department}`,
      weeklyQuotaHours: safeRole === 'faculty' ? 20 : 6,
      usedHoursThisWeek: 0,
      certifications: ['General Lab Safety'],
      assignedLabIds: safeRole === 'faculty' ? ['lab-electronics', 'lab-workshop'] : undefined,
      passwordHash: hashPassword(input.password),
    };
    this.db.users.push(newUser);
    this.enqueuePersist();
    return this.toPublicUser(newUser);
  }

  public updateProfile(
    userId: string,
    patch: { name?: string; department?: string; title?: string },
  ): UserProfile {
    const user = this.findUserById(userId);
    if (!user) throw new Error('User not found.');
    if (patch.name && patch.name.trim()) user.name = patch.name.trim();
    if (patch.department && patch.department.trim()) user.department = patch.department.trim();
    if (patch.title && patch.title.trim()) user.title = patch.title.trim();
    this.enqueuePersist();
    return this.toPublicUser(user);
  }

  public decideFacultyRequest(params: {
    userId: string;
    decision: 'approved' | 'rejected';
    assignedLabIds?: string[];
    reviewerName: string;
  }): UserProfile {
    const user = this.findUserById(params.userId);
    if (!user) throw new Error('Applicant user not found.');
    const approved = params.decision === 'approved';
    user.facultyApprovalStatus = params.decision;
    user.role = approved ? 'faculty' : 'student';
    user.weeklyQuotaHours = approved ? 20 : 6;
    user.assignedLabIds = approved
      ? params.assignedLabIds && params.assignedLabIds.length > 0
        ? params.assignedLabIds
        : this.db.laboratories.map((l) => l.id)
      : [];
    user.title = approved ? `Faculty Lead • ${user.department}` : `Student • ${user.department}`;
    if (approved && !user.certifications.includes('Faculty Approver')) {
      user.certifications.push('Faculty Approver');
    }
    this.db.notifications.unshift({
      id: `ntf-${Date.now()}`,
      userId: user.id,
      title: approved ? 'Faculty Account Approved' : 'Faculty Request Declined',
      message: approved
        ? `Your faculty permissions were approved by ${params.reviewerName}.`
        : `Your faculty account request was declined by ${params.reviewerName}.`,
      type: approved ? 'confirmed' : 'warning',
      read: false,
      createdAt: new Date().toISOString(),
    });
    this.enqueuePersist();
    return this.toPublicUser(user);
  }

  public updateUserRole(userId: string, role: UserRole): UserProfile {
    const user = this.findUserById(userId);
    if (!user) throw new Error('User not found.');
    if (role === 'admin') {
      if (!this.isAuthorizedAdmin(user.email)) {
        this.db.authorizedAdmins.push({
          email: user.email.toLowerCase(),
          name: user.name,
          grantedBy: 'Administrator',
          createdAt: new Date().toISOString(),
        });
      }
    } else if (user.role === 'admin') {
      this.db.authorizedAdmins = this.db.authorizedAdmins.filter(
        (a) => a.email.toLowerCase() !== user.email.toLowerCase(),
      );
    }
    user.role = role;
    if (role === 'faculty') {
      user.facultyApprovalStatus = 'approved';
      user.weeklyQuotaHours = 20;
    }
    this.enqueuePersist();
    return this.toPublicUser(user);
  }

  public updateUserCertifications(userId: string, certifications: string[]): UserProfile {
    const user = this.findUserById(userId);
    if (!user) throw new Error('User not found.');
    user.certifications = certifications;
    this.enqueuePersist();
    return this.toPublicUser(user);
  }

  public assertFacultyScopeForEquipment(
    actorId: string,
    actorRole: UserRole,
    equipmentId: string,
  ): Equipment {
    const eq = this.getEquipmentById(equipmentId);
    if (!eq) throw new Error('Equipment not found.');
    if (actorRole === 'admin') return eq;
    if (actorRole !== 'faculty') {
      throw new Error('Faculty or admin permissions required.');
    }
    const faculty = this.findUserById(actorId);
    if (
      faculty?.assignedLabIds &&
      faculty.assignedLabIds.length > 0 &&
      !faculty.assignedLabIds.includes(eq.laboratoryId)
    ) {
      throw new Error('Faculty members can only manage equipment and approvals in their assigned labs.');
    }
    return eq;
  }

  public getDepartments(): Department[] {
    return this.db.departments;
  }

  public addDepartment(input: Omit<Department, 'id'>): Department {
    const created: Department = { id: `dept-${Date.now()}`, ...input };
    this.db.departments.push(created);
    this.enqueuePersist();
    return created;
  }

  public getLaboratories(): Laboratory[] {
    return this.db.laboratories;
  }

  public addLaboratory(input: Omit<Laboratory, 'id'>): Laboratory {
    const created: Laboratory = { id: `lab-${Date.now()}`, ...input };
    this.db.laboratories.push(created);
    this.enqueuePersist();
    return created;
  }

  public getEquipment(): Equipment[] {
    return this.db.equipment;
  }

  public getEquipmentById(id: string): Equipment | undefined {
    return this.db.equipment.find((e) => e.id === id);
  }

  public addEquipment(input: Omit<Equipment, 'id' | 'totalBookings'>): Equipment {
    const created: Equipment = {
      id: `eq-${Date.now()}`,
      totalBookings: 0,
      ...input,
    };
    this.db.equipment.unshift(created);
    const dept = this.db.departments.find((d) => d.id === created.departmentId);
    if (dept) dept.instrumentCount += 1;
    this.enqueuePersist();
    return created;
  }

  public updateEquipment(
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
  ): Equipment {
    const item = this.getEquipmentById(id);
    if (!item) throw new Error('Equipment not found.');
    Object.assign(item, patch);
    this.enqueuePersist();
    return item;
  }

  public deleteEquipment(id: string): void {
    const idx = this.db.equipment.findIndex((e) => e.id === id);
    if (idx === -1) throw new Error('Equipment not found.');
    const [removed] = this.db.equipment.splice(idx, 1);
    const dept = this.db.departments.find((d) => d.id === removed.departmentId);
    if (dept && dept.instrumentCount > 0) dept.instrumentCount -= 1;
    this.enqueuePersist();
  }

  public updateEquipmentStatus(id: string, status: Equipment['status']): Equipment {
    const item = this.getEquipmentById(id);
    if (!item) throw new Error('Equipment not found.');
    item.status = status;
    this.enqueuePersist();
    return item;
  }

  public getProjects(userId?: string, role?: UserRole): ResearchProject[] {
    if (!userId) return [];
    if (role === 'faculty' || role === 'admin') {
      return this.db.projects;
    }
    return this.db.projects.filter((p) => p.ownerId === userId);
  }

  public createProject(input: Omit<ResearchProject, 'id'>): ResearchProject {
    const created: ResearchProject = {
      id: `proj-${Date.now()}`,
      ...input,
    };
    this.db.projects.unshift(created);
    this.enqueuePersist();
    return created;
  }

  public getAccessRequests(actorId?: string, actorRole?: UserRole): AccessRequest[] {
    if (!actorId || !actorRole) return [];
    if (actorRole === 'student') {
      return this.db.accessRequests.filter((r) => r.userId === actorId);
    }
    if (actorRole === 'faculty') {
      const faculty = this.findUserById(actorId);
      if (faculty?.assignedLabIds && faculty.assignedLabIds.length > 0) {
        const labSet = new Set(faculty.assignedLabIds);
        return this.db.accessRequests.filter((r) => {
          const eq = this.getEquipmentById(r.equipmentId);
          return eq ? labSet.has(eq.laboratoryId) : false;
        });
      }
    }
    return this.db.accessRequests;
  }

  public createAccessRequest(input: {
    userId: string;
    projectId: string;
    equipmentId: string;
    requestedHours: number;
    preferredDate: string;
    justification: string;
  }): AccessRequest {
    const project = this.db.projects.find((p) => p.id === input.projectId);
    if (!project) throw new Error('Project not found.');
    if (project.ownerId !== input.userId) {
      throw new Error('You can only request access for your own projects.');
    }
    const equipment = this.getEquipmentById(input.equipmentId);
    if (!equipment) throw new Error('Equipment not found.');
    const user = this.findUserById(input.userId);
    if (!user) throw new Error('User not found.');

    const created: AccessRequest = {
      id: `ar-${Date.now()}`,
      projectId: project.id,
      projectTitle: project.title,
      userId: user.id,
      userName: user.name,
      userDepartment: user.department,
      equipmentId: equipment.id,
      equipmentName: equipment.name,
      requestedHours: input.requestedHours,
      preferredDate: input.preferredDate,
      deadline: project.deadline,
      justification: input.justification,
      status: 'pending' as AccessRequestStatus,
      createdAt: new Date().toISOString(),
    };
    this.db.accessRequests.unshift(created);
    this.enqueuePersist();
    return created;
  }

  public decideAccessRequest(params: {
    requestId: string;
    actorId: string;
    actorRole: UserRole;
    actorName: string;
    decision: 'approved' | 'rejected' | 'alternative_suggested';
    reviewerNotes?: string;
    alternative?: AccessRequest['suggestedAlternative'];
  }): AccessRequest {
    const reqItem = this.db.accessRequests.find((r) => r.id === params.requestId);
    if (!reqItem) throw new Error('Access request not found.');
    this.assertFacultyScopeForEquipment(params.actorId, params.actorRole, reqItem.equipmentId);

    reqItem.status = params.decision;
    reqItem.facultyReviewerName = params.actorName;
    if (params.reviewerNotes) reqItem.reviewerNotes = params.reviewerNotes;
    if (params.alternative) reqItem.suggestedAlternative = params.alternative;

    this.db.notifications.unshift({
      id: `ntf-${Date.now()}`,
      userId: reqItem.userId,
      title:
        params.decision === 'approved'
          ? 'Project Access Approved'
          : params.decision === 'alternative_suggested'
            ? 'Alternative Suggested for Project Access'
            : 'Project Access Declined',
      message: `${reqItem.equipmentName} request reviewed by ${params.actorName}.`,
      type:
        params.decision === 'approved'
          ? 'confirmed'
          : params.decision === 'rejected'
            ? 'warning'
            : 'ai',
      read: false,
      createdAt: new Date().toISOString(),
    });
    this.enqueuePersist();
    return reqItem;
  }

  public getBusySlots(): BusySlot[] {
    return this.db.bookings
      .filter((b) => b.status === 'confirmed' || b.status === 'pending')
      .map((b) => ({
        equipmentId: b.equipmentId,
        date: b.date,
        startHour: b.startHour,
        durationHours: b.durationHours,
        status: b.status === 'confirmed' ? 'confirmed' : 'pending',
      }));
  }

  public getBookings(actorId?: string, actorRole?: UserRole): Booking[] {
    if (!actorId || !actorRole) return [];
    if (actorRole === 'student') {
      return this.db.bookings.filter((b) => b.userId === actorId);
    }
    if (actorRole === 'faculty') {
      const faculty = this.findUserById(actorId);
      if (faculty?.assignedLabIds && faculty.assignedLabIds.length > 0) {
        const labSet = new Set(faculty.assignedLabIds);
        return this.db.bookings.filter((b) => {
          const eq = this.getEquipmentById(b.equipmentId);
          return eq ? labSet.has(eq.laboratoryId) : false;
        });
      }
    }
    return this.db.bookings;
  }

  public findConflictingBookings(
    equipmentId: string,
    date: string,
    startHour: number,
    durationHours: number,
    excludeBookingId?: string,
  ): Booking[] {
    const reqEnd = startHour + durationHours;
    return this.db.bookings.filter((b) => {
      if (excludeBookingId && b.id === excludeBookingId) return false;
      if (b.equipmentId !== equipmentId || b.date !== date) return false;
      if (b.status !== 'confirmed' && b.status !== 'pending') return false;
      const bEnd = b.startHour + b.durationHours;
      return startHour < bEnd && b.startHour < reqEnd;
    });
  }

  public createBookingAtomic(input: {
    equipmentId: string;
    userId: string;
    projectId: string;
    date: string;
    startHour: number;
    durationHours: number;
    submitToFairSlotOnConflict?: boolean;
  }): {
    booking?: Booking;
    conflictCase?: FairSlotConflictCase;
    conflictError?: string;
    suggestedAlternative?: FairSlotConflictCase['alternatives'][number];
  } {
    const equipment = this.getEquipmentById(input.equipmentId);
    if (!equipment) {
      throw new Error('Selected equipment was not found.');
    }
    if (equipment.status === 'maintenance') {
      throw new Error(`${equipment.name} is currently under maintenance and cannot be booked.`);
    }

    const user = this.findUserById(input.userId);
    if (!user) {
      throw new Error('Authenticated user profile not found.');
    }

    const project = this.db.projects.find((p) => p.id === input.projectId);
    const projectTitle = project ? `${project.title} (${project.grantCode})` : 'General Lab Research';

    const conflicts = this.findConflictingBookings(
      input.equipmentId,
      input.date,
      input.startHour,
      input.durationHours,
    );

    if (conflicts.length > 0) {
      const existing = conflicts[0];
      if (!input.submitToFairSlotOnConflict) {
        const realAlts = findRealAlternativeSlots({
          targetEquipment: equipment,
          allEquipment: this.db.equipment,
          activeBookings: this.db.bookings,
          date: input.date,
          requestedStartHour: input.startHour,
          durationHours: input.durationHours,
          deadlineIso: project?.deadline,
        });
        const bestAlt = realAlts[0];
        return {
          conflictError: `Time ${String(input.startHour).padStart(2, '0')}:00–${String(input.startHour + input.durationHours).padStart(2, '0')}:00 on ${input.date} overlaps with an existing reservation.${bestAlt ? ` Next open option: ${bestAlt.timeLabel} (${bestAlt.equipmentName}).` : ''} Send to Smart Booking or pick another open slot.`,
          suggestedAlternative: bestAlt,
        };
      }

      const existingUser = this.findUserById(existing.userId) || {
        id: existing.userId,
        name: existing.userName,
        title: existing.userRoleTitle,
        weeklyQuotaHours: 6,
        usedHoursThisWeek: 2,
        certifications: ['General Lab Safety'],
      };
      const existingProj = existing.projectId
        ? this.db.projects.find((p) => p.id === existing.projectId)
        : undefined;

      const caseId = `fs-${Date.now().toString().slice(-4)}`;
      const conflictCase = buildDeterministicConflictCase({
        caseId,
        equipment,
        allEquipment: this.db.equipment,
        allBookings: this.db.bookings,
        date: input.date,
        conflictStartHour: input.startHour,
        conflictDurationHours: input.durationHours,
        existingBooking: existing,
        existingUser,
        existingProject: existingProj,
        incomingUser: user,
        incomingProject: project,
        incomingProjectTitleFallback: projectTitle,
      });

      this.db.conflicts.unshift(conflictCase);
      this.enqueuePersist();
      return { conflictCase };
    }

    const status = equipment.requiresFacultyApproval && user.role === 'student' ? 'pending' : 'confirmed';
    const newBooking: Booking = {
      id: `bk-${Date.now()}`,
      equipmentId: equipment.id,
      equipmentName: equipment.name,
      userId: user.id,
      userName: user.name,
      userRoleTitle: user.title,
      projectId: input.projectId,
      projectTitle,
      date: input.date,
      startHour: input.startHour,
      durationHours: input.durationHours,
      status,
      totalCost: equipment.hourlyRate * input.durationHours,
      urgencyTag: status === 'pending' ? 'Routine' : undefined,
      aiNote:
        status === 'pending'
          ? 'Zero conflicts detected. Awaiting faculty certification sign-off.'
          : undefined,
      createdAt: new Date().toISOString(),
    };

    this.db.bookings.unshift(newBooking);
    equipment.totalBookings += 1;
    user.usedHoursThisWeek += input.durationHours;

    this.db.notifications.unshift({
      id: `ntf-${Date.now()}`,
      userId: user.id,
      title: status === 'confirmed' ? 'Reservation Confirmed' : 'Approval Request Submitted',
      message: `${equipment.name} • ${input.date} at ${String(input.startHour).padStart(2, '0')}:00 (${input.durationHours}h).`,
      type: status === 'confirmed' ? 'confirmed' : 'info',
      read: false,
      createdAt: new Date().toISOString(),
    });

    this.enqueuePersist();
    return { booking: newBooking };
  }

  public decideBooking(
    bookingId: string,
    decision: 'confirmed' | 'rejected' | 'alternative_suggested',
    reviewerName: string,
    alternative?: Booking['suggestedAlternative'],
    actorId?: string,
    actorRole?: UserRole,
  ): Booking {
    const booking = this.db.bookings.find((b) => b.id === bookingId);
    if (!booking) throw new Error('Booking request not found.');

    if (actorId && actorRole) {
      this.assertFacultyScopeForEquipment(actorId, actorRole, booking.equipmentId);
    }

    if (decision === 'confirmed') {
      const conflicts = this.findConflictingBookings(
        booking.equipmentId,
        booking.date,
        booking.startHour,
        booking.durationHours,
        booking.id,
      );
      if (conflicts.length > 0) {
        throw new Error(
          `Cannot approve: overlaps with confirmed booking by ${conflicts[0].userName}. Use Smart Booking or suggest an alternative slot.`,
        );
      }
    }

    booking.status = decision;
    booking.facultyReviewerName = reviewerName;
    if (alternative) {
      booking.suggestedAlternative = alternative;
    }

    this.db.notifications.unshift({
      id: `ntf-${Date.now()}`,
      userId: booking.userId,
      title:
        decision === 'confirmed'
          ? 'Faculty Approved Reservation'
          : decision === 'alternative_suggested'
            ? 'Alternative Slot Suggested'
            : 'Reservation Declined',
      message: `${booking.equipmentName} (${booking.date}) reviewed by ${reviewerName}.`,
      type: decision === 'confirmed' ? 'confirmed' : decision === 'rejected' ? 'warning' : 'ai',
      read: false,
      createdAt: new Date().toISOString(),
    });

    this.enqueuePersist();
    return booking;
  }

  public cancelBooking(bookingId: string, actorUserId: string, actorRole: UserRole): Booking {
    const booking = this.db.bookings.find((b) => b.id === bookingId);
    if (!booking) throw new Error('Booking not found.');
    if (booking.userId !== actorUserId && actorRole !== 'admin') {
      if (actorRole === 'faculty') {
        this.assertFacultyScopeForEquipment(actorUserId, actorRole, booking.equipmentId);
      } else {
        throw new Error('You may only cancel your own reservations.');
      }
    }
    booking.status = 'cancelled';
    const usr = this.findUserById(booking.userId);
    if (usr) {
      usr.usedHoursThisWeek = Math.max(0, usr.usedHoursThisWeek - booking.durationHours);
    }
    this.enqueuePersist();
    return booking;
  }

  public getConflicts(actorId?: string, actorRole?: UserRole): FairSlotConflictCase[] {
    if (!actorId || !actorRole) return [];
    if (actorRole === 'admin') return this.db.conflicts;
    if (actorRole === 'faculty') {
      const faculty = this.findUserById(actorId);
      if (faculty?.assignedLabIds && faculty.assignedLabIds.length > 0) {
        const labSet = new Set(faculty.assignedLabIds);
        return this.db.conflicts.filter((c) => {
          const eq = this.getEquipmentById(c.equipmentId);
          return eq ? labSet.has(eq.laboratoryId) : false;
        });
      }
      return this.db.conflicts;
    }
    return this.db.conflicts.filter((c) => c.candidates.some((cand) => cand.studentId === actorId));
  }

  public resolveConflict(
    conflictId: string,
    mode: 'resolved_ai' | 'overridden_faculty',
    alternativeId: string | undefined,
    reviewerName: string,
    actorId?: string,
    actorRole?: UserRole,
  ): { conflict: FairSlotConflictCase; createdBooking?: Booking } {
    const conflict = this.db.conflicts.find((c) => c.id === conflictId);
    if (!conflict) throw new Error('Smart Booking conflict case not found.');

    if (actorId && actorRole) {
      this.assertFacultyScopeForEquipment(actorId, actorRole, conflict.equipmentId);
    }

    const chosenAlt =
      conflict.alternatives.find((a) => a.id === alternativeId) || conflict.alternatives[0];
    const displacedCandidate = conflict.candidates[1];
    let createdBooking: Booking | undefined;
    if (chosenAlt && displacedCandidate) {
      const overlaps = this.findConflictingBookings(
        chosenAlt.equipmentId,
        chosenAlt.date,
        chosenAlt.startHour,
        chosenAlt.durationHours,
      );
      if (overlaps.length > 0) {
        throw new Error(
          `Alternative slot ${chosenAlt.timeLabel} is no longer free. Please choose another slot.`,
        );
      }
      const targetEq = this.getEquipmentById(chosenAlt.equipmentId);
      createdBooking = {
        id: `bk-fs-${Date.now()}`,
        equipmentId: chosenAlt.equipmentId,
        equipmentName: chosenAlt.equipmentName,
        userId: displacedCandidate.studentId,
        userName: displacedCandidate.studentName,
        userRoleTitle: displacedCandidate.studentTitle,
        projectId: displacedCandidate.projectId || '',
        projectTitle: displacedCandidate.projectTitle,
        date: chosenAlt.date,
        startHour: chosenAlt.startHour,
        durationHours: chosenAlt.durationHours,
        status: 'confirmed',
        totalCost: (targetEq?.hourlyRate || 20) * chosenAlt.durationHours,
        facultyReviewerName: reviewerName,
        aiNote: `Resolved via Smart Booking (${mode === 'resolved_ai' ? 'Smart Plan Approved' : 'Faculty Override'}).`,
        createdAt: new Date().toISOString(),
      };
      this.db.bookings.unshift(createdBooking);
      this.db.notifications.unshift({
        id: `ntf-${Date.now()}`,
        userId: displacedCandidate.studentId,
        title: 'New Booking Slot Confirmed',
        message: `${chosenAlt.equipmentName} scheduled for ${chosenAlt.timeLabel} by ${reviewerName}.`,
        type: 'confirmed',
        read: false,
        createdAt: new Date().toISOString(),
      });
    }

    conflict.status = mode;
    conflict.resolvedBy = reviewerName;
    if (chosenAlt) {
      conflict.selectedAlternativeId = chosenAlt.id;
    }

    this.enqueuePersist();
    return { conflict, createdBooking };
  }

  public getMaintenance(): MaintenanceLog[] {
    return this.db.maintenance;
  }

  public addMaintenance(input: Omit<MaintenanceLog, 'id'>): MaintenanceLog {
    const log: MaintenanceLog = { id: `mnt-${Date.now()}`, ...input };
    this.db.maintenance.unshift(log);
    if (input.status === 'in_progress') {
      const eq = this.getEquipmentById(input.equipmentId);
      if (eq) eq.status = 'maintenance';
    } else if (input.status === 'cleared') {
      const eq = this.getEquipmentById(input.equipmentId);
      if (eq) eq.status = 'available';
    }
    this.enqueuePersist();
    return log;
  }

  public getNotifications(userId: string): AppNotification[] {
    return this.db.notifications.filter((n) => n.userId === userId);
  }

  public markNotificationRead(id: string): void {
    const n = this.db.notifications.find((item) => item.id === id);
    if (n) {
      n.read = true;
      this.enqueuePersist();
    }
  }

  public getAnalytics(): UtilizationAnalytics {
    return computeRealUtilizationAnalytics({
      equipment: this.db.equipment,
      bookings: this.db.bookings,
      maintenance: this.db.maintenance,
    });
  }
}

export const db = new LabLinkStore();
