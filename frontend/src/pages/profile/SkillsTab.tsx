import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import type { FormEvent } from 'react'
import { useTranslation } from 'react-i18next'
import { profileApi } from '../../api/endpoints'
import type { Profile, Skill } from '../../api/types'
import { Button } from '../../components/ui/Button'
import { useConfirm } from '../../components/ui/ConfirmDialog'
import { Dialog } from '../../components/ui/Dialog'
import { useErrorDialog } from '../../components/ui/ErrorDialog'
import { Icon } from '../../components/ui/Icon'
import { TextField } from '../../components/ui/TextField'

interface SkillFormData {
  id?: string
  name: string
  category: string
  level: number
  sortOrder: number
}

const emptyForm: SkillFormData = {
  name: '',
  category: '',
  level: 3,
  sortOrder: 0,
}

export function SkillsTab({ profile }: { profile: Profile }) {
  const { t } = useTranslation()
  const queryClient = useQueryClient()
  const showError = useErrorDialog()
  const confirm = useConfirm()

  const [dialogOpen, setDialogOpen] = useState(false)
  const [editingItem, setEditingItem] = useState<SkillFormData | null>(null)

  const saveMutation = useMutation({
    mutationFn: (data: SkillFormData) => {
      const payload = {
        name: data.name,
        category: data.category || null,
        level: data.level,
        sortOrder: data.sortOrder,
      }
      return data.id ? profileApi.updateSkill(data.id, payload) : profileApi.addSkill(payload)
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['profile'] })
      setDialogOpen(false)
      setEditingItem(null)
    },
    onError: (err) => showError(err, t('common.saveFailed')),
  })

  const deleteMutation = useMutation({
    mutationFn: (id: string) => profileApi.deleteSkill(id),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['profile'] })
    },
    onError: (err) => showError(err, t('common.deleteFailed')),
  })

  const handleDelete = async (skill: Skill) => {
    const ok = await confirm({
      title: t('profile.skills.delete'),
      message: t('profile.skills.deleteConfirm'),
      confirmLabel: t('common.delete'),
      tone: 'danger',
    })
    if (ok) deleteMutation.mutate(skill.id)
  }

  const handleOpenAdd = (category = '') => {
    setEditingItem({ ...emptyForm, category, sortOrder: profile.skills.length })
    setDialogOpen(true)
  }

  const handleOpenEdit = (skill: Skill) => {
    setEditingItem({
      id: skill.id,
      name: skill.name,
      category: skill.category ?? '',
      level: skill.level,
      sortOrder: skill.sortOrder,
    })
    setDialogOpen(true)
  }

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault()
    if (editingItem) saveMutation.mutate(editingItem)
  }

  // Group skills by category
  const categories = Array.from(new Set(profile.skills.map((s) => s.category?.trim() || 'Allgemein')))

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h2 className="text-base font-semibold text-ink">{t('profile.skills.title')}</h2>
          <p className="mt-1 text-sm text-ink-muted">{t('profile.skills.subtitle')}</p>
        </div>
        <Button variant="create" icon="plus" onClick={() => handleOpenAdd()}>
          {t('profile.skills.add')}
        </Button>
      </div>

      {profile.skills.length === 0 ? (
        <div className="card flex flex-col items-center justify-center p-12 text-center text-ink-muted">
          <Icon name="sparkles" size={36} className="mb-3 text-ink-muted/50" />
          <p>{t('profile.skills.empty')}</p>
        </div>
      ) : (
        <div className="space-y-6">
          {categories.map((cat) => {
            const skillsInCat = profile.skills.filter((s) => (s.category?.trim() || 'Allgemein') === cat)
            return (
              <section key={cat} className="card p-5" aria-label={cat}>
                <div className="mb-3 flex items-center justify-between">
                  <h3 className="text-sm font-semibold text-ink">{cat}</h3>
                  <Button variant="ghost" small icon="plus" onClick={() => handleOpenAdd(cat === 'Allgemein' ? '' : cat)}>
                    {t('profile.skills.add')}
                  </Button>
                </div>

                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
                  {skillsInCat.map((skill) => (
                    <div
                      key={skill.id}
                      className="flex items-center justify-between rounded-sm border border-line bg-surface-2 p-3 transition-colors hover:border-indicator/50"
                    >
                      <div className="min-w-0 flex-1 pr-2">
                        <p className="truncate text-sm font-semibold text-ink">{skill.name}</p>
                        <div className="mt-1 flex items-center gap-1.5">
                          {skill.level > 0 ? (
                            <div className="flex gap-1" title={`${skill.level}/5`}>
                              {[1, 2, 3, 4, 5].map((lvl) => (
                                <span
                                  key={lvl}
                                  className={`h-1.5 w-4 rounded-xs ${lvl <= skill.level ? 'bg-indicator' : 'bg-line'}`}
                                />
                              ))}
                            </div>
                          ) : (
                            <span className="text-xs text-ink-muted">{t('profile.skills.noLevel')}</span>
                          )}
                        </div>
                      </div>

                      <div className="flex shrink-0 items-center gap-1">
                        <Button variant="ghost" small icon="pencil" onClick={() => handleOpenEdit(skill)}>
                          <span className="sr-only">{t('profile.skills.edit')}</span>
                        </Button>
                        <Button variant="danger-outline" small icon="trash" onClick={() => void handleDelete(skill)}>
                          <span className="sr-only">{t('profile.skills.delete')}</span>
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              </section>
            )
          })}
        </div>
      )}

      {/* Add / Edit Dialog */}
      <Dialog
        open={dialogOpen}
        onClose={() => setDialogOpen(false)}
        title={editingItem?.id ? t('profile.skills.edit') : t('profile.skills.add')}
        icon="sparkles"
        size="sm"
      >
        {editingItem && (
          <form onSubmit={handleSubmit} className="space-y-4">
            <TextField
              label={t('profile.skills.name')}
              value={editingItem.name}
              onChange={(e) => setEditingItem({ ...editingItem, name: e.target.value })}
              placeholder={t('profile.skills.namePlaceholder')}
              required
            />

            <TextField
              label={t('profile.skills.category')}
              value={editingItem.category}
              onChange={(e) => setEditingItem({ ...editingItem, category: e.target.value })}
              placeholder={t('profile.skills.categoryPlaceholder')}
            />

            <div>
              <label htmlFor="skill-level-select" className="block text-sm font-medium text-ink">
                {t('profile.skills.level')}
              </label>
              <select
                id="skill-level-select"
                value={editingItem.level}
                onChange={(e) => setEditingItem({ ...editingItem, level: Number(e.target.value) })}
                className="input mt-1.5 w-full"
              >
                {[0, 1, 2, 3, 4, 5].map((lvl) => (
                  <option key={lvl} value={lvl}>
                    {t(`profile.skills.levelLabels.${lvl}`)}
                  </option>
                ))}
              </select>
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
