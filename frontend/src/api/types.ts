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
