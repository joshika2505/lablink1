export type UserRole = 'student' | 'faculty' | 'admin';

export type FacultyApprovalStatus = 'none' | 'pending' | 'approved' | 'rejected';

export type EquipmentCategory =
  | 'Electronics & Circuits'
  | '3D Printing & Making'
  | 'Robotics'
  | 'Computers & Software'
  | 'Testing & Measurement'
  | 'Mechanical Workshop';

export const EQUIPMENT_CATEGORIES: EquipmentCategory[] = [
  'Electronics & Circuits',
  '3D Printing & Making',
  'Robotics',
  'Computers & Software',
  'Testing & Measurement',
  'Mechanical Workshop',
];

export type ClayEquipmentTheme =
  | 'arduino'
  | 'esp32'
  | 'oscilloscope'
  | 'printer'
  | 'laser'
  | 'cnc'
  | 'robot'
  | 'mobile_robot'
  | 'line_follower'
  | 'pc'
  | 'gpu'
  | 'vr'
  | 'multimeter'
  | 'caliper'
  | 'power_supply'
  | 'lathe'
  | 'mill'
  | 'drill_press'
  | 'microscope';

export interface UserProfile {
  id: string;
  email: string;
  name: string;
  role: UserRole;
  facultyApprovalStatus?: FacultyApprovalStatus;
  department: string;
  title: string;
  weeklyQuotaHours: number;
  usedHoursThisWeek: number;
  certifications: string[];
  assignedLabIds?: string[];
  avatarUrl?: string;
}

export interface AuthorizedAdminEntry {
  email: string;
  name: string;
  grantedBy: string;
  createdAt: string;
}

export interface Department {
  id: string;
  name: string;
  code: string;
  headName: string;
  instrumentCount: number;
  uptimePercent: number;
  accentColor: 'mint' | 'blue' | 'pink' | 'butter';
  icon: string;
}

export interface Laboratory {
  id: string;
  name: string;
  departmentId: string;
  departmentName: string;
  building: string;
  room: string;
  accessLevel: string;
  capacity: number;
  occupied: number;
  status: 'open' | 'high_load' | 'calibrating' | 'closed';
  managerName: string;
  managerTitle: string;
  managerAvatar?: string;
  coordinates: { lat: number; lng: number; xPercent: number; yPercent: number };
}

export interface EquipmentSpec {
  label: string;
  value: string;
  icon: string;
  tone: 'mint' | 'blue' | 'pink' | 'neutral';
}

export interface EquipmentGuideline {
  title: string;
  detail: string;
  icon: string;
}

export interface Equipment {
  id: string;
  code: string;
  name: string;
  category: EquipmentCategory;
  departmentId: string;
  departmentName: string;
  laboratoryId: string;
  locationLabel: string;
  status: 'available' | 'in_use' | 'maintenance';
  hourlyRate: number;
  requiresFacultyApproval: boolean;
  certificationRequired: string;
  biosafetyLevel: string;
  nextSlotLabel: string;
  lastCalibrated: string;
  totalBookings: number;
  shortPurpose: string;
  description: string;
  specsPreview: string;
  specs: EquipmentSpec[];
  guidelines: EquipmentGuideline[];
  imageUrl: string;
  clayTheme: ClayEquipmentTheme;
  isSampleData?: boolean;
}

export interface ResearchProject {
  id: string;
  ownerId: string;
  ownerName: string;
  title: string;
  grantCode: string;
  department: string;
  category: string;
  description: string;
  deadline: string;
  progress: number;
  tone: 'mint' | 'blue' | 'pink';
  icon: string;
  recommendedEquipmentIds: string[];
  aiAnalysisSummary?: string;
  status: 'active' | 'pending_access' | 'completed';
}

export type AccessRequestStatus =
  | 'pending'
  | 'approved'
  | 'rejected'
  | 'alternative_suggested';

export interface AccessRequest {
  id: string;
  projectId: string;
  projectTitle: string;
  userId: string;
  userName: string;
  userDepartment: string;
  equipmentId: string;
  equipmentName: string;
  requestedHours: number;
  preferredDate: string;
  deadline: string;
  justification: string;
  status: AccessRequestStatus;
  suggestedAlternative?: {
    date: string;
    startHour: number;
    durationHours: number;
    equipmentId: string;
    equipmentName: string;
    reason: string;
  };
  facultyReviewerName?: string;
  reviewerNotes?: string;
  createdAt: string;
}

export type BookingStatus =
  | 'confirmed'
  | 'pending'
  | 'rejected'
  | 'cancelled'
  | 'alternative_suggested';

export interface BusySlot {
  equipmentId: string;
  date: string;
  startHour: number;
  durationHours: number;
  status: 'confirmed' | 'pending';
}

export interface Booking {
  id: string;
  equipmentId: string;
  equipmentName: string;
  userId: string;
  userName: string;
  userRoleTitle: string;
  projectId: string;
  projectTitle: string;
  date: string; // YYYY-MM-DD
  startHour: number; // 7..21
  durationHours: number; // 1..8
  status: BookingStatus;
  totalCost: number;
  urgencyTag?: 'Urgent' | 'Routine' | 'Certified';
  aiNote?: string;
  suggestedAlternative?: {
    date: string;
    startHour: number;
    durationHours: number;
    equipmentId: string;
    equipmentName: string;
    reason: string;
  };
  facultyReviewerName?: string;
  createdAt: string;
}

export interface AllocationFactorBreakdown {
  deadlineScore: number; // max 28
  fairnessScore: number; // max 22
  compatibilityScore: number; // max 18
  availabilityScore: number; // max 16
  requirementScore: number; // max 16
}

export interface FairSlotCandidate {
  bookingId: string;
  studentId: string;
  studentName: string;
  studentInitials: string;
  studentTitle: string;
  projectId?: string;
  projectTitle: string;
  deadlineDescription: string;
  hoursUntilDeadline: number;
  priorityScore: number;
  weeklyUsedHours: number;
  weeklyQuotaHours: number;
  requestedStartHour: number;
  requestedDurationHours: number;
  recommended: boolean;
  scoreBreakdown?: AllocationFactorBreakdown;
}

export interface FairSlotAlternative {
  id: string;
  badge: string;
  score: number;
  timeLabel: string;
  date: string;
  startHour: number;
  durationHours: number;
  equipmentId: string;
  equipmentName: string;
  bayLabel: string;
  rationale: string;
}

export interface FairSlotFactor {
  title: string;
  icon: string;
  tone: 'mint' | 'blue' | 'pink';
  detail: string;
}

export interface FairSlotConflictCase {
  id: string;
  caseCode: string;
  equipmentId: string;
  equipmentName: string;
  bayLabel: string;
  date: string;
  conflictStartHour: number;
  conflictEndHour: number;
  status: 'open' | 'resolved_ai' | 'overridden_faculty';
  fairnessScore: number;
  headlineRecommendation: string;
  explanation: string;
  candidates: [FairSlotCandidate, FairSlotCandidate];
  factors: FairSlotFactor[];
  alternatives: FairSlotAlternative[];
  timelineBlocks: Array<{
    hourLabel: string;
    startHour: number;
    label: string;
    kind: 'booked' | 'conflict' | 'ai_suggested' | 'open';
  }>;
  resolvedBy?: string;
  selectedAlternativeId?: string;
}

export interface MaintenanceLog {
  id: string;
  equipmentId: string;
  equipmentName: string;
  technician: string;
  taskTitle: string;
  status: 'scheduled' | 'in_progress' | 'cleared';
  scheduledDate: string;
  notes: string;
}

export interface AppNotification {
  id: string;
  userId: string;
  title: string;
  message: string;
  type: 'confirmed' | 'warning' | 'ai' | 'info';
  read: boolean;
  createdAt: string;
}

export interface EquipmentUsageMetric {
  equipmentId: string;
  name: string;
  category: string;
  bookedHours: number;
  idleHours: number;
  bookingCount: number;
  utilizationPercent: number;
  demandTier: 'high' | 'normal' | 'low';
}

export interface UtilizationAnalytics {
  peakCapacityPercent: number;
  deltaVsLastWeek: string;
  weeklyBars: Array<{ day: string; percent: number; bookedHours?: number; isPeak?: boolean }>;
  zoneSplit: Array<{ zone: string; percent: number; bookedHours?: number; color: string }>;
  onlineInstruments: number;
  totalInstruments: number;
  uptimePercent: number;
  totalBookedHours?: number;
  totalIdleHours?: number;
  totalActiveBookings?: number;
  peakHours?: Array<{ hourLabel: string; count: number }>;
  equipmentUsage?: EquipmentUsageMetric[];
  highDemandTools?: Array<{
    name: string;
    bookedHours: number;
    bookingCount: number;
    utilizationPercent: number;
  }>;
  lowDemandTools?: Array<{
    name: string;
    bookedHours: number;
    bookingCount: number;
    utilizationPercent: number;
  }>;
  recommendations?: string[];
}
