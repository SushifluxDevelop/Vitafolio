import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import type { ChangeEvent, FormEvent } from 'react'
import { useTranslation } from 'react-i18next'
import { profileApi } from '../../api/endpoints'
import type { PersonalDataPayload, Profile } from '../../api/types'
import { Button } from '../../components/ui/Button'
import { useErrorDialog } from '../../components/ui/ErrorDialog'
import { Icon } from '../../components/ui/Icon'
import { Notice } from '../../components/ui/Notice'
import { TextField } from '../../components/ui/TextField'

export function PersonalTab({ profile }: { profile: Profile }) {
  const { t } = useTranslation()
  const queryClient = useQueryClient()
  const showError = useErrorDialog()
  const [success, setSuccess] = useState(false)

  const [form, setForm] = useState<PersonalDataPayload>({
    firstName: profile.firstName ?? '',
    lastName: profile.lastName ?? '',
    academicTitle: profile.academicTitle ?? '',
    professionalTitle: profile.professionalTitle ?? '',
    email: profile.email ?? '',
    phone: profile.phone ?? '',
    street: profile.street ?? '',
    postalCode: profile.postalCode ?? '',
    city: profile.city ?? '',
    country: profile.country ?? '',
    dateOfBirth: profile.dateOfBirth ?? '',
    placeOfBirth: profile.placeOfBirth ?? '',
    nationality: profile.nationality ?? '',
    maritalStatus: profile.maritalStatus ?? '',
    website: profile.website ?? '',
    linkedIn: profile.linkedIn ?? '',
    gitHub: profile.gitHub ?? '',
    xing: profile.xing ?? '',
    bio: profile.bio ?? '',
  })

  const updateMutation = useMutation({
    mutationFn: profileApi.update,
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['profile'] })
      setSuccess(true)
      setTimeout(() => setSuccess(false), 4000)
    },
    onError: (err) => showError(err, t('common.saveFailed')),
  })

  const uploadPhotoMutation = useMutation({
    mutationFn: profileApi.uploadPhoto,
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['profile'] })
    },
    onError: (err) => showError(err, t('profile.personal.photoUpload')),
  })

  const deletePhotoMutation = useMutation({
    mutationFn: profileApi.deletePhoto,
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['profile'] })
    },
    onError: (err) => showError(err, t('profile.personal.photoDelete')),
  })

  const handlePhotoSelect = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) {
      uploadPhotoMutation.mutate(file)
    }
  }

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault()
    updateMutation.mutate(form)
  }

  const initials = `${form.firstName.slice(0, 1)}${form.lastName.slice(0, 1)}`.toUpperCase() || '?'

  return (
    <div className="space-y-6">
      {/* Photo card */}
      <section className="card p-5" aria-labelledby="heading-photo">
        <h2 id="heading-photo" className="text-base font-semibold text-ink">
          {t('profile.personal.photo')}
        </h2>
        <p className="mt-1 text-sm text-ink-muted">{t('profile.personal.photoHint')}</p>

        <div className="mt-4 flex flex-wrap items-center gap-6">
          <div className="relative flex h-24 w-24 shrink-0 items-center justify-center overflow-hidden rounded-full border border-line bg-surface-2 shadow-sm">
            {profile.hasPhoto ? (
              <img
                src={`/api/profile/photo?v=${profile.updatedAt}`}
                alt={`${form.firstName} ${form.lastName}`}
                className="h-full w-full object-cover"
              />
            ) : (
              <span className="text-2xl font-bold text-select-ink">{initials}</span>
            )}
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <label className="btn btn-secondary cursor-pointer">
              <span className="inline-flex items-center gap-2">
                <Icon name="upload" size={17} />
                {profile.hasPhoto ? t('profile.personal.photoChange') : t('profile.personal.photoUpload')}
              </span>
              <input
                type="file"
                accept="image/jpeg,image/png,image/webp"
                className="sr-only"
                onChange={handlePhotoSelect}
                disabled={uploadPhotoMutation.isPending}
              />
            </label>

            {profile.hasPhoto && (
              <Button
                variant="danger-outline"
                icon="trash"
                busy={deletePhotoMutation.isPending}
                onClick={() => deletePhotoMutation.mutate()}
              >
                {t('profile.personal.photoDelete')}
              </Button>
            )}
          </div>
        </div>
      </section>

      {/* Main personal data form */}
      <form onSubmit={handleSubmit} className="card space-y-6 p-6">
        <div>
          <h2 className="text-base font-semibold text-ink">{t('profile.personal.title')}</h2>
          <p className="mt-1 text-sm text-ink-muted">{t('profile.personal.subtitle')}</p>
        </div>

        {success && <Notice tone="success">{t('profile.personal.saveSuccess')}</Notice>}

        {/* Name details */}
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <TextField
            label={t('profile.personal.academicTitle')}
            value={form.academicTitle ?? ''}
            onChange={(e) => setForm({ ...form, academicTitle: e.target.value })}
            placeholder="Dr. / Prof."
          />
          <TextField
            label={t('profile.personal.firstName')}
            value={form.firstName}
            onChange={(e) => setForm({ ...form, firstName: e.target.value })}
            required
          />
          <TextField
            label={t('profile.personal.lastName')}
            value={form.lastName}
            onChange={(e) => setForm({ ...form, lastName: e.target.value })}
            required
          />
          <TextField
            label={t('profile.personal.professionalTitle')}
            value={form.professionalTitle ?? ''}
            onChange={(e) => setForm({ ...form, professionalTitle: e.target.value })}
            placeholder="Software Architect"
          />
        </div>

        {/* Contact details */}
        <div className="border-t border-line pt-4">
          <h3 className="mb-3 text-sm font-semibold text-ink">{t('profile.personal.email')} &amp; Anschrift</h3>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <TextField
              label={t('profile.personal.email')}
              type="email"
              value={form.email ?? ''}
              onChange={(e) => setForm({ ...form, email: e.target.value })}
            />
            <TextField
              label={t('profile.personal.phone')}
              type="tel"
              value={form.phone ?? ''}
              onChange={(e) => setForm({ ...form, phone: e.target.value })}
            />
            <TextField
              label={t('profile.personal.street')}
              value={form.street ?? ''}
              onChange={(e) => setForm({ ...form, street: e.target.value })}
            />
            <div className="grid grid-cols-3 gap-2">
              <TextField
                label={t('profile.personal.postalCode')}
                value={form.postalCode ?? ''}
                onChange={(e) => setForm({ ...form, postalCode: e.target.value })}
                className="col-span-1"
              />
              <TextField
                label={t('profile.personal.city')}
                value={form.city ?? ''}
                onChange={(e) => setForm({ ...form, city: e.target.value })}
                className="col-span-2"
              />
            </div>
            <TextField
              label={t('profile.personal.country')}
              value={form.country ?? ''}
              onChange={(e) => setForm({ ...form, country: e.target.value })}
            />
            <TextField
              label={t('profile.personal.nationality')}
              value={form.nationality ?? ''}
              onChange={(e) => setForm({ ...form, nationality: e.target.value })}
            />
          </div>
        </div>

        {/* Birth & Family */}
        <div className="border-t border-line pt-4">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <TextField
              label={t('profile.personal.dateOfBirth')}
              value={form.dateOfBirth ?? ''}
              onChange={(e) => setForm({ ...form, dateOfBirth: e.target.value })}
              placeholder="YYYY-MM-DD"
            />
            <TextField
              label={t('profile.personal.placeOfBirth')}
              value={form.placeOfBirth ?? ''}
              onChange={(e) => setForm({ ...form, placeOfBirth: e.target.value })}
            />
            <TextField
              label={t('profile.personal.maritalStatus')}
              value={form.maritalStatus ?? ''}
              onChange={(e) => setForm({ ...form, maritalStatus: e.target.value })}
            />
          </div>
        </div>

        {/* Web & Social Links */}
        <div className="border-t border-line pt-4">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <TextField
              label={t('profile.personal.website')}
              value={form.website ?? ''}
              onChange={(e) => setForm({ ...form, website: e.target.value })}
              placeholder="https://..."
            />
            <TextField
              label={t('profile.personal.linkedIn')}
              value={form.linkedIn ?? ''}
              onChange={(e) => setForm({ ...form, linkedIn: e.target.value })}
              placeholder="https://linkedin.com/in/..."
            />
            <TextField
              label={t('profile.personal.gitHub')}
              value={form.gitHub ?? ''}
              onChange={(e) => setForm({ ...form, gitHub: e.target.value })}
              placeholder="https://github.com/..."
            />
            <TextField
              label={t('profile.personal.xing')}
              value={form.xing ?? ''}
              onChange={(e) => setForm({ ...form, xing: e.target.value })}
              placeholder="https://xing.com/profile/..."
            />
          </div>
        </div>

        {/* Bio / Kurzprofil */}
        <div className="border-t border-line pt-4">
          <label htmlFor="bio-input" className="block text-sm font-medium text-ink">
            {t('profile.personal.bio')}
          </label>
          <p className="mt-1 text-xs text-ink-muted">{t('profile.personal.bioHint')}</p>
          <textarea
            id="bio-input"
            rows={4}
            value={form.bio ?? ''}
            onChange={(e) => setForm({ ...form, bio: e.target.value })}
            className="input mt-2 w-full resize-y"
          />
        </div>

        <div className="flex justify-end pt-2">
          <Button type="submit" variant="confirm" busy={updateMutation.isPending} icon="deviceFloppy">
            {t('common.save')}
          </Button>
        </div>
      </form>
    </div>
  )
}

