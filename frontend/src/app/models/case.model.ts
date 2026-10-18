export interface CivicCase {
  id: string;
  citizenId: string;
  citizenName: string;
  title: string;
  rawDescription: string;
  normalizedDescription?: string;
  conciseSummary?: string;
  category: string;
  subcategory?: string;
  language?: string;
  audioUrl?: string;
  originalTranscript?: string;
  editedTranscript?: string;
  photoUrl?: string;
  locationAddress?: string;
  latitude?: number;
  longitude?: number;
  locationContext?: string;
  priority: string;
  suggestedPriority: string;
  priorityRationale?: string;
  priorityRulesTriggered?: string;
  isPriorityOverridden: boolean;
  priorityOverriddenBy?: string;
  priorityOverriddenAt?: string;
  status: string;
  rejectionReason?: string;
  assignedTeamId?: string;
  assignedTeamName?: string;
  targetResponseHours?: number;
  targetResponseDate?: string;
  isDuplicate: boolean;
  primaryCaseId?: string;
  duplicateConfidence?: number;
  duplicateExplanation?: string;
  duplicateReviewStatus: string;
  resolutionPhotoUrl?: string;
  resolutionDescription?: string;
  resolutionDate?: string;
  resolutionReviewerName?: string;
  verificationAssessment?: string;
  hasCitizenReviewRequest: boolean;
  citizenReviewReason?: string;
  citizenReviewRequestedAt?: string;
  safetyConcerns?: string;
  missingInformation?: string;
  recommendedNextStep?: string;
  aiProcessingStatus: string;
  aiConfidence?: number;
  aiModelUsed?: string;
  aiProcessedAt?: string;
  aiError?: string;
  isPhotoUnclear?: boolean;
  photoQualityIssue?: string;
  isAudioUnclear?: boolean;
  audioQualityIssue?: string;
  isNonCivicIssue?: boolean;
  nonCivicReason?: string;
  hasEmergencySafetyTrigger?: boolean;
  emergencyType?: string;
  emergencyHelplinesJson?: string;
  isDemo: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface EmergencyHelpline {
  name: string;
  number: string;
  description: string;
}

export interface TranscriptionResponse {
  transcript: string;
  detectedLanguage: string;
  confidence: number;
  provider: string;
  isAudioUnclear?: boolean;
  audioQualityIssue?: string;
  isCategoryAmbiguous?: boolean;
  suggestedCategory?: string;
  hasEmergencyTrigger?: boolean;
  emergencyType?: string;
  emergencyHelplines?: EmergencyHelpline[];
}

export interface ServiceTeam {
  id: string;
  name: string;
  code: string;
  description: string;
  categorySpecialty: string;
  targetHoursP1: number;
  targetHoursP2: number;
  targetHoursP3: number;
  targetHoursP4: number;
  isActive: boolean;
}

export interface CaseActivityLog {
  id: string;
  caseId: string;
  userId?: string;
  userName: string;
  action: string;
  previousStatus?: string;
  newStatus?: string;
  notes?: string;
  timestamp: string;
}

export interface DuplicateRelation {
  id: string;
  caseId: string;
  potentialDuplicateCaseId: string;
  similarityScore: number;
  distanceMeters?: number;
  matchReasons: string;
  status: string;
  createdAt: string;
}

export interface UserNotification {
  id: string;
  userId: string;
  caseId?: string;
  title: string;
  message: string;
  isRead: boolean;
  createdAt: string;
}

export interface DashboardMetrics {
  totalCases: number;
  pendingReview: number;
  inProgress: number;
  resolved: number;
  p1Cases: number;
  p2Cases: number;
  p3Cases: number;
  p4Cases: number;
  duplicateCount: number;
  casesByCategory: { [key: string]: number };
  casesByStatus: { [key: string]: number };
}

export interface AuthUser {
  userId: string;
  username: string;
  fullName: string;
  role: 'Citizen' | 'Reviewer' | 'Administrator';
  email: string;
  token: string;
}
