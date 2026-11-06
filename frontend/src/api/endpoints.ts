import { api, apiResponse, del, get, patch, post, put } from './client'
import { downloadPost } from './download'
import type {
  ActivityPage,
  AdminSettings,
  AdminUser,
  BackupEntry,
  BackupSettings,
  BackupSettingsInfo,
  Bootstrap,
  Certificate,
  CoverLetter,
  CoverLetterListItem,
  CoverLetterPayload,
  CoverLetterRenderOptions,
  CoverSheetOptions,
  CustomSection,
  CustomSectionItem,
  CvRenderOptions,
  Education,
  Experience,
  Interest,
  LanguageCode,
  LanguageSkill,
  LoginResult,
  PersonalDataPayload,
  Profile,
  Role,
  SessionInfo,
  Skill,
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
  requestEmergencyReset: () => post<{ requested: boolean }>('/api/auth/emergency-reset/request', {}),
  confirmEmergencyReset: (body: { code: string; newPassword: string }) =>
    post<{ success: boolean; username: string }>('/api/auth/emergency-reset/confirm', body),
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

export const profileApi = {
  get: () => get<Profile>('/api/profile'),
  update: (body: PersonalDataPayload) => put<Profile>('/api/profile', body),
  uploadPhoto: (file: File) => {
    const form = new FormData()
    form.append('photo', file)
    return post<Profile>('/api/profile/photo', form)
  },
  deletePhoto: () => del('/api/profile/photo'),

  // Experiences
  addExperience: (body: Omit<Experience, 'id' | 'createdAt' | 'updatedAt'>) => post<Experience>('/api/profile/experiences', body),
  updateExperience: (id: string, body: Omit<Experience, 'id' | 'createdAt' | 'updatedAt'>) => put<Experience>(`/api/profile/experiences/${encodeURIComponent(id)}`, body),
  deleteExperience: (id: string) => del(`/api/profile/experiences/${encodeURIComponent(id)}`),
  reorderExperiences: (ids: string[]) => put('/api/profile/experiences/reorder', { ids }),

  // Educations
  addEducation: (body: Omit<Education, 'id' | 'createdAt' | 'updatedAt'>) => post<Education>('/api/profile/educations', body),
  updateEducation: (id: string, body: Omit<Education, 'id' | 'createdAt' | 'updatedAt'>) => put<Education>(`/api/profile/educations/${encodeURIComponent(id)}`, body),
  deleteEducation: (id: string) => del(`/api/profile/educations/${encodeURIComponent(id)}`),
  reorderEducations: (ids: string[]) => put('/api/profile/educations/reorder', { ids }),

  // Skills
  addSkill: (body: Omit<Skill, 'id' | 'createdAt' | 'updatedAt'>) => post<Skill>('/api/profile/skills', body),
  updateSkill: (id: string, body: Omit<Skill, 'id' | 'createdAt' | 'updatedAt'>) => put<Skill>(`/api/profile/skills/${encodeURIComponent(id)}`, body),
  deleteSkill: (id: string) => del(`/api/profile/skills/${encodeURIComponent(id)}`),
  reorderSkills: (ids: string[]) => put('/api/profile/skills/reorder', { ids }),

  // Languages
  addLanguage: (body: Omit<LanguageSkill, 'id' | 'createdAt' | 'updatedAt'>) => post<LanguageSkill>('/api/profile/languages', body),
  updateLanguage: (id: string, body: Omit<LanguageSkill, 'id' | 'createdAt' | 'updatedAt'>) => put<LanguageSkill>(`/api/profile/languages/${encodeURIComponent(id)}`, body),
  deleteLanguage: (id: string) => del(`/api/profile/languages/${encodeURIComponent(id)}`),
  reorderLanguages: (ids: string[]) => put('/api/profile/languages/reorder', { ids }),

  // Certificates
  addCertificate: (body: Omit<Certificate, 'id' | 'createdAt' | 'updatedAt'>) => post<Certificate>('/api/profile/certificates', body),
  updateCertificate: (id: string, body: Omit<Certificate, 'id' | 'createdAt' | 'updatedAt'>) => put<Certificate>(`/api/profile/certificates/${encodeURIComponent(id)}`, body),
  deleteCertificate: (id: string) => del(`/api/profile/certificates/${encodeURIComponent(id)}`),
  reorderCertificates: (ids: string[]) => put('/api/profile/certificates/reorder', { ids }),

  // Interests
  addInterest: (body: Omit<Interest, 'id' | 'createdAt' | 'updatedAt'>) => post<Interest>('/api/profile/interests', body),
  updateInterest: (id: string, body: Omit<Interest, 'id' | 'createdAt' | 'updatedAt'>) => put<Interest>(`/api/profile/interests/${encodeURIComponent(id)}`, body),
  deleteInterest: (id: string) => del(`/api/profile/interests/${encodeURIComponent(id)}`),
  reorderInterests: (ids: string[]) => put('/api/profile/interests/reorder', { ids }),

  // Custom sections
  addCustomSection: (body: { title: string; sortOrder: number }) => post<CustomSection>('/api/profile/custom-sections', body),
  updateCustomSection: (id: string, body: { title: string; sortOrder: number }) => put<CustomSection>(`/api/profile/custom-sections/${encodeURIComponent(id)}`, body),
  deleteCustomSection: (id: string) => del(`/api/profile/custom-sections/${encodeURIComponent(id)}`),
  reorderCustomSections: (ids: string[]) => put('/api/profile/custom-sections/reorder', { ids }),

  addCustomSectionItem: (sectionId: string, body: Omit<CustomSectionItem, 'id' | 'createdAt' | 'updatedAt'>) =>
    post<CustomSectionItem>(`/api/profile/custom-sections/${encodeURIComponent(sectionId)}/items`, body),
  updateCustomSectionItem: (sectionId: string, id: string, body: Omit<CustomSectionItem, 'id' | 'createdAt' | 'updatedAt'>) =>
    put<CustomSectionItem>(`/api/profile/custom-sections/${encodeURIComponent(sectionId)}/items/${encodeURIComponent(id)}`, body),
  deleteCustomSectionItem: (sectionId: string, id: string) =>
    del(`/api/profile/custom-sections/${encodeURIComponent(sectionId)}/items/${encodeURIComponent(id)}`),
  reorderCustomSectionItems: (sectionId: string, ids: string[]) =>
    put(`/api/profile/custom-sections/${encodeURIComponent(sectionId)}/items/reorder`, { ids }),

  // PDF Preview & Export
  getPreviewPdf: async (options: CvRenderOptions): Promise<Blob> => {
    const res = await apiResponse('POST', '/api/profile/preview/pdf', options)
    return res.blob()
  },
  exportPdf: async (options: CvRenderOptions): Promise<{ blob: Blob; filename: string }> => {
    const res = await apiResponse('POST', '/api/profile/export/pdf', options)
    const blob = await res.blob()
    const disposition = res.headers.get('content-disposition')
    let filename = options.language === 'en' ? 'Resume.pdf' : 'Lebenslauf.pdf'
    if (disposition) {
      const match = /filename\*?=['"]?(?:UTF-\d['"]*)?([^;\r\n"']*)['"]?/i.exec(disposition)
      if (match?.[1]) filename = decodeURIComponent(match[1])
    }
    return { blob, filename }
  },

  exportDocx: async (options: CvRenderOptions): Promise<{ blob: Blob; filename: string }> => {
    const res = await apiResponse('POST', '/api/profile/export/docx', options)
    const blob = await res.blob()
    const disposition = res.headers.get('content-disposition')
    let filename = options.language === 'en' ? 'Resume.docx' : 'Lebenslauf.docx'
    if (disposition) {
      const match = /filename\*?=['"]?(?:UTF-\d['"]*)?([^;\r\n"']*)['"]?/i.exec(disposition)
      if (match?.[1]) filename = decodeURIComponent(match[1])
    }
    return { blob, filename }
  },

  getPreviewCoverSheetPdf: async (options: CoverSheetOptions): Promise<Blob> => {
    const res = await apiResponse('POST', '/api/profile/preview/cover-sheet/pdf', options)
    return res.blob()
  },

  exportCoverSheetPdf: async (options: CoverSheetOptions): Promise<{ blob: Blob; filename: string }> => {
    const res = await apiResponse('POST', '/api/profile/export/cover-sheet/pdf', options)
    const blob = await res.blob()
    const disposition = res.headers.get('content-disposition')
    let filename = options.language === 'en' ? 'CoverSheet.pdf' : 'Deckblatt.pdf'
    if (disposition) {
      const match = /filename\*?=['"]?(?:UTF-\d['"]*)?([^;\r\n"']*)['"]?/i.exec(disposition)
      if (match?.[1]) filename = decodeURIComponent(match[1])
    }
    return { blob, filename }
  },
}

export const coverLettersApi = {
  list: () => get<CoverLetterListItem[]>('/api/cover-letters'),
  get: (id: string) => get<CoverLetter>(`/api/cover-letters/${encodeURIComponent(id)}`),
  create: (body: CoverLetterPayload) => post<CoverLetter>('/api/cover-letters', body),
  update: (id: string, body: CoverLetterPayload) => put<CoverLetter>(`/api/cover-letters/${encodeURIComponent(id)}`, body),
  delete: (id: string) => del(`/api/cover-letters/${encodeURIComponent(id)}`),

  uploadSignature: (id: string, file: File) => {
    const form = new FormData()
    form.append('file', file)
    return post<CoverLetter>(`/api/cover-letters/${encodeURIComponent(id)}/signature`, form)
  },
  deleteSignature: (id: string) => del<CoverLetter>(`/api/cover-letters/${encodeURIComponent(id)}/signature`),

  getPreviewPdf: async (id: string, options: CoverLetterRenderOptions): Promise<Blob> => {
    const res = await apiResponse('POST', `/api/cover-letters/${encodeURIComponent(id)}/preview/pdf`, options)
    return res.blob()
  },

  exportPdf: async (id: string, options: CoverLetterRenderOptions): Promise<{ blob: Blob; filename: string }> => {
    const res = await apiResponse('POST', `/api/cover-letters/${encodeURIComponent(id)}/export/pdf`, options)
    const blob = await res.blob()
    const disposition = res.headers.get('content-disposition')
    let filename = options.language === 'en' ? 'Cover_Letter.pdf' : 'Anschreiben.pdf'
    if (disposition) {
      const match = /filename\*?=['"]?(?:UTF-\d['"]*)?([^;\r\n"']*)['"]?/i.exec(disposition)
      if (match?.[1]) filename = decodeURIComponent(match[1])
    }
    return { blob, filename }
  },

  exportDocx: async (id: string, options: CoverLetterRenderOptions): Promise<{ blob: Blob; filename: string }> => {
    const res = await apiResponse('POST', `/api/cover-letters/${encodeURIComponent(id)}/export/docx`, options)
    const blob = await res.blob()
    const disposition = res.headers.get('content-disposition')
    let filename = options.language === 'en' ? 'Cover_Letter.docx' : 'Anschreiben.docx'
    if (disposition) {
      const match = /filename\*?=['"]?(?:UTF-\d['"]*)?([^;\r\n"']*)['"]?/i.exec(disposition)
      if (match?.[1]) filename = decodeURIComponent(match[1])
    }
    return { blob, filename }
  },
}
