// Copyright (c) 2026 SushiFlux Develop
// Licensed under the AGPL-3.0-only.

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useState, useMemo, useEffect, useRef } from 'react'
import { useTranslation } from 'react-i18next'
import { applicationsApi, coverLettersApi, attachmentsApi } from '../../api/endpoints'
import type {
  Application,
  ApplicationListItem,
  ApplicationPayload,
  ApplicationStatus,
  ApplicationStatusUpdatePayload,
  ApplicationEventPayload,
} from '../../api/types'
import { Button } from '../../components/ui/Button'
import { useConfirm } from '../../components/ui/ConfirmDialog'
import { Dialog } from '../../components/ui/Dialog'
import { Icon } from '../../components/ui/Icon'
import { AiAssistantModal } from '../../components/ai/AiAssistantModal'
import { AttachmentsModal } from './AttachmentsModal'
import { formatDate, formatDateTime } from '../../format'

const STATUS_ORDER: ApplicationStatus[] = [
  'draft',
  'applied',
  'acknowledged',
  'interview',
  'offer',
  'rejected',
  'withdrawn',
]

const STATUS_STYLES: Record<ApplicationStatus, { bg: string; text: string; border: string }> = {
  draft: { bg: 'bg-surface-2', text: 'text-ink-muted', border: 'border-line' },
  applied: { bg: 'bg-sky-500/10', text: 'text-sky-600 dark:text-sky-400', border: 'border-sky-500/30' },
  acknowledged: { bg: 'bg-indigo-500/10', text: 'text-indigo-600 dark:text-indigo-400', border: 'border-indigo-500/30' },
  interview: { bg: 'bg-purple-500/10', text: 'text-purple-600 dark:text-purple-400', border: 'border-purple-500/30' },
  offer: { bg: 'bg-emerald-500/10', text: 'text-emerald-600 dark:text-emerald-400', border: 'border-emerald-500/30' },
  rejected: { bg: 'bg-rose-500/10', text: 'text-rose-600 dark:text-rose-400', border: 'border-rose-500/30' },
  withdrawn: { bg: 'bg-slate-500/10', text: 'text-slate-600 dark:text-slate-400', border: 'border-slate-500/30' },
}

interface KanbanColumnMap {
  draft: ApplicationListItem[]
  applied: ApplicationListItem[]
  acknowledged: ApplicationListItem[]
  interview: ApplicationListItem[]
  offer: ApplicationListItem[]
  closed: ApplicationListItem[]
}

export function ApplicationsPage() {
  const { t, i18n } = useTranslation()
  const queryClient = useQueryClient()
  const confirm = useConfirm()

  const [viewMode, setViewMode] = useState<'kanban' | 'list'>('kanban')
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState<string>('all')
  const [onlyFollowUpDue, setOnlyFollowUpDue] = useState(false)

  // Modals state
  const [isCreateOpen, setIsCreateOpen] = useState(false)
  const [isAttachmentsOpen, setIsAttachmentsOpen] = useState(false)
  const [selectedAppId, setSelectedAppId] = useState<string | null>(null)
  const [detailsTab, setDetailsTab] = useState<'details' | 'timeline' | 'dossier'>('details')
  const [previewBlobUrl, setPreviewBlobUrl] = useState<string | null>(null)
  const [previewTitle, setPreviewTitle] = useState<string>('')

  // Queries
  const { data: applications = [], isLoading: isListLoading } = useQuery({
    queryKey: ['applications', statusFilter, search],
    queryFn: () => applicationsApi.list({ status: statusFilter === 'all' ? undefined : statusFilter, search: search.trim() || undefined }),
  })

  const { data: stats } = useQuery({
    queryKey: ['applications', 'stats'],
    queryFn: applicationsApi.stats,
  })

  const { data: coverLetters = [] } = useQuery({
    queryKey: ['coverLetters'],
    queryFn: coverLettersApi.list,
  })

  const { data: activeApp } = useQuery({
    queryKey: ['applications', selectedAppId],
    queryFn: () => (selectedAppId ? applicationsApi.get(selectedAppId) : null),
    enabled: Boolean(selectedAppId),
  })

  // Cleanup blob URL
  const previewUrlRef = useRef<string | null>(null)
  useEffect(() => {
    previewUrlRef.current = previewBlobUrl
    return () => {
      if (previewUrlRef.current) {
        URL.revokeObjectURL(previewUrlRef.current)
      }
    }
  }, [previewBlobUrl])

  // Filtered applications list
  const filteredApps = useMemo(() => {
    if (!onlyFollowUpDue) return applications
    return applications.filter((a) => a.isFollowUpDue)
  }, [applications, onlyFollowUpDue])

  // Grouped for Kanban columns
  const kanbanColumns = useMemo<KanbanColumnMap>(() => {
    const cols: KanbanColumnMap = {
      draft: [],
      applied: [],
      acknowledged: [],
      interview: [],
      offer: [],
      closed: [],
    }

    for (const app of filteredApps) {
      if (app.status === 'rejected' || app.status === 'withdrawn') {
        cols.closed.push(app)
      } else if (app.status in cols) {
        cols[app.status as keyof Omit<KanbanColumnMap, 'closed'>].push(app)
      } else {
        cols.draft.push(app)
      }
    }

    return cols
  }, [filteredApps])

  // Mutations
  const createMutation = useMutation({
    mutationFn: (payload: ApplicationPayload) => applicationsApi.create(payload),
    onSuccess: (newApp) => {
      void queryClient.invalidateQueries({ queryKey: ['applications'] })
      setIsCreateOpen(false)
      setSelectedAppId(newApp.id)
    },
  })

  const updateStatusMutation = useMutation({
    mutationFn: ({ id, payload }: { id: string; payload: ApplicationStatusUpdatePayload }) =>
      applicationsApi.updateStatus(id, payload),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['applications'] })
    },
  })

  const deleteMutation = useMutation({
    mutationFn: (id: string) => applicationsApi.delete(id),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['applications'] })
      setSelectedAppId(null)
    },
  })

  const addEventMutation = useMutation({
    mutationFn: ({ id, payload }: { id: string; payload: ApplicationEventPayload }) =>
      applicationsApi.addEvent(id, payload),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['applications'] })
    },
  })

  const deleteEventMutation = useMutation({
    mutationFn: ({ appId, eventId }: { appId: string; eventId: string }) =>
      applicationsApi.deleteEvent(appId, eventId),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['applications'] })
    },
  })

  const archiveSnapshotMutation = useMutation({
    mutationFn: (id: string) => applicationsApi.archiveSnapshot(id),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['applications'] })
    },
  })

  // Handlers
  const handleOpenPreview = async (appId: string, company: string, jobTitle: string) => {
    try {
      setPreviewTitle(`${company} – ${jobTitle}`)
      const blob = await applicationsApi.getPreviewPdf(appId)
      if (previewUrlRef.current) URL.revokeObjectURL(previewUrlRef.current)
      const url = URL.createObjectURL(blob)
      setPreviewBlobUrl(url)
    } catch {
      // preview error handled silently
    }
  }

  const handleDownloadDossier = async (appId: string) => {
    try {
      const { blob, filename } = await applicationsApi.downloadDossier(appId)
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = filename
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      URL.revokeObjectURL(url)
    } catch {
      // error handled
    }
  }

  const handleDeleteApplication = async (app: ApplicationListItem | Application) => {
    const ok = await confirm({
      title: t('applications.actions.delete'),
      message: t('applications.deleteConfirm', { company: app.company, jobTitle: app.jobTitle }),
      confirmLabel: t('applications.actions.delete'),
      tone: 'danger',
    })
    if (ok) {
      deleteMutation.mutate(app.id)
    }
  }

  return (
    <div className="flex flex-col gap-6 p-6">
      {/* Top Header */}
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-ink">{t('applications.title')}</h1>
          <p className="mt-1 text-sm text-ink-muted">{t('applications.subtitle')}</p>
        </div>
        <div className="flex items-center gap-3">
          <Button variant="secondary" icon="files" onClick={() => setIsAttachmentsOpen(true)}>
            Anlagen & Zeugnisse
          </Button>
          <Button variant="create" icon="plus" onClick={() => setIsCreateOpen(true)}>
            {t('applications.newApplication')}
          </Button>
        </div>
      </div>

      {/* Follow-up alert banner if applications are overdue */}
      {stats && stats.followUpsDue > 0 && (
        <div className="flex items-center justify-between rounded-lg border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-amber-900 dark:text-amber-200">
          <div className="flex items-center gap-3">
            <Icon name="clock" size={20} className="shrink-0 text-amber-600 dark:text-amber-400" />
            <span className="text-sm font-semibold">
              {t('applications.followUpAlert', { count: stats.followUpsDue })}
            </span>
          </div>
          <button
            type="button"
            onClick={() => setOnlyFollowUpDue(!onlyFollowUpDue)}
            className="rounded px-2.5 py-1 text-xs font-semibold uppercase tracking-wider text-amber-800 transition-colors hover:bg-amber-500/20 dark:text-amber-100"
          >
            {onlyFollowUpDue ? t('applications.filter.all') : t('applications.stats.followUpsDue')}
          </button>
        </div>
      )}

      {/* Metrics Summary Strip */}
      {stats && (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-7">
          <MetricCard label={t('applications.stats.total')} count={stats.total} />
          <MetricCard label={t('applications.stats.draft')} count={stats.draft} />
          <MetricCard label={t('applications.stats.applied')} count={stats.applied} highlight="sky" />
          <MetricCard label={t('applications.stats.interview')} count={stats.interview} highlight="purple" />
          <MetricCard label={t('applications.stats.offer')} count={stats.offer} highlight="emerald" />
          <MetricCard label={t('applications.stats.rejected')} count={stats.rejected + stats.withdrawn} />
          <MetricCard
            label={t('applications.stats.followUpsDue')}
            count={stats.followUpsDue}
            highlight={stats.followUpsDue > 0 ? 'amber' : undefined}
          />
        </div>
      )}

      {/* Filters & View Switcher */}
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-line bg-surface p-3">
        <div className="flex flex-1 flex-wrap items-center gap-3">
          <div className="relative min-w-[240px] flex-1 max-w-md">
            <Icon name="world" size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-muted" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder={t('applications.filter.searchPlaceholder')}
              className="w-full rounded border border-line bg-surface-2 py-1.5 pl-9 pr-3 text-sm text-ink placeholder:text-ink-muted focus:border-indicator focus:outline-none"
            />
          </div>

          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="rounded border border-line bg-surface-2 px-3 py-1.5 text-sm text-ink focus:border-indicator focus:outline-none"
          >
            <option value="all">{t('applications.filter.all')}</option>
            {STATUS_ORDER.map((st) => (
              <option key={st} value={st}>
                {t(`applications.statuses.${st}`)}
              </option>
            ))}
          </select>
        </div>

        <div className="flex items-center gap-1 rounded border border-line bg-surface-2 p-0.5">
          <button
            type="button"
            onClick={() => setViewMode('kanban')}
            className={`flex items-center gap-1.5 rounded px-3 py-1 text-xs font-semibold transition-colors ${
              viewMode === 'kanban' ? 'bg-surface text-ink shadow-sm' : 'text-ink-muted hover:text-ink'
            }`}
          >
            <Icon name="layoutBoard" size={14} />
            {t('applications.views.kanban')}
          </button>
          <button
            type="button"
            onClick={() => setViewMode('list')}
            className={`flex items-center gap-1.5 rounded px-3 py-1 text-xs font-semibold transition-colors ${
              viewMode === 'list' ? 'bg-surface text-ink shadow-sm' : 'text-ink-muted hover:text-ink'
            }`}
          >
            <Icon name="fileText" size={14} />
            {t('applications.views.list')}
          </button>
        </div>
      </div>

      {/* Main Content Area */}
      {isListLoading ? (
        <div className="flex h-64 items-center justify-center">
          <Icon name="loader" size={28} className="animate-spin text-ink-muted" />
        </div>
      ) : filteredApps.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-lg border border-dashed border-line bg-surface p-12 text-center">
          <div className="mb-3 rounded-full bg-surface-2 p-3 text-ink-muted">
            <Icon name="briefcase" size={32} />
          </div>
          <h3 className="text-base font-semibold text-ink">{t('applications.empty')}</h3>
          <p className="mt-1 text-sm text-ink-muted">{t('applications.noResults')}</p>
          <Button variant="create" icon="plus" className="mt-4" onClick={() => setIsCreateOpen(true)}>
            {t('applications.newApplication')}
          </Button>
        </div>
      ) : viewMode === 'kanban' ? (
        /* KANBAN BOARD VIEW */
        <div className="grid grid-cols-1 gap-4 overflow-x-auto pb-4 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
          <KanbanColumn
            title={t('applications.statuses.draft')}
            count={kanbanColumns.draft.length}
            apps={kanbanColumns.draft}
            onSelect={(id) => setSelectedAppId(id)}
            onDownload={handleDownloadDossier}
            onPreview={handleOpenPreview}
          />
          <KanbanColumn
            title={t('applications.statuses.applied')}
            count={kanbanColumns.applied.length}
            apps={kanbanColumns.applied}
            onSelect={(id) => setSelectedAppId(id)}
            onDownload={handleDownloadDossier}
            onPreview={handleOpenPreview}
          />
          <KanbanColumn
            title={t('applications.statuses.acknowledged')}
            count={kanbanColumns.acknowledged.length}
            apps={kanbanColumns.acknowledged}
            onSelect={(id) => setSelectedAppId(id)}
            onDownload={handleDownloadDossier}
            onPreview={handleOpenPreview}
          />
          <KanbanColumn
            title={t('applications.statuses.interview')}
            count={kanbanColumns.interview.length}
            apps={kanbanColumns.interview}
            onSelect={(id) => setSelectedAppId(id)}
            onDownload={handleDownloadDossier}
            onPreview={handleOpenPreview}
          />
          <KanbanColumn
            title={t('applications.statuses.offer')}
            count={kanbanColumns.offer.length}
            apps={kanbanColumns.offer}
            onSelect={(id) => setSelectedAppId(id)}
            onDownload={handleDownloadDossier}
            onPreview={handleOpenPreview}
          />
          <KanbanColumn
            title={t('applications.statuses.rejected')}
            count={kanbanColumns.closed.length}
            apps={kanbanColumns.closed}
            onSelect={(id) => setSelectedAppId(id)}
            onDownload={handleDownloadDossier}
            onPreview={handleOpenPreview}
          />
        </div>
      ) : (
        /* TABLE LIST VIEW */
        <div className="overflow-x-auto rounded-lg border border-line bg-surface">
          <table className="w-full text-left text-sm text-ink">
            <thead className="border-b border-line bg-surface-2 text-xs font-semibold text-ink-muted uppercase">
              <tr>
                <th className="px-4 py-3">{t('applications.fields.jobTitle')} / {t('applications.fields.company')}</th>
                <th className="px-4 py-3">{t('applications.fields.location')}</th>
                <th className="px-4 py-3">{t('applications.fields.status')}</th>
                <th className="px-4 py-3">{t('applications.fields.appliedAt')}</th>
                <th className="px-4 py-3">{t('applications.fields.coverLetter')}</th>
                <th className="px-4 py-3 text-right">{t('common.actions', 'Aktionen')}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {filteredApps.map((app) => (
                <tr key={app.id} className="hover:bg-surface-2/60 transition-colors">
                  <td className="px-4 py-3">
                    <button
                      type="button"
                      onClick={() => setSelectedAppId(app.id)}
                      className="text-left font-semibold text-ink hover:text-select-ink transition-colors"
                    >
                      <div className="flex items-center gap-2">
                        {app.jobTitle}
                        {app.isFollowUpDue && (
                          <span
                            className="inline-flex items-center gap-1 rounded bg-amber-500/10 px-1.5 py-0.5 text-xs font-bold text-amber-600 dark:text-amber-400"
                            title={t('applications.stats.followUpsDue')}
                          >
                            <Icon name="clock" size={12} />
                            {t('applications.stats.followUpsDue')}
                          </span>
                        )}
                      </div>
                      <div className="text-xs text-ink-muted">{app.company}</div>
                    </button>
                  </td>
                  <td className="px-4 py-3 text-sm text-ink-muted">{app.location || '—'}</td>
                  <td className="px-4 py-3">
                    <span
                      className={`inline-block rounded border px-2 py-0.5 text-xs font-semibold ${
                        STATUS_STYLES[app.status]?.bg ?? 'bg-surface-2'
                      } ${STATUS_STYLES[app.status]?.text ?? 'text-ink'} ${
                        STATUS_STYLES[app.status]?.border ?? 'border-line'
                      }`}
                    >
                      {t(`applications.statuses.${app.status}`)}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-sm text-ink-muted">
                    {app.appliedAt ? formatDate(app.appliedAt, i18n.language) : '—'}
                  </td>
                  <td className="px-4 py-3 text-sm text-ink-muted">
                    {app.coverLetterTitle ? (
                      <span className="inline-flex items-center gap-1.5">
                        <Icon name="files" size={14} />
                        {app.coverLetterTitle}
                      </span>
                    ) : (
                      '—'
                    )}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <div className="flex items-center justify-end gap-2">
                      <button
                        type="button"
                        onClick={() => handleDownloadDossier(app.id)}
                        title={t('applications.actions.downloadDossier')}
                        className="rounded p-1.5 text-ink-muted hover:bg-surface-2 hover:text-ink transition-colors"
                      >
                        <Icon name="download" size={16} />
                      </button>
                      <button
                        type="button"
                        onClick={() => setSelectedAppId(app.id)}
                        title={t('applications.actions.viewDetails')}
                        className="rounded p-1.5 text-ink-muted hover:bg-surface-2 hover:text-ink transition-colors"
                      >
                        <Icon name="pencil" size={16} />
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDeleteApplication(app)}
                        title={t('applications.actions.delete')}
                        className="rounded p-1.5 text-ink-muted hover:bg-surface-2 hover:text-rose-600 transition-colors"
                      >
                        <Icon name="trash" size={16} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* CREATE APPLICATION MODAL */}
      <CreateApplicationDialog
        open={isCreateOpen}
        onClose={() => setIsCreateOpen(false)}
        coverLetters={coverLetters}
        isPending={createMutation.isPending}
        onSubmit={(payload) => createMutation.mutate(payload)}
      />

      {/* ATTACHMENTS & CERTIFICATES MODAL */}
      <AttachmentsModal
        open={isAttachmentsOpen}
        onClose={() => setIsAttachmentsOpen(false)}
      />

      {/* APPLICATION DETAILS & TIMELINE DRAWER/MODAL */}
      {selectedAppId && activeApp && (
        <ApplicationDetailsDialog
          app={activeApp}
          activeTab={detailsTab}
          onTabChange={setDetailsTab}
          onClose={() => setSelectedAppId(null)}
          onStatusChange={(status) => updateStatusMutation.mutate({ id: activeApp.id, payload: { status } })}
          onAddEvent={(payload) => addEventMutation.mutate({ id: activeApp.id, payload })}
          onDeleteEvent={(eventId) => deleteEventMutation.mutate({ appId: activeApp.id, eventId })}
          onArchiveSnapshot={() => archiveSnapshotMutation.mutate(activeApp.id)}
          onDownloadDossier={() => handleDownloadDossier(activeApp.id)}
          onPreviewDossier={() => handleOpenPreview(activeApp.id, activeApp.company, activeApp.jobTitle)}
          onDelete={() => handleDeleteApplication(activeApp)}
        />
      )}

      {/* DOSSIER PDF LIVE PREVIEW MODAL */}
      <Dialog
        open={Boolean(previewBlobUrl)}
        onClose={() => setPreviewBlobUrl(null)}
        title={previewTitle || t('applications.dossier.preview')}
        size="lg"
        footer={
          <div className="flex justify-end gap-2">
            <Button variant="secondary" onClick={() => setPreviewBlobUrl(null)}>
              {t('common.close', 'Schließen')}
            </Button>
            {selectedAppId && (
              <Button variant="confirm" icon="download" onClick={() => handleDownloadDossier(selectedAppId)}>
                {t('applications.dossier.download')}
              </Button>
            )}
          </div>
        }
      >
        <div className="h-[75vh] w-full bg-slate-900 rounded overflow-hidden">
          {previewBlobUrl && (
            <iframe
              src={previewBlobUrl}
              title="Dossier PDF Preview"
              className="w-full h-full border-none"
            />
          )}
        </div>
      </Dialog>
    </div>
  )
}

function MetricCard({
  label,
  count,
  highlight,
}: {
  label: string
  count: number
  highlight?: 'sky' | 'purple' | 'emerald' | 'amber'
}) {
  const highlightClass =
    highlight === 'sky'
      ? 'border-sky-500/40 text-sky-600 dark:text-sky-400'
      : highlight === 'purple'
      ? 'border-purple-500/40 text-purple-600 dark:text-purple-400'
      : highlight === 'emerald'
      ? 'border-emerald-500/40 text-emerald-600 dark:text-emerald-400'
      : highlight === 'amber'
      ? 'border-amber-500/40 text-amber-600 dark:text-amber-400 bg-amber-500/5'
      : 'text-ink'

  return (
    <div className={`flex flex-col rounded-lg border border-line bg-surface p-3 ${highlightClass}`}>
      <span className="text-xs font-semibold text-ink-muted uppercase tracking-wider">{label}</span>
      <span className="mt-1 text-2xl font-bold tracking-tight">{count}</span>
    </div>
  )
}

function KanbanColumn({
  title,
  count,
  apps,
  onSelect,
  onDownload,
  onPreview,
}: {
  title: string
  count: number
  apps: ApplicationListItem[]
  onSelect: (id: string) => void
  onDownload: (id: string) => void
  onPreview: (id: string, company: string, jobTitle: string) => void
}) {
  const { t, i18n } = useTranslation()

  return (
    <div className="flex flex-col rounded-lg border border-line bg-surface-2/40 min-w-[260px] h-[750px]">
      <div className="flex items-center justify-between border-b border-line px-3 py-2.5">
        <span className="text-xs font-bold text-ink uppercase tracking-wider">{title}</span>
        <span className="rounded-full bg-surface-2 px-2 py-0.5 text-xs font-bold text-ink-muted">
          {count}
        </span>
      </div>

      <div className="flex-1 overflow-y-auto p-2 flex flex-col gap-2">
        {apps.map((app) => (
          <div
            key={app.id}
            onClick={() => onSelect(app.id)}
            className="group cursor-pointer rounded border border-line bg-surface p-3 shadow-xs hover:border-select hover:shadow-sm transition-all"
          >
            <div className="flex items-start justify-between gap-1">
              <h4 className="text-sm font-semibold text-ink line-clamp-1 group-hover:text-select-ink">
                {app.jobTitle}
              </h4>
              {app.isFollowUpDue && (
                <span
                  className="shrink-0 rounded bg-amber-500/10 p-1 text-amber-600 dark:text-amber-400"
                  title={t('applications.stats.followUpsDue')}
                >
                  <Icon name="clock" size={13} />
                </span>
              )}
            </div>

            <p className="mt-0.5 text-xs font-medium text-ink-muted line-clamp-1">{app.company}</p>

            {app.location && (
              <p className="mt-1 text-xs text-ink-muted flex items-center gap-1">
                <Icon name="world" size={12} />
                <span className="truncate">{app.location}</span>
              </p>
            )}

            <div className="mt-3 flex items-center justify-between border-t border-line/60 pt-2 text-xs text-ink-muted">
              <span>{app.appliedAt ? formatDate(app.appliedAt, i18n.language) : t('applications.statuses.draft')}</span>

              <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity" onClick={(e) => e.stopPropagation()}>
                <button
                  type="button"
                  onClick={() => onPreview(app.id, app.company, app.jobTitle)}
                  title={t('applications.dossier.preview')}
                  className="rounded p-1 hover:bg-surface-2 hover:text-ink"
                >
                  <Icon name="fileText" size={13} />
                </button>
                <button
                  type="button"
                  onClick={() => onDownload(app.id)}
                  title={t('applications.dossier.download')}
                  className="rounded p-1 hover:bg-surface-2 hover:text-ink"
                >
                  <Icon name="download" size={13} />
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

function CreateApplicationDialog({
  open,
  onClose,
  coverLetters,
  isPending,
  onSubmit,
}: {
  open: boolean
  onClose: () => void
  coverLetters: Array<{ id: string; title: string }>
  isPending: boolean
  onSubmit: (payload: ApplicationPayload) => void
}) {
  const { t } = useTranslation()

  const [jobTitle, setJobTitle] = useState('')
  const [company, setCompany] = useState('')
  const [location, setLocation] = useState('')
  const [contactPerson, setContactPerson] = useState('')
  const [contactEmail, setContactEmail] = useState('')
  const [contactPhone, setContactPhone] = useState('')
  const [jobPostingUrl, setJobPostingUrl] = useState('')
  const [salaryExpectation, setSalaryExpectation] = useState('')
  const [status, setStatus] = useState<ApplicationStatus>('draft')
  const [coverLetterId, setCoverLetterId] = useState<string>('')
  const [includeCoverSheet, setIncludeCoverSheet] = useState(true)
  const [selectedAttachmentIds, setSelectedAttachmentIds] = useState<string[]>([])
  const [cvDesign, setCvDesign] = useState('classic')
  const [cvLanguage, setCvLanguage] = useState<'de' | 'en'>('de')
  const [notes, setNotes] = useState('')

  const { data: availableAttachments = [] } = useQuery({
    queryKey: ['attachments'],
    queryFn: attachmentsApi.list,
    enabled: open,
  })

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!jobTitle.trim() || !company.trim()) return

    onSubmit({
      jobTitle: jobTitle.trim(),
      company: company.trim(),
      location: location.trim() || null,
      contactPerson: contactPerson.trim() || null,
      contactEmail: contactEmail.trim() || null,
      contactPhone: contactPhone.trim() || null,
      jobPostingUrl: jobPostingUrl.trim() || null,
      salaryExpectation: salaryExpectation.trim() || null,
      status,
      coverLetterId: coverLetterId || null,
      includeCoverSheet,
      attachmentIds: selectedAttachmentIds,
      cvDesign,
      cvLanguage,
      notes: notes.trim() || null,
    })
  }

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title={t('applications.createTitle')}
      size="md"
      footer={
        <div className="flex justify-end gap-2">
          <Button variant="secondary" onClick={onClose}>
            {t('common.cancel', 'Abbrechen')}
          </Button>
          <Button variant="confirm" busy={isPending} onClick={handleSubmit}>
            {t('applications.actions.save')}
          </Button>
        </div>
      }
    >
      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div>
            <label className="text-xs font-semibold text-ink">{t('applications.fields.jobTitle')} *</label>
            <input
              type="text"
              required
              value={jobTitle}
              onChange={(e) => setJobTitle(e.target.value)}
              placeholder="z. B. Senior Cloud Architect"
              className="mt-1 w-full rounded border border-line bg-surface-2 px-3 py-1.5 text-sm text-ink focus:border-indicator focus:outline-none"
            />
          </div>
          <div>
            <label className="text-xs font-semibold text-ink">{t('applications.fields.company')} *</label>
            <input
              type="text"
              required
              value={company}
              onChange={(e) => setCompany(e.target.value)}
              placeholder="z. B. Acme Corp GmbH"
              className="mt-1 w-full rounded border border-line bg-surface-2 px-3 py-1.5 text-sm text-ink focus:border-indicator focus:outline-none"
            />
          </div>
        </div>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div>
            <label className="text-xs font-semibold text-ink">{t('applications.fields.location')}</label>
            <input
              type="text"
              value={location}
              onChange={(e) => setLocation(e.target.value)}
              placeholder="z. B. Berlin / Remote"
              className="mt-1 w-full rounded border border-line bg-surface-2 px-3 py-1.5 text-sm text-ink focus:border-indicator focus:outline-none"
            />
          </div>
          <div>
            <label className="text-xs font-semibold text-ink">{t('applications.fields.salaryExpectation')}</label>
            <input
              type="text"
              value={salaryExpectation}
              onChange={(e) => setSalaryExpectation(e.target.value)}
              placeholder="z. B. 85.000 EUR"
              className="mt-1 w-full rounded border border-line bg-surface-2 px-3 py-1.5 text-sm text-ink focus:border-indicator focus:outline-none"
            />
          </div>
        </div>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <div>
            <label className="text-xs font-semibold text-ink">{t('applications.fields.contactPerson')}</label>
            <input
              type="text"
              value={contactPerson}
              onChange={(e) => setContactPerson(e.target.value)}
              placeholder="Frau Dr. Schmidt"
              className="mt-1 w-full rounded border border-line bg-surface-2 px-3 py-1.5 text-sm text-ink focus:border-indicator focus:outline-none"
            />
          </div>
          <div>
            <label className="text-xs font-semibold text-ink">{t('applications.fields.contactEmail')}</label>
            <input
              type="email"
              value={contactEmail}
              onChange={(e) => setContactEmail(e.target.value)}
              placeholder="jobs@acme.example"
              className="mt-1 w-full rounded border border-line bg-surface-2 px-3 py-1.5 text-sm text-ink focus:border-indicator focus:outline-none"
            />
          </div>
          <div>
            <label className="text-xs font-semibold text-ink">{t('applications.fields.contactPhone')}</label>
            <input
              type="tel"
              value={contactPhone}
              onChange={(e) => setContactPhone(e.target.value)}
              placeholder="+49 30 12345678"
              className="mt-1 w-full rounded border border-line bg-surface-2 px-3 py-1.5 text-sm text-ink focus:border-indicator focus:outline-none"
            />
          </div>
        </div>

        <div>
          <label className="text-xs font-semibold text-ink">{t('applications.fields.jobPostingUrl')}</label>
          <input
            type="url"
            value={jobPostingUrl}
            onChange={(e) => setJobPostingUrl(e.target.value)}
            placeholder="https://acme.example/careers/job-123"
            className="mt-1 w-full rounded border border-line bg-surface-2 px-3 py-1.5 text-sm text-ink focus:border-indicator focus:outline-none"
          />
        </div>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div>
            <label className="text-xs font-semibold text-ink">{t('applications.fields.status')}</label>
            <select
              value={status}
              onChange={(e) => setStatus(e.target.value as ApplicationStatus)}
              className="mt-1 w-full rounded border border-line bg-surface-2 px-3 py-1.5 text-sm text-ink focus:border-indicator focus:outline-none"
            >
              {STATUS_ORDER.map((st) => (
                <option key={st} value={st}>
                  {t(`applications.statuses.${st}`)}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="text-xs font-semibold text-ink">{t('applications.fields.coverLetter')}</label>
            <select
              value={coverLetterId}
              onChange={(e) => setCoverLetterId(e.target.value)}
              className="mt-1 w-full rounded border border-line bg-surface-2 px-3 py-1.5 text-sm text-ink focus:border-indicator focus:outline-none"
            >
              <option value="">{t('applications.fields.noCoverLetter')}</option>
              {coverLetters.map((cl) => (
                <option key={cl.id} value={cl.id}>
                  {cl.title}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="rounded border border-line bg-surface-2/40 p-3 flex flex-col gap-3">
          <span className="text-xs font-bold text-ink uppercase tracking-wider">{t('applications.dossier.title')}</span>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div>
              <label className="text-xs font-semibold text-ink">{t('applications.fields.cvDesign')}</label>
              <select
                value={cvDesign}
                onChange={(e) => setCvDesign(e.target.value)}
                className="mt-1 w-full rounded border border-line bg-surface-2 px-3 py-1.5 text-sm text-ink focus:border-indicator focus:outline-none"
              >
                <option value="classic">Classic</option>
                <option value="modern">Modern</option>
                <option value="plain">Plain</option>
              </select>
            </div>
            <div>
              <label className="text-xs font-semibold text-ink">{t('applications.fields.cvLanguage')}</label>
              <select
                value={cvLanguage}
                onChange={(e) => setCvLanguage(e.target.value as 'de' | 'en')}
                className="mt-1 w-full rounded border border-line bg-surface-2 px-3 py-1.5 text-sm text-ink focus:border-indicator focus:outline-none"
              >
                <option value="de">Deutsch (DE)</option>
                <option value="en">English (EN)</option>
              </select>
            </div>
          </div>

          <label className="flex items-center gap-2 text-xs font-semibold text-ink cursor-pointer">
            <input
              type="checkbox"
              checked={includeCoverSheet}
              onChange={(e) => setIncludeCoverSheet(e.target.checked)}
              className="rounded border-line text-indicator focus:ring-0"
            />
            {t('applications.fields.includeCoverSheet')}
          </label>

          {/* Attachments selection */}
          <div className="pt-2 border-t border-line/60 space-y-1.5">
            <label className="block text-xs font-semibold text-ink">
              Anlagen & Zeugnisse anhängen ({selectedAttachmentIds.length} ausgewählt)
            </label>
            {availableAttachments.length === 0 ? (
              <p className="text-xs text-ink-muted">
                Noch keine Dokumente hochgeladen. Nutzen Sie &bdquo;Anlagen & Zeugnisse&ldquo; in der Kopfzeile.
              </p>
            ) : (
              <div className="max-h-32 overflow-y-auto space-y-1 rounded border border-line bg-surface p-2">
                {availableAttachments.map((att) => (
                  <label key={att.id} className="flex items-center gap-2 text-xs text-ink cursor-pointer hover:bg-surface-2 p-1 rounded">
                    <input
                      type="checkbox"
                      checked={selectedAttachmentIds.includes(att.id)}
                      onChange={(e) => {
                        if (e.target.checked) {
                          setSelectedAttachmentIds([...selectedAttachmentIds, att.id])
                        } else {
                          setSelectedAttachmentIds(selectedAttachmentIds.filter((id) => id !== att.id))
                        }
                      }}
                      className="rounded border-line text-indicator focus:ring-0"
                    />
                    <span className="font-medium truncate">{att.title}</span>
                    {att.category && (
                      <span className="text-[10px] px-1 rounded bg-canvas-subtle text-ink-muted border border-line">
                        {att.category}
                      </span>
                    )}
                  </label>
                ))}
              </div>
            )}
          </div>
        </div>

        <div>
          <label className="text-xs font-semibold text-ink">{t('applications.fields.notes')}</label>
          <textarea
            rows={2}
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Persönliche Notizen zur Bewerbung..."
            className="mt-1 w-full rounded border border-line bg-surface-2 px-3 py-1.5 text-sm text-ink focus:border-indicator focus:outline-none"
          />
        </div>
      </form>
    </Dialog>
  )
}

function ApplicationDetailsDialog({
  app,
  activeTab,
  onTabChange,
  onClose,
  onStatusChange,
  onAddEvent,
  onDeleteEvent,
  onArchiveSnapshot,
  onDownloadDossier,
  onPreviewDossier,
  onDelete,
}: {
  app: Application
  activeTab: 'details' | 'timeline' | 'dossier'
  onTabChange: (tab: 'details' | 'timeline' | 'dossier') => void
  onClose: () => void
  onStatusChange: (status: ApplicationStatus) => void
  onAddEvent: (payload: ApplicationEventPayload) => void
  onDeleteEvent: (eventId: string) => void
  onArchiveSnapshot: () => void
  onDownloadDossier: () => void
  onPreviewDossier: () => void
  onDelete: () => void
}) {
  const { t, i18n } = useTranslation()

  // New Event State
  const [newEventTitle, setNewEventTitle] = useState('')
  const [newEventNote, setNewEventNote] = useState('')
  const [newEventStatus, setNewEventStatus] = useState<ApplicationStatus>(app.status)
  const [isAiAnalysisOpen, setIsAiAnalysisOpen] = useState(false)

  const handleAddEvent = (e: React.FormEvent) => {
    e.preventDefault()
    if (!newEventTitle.trim()) return

    onAddEvent({
      title: newEventTitle.trim(),
      note: newEventNote.trim() || null,
      status: newEventStatus,
      date: new Date().toISOString(),
    })

    setNewEventTitle('')
    setNewEventNote('')
  }

  return (
    <Dialog
      open
      onClose={onClose}
      title={`${app.jobTitle} – ${app.company}`}
      size="lg"
      footer={
        <div className="flex w-full items-center justify-between">
          <Button variant="danger-outline" icon="trash" onClick={onDelete}>
            {t('applications.actions.delete')}
          </Button>
          <div className="flex gap-2">
            <Button variant="secondary" onClick={onClose}>
              {t('common.close', 'Schließen')}
            </Button>
            <Button variant="confirm" icon="download" onClick={onDownloadDossier}>
              {t('applications.dossier.download')}
            </Button>
          </div>
        </div>
      }
    >
      <div className="flex flex-col gap-4">
        {/* Status Strip */}
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-line bg-surface-2 p-3">
          <div className="flex items-center gap-2">
            <span className="text-xs font-semibold text-ink-muted">{t('applications.fields.status')}:</span>
            <select
              value={app.status}
              onChange={(e) => onStatusChange(e.target.value as ApplicationStatus)}
              className="rounded border border-line bg-surface px-2.5 py-1 text-xs font-bold text-ink focus:border-indicator focus:outline-none"
            >
              {STATUS_ORDER.map((st) => (
                <option key={st} value={st}>
                  {t(`applications.statuses.${st}`)}
                </option>
              ))}
            </select>
          </div>

          <div className="flex items-center gap-2 text-xs text-ink-muted">
            {app.appliedAt && (
              <span>
                {t('applications.fields.appliedAt')}: <strong>{formatDate(app.appliedAt, i18n.language)}</strong>
              </span>
            )}
            {app.isFollowUpDue && (
              <span className="rounded bg-amber-500/10 px-2 py-0.5 font-bold text-amber-600 dark:text-amber-400">
                {t('applications.stats.followUpsDue')}
              </span>
            )}
          </div>
        </div>

        {/* Tab navigation */}
        <div className="flex border-b border-line gap-4 text-sm font-semibold">
          <button
            type="button"
            onClick={() => onTabChange('details')}
            className={`pb-2 transition-colors border-b-2 ${
              activeTab === 'details' ? 'border-indicator text-ink' : 'border-transparent text-ink-muted hover:text-ink'
            }`}
          >
            {t('applications.detailsTitle')}
          </button>
          <button
            type="button"
            onClick={() => onTabChange('timeline')}
            className={`pb-2 transition-colors border-b-2 flex items-center gap-1.5 ${
              activeTab === 'timeline' ? 'border-indicator text-ink' : 'border-transparent text-ink-muted hover:text-ink'
            }`}
          >
            {t('applications.timeline.title')}
            <span className="rounded-full bg-surface-2 px-1.5 py-0.5 text-xs text-ink-muted">
              {app.events?.length ?? 0}
            </span>
          </button>
          <button
            type="button"
            onClick={() => onTabChange('dossier')}
            className={`pb-2 transition-colors border-b-2 flex items-center gap-1.5 ${
              activeTab === 'dossier' ? 'border-indicator text-ink' : 'border-transparent text-ink-muted hover:text-ink'
            }`}
          >
            {t('applications.dossier.title')}
            {app.hasArchivedPdf && (
              <span className="rounded bg-sky-500/10 px-1.5 py-0.5 text-xs font-bold text-sky-600 dark:text-sky-400">
                Snapshot
              </span>
            )}
          </button>
        </div>

        {/* TAB 1: DETAILS */}
        {activeTab === 'details' && (
          <div className="flex flex-col gap-4 text-sm">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div className="rounded border border-line bg-surface-2/40 p-3">
                <h4 className="text-xs font-bold text-ink-muted uppercase tracking-wider mb-2">
                  {t('applications.fields.company')} & {t('applications.fields.location')}
                </h4>
                <p className="font-semibold text-ink">{app.company}</p>
                <p className="text-ink-muted">{app.location || '—'}</p>
                {app.salaryExpectation && (
                  <p className="mt-2 text-xs text-ink-muted">
                    {t('applications.fields.salaryExpectation')}: <strong>{app.salaryExpectation}</strong>
                  </p>
                )}
                {app.jobPostingUrl && (
                  <p className="mt-2 text-xs">
                    <a
                      href={app.jobPostingUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-select-ink underline inline-flex items-center gap-1"
                    >
                      {t('applications.fields.jobPostingUrl')}
                      <Icon name="world" size={12} />
                    </a>
                  </p>
                )}
              </div>

              <div className="rounded border border-line bg-surface-2/40 p-3">
                <h4 className="text-xs font-bold text-ink-muted uppercase tracking-wider mb-2">
                  {t('applications.fields.contactPerson')}
                </h4>
                <p className="font-semibold text-ink">{app.contactPerson || '—'}</p>
                {app.contactEmail && (
                  <p className="text-xs text-ink-muted mt-1">
                    E-Mail: <a href={`mailto:${app.contactEmail}`} className="underline">{app.contactEmail}</a>
                  </p>
                )}
                {app.contactPhone && (
                  <p className="text-xs text-ink-muted mt-0.5">
                    Tel: <a href={`tel:${app.contactPhone}`} className="underline">{app.contactPhone}</a>
                  </p>
                )}
              </div>
            </div>

            {/* AI Job Analysis Action Card */}
            <div className="rounded-lg border border-purple-500/30 bg-purple-500/10 p-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-purple-950 dark:text-purple-200">
              <div className="flex items-center gap-2.5">
                <Icon name="sparkles" size={18} className="text-purple-600 dark:text-purple-400 shrink-0" />
                <div>
                  <h5 className="font-bold text-xs uppercase tracking-wider text-purple-900 dark:text-purple-200">
                    {t('ai.tasks.analyzeJob')}
                  </h5>
                  <p className="text-xs text-purple-800/80 dark:text-purple-300/80 mt-0.5">
                    Gleichen Sie die Anforderungen mit Ihrem Stammprofil ab und erhalten Sie einen Passungs-Score.
                  </p>
                </div>
              </div>
              <Button
                variant="confirm"
                small
                icon="sparkles"
                onClick={() => setIsAiAnalysisOpen(true)}
              >
                Analysieren
              </Button>
            </div>

            {app.coverLetterTitle && (
              <div className="rounded border border-line bg-surface-2/40 p-3 flex items-center justify-between">
                <div>
                  <h4 className="text-xs font-bold text-ink-muted uppercase tracking-wider">
                    {t('applications.fields.coverLetter')}
                  </h4>
                  <p className="font-semibold text-ink mt-0.5">{app.coverLetterTitle}</p>
                </div>
                <Icon name="files" size={20} className="text-ink-muted" />
              </div>
            )}

            {app.notes && (
              <div className="rounded border border-line bg-surface-2/40 p-3">
                <h4 className="text-xs font-bold text-ink-muted uppercase tracking-wider mb-1">
                  {t('applications.fields.notes')}
                </h4>
                <p className="text-ink whitespace-pre-wrap text-xs leading-relaxed">{app.notes}</p>
              </div>
            )}
          </div>
        )}

        {/* TAB 2: TIMELINE */}
        {activeTab === 'timeline' && (
          <div className="flex flex-col gap-4">
            {/* Add event form */}
            <form onSubmit={handleAddEvent} className="rounded border border-line bg-surface-2/60 p-3 flex flex-col gap-2">
              <span className="text-xs font-bold text-ink uppercase tracking-wider">
                {t('applications.timeline.addEvent')}
              </span>
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
                <input
                  type="text"
                  required
                  value={newEventTitle}
                  onChange={(e) => setNewEventTitle(e.target.value)}
                  placeholder={t('applications.timeline.eventTitle')}
                  className="sm:col-span-2 rounded border border-line bg-surface px-2.5 py-1 text-xs text-ink focus:border-indicator focus:outline-none"
                />
                <select
                  value={newEventStatus}
                  onChange={(e) => setNewEventStatus(e.target.value as ApplicationStatus)}
                  className="rounded border border-line bg-surface px-2.5 py-1 text-xs text-ink focus:border-indicator focus:outline-none"
                >
                  {STATUS_ORDER.map((st) => (
                    <option key={st} value={st}>
                      {t(`applications.statuses.${st}`)}
                    </option>
                  ))}
                </select>
              </div>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={newEventNote}
                  onChange={(e) => setNewEventNote(e.target.value)}
                  placeholder={t('applications.timeline.note')}
                  className="flex-1 rounded border border-line bg-surface px-2.5 py-1 text-xs text-ink focus:border-indicator focus:outline-none"
                />
                <Button variant="confirm" small type="submit">
                  {t('common.add', 'Hinzufügen')}
                </Button>
              </div>
            </form>

            {/* Events chronological list */}
            <div className="flex flex-col gap-2">
              {app.events && app.events.length > 0 ? (
                app.events.map((ev) => (
                  <div
                    key={ev.id}
                    className="flex items-start justify-between rounded border border-line bg-surface p-3 transition-colors hover:border-select"
                  >
                    <div className="flex items-start gap-3">
                      <div className="mt-0.5 rounded-full bg-surface-2 p-1.5 text-ink-muted">
                        <Icon name="calendarTime" size={14} />
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-semibold text-ink">{ev.title}</span>
                          <span
                            className={`rounded px-1.5 py-0.5 text-xs font-semibold ${
                              STATUS_STYLES[ev.status]?.bg ?? 'bg-surface-2'
                            } ${STATUS_STYLES[ev.status]?.text ?? 'text-ink'}`}
                          >
                            {t(`applications.statuses.${ev.status}`)}
                          </span>
                        </div>
                        {ev.note && <p className="mt-1 text-xs text-ink-muted">{ev.note}</p>}
                        <span className="mt-1 block text-xs text-ink-muted/80">{formatDateTime(ev.date, i18n.language)}</span>
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={() => onDeleteEvent(ev.id)}
                      title={t('common.delete', 'Löschen')}
                      className="rounded p-1 text-ink-muted hover:bg-surface-2 hover:text-rose-600 transition-colors"
                    >
                      <Icon name="trash" size={14} />
                    </button>
                  </div>
                ))
              ) : (
                <p className="text-center text-xs text-ink-muted py-6">{t('applications.timeline.noEvents')}</p>
              )}
            </div>
          </div>
        )}

        {/* TAB 3: DOSSIER & PDF */}
        {activeTab === 'dossier' && (
          <div className="flex flex-col gap-4 text-sm">
            <div className="rounded-lg border border-line bg-surface-2/40 p-4 flex flex-col gap-3">
              <div className="flex items-center justify-between">
                <div>
                  <h4 className="text-sm font-bold text-ink">{t('applications.dossier.title')}</h4>
                  <p className="text-xs text-ink-muted mt-0.5">
                    {app.hasArchivedPdf
                      ? t('applications.dossier.frozenHint')
                      : 'Kompiliert Deckblatt, DIN 5008 Anschreiben und Lebenslauf in einem Dokument.'}
                  </p>
                </div>
                {app.hasArchivedPdf ? (
                  <span className="rounded bg-sky-500/10 px-2 py-1 text-xs font-bold text-sky-600 dark:text-sky-400">
                    {t('applications.dossier.frozenBadge')}
                  </span>
                ) : (
                  <span className="rounded bg-surface-2 px-2 py-1 text-xs font-bold text-ink-muted">
                    {t('applications.dossier.liveBadge')}
                  </span>
                )}
              </div>

              <div className="flex flex-wrap gap-2 pt-2">
                <Button variant="confirm" icon="download" onClick={onDownloadDossier}>
                  {t('applications.dossier.download')}
                </Button>
                <Button variant="secondary" icon="fileText" onClick={onPreviewDossier}>
                  {t('applications.dossier.preview')}
                </Button>
                <Button variant="ghost" icon="refresh" onClick={onArchiveSnapshot}>
                  {t('applications.dossier.archiveNow')}
                </Button>
              </div>
            </div>

            <div className="rounded border border-line bg-surface p-3 text-xs text-ink-muted flex flex-col gap-1.5">
              <div className="flex justify-between">
                <span>{t('applications.fields.cvDesign')}:</span>
                <strong className="text-ink capitalize">{app.cvDesign}</strong>
              </div>
              <div className="flex justify-between">
                <span>{t('applications.fields.cvLanguage')}:</span>
                <strong className="text-ink uppercase">{app.cvLanguage}</strong>
              </div>
              <div className="flex justify-between">
                <span>{t('applications.fields.includeCoverSheet')}:</span>
                <strong className="text-ink">{app.includeCoverSheet ? 'Ja' : 'Nein'}</strong>
              </div>
              <div className="flex justify-between">
                <span>{t('applications.fields.coverLetter')}:</span>
                <strong className="text-ink">{app.coverLetterTitle || 'Kein Anschreiben'}</strong>
              </div>
              <div className="flex justify-between">
                <span>Anlagen & Nachweise:</span>
                <strong className="text-ink">{app.attachmentIds?.length ? `${app.attachmentIds.length} Dokument(e) angehängt` : 'Keine'}</strong>
              </div>
            </div>
          </div>
        )}
      </div>

      <AiAssistantModal
        open={isAiAnalysisOpen}
        onClose={() => setIsAiAnalysisOpen(false)}
        task="analyze_job"
        initialJobTitle={app.jobTitle}
        initialCompany={app.company}
        initialJobDescription={app.jobDescription || ''}
      />
    </Dialog>
  )
}
