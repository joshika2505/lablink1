import React, { useEffect, useState } from 'react';
import {
  EQUIPMENT_CATEGORIES,
  type AccessRequest,
  type AuthorizedAdminEntry,
  type Booking,
  type Department,
  type Equipment,
  type EquipmentCategory,
  type Laboratory,
  type MaintenanceLog,
  type UserProfile,
  type UserRole,
  type UtilizationAnalytics,
} from '../../types/lablink';
import { api } from '../../lib/api';
import { ClayModal, ClayTiltCard, TactileButton } from '../motion/MotionPrimitives';

interface ApprovalsAdminViewProps {
  mode?: 'approvals' | 'admin-console';
  user: UserProfile | null;
  bookings: Booking[];
  accessRequests: AccessRequest[];
  equipment: Equipment[];
  laboratories: Laboratory[];
  departments: Department[];
  maintenance: MaintenanceLog[];
  users: UserProfile[];
  analytics: UtilizationAnalytics | null;
  authorizedAdmins: AuthorizedAdminEntry[];
  onBookingUpdated: (booking: Booking) => void;
  onAccessRequestUpdated: (req: AccessRequest) => void;
  onEquipmentAdded: (eq: Equipment) => void;
  onEquipmentUpdated: (eq: Equipment) => void;
  onEquipmentDeleted: (equipmentId: string) => void;
  onEquipmentStatusUpdated: (eq: Equipment) => void;
  onDepartmentAdded: (dept: Department) => void;
  onLaboratoryAdded: (lab: Laboratory) => void;
  onMaintenanceAdded: (log: MaintenanceLog) => void;
  onUserRoleUpdated: (user: UserProfile) => void;
  onFacultyRequestDecided: (user: UserProfile) => void;
  onUserCreated: (user: UserProfile) => void;
  onAuthorizedAdminsUpdated: (admins: AuthorizedAdminEntry[]) => void;
  onOpenAuth: () => void;
}

export const ApprovalsAdminView: React.FC<ApprovalsAdminViewProps> = ({
  mode = 'approvals',
  user,
  bookings,
  accessRequests,
  equipment,
  laboratories,
  departments,
  maintenance,
  users,
  analytics,
  authorizedAdmins,
  onBookingUpdated,
  onAccessRequestUpdated,
  onEquipmentAdded,
  onEquipmentUpdated,
  onEquipmentDeleted,
  onEquipmentStatusUpdated,
  onDepartmentAdded,
  onLaboratoryAdded,
  onMaintenanceAdded,
  onUserRoleUpdated,
  onFacultyRequestDecided,
  onUserCreated,
  onAuthorizedAdminsUpdated,
  onOpenAuth,
}) => {
  const isAdmin = user?.role === 'admin';
  const isFacultyOrAdmin = user?.role === 'faculty' || isAdmin;

  const [adminTab, setAdminTab] = useState<
    'equipment' | 'reservations' | 'maintenance' | 'users'
  >('equipment');
  const [actionError, setActionError] = useState<string | null>(null);
  const [actionSuccess, setActionSuccess] = useState<string | null>(null);
  const [loadingBookingId, setLoadingBookingId] = useState<string | null>(null);

  // Alternative slot modal state (bookings & access requests)
  const [altTargetBooking, setAltTargetBooking] = useState<Booking | null>(null);
  const [altTargetAccessReq, setAltTargetAccessReq] = useState<AccessRequest | null>(null);
  const [altHour, setAltHour] = useState(16);
  const [altAccessNotes, setAltAccessNotes] = useState('');
  const [loadingAccessReqId, setLoadingAccessReqId] = useState<string | null>(null);
  const [facultyLabSelection, setFacultyLabSelection] = useState<Record<string, string[]>>({});
  const [loadingFacultyReqId, setLoadingFacultyReqId] = useState<string | null>(null);

  // Add Equipment Modal
  const [showAddEq, setShowAddEq] = useState(false);
  const [newEqName, setNewEqName] = useState('');
  const [newEqCat, setNewEqCat] = useState<EquipmentCategory>('Electronics & Circuits');
  const [newEqDept, setNewEqDept] = useState(departments[0]?.id || '');
  const [newEqLab, setNewEqLab] = useState(laboratories[0]?.id || '');
  const [newEqRate, setNewEqRate] = useState(40);
  const [newEqSpecs, setNewEqSpecs] = useState('');

  // Edit Equipment Modal
  const [editTargetEq, setEditTargetEq] = useState<Equipment | null>(null);
  const [editEqName, setEditEqName] = useState('');
  const [editEqCat, setEditEqCat] = useState<EquipmentCategory>('Electronics & Circuits');
  const [editEqDept, setEditEqDept] = useState('');
  const [editEqLab, setEditEqLab] = useState('');
  const [editEqRate, setEditEqRate] = useState(40);
  const [editEqSpecs, setEditEqSpecs] = useState('');

  // Add Department & Lab Modals
  const [showAddDept, setShowAddDept] = useState(false);
  const [deptName, setDeptName] = useState('');
  const [deptCode, setDeptCode] = useState('');
  const [deptHead, setDeptHead] = useState('');

  const [showAddLab, setShowAddLab] = useState(false);
  const [labName, setLabName] = useState('');
  const [labDept, setLabDept] = useState(departments[0]?.id || '');
  const [labBuilding, setLabBuilding] = useState('');
  const [labRoom, setLabRoom] = useState('');

  // Maintenance Modal
  const [showAddMaint, setShowAddMaint] = useState(false);
  const [maintEqId, setMaintEqId] = useState(equipment[0]?.id || '');
  const [maintTask, setMaintTask] = useState('');
  const [maintTech, setMaintTech] = useState('R. Gomez');

  // Add Faculty Account Modal (Admin only)
  const [showAddFaculty, setShowAddFaculty] = useState(false);
  const [facultyName, setFacultyName] = useState('');
  const [facultyEmail, setFacultyEmail] = useState('');
  const [facultyDept, setFacultyDept] = useState(departments[0]?.name || 'Bioengineering');
  const [facultyPassword, setFacultyPassword] = useState('');

  // Add Authorized Admin form (Admin only)
  const [newAdminEmail, setNewAdminEmail] = useState('');
  const [newAdminName, setNewAdminName] = useState('');

  useEffect(() => {
    if (departments.length > 0 && !departments.some((d) => d.id === newEqDept)) {
      setNewEqDept(departments[0].id);
      setLabDept(departments[0].id);
    }
    if (laboratories.length > 0 && !laboratories.some((l) => l.id === newEqLab)) {
      setNewEqLab(laboratories[0].id);
    }
    if (equipment.length > 0 && !equipment.some((e) => e.id === maintEqId)) {
      setMaintEqId(equipment[0].id);
    }
  }, [departments, laboratories, equipment, newEqDept, newEqLab, maintEqId]);

  if (!isFacultyOrAdmin) {
    return (
      <div className="bg-[#ffffff] rounded-[2rem] p-10 clay-card text-center flex flex-col items-center gap-4 max-w-xl mx-auto mt-6">
        <div className="w-14 h-14 rounded-full bg-[#ffd9e0] text-[#84515e] flex items-center justify-center">
          <span className="material-symbols-outlined text-3xl">lock</span>
        </div>
        <h1 className="text-2xl font-bold text-[#1d1c15]">Staff Access Required</h1>
        <p className="text-sm text-[#3f4945]">
          Only faculty members and authorized administrators can view approval requests or manage
          lab tools.
        </p>
        <TactileButton variant="primary" onClick={onOpenAuth} className="px-6 py-2.5 text-sm">
          Sign In
        </TactileButton>
      </div>
    );
  }

  if (mode === 'admin-console' && !isAdmin) {
    return (
      <div className="bg-[#ffffff] rounded-[2rem] p-10 clay-card text-center flex flex-col items-center gap-4 max-w-xl mx-auto mt-6">
        <div className="w-14 h-14 rounded-full bg-[#ffd9e0] text-[#84515e] flex items-center justify-center">
          <span className="material-symbols-outlined text-3xl">admin_panel_settings</span>
        </div>
        <h1 className="text-2xl font-bold text-[#1d1c15]">Admin Access Required</h1>
        <p className="text-sm text-[#3f4945]">
          Usage reports, user role changes, and platform controls are restricted to authorized
          administrators.
        </p>
      </div>
    );
  }

  // Faculty sees only their assigned lab equipment if assignedLabIds is populated
  const facultyAssignedLabIds = user?.assignedLabIds || [];
  const managedEquipment =
    !isAdmin && facultyAssignedLabIds.length > 0
      ? equipment.filter((e) => facultyAssignedLabIds.includes(e.laboratoryId))
      : equipment;

  const managedLabEquipmentIds = new Set(managedEquipment.map((e) => e.id));
  const managedBookings =
    !isAdmin && facultyAssignedLabIds.length > 0
      ? bookings.filter((b) => managedLabEquipmentIds.has(b.equipmentId))
      : bookings;

  const pendingApprovals = managedBookings.filter((b) => b.status === 'pending');
  const pendingAccessRequests = accessRequests.filter(
    (r) =>
      r.status === 'pending' &&
      (isAdmin || facultyAssignedLabIds.length === 0 || managedLabEquipmentIds.has(r.equipmentId)),
  );
  const pendingFacultyRequests = users.filter((u) => u.facultyApprovalStatus === 'pending');

  const clearBanners = () => {
    setActionError(null);
    setActionSuccess(null);
  };

  const handleDecision = async (
    bookingId: string,
    decision: 'confirmed' | 'rejected' | 'alternative_suggested',
    alternative?: Booking['suggestedAlternative'],
  ) => {
    clearBanners();
    setLoadingBookingId(bookingId);
    try {
      const res = await api.decideApproval(bookingId, decision, alternative);
      onBookingUpdated(res.booking);
      setAltTargetBooking(null);
      setActionSuccess(
        decision === 'confirmed'
          ? 'Booking request approved.'
          : decision === 'rejected'
            ? 'Booking request rejected.'
            : 'New time suggestion sent.',
      );
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'Approval action failed.');
    } finally {
      setLoadingBookingId(null);
    }
  };

  const handleAccessRequestDecision = async (
    reqId: string,
    decision: 'approved' | 'rejected' | 'alternative_suggested',
    reviewerNotes?: string,
    alternative?: AccessRequest['suggestedAlternative'],
  ) => {
    clearBanners();
    setLoadingAccessReqId(reqId);
    try {
      const res = await api.decideAccessRequest(reqId, {
        decision,
        reviewerNotes,
        alternative,
      });
      onAccessRequestUpdated(res.accessRequest);
      setAltTargetAccessReq(null);
      setAltAccessNotes('');
      setActionSuccess(
        decision === 'approved'
          ? 'Project access request approved.'
          : decision === 'rejected'
            ? 'Project access request declined.'
            : 'Alternative window suggested for project request.',
      );
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'Access request decision failed.');
    } finally {
      setLoadingAccessReqId(null);
    }
  };

  const handleFacultyApproval = async (
    targetUserId: string,
    decision: 'approved' | 'rejected',
  ) => {
    clearBanners();
    setLoadingFacultyReqId(targetUserId);
    try {
      const selectedLabs = facultyLabSelection[targetUserId] || [];
      const res = await api.decideFacultyRequest(targetUserId, {
        decision,
        assignedLabIds: decision === 'approved' ? selectedLabs : undefined,
      });
      onFacultyRequestDecided(res.user);
      setActionSuccess(
        decision === 'approved'
          ? `Approved faculty access for ${res.user.name}.`
          : `Declined faculty access request for ${res.user.name}.`,
      );
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'Faculty approval failed.');
    } finally {
      setLoadingFacultyReqId(null);
    }
  };

  const handleCreateEquipment = async (e: React.FormEvent) => {
    e.preventDefault();
    clearBanners();
    try {
      const res = await api.addEquipment({
        name: newEqName,
        category: newEqCat,
        departmentId: newEqDept,
        laboratoryId: newEqLab,
        hourlyRate: newEqRate,
        requiresFacultyApproval: true,
        certificationRequired: 'General Lab Safety',
        description: `${newEqName} shared campus equipment.`,
        specsPreview: newEqSpecs || 'Calibrated · Standard Setup',
      });
      onEquipmentAdded(res.equipment);
      setShowAddEq(false);
      setNewEqName('');
      setNewEqSpecs('');
      setActionSuccess(`Added "${res.equipment.name}" to catalog.`);
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'Failed to add equipment.');
    }
  };

  const openEditEquipment = (eq: Equipment) => {
    setEditTargetEq(eq);
    setEditEqName(eq.name);
    setEditEqCat(eq.category);
    setEditEqDept(eq.departmentId);
    setEditEqLab(eq.laboratoryId);
    setEditEqRate(eq.hourlyRate);
    setEditEqSpecs(eq.specsPreview);
  };

  const handleSaveEquipmentEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editTargetEq) return;
    clearBanners();
    try {
      const res = await api.updateEquipment(editTargetEq.id, {
        name: editEqName,
        category: editEqCat,
        departmentId: editEqDept,
        laboratoryId: editEqLab,
        hourlyRate: editEqRate,
        specsPreview: editEqSpecs,
      });
      onEquipmentUpdated(res.equipment);
      setEditTargetEq(null);
      setActionSuccess(`Updated "${res.equipment.name}".`);
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'Failed to update equipment.');
    }
  };

  const handleRemoveEquipment = async (eq: Equipment) => {
    clearBanners();
    try {
      await api.deleteEquipment(eq.id);
      onEquipmentDeleted(eq.id);
      setActionSuccess(`Removed "${eq.name}".`);
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'Failed to remove equipment.');
    }
  };

  const handleCreateDepartment = async (e: React.FormEvent) => {
    e.preventDefault();
    clearBanners();
    try {
      const res = await api.addDepartment({
        name: deptName,
        code: deptCode,
        headName: deptHead,
      });
      onDepartmentAdded(res.department);
      setShowAddDept(false);
      setDeptName('');
      setDeptCode('');
      setDeptHead('');
      setActionSuccess(`Created department "${res.department.name}".`);
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'Failed to add department.');
    }
  };

  const handleCreateLab = async (e: React.FormEvent) => {
    e.preventDefault();
    clearBanners();
    try {
      const res = await api.addLaboratory({
        name: labName,
        departmentId: labDept,
        building: labBuilding,
        room: labRoom,
        capacity: 10,
        managerName: user?.name || 'Lab Manager',
      });
      onLaboratoryAdded(res.laboratory);
      setShowAddLab(false);
      setLabName('');
      setLabBuilding('');
      setLabRoom('');
      setActionSuccess(`Created lab "${res.laboratory.name}".`);
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'Failed to add lab.');
    }
  };

  const handleCreateMaint = async (e: React.FormEvent) => {
    e.preventDefault();
    clearBanners();
    try {
      const res = await api.addMaintenance({
        equipmentId: maintEqId || managedEquipment[0]?.id || equipment[0]?.id,
        technician: maintTech,
        taskTitle: maintTask,
        status: 'in_progress',
        scheduledDate: new Date().toISOString().slice(0, 10),
        notes: 'Logged from lab operations.',
      });
      onMaintenanceAdded(res.maintenance);
      setShowAddMaint(false);
      setMaintTask('');
      setActionSuccess('Maintenance check scheduled.');
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'Failed to schedule maintenance.');
    }
  };

  const handleCreateFaculty = async (e: React.FormEvent) => {
    e.preventDefault();
    clearBanners();
    try {
      const res = await api.createFacultyAccount({
        email: facultyEmail,
        name: facultyName,
        department: facultyDept,
        password: facultyPassword,
      });
      onUserCreated(res.user);
      setShowAddFaculty(false);
      setFacultyName('');
      setFacultyEmail('');
      setFacultyPassword('');
      setActionSuccess(`Added faculty account for ${res.user.name}.`);
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'Failed to add faculty account.');
    }
  };

  const handleGrantAdmin = async (e: React.FormEvent) => {
    e.preventDefault();
    clearBanners();
    try {
      const res = await api.grantAuthorizedAdmin(newAdminEmail, newAdminName);
      onAuthorizedAdminsUpdated(res.authorizedAdmins);
      setNewAdminEmail('');
      setNewAdminName('');
      setActionSuccess('Added email to authorized admin list.');
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'Failed to add authorized admin.');
    }
  };

  const handleRevokeAdmin = async (email: string) => {
    clearBanners();
    try {
      const res = await api.revokeAuthorizedAdmin(email);
      onAuthorizedAdminsUpdated(res.authorizedAdmins);
      setActionSuccess(`Removed ${email} from authorized admin list.`);
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'Failed to remove authorized admin.');
    }
  };

  const formatBookingStatus = (status: Booking['status']) => {
    if (status === 'pending') return 'Waiting for Approval';
    if (status === 'alternative_suggested') return 'New Time Suggested';
    return status;
  };

  return (
    <div className="flex flex-col w-full gap-10">
      {actionError && (
        <div className="rounded-2xl bg-[#ffdad6] text-[#93000a] px-4 py-3 text-xs font-semibold">
          {actionError}
        </div>
      )}
      {actionSuccess && (
        <div className="rounded-2xl bg-[#a8e8d5]/65 text-[#2b6a5b] px-4 py-3 text-xs font-semibold">
          {actionSuccess}
        </div>
      )}

      {/* SECTION 01: Waiting for Approval Queue */}
      <section className="flex flex-col gap-6">
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
          <div className="flex flex-col gap-1">
            <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-widest text-[#29695a]">
              <span>01. Request Review</span>
              <span className="text-[#707975]">·</span>
              <span className="text-[#3f4945]">Spring Semester</span>
            </div>
            <h1 className="text-3xl font-bold text-[#1d1c15]">Waiting for Approval</h1>
          </div>

          <div className="flex items-center gap-3">
            <div className="bg-[#ffffff] rounded-full px-4 py-1.5 clay-card flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-[#f5b5c4]" />
              <span className="text-sm font-semibold text-[#1d1c15] tabular-nums">
                {pendingApprovals.length + pendingAccessRequests.length} Waiting
              </span>
            </div>
          </div>
        </div>

        {pendingApprovals.length > 0 ? (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {pendingApprovals.map((req) => {
              const initials = req.userName
                .split(' ')
                .map((n) => n[0])
                .join('')
                .slice(0, 2)
                .toUpperCase();
              const badgeClass =
                req.urgencyTag === 'Urgent'
                  ? 'bg-[#ffd9e0] text-[#340e1b]'
                  : req.urgencyTag === 'Certified'
                    ? 'bg-[#afefdc] text-[#002019]'
                    : 'bg-[#bce9ff] text-[#001f29]';
              return (
                <ClayTiltCard
                  key={req.id}
                  tiltMax={4}
                  className="bg-[#ffffff] rounded-[2rem] p-6 clay-card flex flex-col justify-between gap-5"
                >
                  <div className="flex flex-col gap-4">
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-center gap-3 min-w-0">
                        <div className="w-12 h-12 rounded-full bg-[#a8e8d5] text-[#2b6a5b] font-bold flex items-center justify-center shrink-0">
                          {initials}
                        </div>
                        <div className="min-w-0">
                          <h3 className="text-lg font-semibold text-[#1d1c15] truncate">
                            {req.userName}
                          </h3>
                          <p className="text-xs text-[#3f4945] truncate">{req.userRoleTitle}</p>
                        </div>
                      </div>
                      <span
                        className={`px-3 py-1 rounded-full text-[11px] font-semibold shrink-0 ${badgeClass}`}
                      >
                        {req.urgencyTag || 'Routine'}
                      </span>
                    </div>

                    <div className="bg-[#f8f3e8] rounded-2xl p-4 clay-well flex flex-col gap-1.5">
                      <span className="text-[11px] font-semibold uppercase tracking-wider text-[#3f4945]">
                        Project & Equipment
                      </span>
                      <p className="text-sm font-semibold text-[#1d1c15]">{req.projectTitle}</p>
                      <div className="flex flex-wrap gap-2 pt-1 text-xs font-semibold">
                        <span className="px-3 py-1 rounded-full bg-[#a8e8d5] text-[#2b6a5b]">
                          {req.equipmentName}
                        </span>
                        <span className="px-3 py-1 rounded-full bg-[#ffffff] text-[#3f4945] tabular-nums">
                          {req.date} · {String(req.startHour).padStart(2, '0')}:00–
                          {String(req.startHour + req.durationHours).padStart(2, '0')}:00
                        </span>
                      </div>
                    </div>

                    {req.aiNote && (
                      <div className="bg-[#b0e4fd]/45 rounded-2xl p-4 flex items-start gap-2.5">
                        <span className="material-symbols-outlined text-[#32677c] text-[20px] shrink-0">
                          auto_awesome
                        </span>
                        <div className="flex flex-col gap-0.5 min-w-0">
                          <span className="text-xs font-semibold text-[#32677c]">
                            Smart Suggestion
                          </span>
                          <p className="text-xs text-[#1d1c15] leading-relaxed">{req.aiNote}</p>
                        </div>
                      </div>
                    )}
                  </div>

                  <div className="flex flex-wrap items-center gap-2 pt-1">
                    <TactileButton
                      variant="primary"
                      loading={loadingBookingId === req.id}
                      onClick={() => handleDecision(req.id, 'confirmed')}
                      className="flex-1 py-2.5 px-3 text-xs"
                    >
                      <span className="material-symbols-outlined text-[17px]">check</span>
                      <span>Approve</span>
                    </TactileButton>
                    <TactileButton
                      variant="ghost"
                      disabled={loadingBookingId === req.id}
                      onClick={() => setAltTargetBooking(req)}
                      className="py-2.5 px-3 text-xs"
                    >
                      Suggest Time
                    </TactileButton>
                    <TactileButton
                      variant="danger"
                      disabled={loadingBookingId === req.id}
                      onClick={() => handleDecision(req.id, 'rejected')}
                      className="py-2.5 px-3 text-xs"
                    >
                      Reject
                    </TactileButton>
                  </div>
                </ClayTiltCard>
              );
            })}
          </div>
        ) : pendingAccessRequests.length === 0 ? (
          <div className="bg-[#f8f3e8] rounded-[2rem] p-8 clay-well text-center">
            <p className="text-sm font-semibold text-[#1d1c15]">
              All equipment booking and project access requests have been reviewed.
            </p>
          </div>
        ) : null}

        {/* Project-Based Access Requests Review Queue */}
        {pendingAccessRequests.length > 0 && (
          <div className="flex flex-col gap-3">
            <h2 className="text-lg font-bold text-[#1d1c15]">
              Project-Based Access Requests ({pendingAccessRequests.length})
            </h2>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
              {pendingAccessRequests.map((req) => (
                <ClayTiltCard
                  key={req.id}
                  tiltMax={3}
                  className="bg-[#ffffff] rounded-[2rem] p-6 clay-card flex flex-col justify-between gap-4"
                >
                  <div className="flex flex-col gap-3">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <p className="text-base font-bold text-[#1d1c15]">{req.userName}</p>
                        <p className="text-xs text-[#3f4945]">{req.userDepartment}</p>
                      </div>
                      <span className="px-3 py-1 rounded-full bg-[#f8de91] text-[#4a3800] text-[11px] font-semibold tabular-nums">
                        {req.requestedHours}h · Due {req.deadline}
                      </span>
                    </div>

                    <div className="bg-[#f8f3e8] rounded-2xl p-3.5 clay-well flex flex-col gap-1">
                      <span className="text-[11px] font-semibold uppercase tracking-wider text-[#29695a]">
                        Project: {req.projectTitle}
                      </span>
                      <p className="text-sm font-semibold text-[#1d1c15]">
                        {req.equipmentName} · Preferred {req.preferredDate}
                      </p>
                      <p className="text-xs text-[#3f4945] mt-1 leading-relaxed">
                        {req.justification}
                      </p>
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center gap-2">
                    <TactileButton
                      variant="primary"
                      loading={loadingAccessReqId === req.id}
                      onClick={() => handleAccessRequestDecision(req.id, 'approved')}
                      className="flex-1 py-2 px-3 text-xs"
                    >
                      Approve
                    </TactileButton>
                    <TactileButton
                      variant="ghost"
                      disabled={loadingAccessReqId === req.id}
                      onClick={() => setAltTargetAccessReq(req)}
                      className="py-2 px-3 text-xs"
                    >
                      Suggest Alt
                    </TactileButton>
                    <TactileButton
                      variant="danger"
                      disabled={loadingAccessReqId === req.id}
                      onClick={() => handleAccessRequestDecision(req.id, 'rejected')}
                      className="py-2 px-3 text-xs"
                    >
                      Reject
                    </TactileButton>
                  </div>
                </ClayTiltCard>
              ))}
            </div>
          </div>
        )}
      </section>

      {/* SECTION 02: Usage Reports (Admin Only) + Equipment / Bookings / Users Management */}
      <section className="flex flex-col gap-6">
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
          <div className="flex flex-col gap-1">
            <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-widest text-[#2f6579]">
              <span>{isAdmin ? '02. Usage Reports & Admin Tools' : '02. Assigned Lab Management'}</span>
            </div>
            <h2 className="text-3xl font-bold text-[#1d1c15]">
              {isAdmin ? 'Usage Reports & Platform Controls' : 'Assigned Lab Equipment & Bookings'}
            </h2>
          </div>

          <div className="flex flex-wrap items-center gap-1 bg-[#f8f3e8] p-1 rounded-full clay-well">
            {(
              [
                { id: 'equipment', label: isAdmin ? 'Manage Equipment' : 'Lab Equipment' },
                { id: 'reservations', label: 'Manage Bookings' },
                { id: 'maintenance', label: 'Maintenance' },
                ...(isAdmin ? ([{ id: 'users', label: 'Users & Faculty' }] as const) : []),
              ] as const
            ).map((tab) => (
              <button
                key={tab.id}
                type="button"
                onClick={() => setAdminTab(tab.id)}
                className={`px-4 py-1.5 rounded-full text-xs font-semibold transition-all cursor-pointer ${
                  adminTab === tab.id
                    ? 'bg-[#ffffff] text-[#1d1c15] shadow-sm'
                    : 'text-[#3f4945] hover:text-[#1d1c15]'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Admin-only Usage Reports Charts */}
          {isAdmin && analytics && (
            <>
              <div className="lg:col-span-7 bg-[#ffffff] rounded-[2rem] p-6 clay-card flex flex-col justify-between gap-6">
                <div className="flex items-center justify-between">
                  <div>
                    <span className="text-[11px] font-semibold uppercase tracking-wider text-[#3f4945]">
                      Weekly Equipment Usage
                    </span>
                    <h3 className="text-xl font-bold text-[#1d1c15] tabular-nums">
                      {analytics.peakCapacityPercent}% Peak Campus Usage
                    </h3>
                  </div>
                  <span className="bg-[#a8e8d5] text-[#2b6a5b] text-xs font-semibold px-3.5 py-1 rounded-full tabular-nums">
                    {analytics.deltaVsLastWeek}
                  </span>
                </div>

                <div className="w-full pt-2">
                  <svg
                    aria-label="Weekly Equipment Usage Bar Chart"
                    className="w-full h-48 overflow-visible"
                    role="img"
                    viewBox="0 0 560 190"
                  >
                    <g stroke="#ede8dd" strokeDasharray="4 4" strokeWidth="1">
                      <line x1="0" x2="560" y1="30" y2="30" />
                      <line x1="0" x2="560" y1="75" y2="75" />
                      <line x1="0" x2="560" y1="120" y2="120" />
                      <line x1="0" x2="560" y1="165" y2="165" />
                    </g>
                    {analytics.weeklyBars.map((bar, i) => {
                      const x = 24 + i * 76;
                      const h = Math.round((bar.percent / 100) * 155);
                      const y = 165 - h;
                      const fill = bar.isPeak
                        ? '#29695a'
                        : i < 2
                          ? '#a8e8d5'
                          : i < 5
                            ? '#b0e4fd'
                            : '#ffcfd9';
                      return (
                        <g key={bar.day}>
                          <rect x={x} y={y} width="44" height={h} rx="14" fill={fill} />
                          <text
                            x={x + 22}
                            y="185"
                            textAnchor="middle"
                            className="fill-[#3f4945] text-[11px] font-semibold"
                          >
                            {bar.day}
                          </text>
                        </g>
                      );
                    })}
                  </svg>
                </div>
              </div>

              <div className="lg:col-span-5 bg-[#ffffff] rounded-[2rem] p-6 clay-card flex flex-col justify-between gap-4">
                <div>
                  <span className="text-[11px] font-semibold uppercase tracking-wider text-[#3f4945]">
                    Usage by Lab Area
                  </span>
                  <h3 className="text-xl font-bold text-[#1d1c15]">Equipment Usage Split</h3>
                </div>

                <div className="flex items-center justify-around gap-4 py-2">
                  <svg
                    aria-label="Lab Area Usage Chart"
                    className="w-32 h-32 shrink-0 -rotate-90"
                    role="img"
                    viewBox="0 0 120 120"
                  >
                    <circle
                      cx="60"
                      cy="60"
                      fill="none"
                      r="46"
                      stroke="#f8f3e8"
                      strokeWidth="16"
                    />
                    <circle
                      cx="60"
                      cy="60"
                      fill="none"
                      r="46"
                      stroke="#a8e8d5"
                      strokeDasharray="130 289"
                      strokeLinecap="round"
                      strokeWidth="16"
                    />
                    <circle
                      cx="60"
                      cy="60"
                      fill="none"
                      r="46"
                      stroke="#b0e4fd"
                      strokeDasharray="92 289"
                      strokeDashoffset="-135"
                      strokeLinecap="round"
                      strokeWidth="16"
                    />
                    <circle
                      cx="60"
                      cy="60"
                      fill="none"
                      r="46"
                      stroke="#ffcfd9"
                      strokeDasharray="58 289"
                      strokeDashoffset="-232"
                      strokeLinecap="round"
                      strokeWidth="16"
                    />
                  </svg>

                  <div className="flex flex-col gap-2.5 flex-1 tabular-nums">
                    {analytics.zoneSplit.map((z) => (
                      <div key={z.zone} className="flex items-center justify-between text-sm">
                        <div className="flex items-center gap-2">
                          <span
                            className="w-3 h-3 rounded-full"
                            style={{ backgroundColor: z.color }}
                          />
                          <span className="text-[#1d1c15]">{z.zone}</span>
                        </div>
                        <span className="font-semibold text-[#1d1c15]">{z.percent}%</span>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="bg-[#f8f3e8] rounded-2xl p-3.5 flex items-center justify-between text-xs tabular-nums">
                  <span className="text-[#3f4945]">
                    {analytics.onlineInstruments} of {analytics.totalInstruments} tools working
                  </span>
                  <span className="font-semibold text-[#29695a]">
                    {analytics.uptimePercent}% Ready
                  </span>
                </div>
              </div>

              {/* Real Database Utilization Insights */}
              <div className="lg:col-span-12 grid grid-cols-1 md:grid-cols-3 gap-5">
                <div className="bg-[#ffffff] rounded-[2rem] p-5 clay-card flex flex-col gap-2">
                  <span className="text-[11px] font-semibold uppercase tracking-wider text-[#29695a]">
                    Hours & Demand
                  </span>
                  <p className="text-2xl font-bold text-[#1d1c15] tabular-nums">
                    {analytics.totalBookedHours ?? 0}h Booked · {analytics.totalIdleHours ?? 0}h Open
                  </p>
                  <p className="text-xs text-[#3f4945]">
                    Across {analytics.totalActiveBookings ?? 0} active reservations.
                  </p>
                  {analytics.peakHours && analytics.peakHours.length > 0 && (
                    <div className="flex flex-wrap gap-1.5 pt-1">
                      {analytics.peakHours.map((ph) => (
                        <span
                          key={ph.hourLabel}
                          className="px-2.5 py-0.5 rounded-full bg-[#b0e4fd]/60 text-[#32677c] text-[11px] font-semibold tabular-nums"
                        >
                          {ph.hourLabel} ({ph.count})
                        </span>
                      ))}
                    </div>
                  )}
                </div>

                <div className="bg-[#ffffff] rounded-[2rem] p-5 clay-card flex flex-col gap-2">
                  <span className="text-[11px] font-semibold uppercase tracking-wider text-[#82505d]">
                    High vs Underused Tools
                  </span>
                  <div className="flex flex-col gap-1.5 text-xs">
                    {(analytics.highDemandTools || []).slice(0, 2).map((t) => (
                      <div key={t.name} className="flex justify-between gap-2">
                        <span className="font-semibold text-[#1d1c15] truncate">{t.name}</span>
                        <span className="px-2 py-0.5 rounded-full bg-[#ffcfd9] text-[#84515e] font-semibold shrink-0 tabular-nums">
                          {t.bookedHours}h ({t.utilizationPercent}%)
                        </span>
                      </div>
                    ))}
                    {(analytics.lowDemandTools || []).slice(0, 2).map((t) => (
                      <div key={t.name} className="flex justify-between gap-2">
                        <span className="text-[#3f4945] truncate">{t.name}</span>
                        <span className="px-2 py-0.5 rounded-full bg-[#a8e8d5]/55 text-[#2b6a5b] font-semibold shrink-0 tabular-nums">
                          {t.bookedHours}h idle
                        </span>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="bg-[#ffffff] rounded-[2rem] p-5 clay-card flex flex-col gap-2">
                  <span className="text-[11px] font-semibold uppercase tracking-wider text-[#2f6579]">
                    Optimization Suggestions
                  </span>
                  <div className="flex flex-col gap-1.5">
                    {(analytics.recommendations || []).slice(0, 2).map((rec, i) => (
                      <p key={i} className="text-xs text-[#1d1c15] leading-relaxed bg-[#f8f3e8] rounded-xl p-2.5">
                        {rec}
                      </p>
                    ))}
                  </div>
                </div>
              </div>
            </>
          )}

          {/* Left Card: Departments & Labs */}
          <div className="lg:col-span-5 bg-[#ffffff] rounded-[2rem] p-6 clay-card flex flex-col gap-4">
            <div className="flex items-center justify-between gap-2">
              <div>
                <span className="text-[11px] font-semibold uppercase tracking-wider text-[#3f4945]">
                  {isAdmin ? 'Departments & Labs' : 'Your Assigned Labs'}
                </span>
                <h3 className="text-xl font-bold text-[#1d1c15]">Campus Labs</h3>
              </div>
              {isAdmin && (
                <div className="flex items-center gap-1.5">
                  <TactileButton
                    variant="ghost"
                    onClick={() => setShowAddDept(true)}
                    className="px-3 py-1.5 text-xs"
                  >
                    + Dept
                  </TactileButton>
                  <TactileButton
                    variant="primary"
                    onClick={() => setShowAddLab(true)}
                    className="px-3 py-1.5 text-xs"
                  >
                    + Lab
                  </TactileButton>
                </div>
              )}
            </div>

            <div className="flex flex-col gap-2.5">
              {(isAdmin || facultyAssignedLabIds.length === 0
                ? laboratories.slice(0, 5)
                : laboratories.filter((l) => facultyAssignedLabIds.includes(l.id))
              ).map((lab) => {
                const statusClass =
                  lab.status === 'open'
                    ? 'bg-[#a8e8d5] text-[#2b6a5b]'
                    : lab.status === 'high_load'
                      ? 'bg-[#b0e4fd] text-[#32677c]'
                      : 'bg-[#ffd9e0] text-[#340e1b]';
                return (
                  <div
                    key={lab.id}
                    className="bg-[#f8f3e8] rounded-2xl p-3.5 flex items-center justify-between gap-2"
                  >
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-[#1d1c15] truncate">
                        {lab.name} · {lab.room}
                      </p>
                      <p className="text-xs text-[#3f4945] tabular-nums">
                        {lab.occupied}/{lab.capacity} benches used · {lab.departmentName}
                      </p>
                    </div>
                    <span
                      className={`px-3 py-1 rounded-full text-[11px] font-semibold shrink-0 ${statusClass}`}
                    >
                      {lab.status === 'open'
                        ? 'Open'
                        : lab.status === 'high_load'
                          ? 'Busy'
                          : 'Maintenance'}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Right Card: Equipment / Bookings / Maintenance / Users Management */}
          <div className="lg:col-span-7 bg-[#ffffff] rounded-[2rem] p-6 clay-card flex flex-col gap-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <span className="text-[11px] font-semibold uppercase tracking-wider text-[#3f4945]">
                  {adminTab === 'equipment'
                    ? 'Equipment List'
                    : adminTab === 'reservations'
                      ? 'Manage Bookings'
                      : adminTab === 'maintenance'
                        ? 'Service Log'
                        : 'Users & Admin Access'}
                </span>
                <h3 className="text-xl font-bold text-[#1d1c15]">
                  {adminTab === 'equipment'
                    ? 'Lab Equipment & Status'
                    : adminTab === 'reservations'
                      ? isAdmin
                        ? 'All Bookings'
                        : 'Bookings in Your Labs'
                      : adminTab === 'maintenance'
                        ? 'Active Service & Checks'
                        : 'Manage Accounts & Roles'}
                </h3>
              </div>

              {adminTab === 'equipment' && isAdmin && (
                <TactileButton
                  variant="primary"
                  onClick={() => setShowAddEq(true)}
                  className="px-4 py-1.5 text-xs"
                >
                  + Add Equipment
                </TactileButton>
              )}

              {adminTab === 'maintenance' && isFacultyOrAdmin && (
                <TactileButton
                  variant="secondary"
                  onClick={() => setShowAddMaint(true)}
                  className="px-4 py-1.5 text-xs"
                >
                  + Log Service
                </TactileButton>
              )}

              {adminTab === 'users' && isAdmin && (
                <TactileButton
                  variant="primary"
                  onClick={() => setShowAddFaculty(true)}
                  className="px-4 py-1.5 text-xs"
                >
                  + Add Faculty
                </TactileButton>
              )}
            </div>

            {adminTab === 'equipment' && (
              <div className="flex flex-col gap-2.5 max-h-80 overflow-y-auto pr-1">
                {managedEquipment.map((eq) => (
                  <div
                    key={eq.id}
                    className="bg-[#f8f3e8] rounded-2xl p-3.5 flex flex-wrap items-center justify-between gap-3"
                  >
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-semibold text-[#1d1c15] truncate">{eq.name}</p>
                      <p className="text-xs text-[#3f4945] truncate">
                        {eq.locationLabel} · Checked {eq.lastCalibrated}
                      </p>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <select
                        aria-label={`Status for ${eq.name}`}
                        value={eq.status}
                        onChange={async (e) => {
                          clearBanners();
                          try {
                            const updated = await api.updateEquipmentStatus(
                              eq.id,
                              e.target.value as Equipment['status'],
                            );
                            onEquipmentStatusUpdated(updated.equipment);
                          } catch (err) {
                            setActionError(
                              err instanceof Error ? err.message : 'Status update failed.',
                            );
                          }
                        }}
                        className="rounded-full bg-[#ffffff] px-3 py-1 text-xs font-semibold text-[#1d1c15] cursor-pointer"
                      >
                        <option value="available">Available Now</option>
                        <option value="in_use">In Use</option>
                        <option value="maintenance">Maintenance</option>
                      </select>

                      {isAdmin && (
                        <>
                          <button
                            type="button"
                            onClick={() => openEditEquipment(eq)}
                            className="px-3 py-1 rounded-full bg-[#ffffff] hover:bg-[#b0e4fd] text-[#1d1c15] text-xs font-semibold cursor-pointer transition-colors"
                          >
                            Edit
                          </button>
                          <button
                            type="button"
                            onClick={() => handleRemoveEquipment(eq)}
                            className="px-3 py-1 rounded-full bg-[#ffd9e0] hover:bg-[#f5b5c4] text-[#673946] text-xs font-semibold cursor-pointer transition-colors"
                          >
                            Remove
                          </button>
                        </>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}

            {adminTab === 'reservations' && (
              <div className="flex flex-col gap-2.5 max-h-80 overflow-y-auto pr-1">
                {managedBookings.map((bk) => (
                  <div
                    key={bk.id}
                    className="bg-[#f8f3e8] rounded-2xl p-3.5 flex items-center justify-between gap-3"
                  >
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-[#1d1c15] truncate tabular-nums">
                        {bk.date}, {String(bk.startHour).padStart(2, '0')}:00 · {bk.equipmentName}
                      </p>
                      <p className="text-xs text-[#3f4945] truncate">
                        {bk.userName} · {bk.projectTitle}
                      </p>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <span className="px-3 py-1 rounded-full bg-[#b0e4fd] text-[#32677c] text-xs font-semibold">
                        {formatBookingStatus(bk.status)}
                      </span>
                      {isAdmin && bk.status !== 'cancelled' && bk.status !== 'rejected' && (
                        <button
                          type="button"
                          onClick={async () => {
                            clearBanners();
                            try {
                              const res = await api.cancelBooking(bk.id);
                              onBookingUpdated(res.booking);
                            } catch (err) {
                              setActionError(
                                err instanceof Error ? err.message : 'Unable to cancel booking.',
                              );
                            }
                          }}
                          className="px-2.5 py-1 rounded-full bg-[#ffd9e0] text-[#673946] text-[11px] font-semibold cursor-pointer"
                        >
                          Cancel
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}

            {adminTab === 'maintenance' && (
              <div className="flex flex-col gap-2.5 max-h-80 overflow-y-auto pr-1">
                {maintenance.map((log) => (
                  <div
                    key={log.id}
                    className="bg-[#f8f3e8] rounded-2xl p-3.5 flex items-center justify-between gap-3"
                  >
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-[#1d1c15] truncate">
                        {log.equipmentName} · {log.taskTitle}
                      </p>
                      <p className="text-xs text-[#3f4945] truncate">
                        Tech: {log.technician} · {log.notes}
                      </p>
                    </div>
                    <span
                      className={`px-3 py-1 rounded-full text-xs font-semibold shrink-0 ${
                        log.status === 'cleared'
                          ? 'bg-[#a8e8d5] text-[#2b6a5b]'
                          : 'bg-[#ffcfd9] text-[#84515e]'
                      }`}
                    >
                      {log.status.replace('_', ' ')}
                    </span>
                  </div>
                ))}
              </div>
            )}

            {adminTab === 'users' && isAdmin && (
              <div className="flex flex-col gap-4 max-h-96 overflow-y-auto pr-1">
                {pendingFacultyRequests.length > 0 && (
                  <div className="rounded-2xl bg-[#f8de91]/35 p-4 flex flex-col gap-3">
                    <div>
                      <span className="text-[11px] font-semibold uppercase tracking-wider text-[#4a3800]">
                        Pending Faculty Role Requests ({pendingFacultyRequests.length})
                      </span>
                      <p className="text-xs text-[#3f4945]">
                        Assign laboratories and approve or decline faculty privileges.
                      </p>
                    </div>
                    {pendingFacultyRequests.map((reqUser) => {
                      const chosenLabs = facultyLabSelection[reqUser.id] || [];
                      return (
                        <div
                          key={reqUser.id}
                          className="bg-[#ffffff] rounded-2xl p-3.5 flex flex-col gap-2.5 shadow-sm"
                        >
                          <div className="flex items-center justify-between gap-2">
                            <div className="min-w-0">
                              <p className="text-sm font-bold text-[#1d1c15] truncate">
                                {reqUser.name}
                              </p>
                              <p className="text-xs text-[#3f4945] truncate">
                                {reqUser.email} · {reqUser.department}
                              </p>
                            </div>
                            <div className="flex items-center gap-1.5 shrink-0">
                              <button
                                type="button"
                                disabled={loadingFacultyReqId === reqUser.id}
                                onClick={() => handleFacultyApproval(reqUser.id, 'approved')}
                                className="px-3 py-1 rounded-full bg-[#a8e8d5] text-[#2b6a5b] text-xs font-semibold cursor-pointer"
                              >
                                Approve Faculty
                              </button>
                              <button
                                type="button"
                                disabled={loadingFacultyReqId === reqUser.id}
                                onClick={() => handleFacultyApproval(reqUser.id, 'rejected')}
                                className="px-3 py-1 rounded-full bg-[#ffd9e0] text-[#673946] text-xs font-semibold cursor-pointer"
                              >
                                Decline
                              </button>
                            </div>
                          </div>
                          <div className="flex flex-wrap gap-1.5">
                            {laboratories.map((lab) => {
                              const checked = chosenLabs.includes(lab.id);
                              return (
                                <label
                                  key={lab.id}
                                  className={`px-2.5 py-1 rounded-full text-[11px] font-semibold cursor-pointer transition-colors ${
                                    checked
                                      ? 'bg-[#29695a] text-[#ffffff]'
                                      : 'bg-[#f8f3e8] text-[#3f4945]'
                                  }`}
                                >
                                  <input
                                    type="checkbox"
                                    className="sr-only"
                                    checked={checked}
                                    onChange={() => {
                                      setFacultyLabSelection((prev) => {
                                        const cur = prev[reqUser.id] || [];
                                        return {
                                          ...prev,
                                          [reqUser.id]: cur.includes(lab.id)
                                            ? cur.filter((id) => id !== lab.id)
                                            : [...cur, lab.id],
                                        };
                                      });
                                    }}
                                  />
                                  {lab.name}
                                </label>
                              );
                            })}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}

                <div className="flex flex-col gap-2.5">
                  {users.map((u) => (
                    <div
                      key={u.id}
                      className="bg-[#f8f3e8] rounded-2xl p-3.5 flex items-center justify-between gap-3"
                    >
                      <div className="min-w-0">
                        <p className="text-sm font-semibold text-[#1d1c15] truncate">{u.name}</p>
                        <p className="text-xs text-[#3f4945] truncate">
                          {u.email} · {u.department}
                        </p>
                      </div>
                      <select
                        aria-label={`Role for ${u.name}`}
                        value={u.role}
                        onChange={async (e) => {
                          clearBanners();
                          try {
                            const updated = await api.updateUserRole(
                              u.id,
                              e.target.value as UserRole,
                            );
                            onUserRoleUpdated(updated.user);
                            setActionSuccess(`Updated ${u.name}'s role to ${updated.user.role}.`);
                          } catch (err) {
                            setActionError(
                              err instanceof Error ? err.message : 'Role update failed.',
                            );
                          }
                        }}
                        className="rounded-full bg-[#ffffff] px-3 py-1 text-xs font-semibold text-[#1d1c15] cursor-pointer"
                      >
                        <option value="student">Student</option>
                        <option value="faculty">Faculty</option>
                        <option value="admin">Admin</option>
                      </select>
                    </div>
                  ))}
                </div>

                {/* Authorized Admin Allowlist */}
                <div className="border-t border-[#e7e2d7] pt-4 flex flex-col gap-3">
                  <div>
                    <span className="text-[11px] font-semibold uppercase tracking-wider text-[#29695a]">
                      Authorized Admin List
                    </span>
                    <p className="text-xs text-[#3f4945]">
                      Only emails in this database list can hold admin access.
                    </p>
                  </div>

                  <div className="flex flex-col gap-2">
                    {authorizedAdmins.map((entry) => (
                      <div
                        key={entry.email}
                        className="bg-[#a8e8d5]/30 rounded-2xl px-3.5 py-2.5 flex items-center justify-between gap-2 text-xs"
                      >
                        <div className="min-w-0">
                          <span className="font-bold text-[#1d1c15] block truncate">
                            {entry.name} ({entry.email})
                          </span>
                          <span className="text-[11px] text-[#3f4945]">
                            Added by {entry.grantedBy}
                          </span>
                        </div>
                        {entry.email.toLowerCase() !== user?.email.toLowerCase() && (
                          <button
                            type="button"
                            onClick={() => handleRevokeAdmin(entry.email)}
                            className="px-2.5 py-1 rounded-full bg-[#ffd9e0] text-[#673946] font-semibold cursor-pointer shrink-0"
                          >
                            Remove
                          </button>
                        )}
                      </div>
                    ))}
                  </div>

                  <form onSubmit={handleGrantAdmin} className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                    <input
                      required
                      placeholder="Full name"
                      value={newAdminName}
                      onChange={(e) => setNewAdminName(e.target.value)}
                      className="rounded-full bg-[#f8f3e8] px-3.5 py-2 text-xs clay-well"
                    />
                    <input
                      type="email"
                      required
                      placeholder="admin2@lablink.edu"
                      value={newAdminEmail}
                      onChange={(e) => setNewAdminEmail(e.target.value)}
                      className="rounded-full bg-[#f8f3e8] px-3.5 py-2 text-xs clay-well"
                    />
                    <TactileButton type="submit" variant="secondary" className="py-2 text-xs">
                      Grant Admin
                    </TactileButton>
                  </form>
                </div>
              </div>
            )}
          </div>
        </div>
      </section>

      {/* Suggest New Time Modal (Booking) */}
      <ClayModal
        open={Boolean(altTargetBooking)}
        onClose={() => setAltTargetBooking(null)}
        maxWidthClass="max-w-md"
        ariaLabel="Suggest a New Time"
      >
        {altTargetBooking && (
          <div className="flex flex-col gap-4">
            <h3 className="text-xl font-bold text-[#1d1c15]">Suggest a New Time</h3>
            <p className="text-xs text-[#3f4945]">
              Pick another open time for {altTargetBooking.userName} on{' '}
              {altTargetBooking.equipmentName}.
            </p>
            <div>
              <label className="text-xs font-semibold text-[#3f4945] block mb-1">
                New Start Time ({altTargetBooking.date})
              </label>
              <select
                value={altHour}
                onChange={(e) => setAltHour(Number(e.target.value))}
                className="w-full rounded-full bg-[#f8f3e8] px-4 py-2.5 text-sm clay-well"
              >
                {[9, 10, 12, 14, 16, 17].map((h) => (
                  <option key={h} value={h}>
                    {String(h).padStart(2, '0')}:00 –{' '}
                    {String(h + altTargetBooking.durationHours).padStart(2, '0')}:00
                  </option>
                ))}
              </select>
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <TactileButton
                variant="ghost"
                onClick={() => setAltTargetBooking(null)}
                className="px-4 py-2 text-xs"
              >
                Cancel
              </TactileButton>
              <TactileButton
                variant="primary"
                onClick={() =>
                  handleDecision(altTargetBooking.id, 'alternative_suggested', {
                    date: altTargetBooking.date,
                    startHour: altHour,
                    durationHours: altTargetBooking.durationHours,
                    equipmentId: altTargetBooking.equipmentId,
                    equipmentName: altTargetBooking.equipmentName,
                    reason: 'Faculty suggested another open time.',
                  })
                }
                className="px-5 py-2 text-xs"
              >
                Send Suggestion
              </TactileButton>
            </div>
          </div>
        )}
      </ClayModal>

      {/* Suggest Alternative Modal (Project Access Request) */}
      <ClayModal
        open={Boolean(altTargetAccessReq)}
        onClose={() => setAltTargetAccessReq(null)}
        maxWidthClass="max-w-md"
        ariaLabel="Suggest Alternative Access Window"
      >
        {altTargetAccessReq && (
          <div className="flex flex-col gap-4">
            <h3 className="text-xl font-bold text-[#1d1c15]">Suggest Alternative Window</h3>
            <p className="text-xs text-[#3f4945]">
              Recommend an open time slot for {altTargetAccessReq.userName}&apos;s request on{' '}
              {altTargetAccessReq.equipmentName}.
            </p>
            <div>
              <label className="text-xs font-semibold text-[#3f4945] block mb-1">
                Start Hour ({altTargetAccessReq.preferredDate})
              </label>
              <select
                value={altHour}
                onChange={(e) => setAltHour(Number(e.target.value))}
                className="w-full rounded-full bg-[#f8f3e8] px-4 py-2.5 text-sm clay-well"
              >
                {[9, 11, 14, 16].map((h) => (
                  <option key={h} value={h}>
                    {String(h).padStart(2, '0')}:00 –{' '}
                    {String(h + Math.min(4, altTargetAccessReq.requestedHours)).padStart(2, '0')}:00
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-xs font-semibold text-[#3f4945] block mb-1">
                Faculty Reviewer Note
              </label>
              <input
                value={altAccessNotes}
                onChange={(e) => setAltAccessNotes(e.target.value)}
                placeholder="Reason or prep instructions..."
                className="w-full rounded-full bg-[#f8f3e8] px-4 py-2.5 text-sm clay-well"
              />
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <TactileButton
                variant="ghost"
                onClick={() => setAltTargetAccessReq(null)}
                className="px-4 py-2 text-xs"
              >
                Cancel
              </TactileButton>
              <TactileButton
                variant="primary"
                onClick={() =>
                  handleAccessRequestDecision(
                    altTargetAccessReq.id,
                    'alternative_suggested',
                    altAccessNotes || 'Faculty suggested another open window.',
                    {
                      date: altTargetAccessReq.preferredDate,
                      startHour: altHour,
                      durationHours: Math.min(4, altTargetAccessReq.requestedHours),
                      equipmentId: altTargetAccessReq.equipmentId,
                      equipmentName: altTargetAccessReq.equipmentName,
                      reason: altAccessNotes || 'Recommended alternative lab window.',
                    },
                  )
                }
                className="px-5 py-2 text-xs"
              >
                Send Suggestion
              </TactileButton>
            </div>
          </div>
        )}
      </ClayModal>

      {/* Add Equipment Modal (Admin Only) */}
      <ClayModal
        open={showAddEq}
        onClose={() => setShowAddEq(false)}
        maxWidthClass="max-w-md"
        ariaLabel="Add Equipment"
      >
        <form onSubmit={handleCreateEquipment} className="flex flex-col gap-3.5">
          <h3 className="text-xl font-bold text-[#1d1c15]">Add Lab Equipment</h3>
          <input
            required
            placeholder="Equipment Name (e.g., Prusa MK4 3D Printer)"
            value={newEqName}
            onChange={(e) => setNewEqName(e.target.value)}
            className="w-full rounded-full bg-[#f8f3e8] px-4 py-2.5 text-sm clay-well"
          />
          <div className="grid grid-cols-2 gap-2">
            <select
              value={newEqCat}
              onChange={(e) => setNewEqCat(e.target.value as EquipmentCategory)}
              className="rounded-full bg-[#f8f3e8] px-3 py-2 text-xs clay-well"
            >
              {EQUIPMENT_CATEGORIES.map((cat) => (
                <option key={cat} value={cat}>
                  {cat}
                </option>
              ))}
            </select>
            <input
              type="number"
              min={5}
              value={newEqRate}
              onChange={(e) => setNewEqRate(Number(e.target.value))}
              placeholder="Rate $/hr"
              className="rounded-full bg-[#f8f3e8] px-3 py-2 text-xs clay-well"
            />
          </div>
          <select
            value={newEqDept}
            onChange={(e) => setNewEqDept(e.target.value)}
            className="rounded-full bg-[#f8f3e8] px-4 py-2.5 text-xs clay-well"
          >
            {departments.map((d) => (
              <option key={d.id} value={d.id}>
                {d.name}
              </option>
            ))}
          </select>
          <select
            value={newEqLab}
            onChange={(e) => setNewEqLab(e.target.value)}
            className="rounded-full bg-[#f8f3e8] px-4 py-2.5 text-xs clay-well"
          >
            {laboratories.map((l) => (
              <option key={l.id} value={l.id}>
                {l.name} ({l.room})
              </option>
            ))}
          </select>
          <input
            placeholder="Key Specs (e.g., 250×210 mm · PLA/PETG)"
            value={newEqSpecs}
            onChange={(e) => setNewEqSpecs(e.target.value)}
            className="w-full rounded-full bg-[#f8f3e8] px-4 py-2.5 text-sm clay-well"
          />
          <TactileButton type="submit" variant="primary" className="py-2.5 text-sm mt-1">
            Save Equipment
          </TactileButton>
        </form>
      </ClayModal>

      {/* Edit Equipment Modal (Admin Only) */}
      <ClayModal
        open={Boolean(editTargetEq)}
        onClose={() => setEditTargetEq(null)}
        maxWidthClass="max-w-md"
        ariaLabel="Edit Equipment"
      >
        <form onSubmit={handleSaveEquipmentEdit} className="flex flex-col gap-3.5">
          <h3 className="text-xl font-bold text-[#1d1c15]">Edit Equipment</h3>
          <input
            required
            value={editEqName}
            onChange={(e) => setEditEqName(e.target.value)}
            className="w-full rounded-full bg-[#f8f3e8] px-4 py-2.5 text-sm clay-well"
          />
          <div className="grid grid-cols-2 gap-2">
            <select
              value={editEqCat}
              onChange={(e) => setEditEqCat(e.target.value as EquipmentCategory)}
              className="rounded-full bg-[#f8f3e8] px-3 py-2 text-xs clay-well"
            >
              {EQUIPMENT_CATEGORIES.map((cat) => (
                <option key={cat} value={cat}>
                  {cat}
                </option>
              ))}
            </select>
            <input
              type="number"
              min={5}
              value={editEqRate}
              onChange={(e) => setEditEqRate(Number(e.target.value))}
              className="rounded-full bg-[#f8f3e8] px-3 py-2 text-xs clay-well"
            />
          </div>
          <select
            value={editEqDept}
            onChange={(e) => setEditEqDept(e.target.value)}
            className="rounded-full bg-[#f8f3e8] px-4 py-2.5 text-xs clay-well"
          >
            {departments.map((d) => (
              <option key={d.id} value={d.id}>
                {d.name}
              </option>
            ))}
          </select>
          <select
            value={editEqLab}
            onChange={(e) => setEditEqLab(e.target.value)}
            className="rounded-full bg-[#f8f3e8] px-4 py-2.5 text-xs clay-well"
          >
            {laboratories.map((l) => (
              <option key={l.id} value={l.id}>
                {l.name} ({l.room})
              </option>
            ))}
          </select>
          <input
            value={editEqSpecs}
            onChange={(e) => setEditEqSpecs(e.target.value)}
            className="w-full rounded-full bg-[#f8f3e8] px-4 py-2.5 text-sm clay-well"
          />
          <div className="flex justify-end gap-2 pt-1">
            <TactileButton
              type="button"
              variant="ghost"
              onClick={() => setEditTargetEq(null)}
              className="px-4 py-2 text-xs"
            >
              Cancel
            </TactileButton>
            <TactileButton type="submit" variant="primary" className="px-5 py-2 text-xs">
              Save Changes
            </TactileButton>
          </div>
        </form>
      </ClayModal>

      {/* Add Department Modal */}
      <ClayModal
        open={showAddDept}
        onClose={() => setShowAddDept(false)}
        maxWidthClass="max-w-md"
        ariaLabel="Add Department"
      >
        <form onSubmit={handleCreateDepartment} className="flex flex-col gap-3.5">
          <h3 className="text-xl font-bold text-[#1d1c15]">Add Department</h3>
          <input
            required
            placeholder="Department Name"
            value={deptName}
            onChange={(e) => setDeptName(e.target.value)}
            className="w-full rounded-full bg-[#f8f3e8] px-4 py-2.5 text-sm clay-well"
          />
          <input
            required
            placeholder="Code (e.g., AERO)"
            value={deptCode}
            onChange={(e) => setDeptCode(e.target.value)}
            className="w-full rounded-full bg-[#f8f3e8] px-4 py-2.5 text-sm clay-well"
          />
          <input
            required
            placeholder="Department Head"
            value={deptHead}
            onChange={(e) => setDeptHead(e.target.value)}
            className="w-full rounded-full bg-[#f8f3e8] px-4 py-2.5 text-sm clay-well"
          />
          <TactileButton type="submit" variant="primary" className="py-2.5 text-sm">
            Add Department
          </TactileButton>
        </form>
      </ClayModal>

      {/* Add Lab Modal */}
      <ClayModal
        open={showAddLab}
        onClose={() => setShowAddLab(false)}
        maxWidthClass="max-w-md"
        ariaLabel="Add Lab"
      >
        <form onSubmit={handleCreateLab} className="flex flex-col gap-3.5">
          <h3 className="text-xl font-bold text-[#1d1c15]">Add Lab</h3>
          <input
            required
            placeholder="Lab Name"
            value={labName}
            onChange={(e) => setLabName(e.target.value)}
            className="w-full rounded-full bg-[#f8f3e8] px-4 py-2.5 text-sm clay-well"
          />
          <select
            value={labDept}
            onChange={(e) => setLabDept(e.target.value)}
            className="rounded-full bg-[#f8f3e8] px-4 py-2.5 text-sm clay-well"
          >
            {departments.map((d) => (
              <option key={d.id} value={d.id}>
                {d.name}
              </option>
            ))}
          </select>
          <div className="grid grid-cols-2 gap-2">
            <input
              required
              placeholder="Building"
              value={labBuilding}
              onChange={(e) => setLabBuilding(e.target.value)}
              className="rounded-full bg-[#f8f3e8] px-4 py-2.5 text-sm clay-well"
            />
            <input
              required
              placeholder="Room"
              value={labRoom}
              onChange={(e) => setLabRoom(e.target.value)}
              className="rounded-full bg-[#f8f3e8] px-4 py-2.5 text-sm clay-well"
            />
          </div>
          <TactileButton type="submit" variant="primary" className="py-2.5 text-sm">
            Add Lab
          </TactileButton>
        </form>
      </ClayModal>

      {/* Log Maintenance Modal */}
      <ClayModal
        open={showAddMaint}
        onClose={() => setShowAddMaint(false)}
        maxWidthClass="max-w-md"
        ariaLabel="Log Service"
      >
        <form onSubmit={handleCreateMaint} className="flex flex-col gap-3.5">
          <h3 className="text-xl font-bold text-[#1d1c15]">Schedule Equipment Service</h3>
          <select
            value={maintEqId || managedEquipment[0]?.id || equipment[0]?.id}
            onChange={(e) => setMaintEqId(e.target.value)}
            className="rounded-full bg-[#f8f3e8] px-4 py-2.5 text-sm clay-well"
          >
            {managedEquipment.map((eq) => (
              <option key={eq.id} value={eq.id}>
                {eq.name}
              </option>
            ))}
          </select>
          <input
            required
            placeholder="Service Task (e.g., Calibration Check)"
            value={maintTask}
            onChange={(e) => setMaintTask(e.target.value)}
            className="rounded-full bg-[#f8f3e8] px-4 py-2.5 text-sm clay-well"
          />
          <input
            required
            placeholder="Technician"
            value={maintTech}
            onChange={(e) => setMaintTech(e.target.value)}
            className="rounded-full bg-[#f8f3e8] px-4 py-2.5 text-sm clay-well"
          />
          <TactileButton type="submit" variant="secondary" className="py-2.5 text-sm">
            Save Service Log
          </TactileButton>
        </form>
      </ClayModal>

      {/* Add Faculty Account Modal (Admin Only) */}
      <ClayModal
        open={showAddFaculty}
        onClose={() => setShowAddFaculty(false)}
        maxWidthClass="max-w-md"
        ariaLabel="Add Faculty Account"
      >
        <form onSubmit={handleCreateFaculty} className="flex flex-col gap-3.5">
          <h3 className="text-xl font-bold text-[#1d1c15]">Add Faculty Account</h3>
          <input
            required
            placeholder="Full Name (e.g., Dr. Priya Nair)"
            value={facultyName}
            onChange={(e) => setFacultyName(e.target.value)}
            className="w-full rounded-full bg-[#f8f3e8] px-4 py-2.5 text-sm clay-well"
          />
          <input
            type="email"
            required
            placeholder="Faculty Email"
            value={facultyEmail}
            onChange={(e) => setFacultyEmail(e.target.value)}
            className="w-full rounded-full bg-[#f8f3e8] px-4 py-2.5 text-sm clay-well"
          />
          <input
            required
            placeholder="Department"
            value={facultyDept}
            onChange={(e) => setFacultyDept(e.target.value)}
            className="w-full rounded-full bg-[#f8f3e8] px-4 py-2.5 text-sm clay-well"
          />
          <input
            type="password"
            required
            minLength={6}
            placeholder="Temporary Password (min 6 chars)"
            value={facultyPassword}
            onChange={(e) => setFacultyPassword(e.target.value)}
            className="w-full rounded-full bg-[#f8f3e8] px-4 py-2.5 text-sm clay-well"
          />
          <TactileButton type="submit" variant="primary" className="py-2.5 text-sm">
            Create Faculty Account
          </TactileButton>
        </form>
      </ClayModal>
    </div>
  );
};
