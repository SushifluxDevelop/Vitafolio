import { api, del, get, patch, post, put } from './client'
import { downloadPost } from './download'
import type {
  ActivityPage,
  AdminSettings,
  AdminUser,
  BackupEntry,
  BackupSettings,
  BackupSettingsInfo,
  Bootstrap,
  LanguageCode,
  LoginResult,
  Role,
  SessionInfo,
  ThemePreference,
  TotpSetup,
  UserEnvelope,
  VersionInfo,
} from './types'

/** Thin typed wrappers around the endpoints of the API contract; no logic lives here. */

export const publicApi = {
  bootstrap: () => get<Bootstrap>('/api/bootstrap'),
  version: () => get<VersionInfo>('/api/version'),
}

export interface NewAccount {
  username: string
  displayName: string
  password: string
  /** Only for the first account while the server asks for its setup code (normalised: XXXX-XXXX-XXXX-XXXX). */
  setupToken?: string
}

export const authApi = {
  setup: (body: NewAccount) => post<UserEnvelope>('/api/setup', body),
  register: (body: NewAccount) => post<UserEnvelope>('/api/auth/register', body),
  login: (body: { username: string; password: string }) => post<LoginResult>('/api/auth/login', body),
  loginTwoFactor: (body: { challengeId: string; code: string }) => post<UserEnvelope>('/api/auth/login/2fa', body),
  logout: () => post('/api/auth/logout'),
  me: () => get<UserEnvelope>('/api/auth/me'),
}

export const accountApi = {
  savePreferences: (body: { language?: LanguageCode; theme?: ThemePreference }) => put('/api/account/preferences', body),
  changePassword: (body: { currentPassword: string; newPassword: string }) => post('/api/account/password', body),
  totpSetup: () => post<TotpSetup>('/api/account/2fa/totp/setup'),
  /** The current password is required except right after a fresh sign-in during the forced setup (the server says so). */
  totpEnable: (body: { code: string; currentPassword?: string }) => post<{ recoveryCodes: string[] }>('/api/account/2fa/totp/enable', body),
  twoFactorDisable: (body: { password: string; code: string }) => post('/api/account/2fa/disable', body),
  sessions: () => get<SessionInfo[]>('/api/account/sessions'),
  revokeSession: (id: string) => del(`/api/account/sessions/${encodeURIComponent(id)}`),
}

export interface ActivityQuery {
  page: number
  pageSize: number
  action?: string
  userId?: string
}

export const adminApi = {
  users: () => get<AdminUser[]>('/api/admin/users'),
  createUser: (body: NewAccount & { role: Role }) => post<AdminUser>('/api/admin/users', body),
  updateUser: (id: string, body: { displayName?: string; role?: Role; disabled?: boolean }) =>
    patch<AdminUser>(`/api/admin/users/${encodeURIComponent(id)}`, body),
  resetTwoFactor: (id: string) => post(`/api/admin/users/${encodeURIComponent(id)}/reset-2fa`),
  setPassword: (id: string, body: { newPassword: string }) => post(`/api/admin/users/${encodeURIComponent(id)}/password`, body),
  deleteUser: (id: string) => del(`/api/admin/users/${encodeURIComponent(id)}`),
  settings: () => get<AdminSettings>('/api/admin/settings'),
  saveSettings: (body: AdminSettings) => put<AdminSettings>('/api/admin/settings', body),
  activity: (query: ActivityQuery) => {
    const params = new URLSearchParams({ page: String(query.page), pageSize: String(query.pageSize) })
    if (query.action) params.set('action', query.action)
    if (query.userId) params.set('userId', query.userId)
    return get<ActivityPage>(`/api/admin/activity?${params}`)
  },
  backups: () => get<BackupEntry[]>('/api/admin/backups'),
  runBackup: () => post<BackupEntry>('/api/admin/backups'),
  deleteBackup: (id: string, credentials: Reauth) => api<void>('DELETE', `/api/admin/backups/${encodeURIComponent(id)}`, credentials),
  backupSettings: () => get<BackupSettingsInfo>('/api/admin/backups/settings'),
  saveBackupSettings: (body: BackupSettings) => put('/api/admin/backups/settings', body),
  /** Download, upload and restore contain everybody's data: the server asks for the password (and 2FA code) again. */
  downloadBackup: (id: string, credentials: Reauth, fallbackName: string) =>
    downloadPost(`/api/admin/backups/${encodeURIComponent(id)}/download`, credentials, fallbackName),
  downloadCurrent: (credentials: Reauth, fallbackName: string) => downloadPost('/api/admin/backups/current/download', credentials, fallbackName),
  uploadBackup: (file: File, credentials: Reauth) => {
    const form = new FormData()
    form.append('file', file)
    if (credentials.password) form.append('password', credentials.password)
    if (credentials.code) form.append('code', credentials.code)
    return post<BackupEntry>('/api/admin/backups/upload', form)
  },
  restoreBackup: (id: string, credentials: Reauth) =>
    post<{ restored: boolean }>(`/api/admin/backups/${encodeURIComponent(id)}/restore`, credentials),
}

/** The admin's current password (and 2FA code when 2FA is on); empty in the desktop program (no password there). */
export interface Reauth {
  password?: string
  code?: string
}
