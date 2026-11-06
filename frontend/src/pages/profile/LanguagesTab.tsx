import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import type { FormEvent } from 'react'
import { useTranslation } from 'react-i18next'
import { profileApi } from '../../api/endpoints'
import type { LanguageSkill, Profile } from '../../api/types'
import { Button } from '../../components/ui/Button'
import { useConfirm } from '../../components/ui/ConfirmDialog'
import { Dialog } from '../../components/ui/Dialog'
import { useErrorDialog } from '../../components/ui/ErrorDialog'
import { Icon } from '../../components/ui/Icon'
import { TextField } from '../../components/ui/TextField'

interface LanguageFormData {
  id?: string
  language: string
  level: string
  sortOrder: number
}

const emptyForm: LanguageFormData = {
  language: '',
  level: 'B2',
  sortOrder: 0,
}

const STANDARD_LEVELS = ['native', 'C2', 'C1', 'B2', 'B1', 'A2', 'A1'] as const

export function LanguagesTab({ profile }: { profile: Profile }) {
  const { t } = useTranslation()
  const queryClient = useQueryClient()
  const showError = useErrorDialog()
  const confirm = useConfirm()

  const [dialogOpen, setDialogOpen] = useState(false)
  const [editingItem, setEditingItem] = useState<LanguageFormData | null>(null)

  const saveMutation = useMutation({
    mutationFn: (data: LanguageFormData) => {
      const payload = {
        language: data.language,
        level: data.level,
        sortOrder: data.sortOrder,
      }
      return data.id ? profileApi.updateLanguage(data.id, payload) : profileApi.addLanguage(payload)
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['profile'] })
      setDialogOpen(false)
      setEditingItem(null)
    },
    onError: (err) => showError(err, t('common.saveFailed')),
  })

  const deleteMutation = useMutation({
    mutationFn: (id: string) => profileApi.deleteLanguage(id),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['profile'] })
    },
    onError: (err) => showError(err, t('common.deleteFailed')),
  })

  const handleDelete = async (lang: LanguageSkill) => {
    const ok = await confirm({
      title: t('profile.languages.delete'),
      message: t('profile.languages.deleteConfirm'),
      confirmLabel: t('common.delete'),
      tone: 'danger',
    })
    if (ok) deleteMutation.mutate(lang.id)
  }

  const handleOpenAdd = () => {
    setEditingItem({ ...emptyForm, sortOrder: profile.languages.length })
    setDialogOpen(true)
  }

  const handleOpenEdit = (lang: LanguageSkill) => {
    setEditingItem({
      id: lang.id,
      language: lang.language,
      level: lang.level,
      sortOrder: lang.sortOrder,
    })
    setDialogOpen(true)
  }

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault()
    if (editingItem) saveMutation.mutate(editingItem)
  }

  const displayLevel = (lvl: string) => {
    const key = `profile.languages.levels.${lvl}`
    const translated = t(key)
    return translated !== key ? translated : lvl
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h2 className="text-base font-semibold text-ink">{t('profile.languages.title')}</h2>
          <p className="mt-1 text-sm text-ink-muted">{t('profile.languages.subtitle')}</p>
        </div>
        <Button variant="create" icon="plus" onClick={handleOpenAdd}>
          {t('profile.languages.add')}
        </Button>
      </div>

      {profile.languages.length === 0 ? (
        <div className="card flex flex-col items-center justify-center p-12 text-center text-ink-muted">
          <Icon name="language" size={36} className="mb-3 text-ink-muted/50" />
          <p>{t('profile.languages.empty')}</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {profile.languages.map((lang) => (
            <div key={lang.id} className="card flex items-center justify-between p-4">
              <div>
                <h3 className="text-base font-semibold text-ink">{lang.language}</h3>
                <span className="badge badge-select mt-1.5 inline-block text-xs font-semibold">
                  {displayLevel(lang.level)}
                </span>
              </div>

              <div className="flex shrink-0 items-center gap-1">
                <Button variant="ghost" small icon="pencil" onClick={() => handleOpenEdit(lang)}>
                  <span className="sr-only">{t('profile.languages.edit')}</span>
                </Button>
                <Button variant="danger-outline" small icon="trash" onClick={() => void handleDelete(lang)}>
                  <span className="sr-only">{t('profile.languages.delete')}</span>
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Add / Edit Dialog */}
      <Dialog
        open={dialogOpen}
        onClose={() => setDialogOpen(false)}
        title={editingItem?.id ? t('profile.languages.edit') : t('profile.languages.add')}
        icon="language"
        size="sm"
      >
        {editingItem && (
          <form onSubmit={handleSubmit} className="space-y-4">
            <TextField
              label={t('profile.languages.language')}
              value={editingItem.language}
              onChange={(e) => setEditingItem({ ...editingItem, language: e.target.value })}
              placeholder="z. B. Englisch, Spanisch, Französisch"
              required
            />

            <div>
              <label htmlFor="lang-level-select" className="block text-sm font-medium text-ink">
                {t('profile.languages.level')}
              </label>
              <select
                id="lang-level-select"
                value={editingItem.level}
                onChange={(e) => setEditingItem({ ...editingItem, level: e.target.value })}
                className="input mt-1.5 w-full"
              >
                {STANDARD_LEVELS.map((lvl) => (
                  <option key={lvl} value={lvl}>
                    {t(`profile.languages.levels.${lvl}`)}
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
