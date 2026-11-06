// Copyright (c) 2026 SushiFlux Develop
// Licensed under the AGPL-3.0-only.

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { aiApi } from '../../api/endpoints'
import type { AiConfig, AiProvider } from '../../api/types'
import { Button } from '../ui/Button'
import { Dialog } from '../ui/Dialog'
import { Icon } from '../ui/Icon'

interface AiSettingsModalProps {
  open: boolean
  onClose: () => void
}

const PROVIDER_OPTIONS: Array<{ id: AiProvider; labelKey: string }> = [
  { id: 'copy_paste', labelKey: 'ai.providers.copy_paste' },
  { id: 'openai', labelKey: 'ai.providers.openai' },
  { id: 'anthropic', labelKey: 'ai.providers.anthropic' },
  { id: 'gemini', labelKey: 'ai.providers.gemini' },
  { id: 'ollama', labelKey: 'ai.providers.ollama' },
  { id: 'custom', labelKey: 'ai.providers.custom' },
]

export function AiSettingsModal({ open, onClose }: AiSettingsModalProps) {
  const { t } = useTranslation()

  const { data: config, isLoading } = useQuery({
    queryKey: ['ai', 'config'],
    queryFn: aiApi.getConfig,
    enabled: open,
  })

  if (!open) return null

  return (
    <Dialog open={open} onClose={onClose} title={t('ai.settingsTitle')} size="md">
      {isLoading || !config ? (
        <div className="p-4 text-center text-sm text-ink-muted">{t('common.loading', 'Laden …')}</div>
      ) : (
        <AiSettingsForm key={config.provider + (config.model || '')} config={config} onClose={onClose} />
      )}
    </Dialog>
  )
}

function AiSettingsForm({ config, onClose }: { config: AiConfig; onClose: () => void }) {
  const { t } = useTranslation()
  const queryClient = useQueryClient()

  const [provider, setProvider] = useState<AiProvider>(config.provider)
  const [model, setModel] = useState(config.model || 'gpt-4o-mini')
  const [baseUrl, setBaseUrl] = useState(config.baseUrl || '')
  const [apiKey, setApiKey] = useState('')
  const [pseudonymize, setPseudonymize] = useState(config.pseudonymize)
  const [testResult, setTestResult] = useState<{ success: boolean; message: string | null } | null>(null)
  const [saveSuccess, setSaveSuccess] = useState(false)

  const saveMutation = useMutation({
    mutationFn: () =>
      aiApi.saveConfig({
        provider,
        model: model.trim() || undefined,
        baseUrl: baseUrl.trim() || null,
        apiKey: apiKey.trim() || undefined,
        pseudonymize,
      }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['ai', 'config'] })
      setSaveSuccess(true)
      setTimeout(() => setSaveSuccess(false), 3000)
    },
  })

  const testMutation = useMutation({
    mutationFn: aiApi.testConnection,
    onSuccess: (data) => {
      setTestResult(data)
    },
    onError: (err: Error) => {
      setTestResult({ success: false, message: err.message })
    },
  })

  const handleProviderChange = (newProvider: AiProvider) => {
    setProvider(newProvider)
    setTestResult(null)
    if (newProvider === 'openai') {
      setModel('gpt-4o-mini')
      setBaseUrl('')
    } else if (newProvider === 'anthropic') {
      setModel('claude-3-5-haiku-20241022')
      setBaseUrl('')
    } else if (newProvider === 'gemini') {
      setModel('gemini-2.5-flash')
      setBaseUrl('')
    } else if (newProvider === 'ollama') {
      setModel('llama3.2')
      setBaseUrl('http://localhost:11434')
    } else if (newProvider === 'custom') {
      setModel('local-model')
      setBaseUrl('http://localhost:1234/v1')
    }
  }

  return (
    <div className="flex flex-col gap-4 text-sm">
      {saveSuccess && (
        <div className="rounded border border-emerald-500/30 bg-emerald-500/10 p-3 text-xs font-semibold text-emerald-800 dark:text-emerald-200">
          {t('ai.saved')}
        </div>
      )}

      {testResult && (
        <div
          className={`rounded border p-3 text-xs font-semibold ${
            testResult.success
              ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-800 dark:text-emerald-200'
              : 'border-rose-500/30 bg-rose-500/10 text-rose-800 dark:text-rose-200'
          }`}
        >
          {testResult.success
            ? t('ai.testSuccess')
            : t('ai.testFailed', { message: testResult.message || 'Error' })}
        </div>
      )}

      {/* Provider selection */}
      <div>
        <label className="text-xs font-bold text-ink uppercase tracking-wider">{t('ai.provider')}</label>
        <select
          value={provider}
          onChange={(e) => handleProviderChange(e.target.value as AiProvider)}
          className="mt-1 w-full rounded border border-line bg-surface-2 px-3 py-2 text-sm text-ink focus:border-indicator focus:outline-none"
        >
          {PROVIDER_OPTIONS.map((opt) => (
            <option key={opt.id} value={opt.id}>
              {t(opt.labelKey)}
            </option>
          ))}
        </select>
      </div>

      {/* If copy-paste is selected: show friendly explanatory notice */}
      {provider === 'copy_paste' ? (
        <div className="rounded-lg border border-sky-500/30 bg-sky-500/10 p-4 text-sky-950 dark:text-sky-200 flex flex-col gap-2">
          <div className="flex items-center gap-2 font-semibold">
            <Icon name="infoCircle" size={18} />
            <span>Kostenlos & 100% datenschutzfreundlich</span>
          </div>
          <p className="text-xs leading-relaxed text-sky-900/90 dark:text-sky-200/90">
            Im Modus „Kopieren & Einfügen“ bereitet Vitafolio den fertigen Prompt für Sie vor. Sie kopieren ihn einfach mit einem Klick in Ihren bevorzugten KI-Chat (z. B. ChatGPT, Claude oder Gemini Web) und fügen die Antwort zurück in die App ein. Es wird kein eigener API-Key benötigt und es fallen keinerlei Kosten an.
          </p>
        </div>
      ) : (
        <>
          {/* Model */}
          <div>
            <label className="text-xs font-bold text-ink uppercase tracking-wider">{t('ai.model')}</label>
            <input
              type="text"
              value={model}
              onChange={(e) => setModel(e.target.value)}
              placeholder={t('ai.modelPlaceholder')}
              className="mt-1 w-full rounded border border-line bg-surface-2 px-3 py-2 text-sm text-ink focus:border-indicator focus:outline-none"
            />
          </div>

          {/* BaseUrl (for Ollama or Custom) */}
          {(provider === 'ollama' || provider === 'custom') && (
            <div>
              <label className="text-xs font-bold text-ink uppercase tracking-wider">{t('ai.baseUrl')}</label>
              <input
                type="url"
                value={baseUrl}
                onChange={(e) => setBaseUrl(e.target.value)}
                placeholder={t('ai.baseUrlPlaceholder')}
                className="mt-1 w-full rounded border border-line bg-surface-2 px-3 py-2 text-sm text-ink focus:border-indicator focus:outline-none"
              />
            </div>
          )}

          {/* API Key */}
          {provider !== 'ollama' && (
            <div>
              <div className="flex items-center justify-between">
                <label className="text-xs font-bold text-ink uppercase tracking-wider">{t('ai.apiKey')}</label>
                {config.hasApiKey && (
                  <span className="inline-flex items-center gap-1 rounded bg-emerald-500/10 px-2 py-0.5 text-xs font-semibold text-emerald-700 dark:text-emerald-300">
                    <Icon name="check" size={13} />
                    {t('ai.apiKeyStored')}
                  </span>
                )}
              </div>
              <input
                type="password"
                value={apiKey}
                onChange={(e) => setApiKey(e.target.value)}
                placeholder={t('ai.apiKeyPlaceholder')}
                className="mt-1 w-full rounded border border-line bg-surface-2 px-3 py-2 text-sm text-ink focus:border-indicator focus:outline-none"
              />
            </div>
          )}
        </>
      )}

      {/* Pseudonymization toggle */}
      <div className="rounded-lg border border-line bg-surface-2/40 p-3 flex flex-col gap-1">
        <label className="flex items-center gap-2 cursor-pointer text-xs font-semibold text-ink">
          <input
            type="checkbox"
            checked={pseudonymize}
            onChange={(e) => setPseudonymize(e.target.checked)}
            className="rounded border-line text-indicator focus:ring-0"
          />
          {t('ai.pseudonymize')}
        </label>
        <p className="text-xs text-ink-muted pl-5">{t('ai.pseudonymizeHint')}</p>
      </div>

      {/* Modal Actions Footer */}
      <div className="flex w-full items-center justify-between border-t border-line pt-3 mt-2">
        <div>
          {provider !== 'copy_paste' && (
            <Button
              variant="secondary"
              small
              type="button"
              disabled={testMutation.isPending}
              onClick={() => testMutation.mutate()}
            >
              {testMutation.isPending ? t('ai.testing') : t('ai.testConnection')}
            </Button>
          )}
        </div>
        <div className="flex gap-2">
          <Button variant="secondary" onClick={onClose}>
            {t('common.cancel', 'Abbrechen')}
          </Button>
          <Button
            variant="confirm"
            disabled={saveMutation.isPending}
            onClick={() => saveMutation.mutate()}
          >
            {saveMutation.isPending ? t('ai.saving') : t('ai.save')}
          </Button>
        </div>
      </div>
    </div>
  )
}
