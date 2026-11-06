import { describe, it, expect } from 'vitest'
import { renderHook } from '@testing-library/react'
import { useGapAnalyzer } from './useGapAnalyzer'
import type { Profile } from '../../api/types'

describe('useGapAnalyzer', () => {
  const baseProfile: Profile = {
    id: 'p1',
    firstName: 'Max',
    lastName: 'Mustermann',
    academicTitle: null,
    professionalTitle: 'Engineer',
    email: 'max@example.com',
    phone: null,
    street: null,
    postalCode: null,
    city: null,
    country: null,
    dateOfBirth: null,
    placeOfBirth: null,
    nationality: null,
    maritalStatus: null,
    website: null,
    linkedIn: null,
    gitHub: null,
    xing: null,
    bio: null,
    hasPhoto: false,
    createdAt: '2026-01-01T00:00:00Z',
    updatedAt: '2026-01-01T00:00:00Z',
    experiences: [],
    educations: [],
    skills: [],
    languages: [],
    certificates: [],
    interests: [],
    customSections: [],
  }

  it('reports no gaps for an empty profile', () => {
    const { result } = renderHook(() => useGapAnalyzer(baseProfile))
    expect(result.current.hasGaps).toBe(false)
    expect(result.current.isContinuous).toBe(false)
    expect(result.current.gaps).toHaveLength(0)
  })

  it('detects continuous career with adjacent stations', () => {
    const profile: Profile = {
      ...baseProfile,
      experiences: [
        {
          id: 'exp1',
          jobTitle: 'Developer',
          employer: 'Firma A',
          employmentType: 'Vollzeit',
          city: 'Berlin',
          country: 'DE',
          startDate: '2020-01',
          endDate: '2021-12',
          isCurrent: false,
          description: null,
          sortOrder: 0,
          createdAt: '',
          updatedAt: '',
        },
        {
          id: 'exp2',
          jobTitle: 'Senior Developer',
          employer: 'Firma B',
          employmentType: 'Vollzeit',
          city: 'Berlin',
          country: 'DE',
          startDate: '2022-01',
          endDate: '2023-12',
          isCurrent: false,
          description: null,
          sortOrder: 1,
          createdAt: '',
          updatedAt: '',
        },
      ],
    }

    const { result } = renderHook(() => useGapAnalyzer(profile))
    expect(result.current.hasGaps).toBe(false)
    expect(result.current.isContinuous).toBe(true)
  })

  it('detects a 6-month gap between stations', () => {
    const profile: Profile = {
      ...baseProfile,
      experiences: [
        {
          id: 'exp1',
          jobTitle: 'Developer',
          employer: 'Firma A',
          employmentType: 'Vollzeit',
          city: 'Berlin',
          country: 'DE',
          startDate: '2020-01',
          endDate: '2020-12',
          isCurrent: false,
          description: null,
          sortOrder: 0,
          createdAt: '',
          updatedAt: '',
        },
        {
          id: 'exp2',
          jobTitle: 'Senior Developer',
          employer: 'Firma B',
          employmentType: 'Vollzeit',
          city: 'Berlin',
          country: 'DE',
          startDate: '2021-07',
          endDate: '2022-12',
          isCurrent: false,
          description: null,
          sortOrder: 1,
          createdAt: '',
          updatedAt: '',
        },
      ],
    }

    const { result } = renderHook(() => useGapAnalyzer(profile))
    expect(result.current.hasGaps).toBe(true)
    expect(result.current.gaps).toHaveLength(1)
    expect(result.current.gaps[0]?.durationMonths).toBe(6)
    expect(result.current.gaps[0]?.startFormatted).toBe('01/2021')
    expect(result.current.gaps[0]?.endFormatted).toBe('06/2021')
  })
})

