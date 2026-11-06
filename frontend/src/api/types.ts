/** Wire types of the API contract. All JSON is camelCase. */

export type Role = 'admin' | 'user'
export type ThemePreference = 'system' | 'light' | 'dark'
export type LanguageCode = 'de' | 'en'
export type HostMode = 'server' | 'desktop'

export interface User {
  id: string
  username: string
  displayName: string
  role: Role
  twoFactorEnabled: boolean
  mustSetupTwoFactor: boolean
  language: LanguageCode | null
  theme: ThemePreference | null
}

export interface TextRule {
  minLength: number
  maxLength: number
}

/** The only source of form rules for the UI (delivered by /api/bootstrap). */
export interface Rules {
  username: TextRule & { pattern: string }
  displayName: TextRule
  password: TextRule
}

export interface Bootstrap {
  productName: string
  mode: HostMode
  setupRequired: boolean
  /** The first account needs the one-time setup code from the server's log (only while setup is required). */
  setupTokenRequired?: boolean
  registrationOpen: boolean
  rules: Rules
  languages: LanguageCode[]
}

export interface VersionInfo {
  /** The readable form, e.g. "v2026.11.12 (13.557)" - shown as it is. */
  version: string
  short: string
  buildId: string
  channel: 'dev' | 'beta' | 'release' | string
}

export interface UserEnvelope {
  user: User
}

export type LoginResult = UserEnvelope | { twoFactorRequired: true; challengeId: string }

export interface TotpSetup {
  secret: string
  otpauthUri: string
}

export interface SessionInfo {
  id: string
  createdAt: string
  lastUsedAt: string
  ip: string | null
  userAgent: string | null
  current: boolean
}

export interface AdminUser {
  id: string
  username: string
  displayName: string
  role: Role
  disabled: boolean
  twoFactorEnabled: boolean
  createdAt?: string
  lastLoginAt?: string | null
}

export interface AdminSettings {
  registrationOpen: boolean
  requireTwoFactor: boolean
}

export interface ActivityItem {
  id: string | number
  /** UTC time of the event. */
  at: string
  actorId: string | null
  actorName: string | null
  action: string
  target: string | null
  ip: string | null
  details: unknown
}

export interface ActivityPage {
  items: ActivityItem[]
  total: number
}

export type BackupKind = 'start' | 'shutdown' | 'scheduled' | 'manual' | 'pre-restore' | 'uploaded'

export interface BackupEntry {
  id: string
  file: string
  createdAt: string
  sizeBytes: number
  kind: BackupKind | string
  tier: 'recent' | 'daily' | string
}

export type ScheduleKind = 'off' | 'interval' | 'times'

export interface BackupSchedule {
  kind: ScheduleKind
  /** 1-168 */
  intervalHours: number
  /** 24-hour "HH:mm", at most 12 entries. */
  times: string[]
  /** 1 = Monday ... 7 = Sunday. */
  weekdays: number[]
}

export interface BackupSettings {
  /** Master switch of all automatic backups (start, shutdown, schedule); manual actions always work. */
  automaticEnabled: boolean
  onStart: boolean
  beforeShutdown: boolean
  schedule: BackupSchedule
  catchUpMissed: boolean
  /** 5-500 */
  keepRecent: number
  /** 0-3650 */
  keepDailyDays: number
}

/** What GET /api/admin/backups/settings returns: the settings plus read-only facts about this instance. */
export interface BackupSettingsInfo extends BackupSettings {
  /** The planned runs of the next 7 days (ISO), as the server computes them. */
  nextRuns: string[]
  timeZone: string
  directory: string
}

/** One error entry of a field: a stable code plus the values for its message. */
export interface FieldProblem {
  code: string
  params?: Record<string, string | number | boolean>
}

/** RFC 7807 problem details as the server extends them. */
export interface ProblemDetails {
  status?: number
  title?: string
  detail?: string
  code?: string
  params?: Record<string, string | number | boolean>
  errors?: Record<string, FieldProblem[]>
  traceId?: string
}

export interface Experience {
  id: string
  jobTitle: string
  employer: string
  employmentType?: string | null
  city?: string | null
  country?: string | null
  startDate: string
  endDate?: string | null
  isCurrent: boolean
  description?: string | null
  sortOrder: number
  createdAt: string
  updatedAt: string
}

export interface Education {
  id: string
  degree: string
  fieldOfStudy?: string | null
  institution: string
  city?: string | null
  country?: string | null
  startDate: string
  endDate?: string | null
  isCurrent: boolean
  grade?: string | null
  description?: string | null
  sortOrder: number
  createdAt: string
  updatedAt: string
}

export interface Skill {
  id: string
  name: string
  category?: string | null
  level: number
  sortOrder: number
  createdAt: string
  updatedAt: string
}

export interface LanguageSkill {
  id: string
  language: string
  level: string
  sortOrder: number
  createdAt: string
  updatedAt: string
}

export interface Certificate {
  id: string
  title: string
  issuer?: string | null
  issueDate?: string | null
  expiryDate?: string | null
  credentialUrl?: string | null
  credentialId?: string | null
  sortOrder: number
  createdAt: string
  updatedAt: string
}

export interface Interest {
  id: string
  name: string
  category?: string | null
  description?: string | null
  sortOrder: number
  createdAt: string
  updatedAt: string
}

export interface CustomSectionItem {
  id: string
  title: string
  subtitle?: string | null
  dateRange?: string | null
  description?: string | null
  sortOrder: number
  createdAt: string
  updatedAt: string
}

export interface CustomSection {
  id: string
  title: string
  sortOrder: number
  createdAt: string
  updatedAt: string
  items: CustomSectionItem[]
}

export interface Profile {
  id: string
  firstName: string
  lastName: string
  academicTitle?: string | null
  professionalTitle?: string | null
  email?: string | null
  phone?: string | null
  street?: string | null
  postalCode?: string | null
  city?: string | null
  country?: string | null
  dateOfBirth?: string | null
  placeOfBirth?: string | null
  nationality?: string | null
  maritalStatus?: string | null
  website?: string | null
  linkedIn?: string | null
  gitHub?: string | null
  xing?: string | null
  bio?: string | null
  hasPhoto: boolean
  createdAt: string
  updatedAt: string
  experiences: Experience[]
  educations: Education[]
  skills: Skill[]
  languages: LanguageSkill[]
  certificates: Certificate[]
  interests: Interest[]
  customSections: CustomSection[]
}

export interface PersonalDataPayload {
  firstName: string
  lastName: string
  academicTitle?: string | null
  professionalTitle?: string | null
  email?: string | null
  phone?: string | null
  street?: string | null
  postalCode?: string | null
  city?: string | null
  country?: string | null
  dateOfBirth?: string | null
  placeOfBirth?: string | null
  nationality?: string | null
  maritalStatus?: string | null
  website?: string | null
  linkedIn?: string | null
  gitHub?: string | null
  xing?: string | null
  bio?: string | null
}

export interface CvRenderOptions {
  design?: 'classic' | 'modern' | 'plain'
  accentColor?: string
  font?: string
  showPhoto?: boolean
  photoShape?: 'round' | 'rounded' | 'rect'
  language?: 'de' | 'en'
}

export interface CoverLetter {
  id: string
  title: string
  senderName?: string | null
  senderStreet?: string | null
  senderPostalCode?: string | null
  senderCity?: string | null
  senderPhone?: string | null
  senderEmail?: string | null
  recipientCompany: string
  recipientDepartment?: string | null
  recipientContactPerson?: string | null
  recipientStreet?: string | null
  recipientPostalCode?: string | null
  recipientCity: string
  recipientCountry?: string | null
  place?: string | null
  date?: string | null
  subject: string
  salutation: string
  body: string
  closing: string
  signatureName?: string | null
  hasSignature: boolean
  attachmentsNote?: string | null
  language: 'de' | 'en'
  font?: string | null
  accentColor?: string | null
  createdAt: string
  updatedAt: string
}

export interface CoverLetterListItem {
  id: string
  title: string
  recipientCompany: string
  subject: string
  date?: string | null
  updatedAt: string
}

export interface CoverLetterPayload {
  title: string
  senderName?: string | null
  senderStreet?: string | null
  senderPostalCode?: string | null
  senderCity?: string | null
  senderPhone?: string | null
  senderEmail?: string | null
  recipientCompany: string
  recipientDepartment?: string | null
  recipientContactPerson?: string | null
  recipientStreet?: string | null
  recipientPostalCode?: string | null
  recipientCity: string
  recipientCountry?: string | null
  place?: string | null
  date?: string | null
  subject: string
  salutation: string
  body: string
  closing?: string | null
  signatureName?: string | null
  attachmentsNote?: string | null
  language?: 'de' | 'en'
  font?: string | null
  accentColor?: string | null
}

export interface CoverLetterRenderOptions {
  font?: string
  accentColor?: string
  language?: 'de' | 'en'
  includeFoldMarks?: boolean
}

export interface CoverSheetOptions {
  targetJob?: string
  targetCompany?: string
  contents?: string[]
  accentColor?: string
  font?: string
  showPhoto?: boolean
  photoShape?: 'round' | 'rounded' | 'rect'
  language?: 'de' | 'en'
}

export type ApplicationStatus =
  | 'draft'
  | 'applied'
  | 'acknowledged'
  | 'interview'
  | 'offer'
  | 'rejected'
  | 'withdrawn'

export interface ApplicationEvent {
  id: string
  applicationId: string
  status: ApplicationStatus
  date: string
  title: string | null
  note: string | null
  createdAt: string
}

export interface ApplicationListItem {
  id: string
  jobTitle: string
  company: string
  location?: string | null
  status: ApplicationStatus
  appliedAt?: string | null
  followUpAt?: string | null
  isFollowUpDue: boolean
  coverLetterTitle?: string | null
  hasArchivedPdf: boolean
  updatedAt: string
}

export interface Application {
  id: string
  jobTitle: string
  company: string
  location?: string | null
  contactPerson?: string | null
  contactEmail?: string | null
  contactPhone?: string | null
  jobPostingUrl?: string | null
  jobDescription?: string | null
  salaryExpectation?: string | null
  status: ApplicationStatus
  appliedAt?: string | null
  followUpAt?: string | null
  isFollowUpDue: boolean
  coverLetterId?: string | null
  coverLetterTitle?: string | null
  cvDesign: string
  cvAccentColor?: string | null
  cvFont?: string | null
  cvLanguage: 'de' | 'en'
  cvShowPhoto: boolean
  cvPhotoShape: 'round' | 'rounded' | 'rect'
  includeCoverSheet: boolean
  attachmentIds: string[]
  hasArchivedPdf: boolean
  notes?: string | null
  createdAt: string
  updatedAt: string
  events: ApplicationEvent[]
}

export interface Attachment {
  id: string
  title: string
  fileName: string
  category?: string | null
  contentType: string
  sizeBytes: number
  sortOrder: number
  createdAt: string
  updatedAt: string
}

export interface ApplicationPayload {
  jobTitle: string
  company: string
  location?: string | null
  contactPerson?: string | null
  contactEmail?: string | null
  contactPhone?: string | null
  jobPostingUrl?: string | null
  jobDescription?: string | null
  salaryExpectation?: string | null
  status?: ApplicationStatus
  appliedAt?: string | null
  followUpAt?: string | null
  coverLetterId?: string | null
  cvDesign?: string
  cvAccentColor?: string
  cvFont?: string
  cvLanguage?: 'de' | 'en'
  cvShowPhoto?: boolean
  cvPhotoShape?: 'round' | 'rounded' | 'rect'
  includeCoverSheet?: boolean
  attachmentIds?: string[]
  notes?: string | null
}

export interface ApplicationStatusUpdatePayload {
  status: ApplicationStatus
  date?: string | null
  note?: string | null
}

export interface ApplicationEventPayload {
  date?: string | null
  status?: ApplicationStatus
  title: string
  note?: string | null
}

export interface ApplicationStats {
  total: number
  draft: number
  applied: number
  acknowledged: number
  interview: number
  offer: number
  rejected: number
  withdrawn: number
  followUpsDue: number
}

// ==================== AI ASSISTANT TYPES ====================

export type AiProvider = 'copy_paste' | 'openai' | 'anthropic' | 'gemini' | 'ollama' | 'custom'

export type AiTask =
  | 'generate_cover_letter'
  | 'analyze_job'
  | 'generate_summary'
  | 'improve_bullet'
  | 'translate_content'

export interface AiConfig {
  provider: AiProvider
  model: string
  baseUrl: string | null
  hasApiKey: boolean
  pseudonymize: boolean
}

export interface UpdateAiConfigPayload {
  provider?: AiProvider
  model?: string
  baseUrl?: string | null
  apiKey?: string | null
  pseudonymize?: boolean
}

export interface TestAiConnectionResult {
  success: boolean
  message: string | null
}

export interface AiPromptPayload {
  task: AiTask
  jobTitle?: string | null
  company?: string | null
  jobDescription?: string | null
  recipientPerson?: string | null
  tone?: string | null
  language?: string | null
  inputText?: string | null
  coverLetterId?: string | null
}

export interface AiPromptResult {
  task: AiTask
  systemPrompt: string
  userPrompt: string
  fullCopyPasteText: string
  pseudonymized: boolean
}

export interface AiParsePayload {
  task: AiTask
  rawResponse: string
  pseudonymized: boolean
  language?: string | null
}

export interface AiCoverLetterResult {
  subject: string
  salutation: string
  opening: string
  body: string
  closing: string
  keyMatches?: string[]
}

export interface MatchedRequirement {
  requirement: string
  candidateMatch: string
}

export interface MissingRequirement {
  requirement: string
  suggestion: string
}

export interface AiJobAnalysisResult {
  matchScore: number
  summary: string
  matchedRequirements: MatchedRequirement[]
  missingRequirements: MissingRequirement[]
  tips: string[]
}

export interface AiSummaryResult {
  shortSummary: string
  bulletPoints: string[]
}

export interface AiImproveBulletResult {
  improved: string
  alternatives: string[]
  explanation: string
}

export interface TranslatedItem {
  key: string
  translation: string
}

export interface AiTranslateResult {
  translatedText: string
  items?: TranslatedItem[]
}





