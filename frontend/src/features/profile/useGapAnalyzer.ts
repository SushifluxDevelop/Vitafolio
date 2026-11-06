import { useMemo } from 'react'
import type { Profile } from '../../api/types'

export interface ResumeGap {
  id: string
  startFormatted: string
  endFormatted: string
  durationMonths: number
  previousTitle?: string
  nextTitle?: string
}

export interface GapAnalysisResult {
  hasGaps: boolean
  gaps: ResumeGap[]
  isContinuous: boolean
  totalGapsCount: number
}

/**
 * Parses diverse date inputs (YYYY-MM, MM/YYYY, YYYY, DD.MM.YYYY) into an absolute month index (year * 12 + month).
 */
function parseToMonthIndex(val?: string | null): number | null {
  if (!val || !val.trim()) return null
  const s = val.trim()

  // Match YYYY-MM
  const yyyyMm = /^(\d{4})[-/.](\d{1,2})$/.exec(s)
  if (yyyyMm) {
    const y = parseInt(yyyyMm[1]!, 10)
    const m = parseInt(yyyyMm[2]!, 10)
    return y * 12 + Math.max(1, Math.min(12, m))
  }

  // Match MM/YYYY or MM.YYYY
  const mmYyyy = /^(\d{1,2})[-/.](\d{4})$/.exec(s)
  if (mmYyyy) {
    const m = parseInt(mmYyyy[1]!, 10)
    const y = parseInt(mmYyyy[2]!, 10)
    return y * 12 + Math.max(1, Math.min(12, m))
  }

  // Match DD.MM.YYYY
  const ddMmYyyy = /^(\d{1,2})[.](\d{1,2})[.](\d{4})$/.exec(s)
  if (ddMmYyyy) {
    const m = parseInt(ddMmYyyy[2]!, 10)
    const y = parseInt(ddMmYyyy[3]!, 10)
    return y * 12 + Math.max(1, Math.min(12, m))
  }

  // Match bare YYYY
  const yyyy = /^(\d{4})$/.exec(s)
  if (yyyy) {
    const y = parseInt(yyyy[1]!, 10)
    return y * 12 + 1 // Default to January
  }

  return null
}

function formatMonthIndex(index: number): string {
  const y = Math.floor(index / 12)
  const m = index % 12 || 12
  const adjustedY = m === 12 ? y - 1 : y
  return `${String(m).padStart(2, '0')}/${adjustedY}`
}

interface StationInterval {
  start: number
  end: number
  title: string
}

export function useGapAnalyzer(profile: Profile): GapAnalysisResult {
  return useMemo(() => {
    const intervals: StationInterval[] = []
    const now = new Date()
    const currentMonthIndex = now.getFullYear() * 12 + (now.getMonth() + 1)

    // Collect experience intervals
    for (const exp of profile.experiences ?? []) {
      const start = parseToMonthIndex(exp.startDate)
      if (start === null) continue
      const end = exp.isCurrent ? currentMonthIndex : parseToMonthIndex(exp.endDate) ?? start
      intervals.push({
        start: Math.min(start, end),
        end: Math.max(start, end),
        title: `${exp.jobTitle || 'Position'} (${exp.employer || 'Arbeitgeber'})`,
      })
    }

    // Collect education intervals
    for (const edu of profile.educations ?? []) {
      const start = parseToMonthIndex(edu.startDate)
      if (start === null) continue
      const end = edu.isCurrent ? currentMonthIndex : parseToMonthIndex(edu.endDate) ?? start
      intervals.push({
        start: Math.min(start, end),
        end: Math.max(start, end),
        title: `${edu.degree || 'Abschluss'} (${edu.institution || 'Einrichtung'})`,
      })
    }

    if (intervals.length <= 1) {
      return {
        hasGaps: false,
        gaps: [],
        isContinuous: intervals.length === 1,
        totalGapsCount: 0,
      }
    }

    // Sort intervals by start ascending
    intervals.sort((a, b) => a.start - b.start)

    // Merge overlapping intervals
    const merged: { start: number; end: number; titles: string[] }[] = []
    let current = {
      start: intervals[0]!.start,
      end: intervals[0]!.end,
      titles: [intervals[0]!.title],
    }

    for (let i = 1; i < intervals.length; i++) {
      const next = intervals[i]!
      // If overlapping or directly contiguous (gap <= 1 month difference)
      if (next.start <= current.end + 1) {
        current.end = Math.max(current.end, next.end)
        current.titles.push(next.title)
      } else {
        merged.push(current)
        current = {
          start: next.start,
          end: next.end,
          titles: [next.title],
        }
      }
    }
    merged.push(current)

    // Detect gaps between merged intervals (> 1 month difference)
    const gaps: ResumeGap[] = []
    for (let i = 0; i < merged.length - 1; i++) {
      const prev = merged[i]!
      const next = merged[i + 1]!

      const gapStart = prev.end + 1
      const gapEnd = next.start - 1

      if (gapEnd >= gapStart) {
        const duration = gapEnd - gapStart + 1
        gaps.push({
          id: `gap-${gapStart}-${gapEnd}`,
          startFormatted: formatMonthIndex(gapStart),
          endFormatted: formatMonthIndex(gapEnd),
          durationMonths: duration,
          previousTitle: prev.titles[prev.titles.length - 1],
          nextTitle: next.titles[0],
        })
      }
    }

    return {
      hasGaps: gaps.length > 0,
      gaps,
      isContinuous: gaps.length === 0 && intervals.length > 0,
      totalGapsCount: gaps.length,
    }
  }, [profile.experiences, profile.educations])
}
