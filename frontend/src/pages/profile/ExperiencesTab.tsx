import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import type { FormEvent } from 'react'
import { useTranslation } from 'react-i18next'
import { profileApi } from '../../api/endpoints'
import type { Experience, Profile } from '../../api/types'
import { Button } from '../../components/ui/Button'
import { useConfirm } from '../../components/ui/ConfirmDialog'
import { Dialog } from '../../components/ui/Dialog'
import { useErrorDialog } from '../../components/ui/ErrorDialog'
import { Icon } from '../../components/ui/Icon'
import { TextField } from '../../components/ui/TextField'
import { Toggle } from '../../components/ui/Toggle'
import { GapAnalyzerCard } from '../../features/profile/GapAnalyzerCard'

interface ExperienceFormData {
  id?: string
  jobTitle: string
  employer: string
  employmentType: string
  city: string
  country: string
  startDate: string
  endDate: string
  isCurrent: boolean
  description: string
  sortOrder: number
}

const emptyForm: ExperienceFormData = {
  jobTitle: '',
  employer: '',
  employmentType: '',
  city: '',
  country: '',
  startDate: '',
  endDate: '',
  isCurrent: false,
  description: '',
  sortOrder: 0,
}

export function ExperiencesTab({ profile }: { profile: Profile }) {
  const { t } = useTranslation()
  const queryClient = useQueryClient()
  const showError = useErrorDialog()
  const confirm = useConfirm()

  const [dialogOpen, setDialogOpen] = useState(false)
  const [editingItem, setEditingItem] = useState<ExperienceFormData | null>(null)

  const saveMutation = useMutation({
    mutationFn: (data: ExperienceFormData) => {
      const payload = {
        jobTitle: data.jobTitle,
        employer: data.employer,
        employmentType: data.employmentType || null,
        city: data.city || null,
        country: data.country || null,
        startDate: data.startDate,
        endDate: data.isCurrent ? null : data.endDate || null,
        isCurrent: data.isCurrent,
        description: data.description || null,
        sortOrder: data.sortOrder,
      }
      return data.id ? profileApi.updateExperience(data.id, payload) : profileApi.addExperience(payload)
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['profile'] })
      setDialogOpen(false)
      setEditingItem(null)
    },
    onError: (err) => showError(err, t('common.saveFailed')),
  })

  const deleteMutation = useMutation({
    mutationFn: (id: string) => profileApi.deleteExperience(id),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['profile'] })
    },
    onError: (err) => showError(err, t('common.deleteFailed')),
  })

  const handleDelete = async (exp: Experience) => {
    const ok = await confirm({
      title: t('profile.experiences.delete'),
      message: t('profile.experiences.deleteConfirm'),
      confirmLabel: t('common.delete'),
      tone: 'danger',
    })
    if (ok) deleteMutation.mutate(exp.id)
  }

  const reorderMutation = useMutation({
    mutationFn: (ids: string[]) => profileApi.reorderExperiences(ids),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['profile'] })
    },
    onError: (err) => showError(err, t('common.saveFailed')),
  })

  const handleOpenAdd = () => {
    setEditingItem({ ...emptyForm, sortOrder: profile.experiences.length })
    setDialogOpen(true)
  }

  const handleQuickAddFromGap = (start: string, end: string, title: string) => {
    setEditingItem({
      ...emptyForm,
      jobTitle: title,
      employer: 'Selbststudium / Orientierung',
      startDate: start,
      endDate: end,
      isCurrent: false,
      sortOrder: profile.experiences.length,
    })
    setDialogOpen(true)
  }

  const handleOpenEdit = (exp: Experience) => {
    setEditingItem({
      id: exp.id,
      jobTitle: exp.jobTitle,
      employer: exp.employer,
      employmentType: exp.employmentType ?? '',
      city: exp.city ?? '',
      country: exp.country ?? '',
      startDate: exp.startDate,
      endDate: exp.endDate ?? '',
      isCurrent: exp.isCurrent,
      description: exp.description ?? '',
      sortOrder: exp.sortOrder,
    })
    setDialogOpen(true)
  }

  const handleMove = (index: number, direction: 'up' | 'down') => {
    const targetIndex = direction === 'up' ? index - 1 : index + 1
    if (targetIndex < 0 || targetIndex >= profile.experiences.length) return

    const reordered = [...profile.experiences]
    const [moved] = reordered.splice(index, 1)
    if (moved) reordered.splice(targetIndex, 0, moved)

    reorderMutation.mutate(reordered.map((e) => e.id))
  }

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault()
    if (editingItem) saveMutation.mutate(editingItem)
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h2 className="text-base font-semibold text-ink">{t('profile.experiences.title')}</h2>
          <p className="mt-1 text-sm text-ink-muted">{t('profile.experiences.subtitle')}</p>
        </div>
        <Button variant="create" icon="plus" onClick={handleOpenAdd}>
          {t('profile.experiences.add')}
        </Button>
      </div>

      <GapAnalyzerCard profile={profile} onQuickAdd={handleQuickAddFromGap} />

      {profile.experiences.length === 0 ? (
        <div className="card flex flex-col items-center justify-center p-12 text-center text-ink-muted">
          <Icon name="briefcase" size={36} className="mb-3 text-ink-muted/50" />
          <p>{t('profile.experiences.empty')}</p>
        </div>
      ) : (
        <div className="space-y-3">
          {profile.experiences.map((exp, idx) => (
            <article key={exp.id} className="card relative flex flex-col justify-between gap-4 p-5 sm:flex-row sm:items-start">
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-baseline gap-2">
                  <h3 className="text-base font-semibold text-ink">{exp.jobTitle}</h3>
                  <span className="text-sm font-medium text-ink-muted">bei {exp.employer}</span>
                  {exp.employmentType && <span className="badge badge-select text-xs">{exp.employmentType}</span>}
                </div>

                <div className="mt-1 flex flex-wrap gap-x-4 text-xs text-ink-muted">
                  <span>
                    {exp.startDate} – {exp.isCurrent ? t('profile.experiences.isCurrent') : exp.endDate || '–'}
                  </span>
                  {(exp.city || exp.country) && <span>{[exp.city, exp.country].filter(Boolean).join(', ')}</span>}
                </div>

                {exp.description && <p className="mt-3 whitespace-pre-line text-sm text-ink">{exp.description}</p>}
              </div>

              <div className="flex shrink-0 items-center gap-1.5 self-end sm:self-start">
                <Button
                  variant="ghost"
                  small
                  icon="chevronLeft"
                  className="-rotate-90"
                  disabled={idx === 0 || reorderMutation.isPending}
                  onClick={() => handleMove(idx, 'up')}
                  aria-label={t('profile.experiences.moveUp')}
                >
                  <span className="sr-only">{t('profile.experiences.moveUp')}</span>
                </Button>
                <Button
                  variant="ghost"
                  small
                  icon="chevronLeft"
                  className="rotate-90"
                  disabled={idx === profile.experiences.length - 1 || reorderMutation.isPending}
                  onClick={() => handleMove(idx, 'down')}
                  aria-label={t('profile.experiences.moveDown')}
                >
                  <span className="sr-only">{t('profile.experiences.moveDown')}</span>
                </Button>
                <Button variant="secondary" small icon="pencil" onClick={() => handleOpenEdit(exp)}>
                  {t('profile.experiences.edit')}
                </Button>
                <Button variant="danger-outline" small icon="trash" onClick={() => void handleDelete(exp)}>
                  {t('profile.experiences.delete')}
                </Button>
              </div>
            </article>
          ))}
        </div>
      )}

      {/* Add / Edit Dialog */}
      <Dialog
        open={dialogOpen}
        onClose={() => setDialogOpen(false)}
        title={editingItem?.id ? t('profile.experiences.edit') : t('profile.experiences.add')}
        icon="briefcase"
        size="md"
      >
        {editingItem && (
          <form id="exp-form" onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <TextField
                label={t('profile.experiences.jobTitle')}
                value={editingItem.jobTitle}
                onChange={(e) => setEditingItem({ ...editingItem, jobTitle: e.target.value })}
                required
              />
              <TextField
                label={t('profile.experiences.employer')}
                value={editingItem.employer}
                onChange={(e) => setEditingItem({ ...editingItem, employer: e.target.value })}
                required
              />
            </div>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
              <TextField
                label={t('profile.experiences.employmentType')}
                value={editingItem.employmentType}
                onChange={(e) => setEditingItem({ ...editingItem, employmentType: e.target.value })}
                placeholder={t('profile.experiences.employmentTypePlaceholder')}
              />
              <TextField
                label={t('profile.experiences.city')}
                value={editingItem.city}
                onChange={(e) => setEditingItem({ ...editingItem, city: e.target.value })}
              />
              <TextField
                label={t('profile.experiences.country')}
                value={editingItem.country}
                onChange={(e) => setEditingItem({ ...editingItem, country: e.target.value })}
              />
            </div>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <TextField
                label={t('profile.experiences.startDate')}
                value={editingItem.startDate}
                onChange={(e) => setEditingItem({ ...editingItem, startDate: e.target.value })}
                placeholder="YYYY-MM"
                required
              />
              {!editingItem.isCurrent && (
                <TextField
                  label={t('profile.experiences.endDate')}
                  value={editingItem.endDate}
                  onChange={(e) => setEditingItem({ ...editingItem, endDate: e.target.value })}
                  placeholder="YYYY-MM"
                />
              )}
            </div>

            <div className="pt-1">
              <Toggle
                label={t('profile.experiences.isCurrent')}
                checked={editingItem.isCurrent}
                onChange={(checked) => setEditingItem({ ...editingItem, isCurrent: checked })}
              />
            </div>

            <div>
              <label htmlFor="exp-desc" className="block text-sm font-medium text-ink">
                {t('profile.experiences.description')}
              </label>
              <textarea
                id="exp-desc"
                rows={4}
                value={editingItem.description}
                onChange={(e) => setEditingItem({ ...editingItem, description: e.target.value })}
                className="input mt-1.5 w-full resize-y"
              />
            </div>

            <div className="flex justify-end gap-3 pt-3">
              <Button variant="secondary" onClick={() => setDialogOpen(false)}>
                {t('common.cancel')}
              </Button>
              <Button type="submit" variant="confirm" busy={saveMutation.isPending}>
                {t('common.save')}
              </Button>
            </div>
          </form>
        )}
      </Dialog>
    </div>
  )
}
