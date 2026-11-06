import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import type { FormEvent } from 'react'
import { useTranslation } from 'react-i18next'
import { profileApi } from '../../api/endpoints'
import type { Interest, Profile } from '../../api/types'
import { Button } from '../../components/ui/Button'
import { useConfirm } from '../../components/ui/ConfirmDialog'
import { Dialog } from '../../components/ui/Dialog'
import { useErrorDialog } from '../../components/ui/ErrorDialog'
import { Icon } from '../../components/ui/Icon'
import { TextField } from '../../components/ui/TextField'

interface InterestFormData {
  id?: string
  name: string
  category: string
  description: string
  sortOrder: number
}

const emptyForm: InterestFormData = {
  name: '',
  category: '',
  description: '',
  sortOrder: 0,
}

export function InterestsTab({ profile }: { profile: Profile }) {
  const { t } = useTranslation()
  const queryClient = useQueryClient()
  const showError = useErrorDialog()
  const confirm = useConfirm()

  const [dialogOpen, setDialogOpen] = useState(false)
  const [editingItem, setEditingItem] = useState<InterestFormData | null>(null)

  const saveMutation = useMutation({
    mutationFn: (data: InterestFormData) => {
      const payload = {
        name: data.name,
        category: data.category || null,
        description: data.description || null,
        sortOrder: data.sortOrder,
      }
      return data.id ? profileApi.updateInterest(data.id, payload) : profileApi.addInterest(payload)
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['profile'] })
      setDialogOpen(false)
      setEditingItem(null)
    },
    onError: (err) => showError(err, t('common.saveFailed')),
  })

  const deleteMutation = useMutation({
    mutationFn: (id: string) => profileApi.deleteInterest(id),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['profile'] })
    },
    onError: (err) => showError(err, t('common.deleteFailed')),
  })

  const handleDelete = async (interest: Interest) => {
    const ok = await confirm({
      title: t('profile.interests.delete'),
      message: t('profile.interests.deleteConfirm'),
      confirmLabel: t('common.delete'),
      tone: 'danger',
    })
    if (ok) deleteMutation.mutate(interest.id)
  }

  const handleOpenAdd = () => {
    setEditingItem({ ...emptyForm, sortOrder: profile.interests.length })
    setDialogOpen(true)
  }

  const handleOpenEdit = (int: Interest) => {
    setEditingItem({
      id: int.id,
      name: int.name,
      category: int.category ?? '',
      description: int.description ?? '',
      sortOrder: int.sortOrder,
    })
    setDialogOpen(true)
  }

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault()
    if (editingItem) saveMutation.mutate(editingItem)
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h2 className="text-base font-semibold text-ink">{t('profile.interests.title')}</h2>
          <p className="mt-1 text-sm text-ink-muted">{t('profile.interests.subtitle')}</p>
        </div>
        <Button variant="create" icon="plus" onClick={handleOpenAdd}>
          {t('profile.interests.add')}
        </Button>
      </div>

      {profile.interests.length === 0 ? (
        <div className="card flex flex-col items-center justify-center p-12 text-center text-ink-muted">
          <Icon name="sun" size={36} className="mb-3 text-ink-muted/50" />
          <p>{t('profile.interests.empty')}</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {profile.interests.map((int) => (
            <article key={int.id} className="card flex flex-col justify-between p-4">
              <div>
                <div className="flex items-start justify-between gap-2">
                  <h3 className="text-base font-semibold text-ink">{int.name}</h3>
                  {int.category && <span className="badge badge-select text-xs">{int.category}</span>}
                </div>
                {int.description && <p className="mt-2 text-sm text-ink-muted">{int.description}</p>}
              </div>

              <div className="mt-4 flex justify-end gap-1.5 border-t border-line pt-2">
                <Button variant="ghost" small icon="pencil" onClick={() => handleOpenEdit(int)}>
                  <span className="sr-only">{t('profile.interests.edit')}</span>
                </Button>
                <Button variant="danger-outline" small icon="trash" onClick={() => void handleDelete(int)}>
                  <span className="sr-only">{t('profile.interests.delete')}</span>
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
        title={editingItem?.id ? t('profile.interests.edit') : t('profile.interests.add')}
        icon="sun"
        size="sm"
      >
        {editingItem && (
          <form onSubmit={handleSubmit} className="space-y-4">
            <TextField
              label={t('profile.interests.name')}
              value={editingItem.name}
              onChange={(e) => setEditingItem({ ...editingItem, name: e.target.value })}
              placeholder="z. B. Fotografie, Freie Software, Wandern, Führerschein B"
              required
            />

            <TextField
              label={t('profile.interests.category')}
              value={editingItem.category}
              onChange={(e) => setEditingItem({ ...editingItem, category: e.target.value })}
              placeholder="z. B. Hobby, Ehrenamt, Sport, Führerschein"
            />

            <div>
              <label htmlFor="int-desc" className="block text-sm font-medium text-ink">
                {t('profile.interests.description')}
              </label>
              <textarea
                id="int-desc"
                rows={3}
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
