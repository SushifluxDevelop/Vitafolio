import type { TFunction } from 'i18next'

/** The wait the longest "too many requests" text names (three digits cover every realistic Retry-After). */
const WORST_CASE_SECONDS = 600

/** A typical name of the safety backup a failed restore mentions. */
const TYPICAL_BACKUP_FILE = 'app-20261104-223037-pre-restore.db'

/** A typical limit of uploaded backups (two digits). */
const TYPICAL_UPLOAD_LIMIT = 10

/** Translated texts of the server answers a form can show in normal operation, for AlertSlot's reserved room. */
export function reserveFor(t: TFunction, codes: readonly string[]): string[] {
  return codes.map((code) => t(`errors.codes.${code}`, { seconds: WORST_CASE_SECONDS, safetyBackup: TYPICAL_BACKUP_FILE, max: TYPICAL_UPLOAD_LIMIT }))
}
