import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import type { FormEvent } from 'react'
import { useTranslation } from 'react-i18next'
import { profileApi } from '../../api/endpoints'
import type { CustomSection, CustomSectionItem, Profile } from '../../api/types'
import { Button } from '../../components/ui/Button'
import { useConfirm } from '../../components/ui/ConfirmDialog'
import { Dialog } from '../../components/ui/Dialog'
import { useErrorDialog } from '../../components/ui/ErrorDialog'
import { Icon } from '../../components/ui/Icon'
import { TextField } from '../../components/ui/TextField'

export function CustomSectionsTab({ profile }: { profile: Profile }) {
  const { t } = useTranslation()
  const queryClient = useQueryClient()
  const showError = useErrorDialog()
  const confirm = useConfirm()

  // Section dialogs
  const [sectionDialogOpen, setSectionDialogOpen] = useState(false)
  const [editingSection, setEditingSection] = useState<{ id?: string; title: string; sortOrder: number } | null>(null)

  // Item dialogs
  const [itemDialogOpen, setItemDialogOpen] = useState(false)
  const [itemSectionId, setItemSectionId] = useState<string | null>(null)
  const [editingItem, setEditingItem] = useState<{
    id?: string
    title: string
    subtitle: string
    dateRange: string
    description: string
    sortOrder: number
  } | null>(null)

  const saveSectionMutation = useMutation({
    mutationFn: (data: { id?: string; title: string; sortOrder: number }) =>
      data.id ? profileApi.updateCustomSection(data.id, data) : profileApi.addCustomSection(data),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['profile'] })
      setSectionDialogOpen(false)
      setEditingSection(null)
    },
    onError: (err) => showError(err, t('common.saveFailed')),
  })

  const deleteSectionMutation = useMutation({
    mutationFn: (id: string) => profileApi.deleteCustomSection(id),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['profile'] })
    },
    onError: (err) => showError(err, t('common.deleteFailed')),
  })

  const handleDeleteSection = async (sec: CustomSection) => {
    const ok = await confirm({
      title: t('profile.customSections.deleteSection'),
      message: 'Möchten Sie diesen Abschnitt und alle darin enthaltenen Einträge wirklich löschen?',
      confirmLabel: t('common.delete'),
      tone: 'danger',
    })
    if (ok) deleteSectionMutation.mutate(sec.id)
  }

  const saveItemMutation = useMutation({
    mutationFn: ({ sectionId, data }: { sectionId: string; data: { id?: string; title: string; subtitle?: string; dateRange?: string; description?: string; sortOrder: number } }) => {
      const payload = {
        title: data.title,
        subtitle: data.subtitle || null,
        dateRange: data.dateRange || null,
        description: data.description || null,
        sortOrder: data.sortOrder,
      }
      return data.id
        ? profileApi.updateCustomSectionItem(sectionId, data.id, payload)
        : profileApi.addCustomSectionItem(sectionId, payload)
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['profile'] })
      setItemDialogOpen(false)
      setEditingItem(null)
      setItemSectionId(null)
    },
    onError: (err) => showError(err, t('common.saveFailed')),
  })

  const deleteItemMutation = useMutation({
    mutationFn: ({ sectionId, itemId }: { sectionId: string; itemId: string }) =>
      profileApi.deleteCustomSectionItem(sectionId, itemId),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['profile'] })
    },
    onError: (err) => showError(err, t('common.deleteFailed')),
  })

  const handleDeleteItem = async (sectionId: string, item: CustomSectionItem) => {
    const ok = await confirm({
      title: t('profile.customSections.deleteItem'),
      message: 'Möchten Sie diesen Eintrag wirklich löschen?',
      confirmLabel: t('common.delete'),
      tone: 'danger',
    })
    if (ok) deleteItemMutation.mutate({ sectionId, itemId: item.id })
  }

  const handleOpenAddSection = () => {
    setEditingSection({ title: '', sortOrder: profile.customSections.length })
    setSectionDialogOpen(true)
  }

  const handleOpenEditSection = (sec: CustomSection) => {
    setEditingSection({ id: sec.id, title: sec.title, sortOrder: sec.sortOrder })
    setSectionDialogOpen(true)
  }

  const handleOpenAddItem = (sectionId: string, currentItemCount: number) => {
    setItemSectionId(sectionId)
    setEditingItem({
      title: '',
      subtitle: '',
      dateRange: '',
      description: '',
      sortOrder: currentItemCount,
    })
    setItemDialogOpen(true)
  }

  const handleOpenEditItem = (sectionId: string, item: CustomSectionItem) => {
    setItemSectionId(sectionId)
    setEditingItem({
      id: item.id,
      title: item.title,
      subtitle: item.subtitle ?? '',
      dateRange: item.dateRange ?? '',
      description: item.description ?? '',
      sortOrder: item.sortOrder,
    })
    setItemDialogOpen(true)
  }

  const handleSectionSubmit = (e: FormEvent) => {
    e.preventDefault()
    if (editingSection) saveSectionMutation.mutate(editingSection)
  }

  const handleItemSubmit = (e: FormEvent) => {
    e.preventDefault()
    if (editingItem && itemSectionId) {
      saveItemMutation.mutate({ sectionId: itemSectionId, data: editingItem })
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h2 className="text-base font-semibold text-ink">{t('profile.customSections.title')}</h2>
          <p className="mt-1 text-sm text-ink-muted">{t('profile.customSections.subtitle')}</p>
        </div>
        <Button variant="create" icon="plus" onClick={handleOpenAddSection}>
          {t('profile.customSections.addSection')}
        </Button>
      </div>

      {profile.customSections.length === 0 ? (
        <div className="card flex flex-col items-center justify-center p-12 text-center text-ink-muted">
          <Icon name="files" size={36} className="mb-3 text-ink-muted/50" />
          <p>{t('profile.customSections.empty')}</p>
        </div>
      ) : (
        <div className="space-y-6">
          {profile.customSections.map((sec) => (
            <section key={sec.id} className="card p-5" aria-label={sec.title}>
              <div className="mb-4 flex flex-wrap items-center justify-between gap-2 border-b border-line pb-3">
                <h3 className="text-base font-semibold text-ink">{sec.title}</h3>
                <div className="flex items-center gap-1.5">
                  <Button variant="create" small icon="plus" onClick={() => handleOpenAddItem(sec.id, sec.items.length)}>
                    {t('profile.customSections.addItem')}
                  </Button>
                  <Button variant="ghost" small icon="pencil" onClick={() => handleOpenEditSection(sec)}>
                    <span className="sr-only">{t('profile.customSections.editSection')}</span>
                  </Button>
                  <Button variant="danger-outline" small icon="trash" onClick={() => void handleDeleteSection(sec)}>
                    <span className="sr-only">{t('profile.customSections.deleteSection')}</span>
                  </Button>
                </div>
              </div>

              {sec.items.length === 0 ? (
                <p className="py-4 text-center text-xs text-ink-muted">Noch keine Einträge in diesem Abschnitt.</p>
              ) : (
                <div className="space-y-2">
                  {sec.items.map((item) => (
                    <div
                      key={item.id}
                      className="flex items-start justify-between gap-3 rounded-sm border border-line bg-surface-2 p-3"
                    >
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-baseline gap-2">
                          <p className="font-semibold text-ink">{item.title}</p>
                          {item.subtitle && <span className="text-xs text-ink-muted">({item.subtitle})</span>}
                          {item.dateRange && <span className="badge badge-select text-xs">{item.dateRange}</span>}
                        </div>
                        {item.description && <p className="mt-1 whitespace-pre-line text-sm text-ink">{item.description}</p>}
                      </div>

                      <div className="flex shrink-0 items-center gap-1">
                        <Button variant="ghost" small icon="pencil" onClick={() => handleOpenEditItem(sec.id, item)}>
                          <span className="sr-only">{t('profile.customSections.editItem')}</span>
                        </Button>
                        <Button
                          variant="danger-outline"
                          small
                          icon="trash"
                          onClick={() => void handleDeleteItem(sec.id, item)}
                        >
                          <span className="sr-only">{t('profile.customSections.deleteItem')}</span>
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </section>
          ))}
        </div>
      )}

      {/* Add / Edit Section Dialog */}
      <Dialog
        open={sectionDialogOpen}
        onClose={() => setSectionDialogOpen(false)}
        title={editingSection?.id ? t('profile.customSections.editSection') : t('profile.customSections.addSection')}
        icon="files"
        size="sm"
      >
        {editingSection && (
          <form onSubmit={handleSectionSubmit} className="space-y-4">
            <TextField
              label={t('profile.customSections.sectionTitle')}
              value={editingSection.title}
              onChange={(e) => setEditingSection({ ...editingSection, title: e.target.value })}
              placeholder="z. B. Publikationen, Patente, Auszeichnungen"
              required
            />
            <div className="flex justify-end gap-3 pt-3">
              <Button variant="secondary" onClick={() => setSectionDialogOpen(false)}>
                {t('common.cancel')}
              </Button>
              <Button type="submit" variant="confirm" busy={saveSectionMutation.isPending}>
                {t('common.save')}
              </Button>
            </div>
          </form>
        )}
      </Dialog>

      {/* Add / Edit Item Dialog */}
      <Dialog
        open={itemDialogOpen}
        onClose={() => setItemDialogOpen(false)}
        title={editingItem?.id ? t('profile.customSections.editItem') : t('profile.customSections.addItem')}
        icon="fileText"
        size="md"
      >
        {editingItem && (
          <form onSubmit={handleItemSubmit} className="space-y-4">
            <TextField
              label={t('profile.customSections.itemTitle')}
              value={editingItem.title}
              onChange={(e) => setEditingItem({ ...editingItem, title: e.target.value })}
              required
            />
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <TextField
                label={t('profile.customSections.itemSubtitle')}
                value={editingItem.subtitle}
                onChange={(e) => setEditingItem({ ...editingItem, subtitle: e.target.value })}
              />
              <TextField
                label={t('profile.customSections.itemDate')}
                value={editingItem.dateRange}
                onChange={(e) => setEditingItem({ ...editingItem, dateRange: e.target.value })}
                placeholder="z. B. 2024 oder 03/2023 – 09/2023"
              />
            </div>
            <div>
              <label htmlFor="custom-item-desc" className="block text-sm font-medium text-ink">
                {t('profile.customSections.itemDescription')}
              </label>
              <textarea
                id="custom-item-desc"
                rows={3}
                value={editingItem.description}
                onChange={(e) => setEditingItem({ ...editingItem, description: e.target.value })}
                className="input mt-1.5 w-full resize-y"
              />
            </div>
            <div className="flex justify-end gap-3 pt-3">
              <Button variant="secondary" onClick={() => setItemDialogOpen(false)}>
                {t('common.cancel')}
              </Button>
              <Button type="submit" variant="confirm" busy={saveItemMutation.isPending}>
                {t('common.save')}
              </Button>
            </div>
          </form>
        )}
      </Dialog>
    </div>
  )
}
