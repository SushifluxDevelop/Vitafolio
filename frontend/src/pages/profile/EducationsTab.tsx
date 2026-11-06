import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import type { FormEvent } from 'react'
import { useTranslation } from 'react-i18next'
import { profileApi } from '../../api/endpoints'
import type { Education, Profile } from '../../api/types'
import { Button } from '../../components/ui/Button'
import { useConfirm } from '../../components/ui/ConfirmDialog'
import { Dialog } from '../../components/ui/Dialog'
import { useErrorDialog } from '../../components/ui/ErrorDialog'
import { Icon } from '../../components/ui/Icon'
import { TextField } from '../../components/ui/TextField'
import { Toggle } from '../../components/ui/Toggle'

interface EducationFormData {
  id?: string
  degree: string
  fieldOfStudy: string
  institution: string
  city: string
  country: string
  startDate: string
  endDate: string
  isCurrent: boolean
  grade: string
  description: string
  sortOrder: number
}

const emptyForm: EducationFormData = {
  degree: '',
  fieldOfStudy: '',
  institution: '',
  city: '',
  country: '',
  startDate: '',
  endDate: '',
  isCurrent: false,
  grade: '',
  description: '',
  sortOrder: 0,
}

export function EducationsTab({ profile }: { profile: Profile }) {
  const { t } = useTranslation()
  const queryClient = useQueryClient()
  const showError = useErrorDialog()
  const confirm = useConfirm()

  const [dialogOpen, setDialogOpen] = useState(false)
  const [editingItem, setEditingItem] = useState<EducationFormData | null>(null)

  const saveMutation = useMutation({
    mutationFn: (data: EducationFormData) => {
      const payload = {
        degree: data.degree,
        fieldOfStudy: data.fieldOfStudy || null,
        institution: data.institution,
        city: data.city || null,
        country: data.country || null,
        startDate: data.startDate,
        endDate: data.isCurrent ? null : data.endDate || null,
        isCurrent: data.isCurrent,
        grade: data.grade || null,
        description: data.description || null,
        sortOrder: data.sortOrder,
      }
      return data.id ? profileApi.updateEducation(data.id, payload) : profileApi.addEducation(payload)
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['profile'] })
      setDialogOpen(false)
      setEditingItem(null)
    },
    onError: (err) => showError(err, t('common.saveFailed')),
  })

  const deleteMutation = useMutation({
    mutationFn: (id: string) => profileApi.deleteEducation(id),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['profile'] })
    },
    onError: (err) => showError(err, t('common.deleteFailed')),
  })

  const handleDelete = async (edu: Education) => {
    const ok = await confirm({
      title: t('profile.educations.delete'),
      message: t('profile.educations.deleteConfirm'),
      confirmLabel: t('common.delete'),
      tone: 'danger',
    })
    if (ok) deleteMutation.mutate(edu.id)
  }

  const reorderMutation = useMutation({
    mutationFn: (ids: string[]) => profileApi.reorderEducations(ids),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['profile'] })
    },
    onError: (err) => showError(err, t('common.saveFailed')),
  })

  const handleOpenAdd = () => {
    setEditingItem({ ...emptyForm, sortOrder: profile.educations.length })
    setDialogOpen(true)
  }

  const handleOpenEdit = (edu: Education) => {
    setEditingItem({
      id: edu.id,
      degree: edu.degree,
      fieldOfStudy: edu.fieldOfStudy ?? '',
      institution: edu.institution,
      city: edu.city ?? '',
      country: edu.country ?? '',
      startDate: edu.startDate,
      endDate: edu.endDate ?? '',
      isCurrent: edu.isCurrent,
      grade: edu.grade ?? '',
      description: edu.description ?? '',
      sortOrder: edu.sortOrder,
    })
    setDialogOpen(true)
  }

  const handleMove = (index: number, direction: 'up' | 'down') => {
    const targetIndex = direction === 'up' ? index - 1 : index + 1
    if (targetIndex < 0 || targetIndex >= profile.educations.length) return

    const reordered = [...profile.educations]
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
          <h2 className="text-base font-semibold text-ink">{t('profile.educations.title')}</h2>
          <p className="mt-1 text-sm text-ink-muted">{t('profile.educations.subtitle')}</p>
        </div>
        <Button variant="create" icon="plus" onClick={handleOpenAdd}>
          {t('profile.educations.add')}
        </Button>
      </div>

      {profile.educations.length === 0 ? (
        <div className="card flex flex-col items-center justify-center p-12 text-center text-ink-muted">
          <Icon name="timeline" size={36} className="mb-3 text-ink-muted/50" />
          <p>{t('profile.educations.empty')}</p>
        </div>
      ) : (
        <div className="space-y-3">
          {profile.educations.map((edu, idx) => (
            <article key={edu.id} className="card relative flex flex-col justify-between gap-4 p-5 sm:flex-row sm:items-start">
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-baseline gap-2">
                  <h3 className="text-base font-semibold text-ink">{edu.degree}</h3>
                  {edu.fieldOfStudy && <span className="text-sm text-ink font-medium">({edu.fieldOfStudy})</span>}
                  <span className="text-sm text-ink-muted">an der {edu.institution}</span>
                  {edu.grade && <span className="badge badge-select text-xs">Note {edu.grade}</span>}
                </div>

                <div className="mt-1 flex flex-wrap gap-x-4 text-xs text-ink-muted">
                  <span>
                    {edu.startDate} – {edu.isCurrent ? t('profile.educations.isCurrent') : edu.endDate || '–'}
                  </span>
                  {(edu.city || edu.country) && <span>{[edu.city, edu.country].filter(Boolean).join(', ')}</span>}
                </div>

                {edu.description && <p className="mt-3 whitespace-pre-line text-sm text-ink">{edu.description}</p>}
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
                  disabled={idx === profile.educations.length - 1 || reorderMutation.isPending}
                  onClick={() => handleMove(idx, 'down')}
                  aria-label={t('profile.experiences.moveDown')}
                >
                  <span className="sr-only">{t('profile.experiences.moveDown')}</span>
                </Button>
                <Button variant="secondary" small icon="pencil" onClick={() => handleOpenEdit(edu)}>
                  {t('profile.educations.edit')}
                </Button>
                <Button variant="danger-outline" small icon="trash" onClick={() => void handleDelete(edu)}>
                  {t('profile.educations.delete')}
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
        title={editingItem?.id ? t('profile.educations.edit') : t('profile.educations.add')}
        icon="timeline"
        size="md"
      >
        {editingItem && (
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <TextField
                label={t('profile.educations.degree')}
                value={editingItem.degree}
                onChange={(e) => setEditingItem({ ...editingItem, degree: e.target.value })}
                placeholder={t('profile.educations.degreePlaceholder')}
                required
              />
              <TextField
                label={t('profile.educations.fieldOfStudy')}
                value={editingItem.fieldOfStudy}
                onChange={(e) => setEditingItem({ ...editingItem, fieldOfStudy: e.target.value })}
              />
            </div>

            <TextField
              label={t('profile.educations.institution')}
              value={editingItem.institution}
              onChange={(e) => setEditingItem({ ...editingItem, institution: e.target.value })}
              required
            />

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
              <TextField
                label={t('profile.educations.city')}
                value={editingItem.city}
                onChange={(e) => setEditingItem({ ...editingItem, city: e.target.value })}
              />
              <TextField
                label={t('profile.educations.country')}
                value={editingItem.country}
                onChange={(e) => setEditingItem({ ...editingItem, country: e.target.value })}
              />
              <TextField
                label={t('profile.educations.grade')}
                value={editingItem.grade}
                onChange={(e) => setEditingItem({ ...editingItem, grade: e.target.value })}
                placeholder="1,3"
              />
            </div>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <TextField
                label={t('profile.educations.startDate')}
                value={editingItem.startDate}
                onChange={(e) => setEditingItem({ ...editingItem, startDate: e.target.value })}
                placeholder="YYYY-MM"
                required
              />
              {!editingItem.isCurrent && (
                <TextField
                  label={t('profile.educations.endDate')}
                  value={editingItem.endDate}
                  onChange={(e) => setEditingItem({ ...editingItem, endDate: e.target.value })}
                  placeholder="YYYY-MM"
                />
              )}
            </div>

            <div className="pt-1">
              <Toggle
                label={t('profile.educations.isCurrent')}
                checked={editingItem.isCurrent}
                onChange={(checked) => setEditingItem({ ...editingItem, isCurrent: checked })}
              />
            </div>

            <div>
              <label htmlFor="edu-desc" className="block text-sm font-medium text-ink">
                {t('profile.educations.description')}
              </label>
              <textarea
                id="edu-desc"
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
