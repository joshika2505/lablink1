import { GoogleGenAI, Type, ThinkingLevel } from '@google/genai';
import type {
  Booking,
  Equipment,
  FairSlotConflictCase,
  Laboratory,
  ResearchProject,
  UtilizationAnalytics,
} from '../src/types/lablink.js';

export class GeminiConfigError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'GeminiConfigError';
  }
}

function getGeminiClient(): GoogleGenAI {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey || apiKey === 'MY_GEMINI_API_KEY') {
    throw new GeminiConfigError(
      'LabBot AI is waiting for a Gemini API key. Add GEMINI_API_KEY in Settings -> Secrets to enable live responses.',
    );
  }
  return new GoogleGenAI({
    apiKey,
    httpOptions: {
      headers: {
        'User-Agent': 'aistudio-build',
      },
    },
  });
}

const DEFAULT_MODEL = 'gemini-4-hydrogen';

export async function discoverEquipmentWithAI(query: string, catalog: Equipment[]) {
  const ai = getGeminiClient();
  const compactCatalog = catalog.map((item) => ({
    id: item.id,
    name: item.name,
    category: item.category,
    department: item.departmentName,
    location: item.locationLabel,
    status: item.status,
    nextSlot: item.nextSlotLabel,
    shortPurpose: item.shortPurpose,
    specsPreview: item.specsPreview,
    certificationRequired: item.certificationRequired,
  }));

  const response = await ai.models.generateContent({
    model: DEFAULT_MODEL,
    contents: `Student/faculty search request: "${query}"\n\nCampus equipment catalog (sample lab data):\n${JSON.stringify(compactCatalog)}`,
    config: {
      systemInstruction:
        'You are LabLink Smart Match, helping students find the right laboratory equipment in simple, clear language. Match the request to the most relevant equipment IDs in the catalog. Never invent IDs or availability.',
      thinkingConfig: { thinkingLevel: ThinkingLevel.LOW },
      responseMimeType: 'application/json',
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          summary: {
            type: Type.STRING,
            description: 'One friendly sentence explaining the best equipment matches.',
          },
          matches: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                equipmentId: { type: Type.STRING },
                matchScore: { type: Type.INTEGER },
                reason: { type: Type.STRING },
                recommendedSlotHint: { type: Type.STRING },
              },
              required: ['equipmentId', 'matchScore', 'reason', 'recommendedSlotHint'],
            },
          },
        },
        required: ['summary', 'matches'],
      },
    },
  });

  const text = (response.text ?? '{}').trim();
  return JSON.parse(text) as {
    summary: string;
    matches: Array<{
      equipmentId: string;
      matchScore: number;
      reason: string;
      recommendedSlotHint: string;
    }>;
  };
}

export async function analyzeProjectWithAI(
  project: { title: string; department: string; description: string; deadline: string },
  catalog: Equipment[],
) {
  const ai = getGeminiClient();
  const compactCatalog = catalog.map((item) => ({
    id: item.id,
    name: item.name,
    category: item.category,
    shortPurpose: item.shortPurpose,
    specsPreview: item.specsPreview,
    certificationRequired: item.certificationRequired,
  }));

  const response = await ai.models.generateContent({
    model: DEFAULT_MODEL,
    contents: `Project:\nTitle: ${project.title}\nDepartment: ${project.department}\nDeadline: ${project.deadline}\nDescription: ${project.description}\n\nCampus Equipment Catalog:\n${JSON.stringify(compactCatalog)}`,
    config: {
      systemInstruction:
        'Analyze the project in plain, student-friendly language and recommend up to 3 tools from the catalog, required safety training, and weekly hours needed. Only use equipment IDs present in the catalog.',
      thinkingConfig: { thinkingLevel: ThinkingLevel.LOW },
      responseMimeType: 'application/json',
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          analysisSummary: { type: Type.STRING },
          recommendedEquipmentIds: {
            type: Type.ARRAY,
            items: { type: Type.STRING },
          },
          safetyPrerequisites: {
            type: Type.ARRAY,
            items: { type: Type.STRING },
          },
          estimatedHoursPerWeek: { type: Type.NUMBER },
        },
        required: [
          'analysisSummary',
          'recommendedEquipmentIds',
          'safetyPrerequisites',
          'estimatedHoursPerWeek',
        ],
      },
    },
  });

  const text = (response.text ?? '{}').trim();
  return JSON.parse(text) as {
    analysisSummary: string;
    recommendedEquipmentIds: string[];
    safetyPrerequisites: string[];
    estimatedHoursPerWeek: number;
  };
}

export async function evaluateFairSlotWithAI(conflict: FairSlotConflictCase) {
  const ai = getGeminiClient();
  const deterministicWinner =
    conflict.candidates.find((c) => c.recommended) || conflict.candidates[0];
  const validCandidateIds = new Set(conflict.candidates.map((c) => c.studentId));
  const validAltIds = new Set(conflict.alternatives.map((a) => a.id));
  const defaultAltId = conflict.selectedAlternativeId || conflict.alternatives[0]?.id || '';

  const response = await ai.models.generateContent({
    model: DEFAULT_MODEL,
    contents: `Explain this deterministic Smart Booking arbitration in clear, student-friendly language:\n${JSON.stringify({
      equipment: conflict.equipmentName,
      bay: conflict.bayLabel,
      date: conflict.date,
      window: `${conflict.conflictStartHour}:00 - ${conflict.conflictEndHour}:00`,
      deterministicFairnessScore: conflict.fairnessScore,
      deterministicWinnerStudentId: deterministicWinner?.studentId,
      candidates: conflict.candidates,
      verifiedOpenAlternatives: conflict.alternatives,
    })}`,
    config: {
      systemInstruction:
        'You are Smart Booking Advisor on LabLink. The deterministic allocation engine has already ranked candidates by deadline urgency, weekly fairness, safety certification match, schedule fit, and project fit (and verified conflict-free alternatives). Explain that decision in plain, friendly terms without altering the winner or inventing slots, and note that Faculty make the final approval decision.',
      thinkingConfig: { thinkingLevel: ThinkingLevel.LOW },
      responseMimeType: 'application/json',
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          headlineRecommendation: { type: Type.STRING },
          explanation: { type: Type.STRING },
          recommendedPrimaryStudentId: { type: Type.STRING },
          recommendedAlternativeId: { type: Type.STRING },
          factors: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                title: { type: Type.STRING },
                detail: { type: Type.STRING },
              },
              required: ['title', 'detail'],
            },
          },
        },
        required: [
          'headlineRecommendation',
          'explanation',
          'recommendedPrimaryStudentId',
          'recommendedAlternativeId',
          'factors',
        ],
      },
    },
  });

  const text = (response.text ?? '{}').trim();
  const parsed = JSON.parse(text) as {
    headlineRecommendation: string;
    explanation: string;
    recommendedPrimaryStudentId: string;
    recommendedAlternativeId: string;
    factors: Array<{ title: string; detail: string }>;
  };

  return {
    fairnessScore: conflict.fairnessScore,
    headlineRecommendation: parsed.headlineRecommendation || conflict.headlineRecommendation,
    explanation: parsed.explanation || conflict.explanation,
    recommendedPrimaryStudentId:
      deterministicWinner?.studentId ||
      (validCandidateIds.has(parsed.recommendedPrimaryStudentId)
        ? parsed.recommendedPrimaryStudentId
        : conflict.candidates[0]?.studentId || ''),
    recommendedAlternativeId: validAltIds.has(parsed.recommendedAlternativeId)
      ? parsed.recommendedAlternativeId
      : defaultAltId,
    factors:
      Array.isArray(parsed.factors) && parsed.factors.length > 0
        ? parsed.factors
        : conflict.factors.map((f) => ({ title: f.title, detail: f.detail })),
  };
}

export interface LabBotContext {
  userName: string;
  userRole: 'guest' | 'student' | 'faculty' | 'admin';
  department: string;
  certifications: string[];
  laboratories: Laboratory[];
  scopedBookings: Booking[];
  scopedProjects: ResearchProject[];
  pendingApprovalsCount?: number;
  openConflictsCount?: number;
  analytics?: UtilizationAnalytics | null;
}

export async function askLabAssistantWithAI(
  prompt: string,
  catalog: Equipment[],
  context: LabBotContext,
  history: Array<{ role: 'user' | 'assistant'; text: string }> = [],
) {
  const ai = getGeminiClient();

  const compactCatalog = catalog.map((item) => ({
    id: item.id,
    name: item.name,
    category: item.category,
    location: item.locationLabel,
    status: item.status,
    nextSlot: item.nextSlotLabel,
    requiresFacultyApproval: item.requiresFacultyApproval,
    certificationRequired: item.certificationRequired,
    shortPurpose: item.shortPurpose,
    guidelines: item.guidelines.map((g) => `${g.title}: ${g.detail}`),
  }));

  const compactLabs = context.laboratories.map((l) => ({
    name: l.name,
    building: l.building,
    room: l.room,
    status: l.status,
    occupied: `${l.occupied}/${l.capacity}`,
    accessLevel: l.accessLevel,
  }));

  const compactBookings = context.scopedBookings.slice(0, 12).map((b) => ({
    equipment: b.equipmentName,
    date: b.date,
    time: `${String(b.startHour).padStart(2, '0')}:00-${String(b.startHour + b.durationHours).padStart(2, '0')}:00`,
    status: b.status,
    requester: context.userRole === 'faculty' || context.userRole === 'admin' ? b.userName : 'You',
    project: b.projectTitle,
  }));

  const compactProjects = context.scopedProjects.slice(0, 6).map((p) => ({
    title: p.title,
    category: p.category,
    deadline: p.deadline,
    progress: `${p.progress}%`,
  }));

  const recentConversation = history
    .slice(-6)
    .map((m) => `${m.role === 'user' ? 'User' : 'LabBot'}: ${m.text}`)
    .join('\n');

  const roleScopePayload = {
    signedInAs: `${context.userName} (role: ${context.userRole})`,
    department: context.department,
    certifications: context.certifications,
    note: 'Equipment availability and locations below are Sample Lab Data.',
    bookingsVisibleToThisUser: compactBookings,
    projectsVisibleToThisUser: compactProjects,
    ...(context.userRole === 'faculty' || context.userRole === 'admin'
      ? {
          pendingApprovalRequestsCount: context.pendingApprovalsCount ?? 0,
          openBookingConflictsCount: context.openConflictsCount ?? 0,
        }
      : {}),
    ...(context.userRole === 'admin' && context.analytics
      ? {
          platformAnalytics: {
            peakCapacityPercent: context.analytics.peakCapacityPercent,
            onlineTools: `${context.analytics.onlineInstruments}/${context.analytics.totalInstruments}`,
            uptimePercent: `${context.analytics.uptimePercent}%`,
          },
        }
      : {}),
  };

  const response = await ai.models.generateContent({
    model: DEFAULT_MODEL,
    contents: `${recentConversation ? `Recent chat:\n${recentConversation}\n\n` : ''}Current user question: ${prompt}\n\nUser Role & Allowed Data:\n${JSON.stringify(roleScopePayload)}\n\nCampus Laboratories:\n${JSON.stringify(compactLabs)}\n\nCampus Equipment Catalog:\n${JSON.stringify(compactCatalog)}`,
    config: {
      systemInstruction:
        'You are LabBot, the friendly AI helper for LabLink (a campus lab equipment sharing platform). Use simple, clear, short sentences that students understand right away. Only answer using the equipment catalog, lab list, and role-scoped bookings/projects provided. Respect role boundaries: never invent availability, never promise admin actions to non-admins, and remind users that sample availability is shown. Include matching equipment IDs in suggestedEquipmentIds whenever relevant, and optionally set suggestedRoute to one of: discover, my-reservations, projects, approvals, admin-console, lab-map, ai-assistant.',
      thinkingConfig: { thinkingLevel: ThinkingLevel.LOW },
      responseMimeType: 'application/json',
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          answer: { type: Type.STRING },
          suggestedEquipmentIds: {
            type: Type.ARRAY,
            items: { type: Type.STRING },
          },
          safetyNote: { type: Type.STRING },
          suggestedRoute: { type: Type.STRING },
        },
        required: ['answer', 'suggestedEquipmentIds', 'safetyNote'],
      },
    },
  });

  const text = (response.text ?? '{}').trim();
  const parsed = JSON.parse(text) as {
    answer: string;
    suggestedEquipmentIds: string[];
    safetyNote: string;
    suggestedRoute?: string;
  };
  const validIds = new Set(catalog.map((c) => c.id));
  parsed.suggestedEquipmentIds = (parsed.suggestedEquipmentIds || []).filter((id) =>
    validIds.has(id),
  );
  return parsed;
}
