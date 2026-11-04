import { Icon as IconifyIcon } from '@iconify/react/offline'
import alertCircle from '@iconify-icons/tabler/alert-circle'
import alertTriangle from '@iconify-icons/tabler/alert-triangle'
import ban from '@iconify-icons/tabler/ban'
import briefcase from '@iconify-icons/tabler/briefcase'
import check from '@iconify-icons/tabler/check'
import chevronDown from '@iconify-icons/tabler/chevron-down'
import chevronLeft from '@iconify-icons/tabler/chevron-left'
import chevronRight from '@iconify-icons/tabler/chevron-right'
import circleCheck from '@iconify-icons/tabler/circle-check'
import clock from '@iconify-icons/tabler/clock'
import copy from '@iconify-icons/tabler/copy'
import calendarTime from '@iconify-icons/tabler/calendar-time'
import database from '@iconify-icons/tabler/database'
import download from '@iconify-icons/tabler/download'
import deviceDesktop from '@iconify-icons/tabler/device-desktop'
import deviceFloppy from '@iconify-icons/tabler/device-floppy'
import folder from '@iconify-icons/tabler/folder'
import fileExport from '@iconify-icons/tabler/file-export'
import fileText from '@iconify-icons/tabler/file-text'
import files from '@iconify-icons/tabler/files'
import history from '@iconify-icons/tabler/history'
import home from '@iconify-icons/tabler/home'
import infoCircle from '@iconify-icons/tabler/info-circle'
import key from '@iconify-icons/tabler/key'
import language from '@iconify-icons/tabler/language'
import layoutBoard from '@iconify-icons/tabler/layout-board'
import lock from '@iconify-icons/tabler/lock'
import logout from '@iconify-icons/tabler/logout'
import moon from '@iconify-icons/tabler/moon'
import palette from '@iconify-icons/tabler/palette'
import pencil from '@iconify-icons/tabler/pencil'
import plus from '@iconify-icons/tabler/plus'
import qrcode from '@iconify-icons/tabler/qrcode'
import refresh from '@iconify-icons/tabler/refresh'
import settings from '@iconify-icons/tabler/settings'
import shieldCheck from '@iconify-icons/tabler/shield-check'
import shieldLock from '@iconify-icons/tabler/shield-lock'
import sparkles from '@iconify-icons/tabler/sparkles'
import sun from '@iconify-icons/tabler/sun'
import sunMoon from '@iconify-icons/tabler/sun-moon'
import timeline from '@iconify-icons/tabler/timeline'
import trash from '@iconify-icons/tabler/trash'
import upload from '@iconify-icons/tabler/upload'
import userPlus from '@iconify-icons/tabler/user-plus'
import users from '@iconify-icons/tabler/users'
import userShield from '@iconify-icons/tabler/user-shield'
import world from '@iconify-icons/tabler/world'
import x from '@iconify-icons/tabler/x'
import loader from '@iconify-icons/tabler/loader-2'

/**
 * The icons the app uses, bundled (Tabler set through Iconify's offline mode): nothing is ever fetched from an icon
 * service at runtime, so the app works without internet and sends no request anywhere.
 */
const ICONS = {
  alertCircle,
  alertTriangle,
  ban,
  briefcase,
  check,
  chevronDown,
  chevronLeft,
  chevronRight,
  circleCheck,
  clock,
  copy,
  calendarTime,
  database,
  download,
  deviceDesktop,
  deviceFloppy,
  fileExport,
  folder,
  fileText,
  files,
  history,
  home,
  infoCircle,
  key,
  language,
  layoutBoard,
  loader,
  lock,
  logout,
  moon,
  palette,
  pencil,
  plus,
  qrcode,
  refresh,
  settings,
  shieldCheck,
  shieldLock,
  sparkles,
  sun,
  sunMoon,
  timeline,
  trash,
  upload,
  userPlus,
  users,
  userShield,
  world,
  x,
} as const

export type IconName = keyof typeof ICONS

interface IconProps {
  name: IconName
  /** Pixel size (square). */
  size?: number
  className?: string
}

/** One icon, decorative by default (the control around it carries the accessible name). */
export function Icon({ name, size = 18, className }: IconProps) {
  return <IconifyIcon icon={ICONS[name]} width={size} height={size} className={className} aria-hidden="true" focusable="false" />
}
