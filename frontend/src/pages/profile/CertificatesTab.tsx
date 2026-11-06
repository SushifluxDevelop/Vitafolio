import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import type { FormEvent } from 'react'
import { useTranslation } from 'react-i18next'
import { profileApi } from '../../api/endpoints'
import type { Certificate, Profile } from '../../api/types'
import { Button } from '../../components/ui/Button'
import { useConfirm } from '../../components/ui/ConfirmDialog'
import { Dialog } from '../../components/ui/Dialog'
import { useErrorDialog } from '../../components/ui/ErrorDialog'
import { Icon } from '../../components/ui/Icon'
import { TextField } from '../../components/ui/TextField'

interface CertificateFormData {
  id?: string
  title: string
  issuer: string
  issueDate: string
  expiryDate: string
  credentialUrl: string
  credentialId: string
  sortOrder: number
}

const emptyForm: CertificateFormData = {
  title: '',
  issuer: '',
  issueDate: '',
  expiryDate: '',
  credentialUrl: '',
  credentialId: '',
  sortOrder: 0,
}

export function CertificatesTab({ profile }: { profile: Profile }) {
  const { t } = useTranslation()
  const queryClient = useQueryClient()
  const showError = useErrorDialog()
  const confirm = useConfirm()

  const [dialogOpen, setDialogOpen] = useState(false)
  const [editingItem, setEditingItem] = useState<CertificateFormData | null>(null)

  const saveMutation = useMutation({
    mutationFn: (data: CertificateFormData) => {
      const payload = {
        title: data.title,
        issuer: data.issuer || null,
        issueDate: data.issueDate || null,
        expiryDate: data.expiryDate || null,
        credentialUrl: data.credentialUrl || null,
        credentialId: data.credentialId || null,
        sortOrder: data.sortOrder,
      }
      return data.id ? profileApi.updateCertificate(data.id, payload) : profileApi.addCertificate(payload)
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['profile'] })
      setDialogOpen(false)
      setEditingItem(null)
    },
    onError: (err) => showError(err, t('common.saveFailed')),
  })

  const deleteMutation = useMutation({
    mutationFn: (id: string) => profileApi.deleteCertificate(id),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['profile'] })
    },
    onError: (err) => showError(err, t('common.deleteFailed')),
  })

  const handleDelete = async (cert: Certificate) => {
    const ok = await confirm({
      title: t('profile.certificates.delete'),
      message: t('profile.certificates.deleteConfirm'),
      confirmLabel: t('common.delete'),
      tone: 'danger',
    })
    if (ok) deleteMutation.mutate(cert.id)
  }

  const handleOpenAdd = () => {
    setEditingItem({ ...emptyForm, sortOrder: profile.certificates.length })
    setDialogOpen(true)
  }

  const handleOpenEdit = (cert: Certificate) => {
    setEditingItem({
      id: cert.id,
      title: cert.title,
      issuer: cert.issuer ?? '',
      issueDate: cert.issueDate ?? '',
      expiryDate: cert.expiryDate ?? '',
      credentialUrl: cert.credentialUrl ?? '',
      credentialId: cert.credentialId ?? '',
      sortOrder: cert.sortOrder,
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
          <h2 className="text-base font-semibold text-ink">{t('profile.certificates.title')}</h2>
          <p className="mt-1 text-sm text-ink-muted">{t('profile.certificates.subtitle')}</p>
        </div>
        <Button variant="create" icon="plus" onClick={handleOpenAdd}>
          {t('profile.certificates.add')}
        </Button>
      </div>

      {profile.certificates.length === 0 ? (
        <div className="card flex flex-col items-center justify-center p-12 text-center text-ink-muted">
          <Icon name="circleCheck" size={36} className="mb-3 text-ink-muted/50" />
          <p>{t('profile.certificates.empty')}</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          {profile.certificates.map((cert) => (
            <article key={cert.id} className="card flex flex-col justify-between p-5">
              <div>
                <h3 className="text-base font-semibold text-ink">{cert.title}</h3>
                {cert.issuer && <p className="mt-1 text-sm font-medium text-ink-muted">{cert.issuer}</p>}

                <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-xs text-ink-muted">
                  {cert.issueDate && <span>Ausgestellt: {cert.issueDate}</span>}
                  {cert.expiryDate && <span>Gültig bis: {cert.expiryDate}</span>}
                  {cert.credentialId && <span>ID: {cert.credentialId}</span>}
                </div>

                {cert.credentialUrl && (
                  <div className="mt-3">
                    <a
                      href={cert.credentialUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1.5 text-xs font-semibold text-indicator hover:underline"
                    >
                      <Icon name="world" size={14} />
                      {t('profile.certificates.credentialUrl')}
                    </a>
                  </div>
                )}
              </div>

              <div className="mt-4 flex justify-end gap-1.5 border-t border-line pt-3">
                <Button variant="secondary" small icon="pencil" onClick={() => handleOpenEdit(cert)}>
                  {t('profile.certificates.edit')}
                </Button>
                <Button variant="danger-outline" small icon="trash" onClick={() => void handleDelete(cert)}>
                  {t('profile.certificates.delete')}
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
        title={editingItem?.id ? t('profile.certificates.edit') : t('profile.certificates.add')}
        icon="circleCheck"
        size="md"
      >
        {editingItem && (
          <form onSubmit={handleSubmit} className="space-y-4">
            <TextField
              label={t('profile.certificates.certTitle')}
              value={editingItem.title}
              onChange={(e) => setEditingItem({ ...editingItem, title: e.target.value })}
              placeholder="z. B. AWS Certified Solutions Architect"
              required
            />

            <TextField
              label={t('profile.certificates.issuer')}
              value={editingItem.issuer}
              onChange={(e) => setEditingItem({ ...editingItem, issuer: e.target.value })}
              placeholder="z. B. Amazon Web Services, TÜV, IHK"
            />

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <TextField
                label={t('profile.certificates.issueDate')}
                value={editingItem.issueDate}
                onChange={(e) => setEditingItem({ ...editingItem, issueDate: e.target.value })}
                placeholder="YYYY-MM"
              />
              <TextField
                label={t('profile.certificates.expiryDate')}
                value={editingItem.expiryDate}
                onChange={(e) => setEditingItem({ ...editingItem, expiryDate: e.target.value })}
                placeholder="YYYY-MM"
              />
            </div>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <TextField
                label={t('profile.certificates.credentialUrl')}
                value={editingItem.credentialUrl}
                onChange={(e) => setEditingItem({ ...editingItem, credentialUrl: e.target.value })}
                placeholder="https://..."
              />
              <TextField
                label={t('profile.certificates.credentialId')}
                value={editingItem.credentialId}
                onChange={(e) => setEditingItem({ ...editingItem, credentialId: e.target.value })}
                placeholder="Zertifikats-ID"
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
