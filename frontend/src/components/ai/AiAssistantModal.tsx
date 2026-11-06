// Copyright (c) 2026 SushiFlux Develop
// Licensed under the AGPL-3.0-only.

import { useMutation, useQuery } from '@tanstack/react-query'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { aiApi } from '../../api/endpoints'
import type {
  AiConfig,
  AiCoverLetterResult,
  AiImproveBulletResult,
  AiJobAnalysisResult,
  AiSummaryResult,
  AiTask,
} from '../../api/types'
import { Button } from '../ui/Button'
import { Dialog } from '../ui/Dialog'
import { Icon } from '../ui/Icon'
import { AiSettingsModal } from './AiSettingsModal'

interface AiAssistantModalProps {
  open: boolean
  onClose: () => void
  task: AiTask
  initialJobTitle?: string
  initialCompany?: string
  initialJobDescription?: string
  initialRecipient?: string
  initialText?: string
  onApplyCoverLetter?: (result: AiCoverLetterResult) => void
  onApplySummary?: (result: AiSummaryResult) => void
  onApplyBullet?: (result: AiImproveBulletResult) => void
}

export function AiAssistantModal(props: AiAssistantModalProps) {
  const { open, onClose, task } = props
  const { t } = useTranslation()

  const { data: config } = useQuery({
    queryKey: ['ai', 'config'],
    queryFn: aiApi.getConfig,
    enabled: open,
  })

  if (!open) return null

  const title =
    task === 'generate_cover_letter'
      ? t('ai.tasks.coverLetter')
      : task === 'analyze_job'
      ? t('ai.tasks.analyzeJob')
      : task === 'generate_summary'
      ? t('ai.tasks.summary')
      : t('ai.tasks.improveBullet')

  return (
    <Dialog open={open} onClose={onClose} title={title} size="lg">
      <AiAssistantInner {...props} config={config} />
    </Dialog>
  )
}

function AiAssistantInner({
  onClose,
  task,
  initialJobTitle = '',
  initialCompany = '',
  initialJobDescription = '',
  initialRecipient = '',
  initialText = '',
  onApplyCoverLetter,
  onApplySummary,
  onApplyBullet,
  config,
}: AiAssistantModalProps & { config?: AiConfig }) {
  const { t, i18n } = useTranslation()

  // Input states initialized from props
  const [jobTitle, setJobTitle] = useState(initialJobTitle)
  const [company, setCompany] = useState(initialCompany)
  const [jobDescription, setJobDescription] = useState(initialJobDescription)
  const [recipient, setRecipient] = useState(initialRecipient)
  const [tone, setTone] = useState('confident')
  const [inputText, setInputText] = useState(initialText)

  // Copy-paste workflow states
  const [promptCopied, setPromptCopied] = useState(false)
  const [rawResponse, setRawResponse] = useState('')
  const [parsedResult, setParsedResult] = useState<unknown | null>(null)
  const [isSettingsOpen, setIsSettingsOpen] = useState(false)

  const isDirectAvailable = config && config.provider !== 'copy_paste'

  // Prompt Mutation (Copy & Paste)
  const promptMutation = useMutation({
    mutationFn: () =>
      aiApi.buildPrompt({
        task,
        jobTitle: jobTitle.trim() || undefined,
        company: company.trim() || undefined,
        jobDescription: jobDescription.trim() || undefined,
        recipientPerson: recipient.trim() || undefined,
        tone,
        language: i18n.language === 'en' ? 'en' : 'de',
        inputText: inputText.trim() || undefined,
      }),
    onSuccess: async (data) => {
      try {
        await navigator.clipboard.writeText(data.fullCopyPasteText)
        setPromptCopied(true)
        setTimeout(() => setPromptCopied(false), 4000)
      } catch {
        // clipboard error handled
      }
    },
  })

  // Parse Mutation (Copy & Paste)
  const parseMutation = useMutation({
    mutationFn: () =>
      aiApi.parseResponse({
        task,
        rawResponse,
        pseudonymized: config?.pseudonymize ?? true,
        language: i18n.language === 'en' ? 'en' : 'de',
      }),
    onSuccess: (data) => {
      setParsedResult(data)
    },
  })

  // Direct Generation Mutation
  const generateMutation = useMutation({
    mutationFn: () =>
      aiApi.generate({
        task,
        jobTitle: jobTitle.trim() || undefined,
        company: company.trim() || undefined,
        jobDescription: jobDescription.trim() || undefined,
        recipientPerson: recipient.trim() || undefined,
        tone,
        language: i18n.language === 'en' ? 'en' : 'de',
        inputText: inputText.trim() || undefined,
      }),
    onSuccess: (data) => {
      setParsedResult(data)
    },
  })

  const handleApply = () => {
    if (!parsedResult) return
    if (task === 'generate_cover_letter' && onApplyCoverLetter) {
      onApplyCoverLetter(parsedResult as AiCoverLetterResult)
      onClose()
    } else if (task === 'generate_summary' && onApplySummary) {
      onApplySummary(parsedResult as AiSummaryResult)
      onClose()
    } else if (task === 'improve_bullet' && onApplyBullet) {
      onApplyBullet(parsedResult as AiImproveBulletResult)
      onClose()
    }
  }

  const renderResult = () => {
    if (!parsedResult) return null

    if (task === 'generate_cover_letter') {
      const res = parsedResult as AiCoverLetterResult
      return (
        <div className="rounded-lg border border-line bg-surface p-4 flex flex-col gap-3">
          <div className="flex items-center justify-between border-b border-line pb-2">
            <span className="text-xs font-bold text-ink uppercase tracking-wider">Vorschau Anschreiben</span>
            {res.keyMatches && res.keyMatches.length > 0 && (
              <div className="flex flex-wrap gap-1">
                {res.keyMatches.map((m, idx) => (
                  <span key={idx} className="rounded bg-sky-500/10 px-2 py-0.5 text-xs font-medium text-sky-700 dark:text-sky-300">
                    {m}
                  </span>
                ))}
              </div>
            )}
          </div>
          <div>
            <span className="text-xs font-semibold text-ink-muted">Betreff:</span>
            <p className="font-bold text-ink mt-0.5 text-sm">{res.subject}</p>
          </div>
          <div>
            <span className="text-xs font-semibold text-ink-muted">Anrede:</span>
            <p className="text-ink mt-0.5 text-sm">{res.salutation}</p>
          </div>
          <div>
            <span className="text-xs font-semibold text-ink-muted">Einleitung & Hauptteil:</span>
            <p className="text-ink mt-0.5 text-sm leading-relaxed whitespace-pre-wrap">{res.opening}</p>
            <p className="text-ink mt-2 text-sm leading-relaxed whitespace-pre-wrap">{res.body}</p>
          </div>
          <div>
            <span className="text-xs font-semibold text-ink-muted">Schluss:</span>
            <p className="text-ink mt-0.5 text-sm leading-relaxed">{res.closing}</p>
          </div>
        </div>
      )
    }

    if (task === 'analyze_job') {
      const res = parsedResult as AiJobAnalysisResult
      const scoreColor =
        res.matchScore >= 80
          ? 'text-emerald-600 dark:text-emerald-400 border-emerald-500/40 bg-emerald-500/10'
          : res.matchScore >= 60
          ? 'text-amber-600 dark:text-amber-400 border-amber-500/40 bg-amber-500/10'
          : 'text-rose-600 dark:text-rose-400 border-rose-500/40 bg-rose-500/10'

      return (
        <div className="rounded-lg border border-line bg-surface p-4 flex flex-col gap-4">
          <div className="flex items-center justify-between border-b border-line pb-3">
            <div>
              <span className="text-xs font-bold text-ink uppercase tracking-wider">{t('ai.assistant.matchScore')}</span>
              <p className="text-xs text-ink-muted mt-0.5">{res.summary}</p>
            </div>
            <div className={`flex items-center justify-center rounded-full border px-3 py-1 font-bold text-lg ${scoreColor}`}>
              {res.matchScore} %
            </div>
          </div>

          {res.matchedRequirements.length > 0 && (
            <div>
              <h5 className="text-xs font-bold text-ink uppercase tracking-wider mb-2 flex items-center gap-1.5 text-emerald-700 dark:text-emerald-400">
                <Icon name="check" size={14} />
                {t('ai.assistant.matchedRequirements')}
              </h5>
              <div className="flex flex-col gap-1.5">
                {res.matchedRequirements.map((m, idx) => (
                  <div key={idx} className="rounded border border-line bg-surface-2/40 p-2 text-xs">
                    <span className="font-semibold text-ink">{m.requirement}</span>
                    <p className="text-ink-muted mt-0.5">✓ {m.candidateMatch}</p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {res.missingRequirements.length > 0 && (
            <div>
              <h5 className="text-xs font-bold text-ink uppercase tracking-wider mb-2 flex items-center gap-1.5 text-amber-700 dark:text-amber-400">
                <Icon name="clock" size={14} />
                {t('ai.assistant.missingRequirements')}
              </h5>
              <div className="flex flex-col gap-1.5">
                {res.missingRequirements.map((m, idx) => (
                  <div key={idx} className="rounded border border-line bg-surface-2/40 p-2 text-xs">
                    <span className="font-semibold text-ink">{m.requirement}</span>
                    <p className="text-ink-muted mt-0.5">💡 {m.suggestion}</p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {res.tips.length > 0 && (
            <div className="rounded border border-line bg-surface-2/60 p-3 text-xs">
              <h5 className="font-bold text-ink uppercase tracking-wider mb-1.5">{t('ai.assistant.tips')}</h5>
              <ul className="list-disc pl-4 space-y-1 text-ink-muted">
                {res.tips.map((tip, idx) => (
                  <li key={idx}>{tip}</li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )
    }

    if (task === 'generate_summary') {
      const res = parsedResult as AiSummaryResult
      return (
        <div className="rounded-lg border border-line bg-surface p-4 flex flex-col gap-3">
          <span className="text-xs font-bold text-ink uppercase tracking-wider">Kurzprofil & Elevator Pitch</span>
          <p className="text-sm font-semibold text-ink leading-relaxed">{res.shortSummary}</p>
          {res.bulletPoints.length > 0 && (
            <ul className="list-disc pl-4 space-y-1 text-xs text-ink-muted">
              {res.bulletPoints.map((b, idx) => (
                <li key={idx}>{b}</li>
              ))}
            </ul>
          )}
        </div>
      )
    }

    if (task === 'improve_bullet') {
      const res = parsedResult as AiImproveBulletResult
      return (
        <div className="rounded-lg border border-line bg-surface p-4 flex flex-col gap-3">
          <span className="text-xs font-bold text-ink uppercase tracking-wider">Optimierter Stichpunkt</span>
          <p className="text-sm font-bold text-emerald-800 dark:text-emerald-300 bg-emerald-500/10 p-2.5 rounded border border-emerald-500/30">
            {res.improved}
          </p>
          {res.alternatives.length > 0 && (
            <div>
              <span className="text-xs font-semibold text-ink-muted">Alternative Formulierungen:</span>
              <ul className="list-disc pl-4 space-y-1 text-xs text-ink-muted mt-1">
                {res.alternatives.map((alt, idx) => (
                  <li key={idx}>{alt}</li>
                ))}
              </ul>
            </div>
          )}
          {res.explanation && <p className="text-xs text-ink-muted italic">Tipp: {res.explanation}</p>}
        </div>
      )
    }

    return null
  }

  return (
    <>
      <div className="flex flex-col gap-5 text-sm">
        {/* Header Strip with provider indicator */}
        <div className="flex items-center justify-between rounded-lg border border-line bg-surface-2 p-3 text-xs">
          <div className="flex items-center gap-2">
            <span className="font-semibold text-ink-muted">{t('ai.provider')}:</span>
            <span className="rounded bg-surface px-2 py-0.5 font-bold text-ink">
              {t(`ai.providers.${config?.provider || 'copy_paste'}`)}
            </span>
            {config?.model && config.provider !== 'copy_paste' && (
              <span className="rounded bg-sky-500/10 px-2 py-0.5 font-medium text-sky-700 dark:text-sky-300">
                {config.model}
              </span>
            )}
          </div>

          <button
            type="button"
            onClick={() => setIsSettingsOpen(true)}
            className="font-semibold text-select-ink hover:underline"
          >
            Ändern
          </button>
        </div>

        {/* Context Inputs (if cover letter or analyze job) */}
        {(task === 'generate_cover_letter' || task === 'analyze_job') && (
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div>
              <label className="text-xs font-semibold text-ink">{t('ai.assistant.jobTitle')}</label>
              <input
                type="text"
                value={jobTitle}
                onChange={(e) => setJobTitle(e.target.value)}
                placeholder="z. B. Senior Cloud Engineer"
                className="mt-1 w-full rounded border border-line bg-surface-2 px-3 py-1.5 text-xs text-ink focus:border-indicator focus:outline-none"
              />
            </div>
            <div>
              <label className="text-xs font-semibold text-ink">{t('ai.assistant.company')}</label>
              <input
                type="text"
                value={company}
                onChange={(e) => setCompany(e.target.value)}
                placeholder="z. B. CloudScale AG"
                className="mt-1 w-full rounded border border-line bg-surface-2 px-3 py-1.5 text-xs text-ink focus:border-indicator focus:outline-none"
              />
            </div>

            {task === 'generate_cover_letter' && (
              <>
                <div>
                  <label className="text-xs font-semibold text-ink">{t('ai.assistant.recipient')}</label>
                  <input
                    type="text"
                    value={recipient}
                    onChange={(e) => setRecipient(e.target.value)}
                    placeholder="z. B. Frau Dr. Schmidt"
                    className="mt-1 w-full rounded border border-line bg-surface-2 px-3 py-1.5 text-xs text-ink focus:border-indicator focus:outline-none"
                  />
                </div>
                <div>
                  <label className="text-xs font-semibold text-ink">{t('ai.assistant.tone')}</label>
                  <select
                    value={tone}
                    onChange={(e) => setTone(e.target.value)}
                    className="mt-1 w-full rounded border border-line bg-surface-2 px-3 py-1.5 text-xs text-ink focus:border-indicator focus:outline-none"
                  >
                    <option value="confident">{t('ai.assistant.tones.confident')}</option>
                    <option value="professional">{t('ai.assistant.tones.professional')}</option>
                    <option value="dynamic">{t('ai.assistant.tones.dynamic')}</option>
                    <option value="classic">{t('ai.assistant.tones.classic')}</option>
                  </select>
                </div>
              </>
            )}

            <div className="sm:col-span-2">
              <label className="text-xs font-semibold text-ink">{t('ai.assistant.jobDescription')}</label>
              <textarea
                rows={3}
                value={jobDescription}
                onChange={(e) => setJobDescription(e.target.value)}
                placeholder="Kopieren Sie hier den Text der Stellenanzeige oder die wichtigsten Anforderungen hinein..."
                className="mt-1 w-full rounded border border-line bg-surface-2 px-3 py-1.5 text-xs text-ink focus:border-indicator focus:outline-none"
              />
            </div>
          </div>
        )}

        {/* Context Input for improve_bullet or summary */}
        {(task === 'improve_bullet' || task === 'generate_summary') && (
          <div>
            <label className="text-xs font-semibold text-ink">
              {task === 'improve_bullet' ? 'Zu optimierender Stichpunkt' : 'Fokus / Schwerpunkt (optional)'}
            </label>
            <textarea
              rows={2}
              value={inputText}
              onChange={(e) => setInputText(e.target.value)}
              placeholder={task === 'improve_bullet' ? 'z. B. Zuständig für Cloud-Migrationen' : 'z. B. Fokus auf Cloud-Architektur und Teamleitung'}
              className="mt-1 w-full rounded border border-line bg-surface-2 px-3 py-1.5 text-xs text-ink focus:border-indicator focus:outline-none"
            />
          </div>
        )}

        {/* Execution Section: Direct API vs Copy-Paste */}
        {isDirectAvailable ? (
          <div className="flex items-center justify-between rounded-lg border border-line bg-surface-2/40 p-4">
            <div>
              <h4 className="text-xs font-bold text-ink uppercase tracking-wider">{t('ai.assistant.directMode')}</h4>
              <p className="text-xs text-ink-muted mt-0.5">
                Generiert den Vorschlag direkt über Ihren konfigurierten Anbieter ({config?.model}).
              </p>
            </div>
            <Button
              variant="confirm"
              icon="sparkles"
              disabled={generateMutation.isPending}
              onClick={() => generateMutation.mutate()}
            >
              {generateMutation.isPending ? t('ai.assistant.generating') : t('ai.assistant.generate')}
            </Button>
          </div>
        ) : (
          /* Copy & Paste 3-Step Section */
          <div className="rounded-lg border border-line bg-surface-2/50 p-4 flex flex-col gap-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-line pb-3">
              <div>
                <h4 className="text-xs font-bold text-ink uppercase tracking-wider">{t('ai.assistant.copyPasteMode')}</h4>
                <p className="text-xs text-ink-muted mt-0.5">
                  Kopieren Sie den vorbereiteten Prompt und fügen Sie ihn in ChatGPT, Claude oder Gemini Web ein.
                </p>
              </div>
              <Button
                variant={promptCopied ? 'confirm' : 'secondary'}
                icon={promptCopied ? 'check' : 'copy'}
                disabled={promptMutation.isPending}
                onClick={() => promptMutation.mutate()}
              >
                {promptCopied ? 'Kopiert!' : t('ai.assistant.copyPrompt')}
              </Button>
            </div>

            {promptCopied && (
              <div className="rounded border border-emerald-500/30 bg-emerald-500/10 p-2.5 text-xs text-emerald-800 dark:text-emerald-200">
                {t('ai.assistant.promptCopied')}
              </div>
            )}

            <div>
              <label className="text-xs font-semibold text-ink">{t('ai.assistant.pasteAnswer')}</label>
              <textarea
                rows={4}
                value={rawResponse}
                onChange={(e) => setRawResponse(e.target.value)}
                placeholder={t('ai.assistant.pastePlaceholder')}
                className="mt-1 w-full rounded border border-line bg-surface px-3 py-2 text-xs font-mono text-ink focus:border-indicator focus:outline-none"
              />
            </div>

            <div className="flex justify-end">
              <Button
                variant="confirm"
                icon="check"
                disabled={!rawResponse.trim() || parseMutation.isPending}
                onClick={() => parseMutation.mutate()}
              >
                {parseMutation.isPending ? t('ai.assistant.generating') : t('ai.assistant.parseAnswer')}
              </Button>
            </div>
          </div>
        )}

        {/* Parsed Result Display */}
        {renderResult()}

        {/* Dialog Actions Footer */}
        <div className="flex w-full items-center justify-between border-t border-line pt-3 mt-2">
          <button
            type="button"
            onClick={() => setIsSettingsOpen(true)}
            className="text-xs text-ink-muted hover:text-ink underline inline-flex items-center gap-1"
          >
            <Icon name="settings" size={14} />
            {t('ai.assistant.openSettings')}
          </button>
          <div className="flex gap-2">
            <Button variant="secondary" onClick={onClose}>
              {t('common.close', 'Schließen')}
            </Button>
            {Boolean(parsedResult) && (task === 'generate_cover_letter' || task === 'generate_summary' || task === 'improve_bullet') && (
              <Button variant="confirm" icon="check" onClick={handleApply}>
                {task === 'generate_cover_letter' ? t('ai.assistant.applyToCoverLetter') : t('ai.assistant.apply')}
              </Button>
            )}
          </div>
        </div>
      </div>

      {/* Embedded Settings Dialog */}
      <AiSettingsModal open={isSettingsOpen} onClose={() => setIsSettingsOpen(false)} />
    </>
  )
}
