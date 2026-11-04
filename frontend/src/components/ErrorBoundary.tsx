import {
  IconAlertTriangle,
  IconBolt,
  IconBrandReact,
  IconCode,
  IconFileText,
  IconInfoCircle,
  IconLink,
  IconListDetails,
  IconRefresh,
  IconDeviceDesktop,
  IconWorld,
} from '@tabler/icons-react'
import { Component } from 'react'
import type { ErrorInfo, ReactNode } from 'react'

interface Props {
  children?: ReactNode
}

type Tab = 'stack' | 'context' | 'request' | 'app'

interface StackFrame {
  function: string
  file: string
  line: string
  column: string
  raw: string
}

interface State {
  hasError: boolean
  error: Error | null
  errorInfo: ErrorInfo | null
  activeTab: Tab
  activeFrameIndex: number
}

const TABS: Tab[] = ['stack', 'context', 'request', 'app']

/**
 * Developer crash console for uncaught React render errors, in the style of Laravel Ignition.
 *
 * Deliberately fixed dark and not theme-aware (an exception to the light/dark rule): a crash console is a
 * self-contained diagnostic tool with its own identity, like the browser's developer tools, and must stay legible
 * even when the app's own rendering - theme provider included - is what just broke.
 *
 * It only catches real React render/lifecycle errors (see React's documentation on error boundaries). Errors in event
 * handlers or async code, such as a failed fetch, do not pass through here; those are shown at the place of the action
 * as a specific, copyable message.
 */
export class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null,
    errorInfo: null,
    activeTab: 'stack',
    activeFrameIndex: 0,
  }

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error, errorInfo: null, activeTab: 'stack', activeFrameIndex: 0 }
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('Uncaught error:', error, errorInfo)
    this.setState({ errorInfo })
  }

  private parseStack(stack?: string): StackFrame[] {
    if (!stack) return []
    return stack
      .split('\n')
      .filter((line) => line.trim().startsWith('at '))
      .map((line) => {
        const match = line.match(/at\s+(.*?)\s+\((.*?):(\d+):(\d+)\)/) || line.match(/at\s+(.*?):(\d+):(\d+)/)
        if (match && match.length === 5) {
          return {
            function: match[1] === '?' ? '<anonymous>' : (match[1] ?? ''),
            file: match[2] ?? '',
            line: match[3] ?? '0',
            column: match[4] ?? '0',
            raw: line.trim(),
          }
        }
        return { function: line.replace('at ', '').trim(), file: 'unknown', line: '0', column: '0', raw: line.trim() }
      })
  }

  public render() {
    if (this.state.hasError) {
      const frames = this.parseStack(this.state.error?.stack)
      const activeFrame = frames[this.state.activeFrameIndex] || frames[0]

      return (
        <div className="min-h-screen bg-[#0f111a] font-sans text-gray-300 selection:bg-red-500/30" data-theme="dark">
          {/* Header */}
          <div className="z-10 border-b border-gray-800 bg-[#161b22] shadow-xl">
            <div className="mx-auto flex max-w-[1600px] flex-col justify-between gap-4 px-6 py-4 md:flex-row md:items-start">
              <div className="space-y-1.5">
                <div className="flex w-fit items-center gap-2 rounded-full border border-red-500/20 bg-red-500/10 px-2.5 py-0.5 font-mono text-xs text-red-500 shadow-inner">
                  <IconAlertTriangle size={16} stroke={1.75} />
                  <span>React.ErrorBoundary</span>
                </div>
                <h1 className="text-xl font-bold leading-tight tracking-tight text-white md:text-2xl">
                  {this.state.error?.message || 'Unknown Error'}
                </h1>
                <p className="mt-1 flex items-center gap-1.5 font-mono text-xs text-gray-400">
                  <IconBolt size={14} className="text-yellow-500" />
                  Exception thrown in <span className="font-semibold text-gray-200">{activeFrame?.function || 'React'}</span>
                </p>
              </div>
              <div className="mt-2 flex shrink-0 gap-3 md:mt-0">
                <button
                  onClick={() => window.location.reload()}
                  className="flex items-center gap-2 rounded-lg bg-white px-4 py-2 text-sm font-bold text-black shadow-lg transition-all hover:bg-gray-200 active:scale-95"
                >
                  <IconRefresh size={16} />
                  Reload Application
                </button>
              </div>
            </div>

            {/* Tabs */}
            <div className="custom-scrollbar mx-auto mt-2 flex max-w-[1600px] gap-6 overflow-x-auto border-t border-gray-800/50 px-6 pt-1">
              {TABS.map((tab) => (
                <button
                  key={tab}
                  onClick={() => this.setState({ activeTab: tab })}
                  className={`whitespace-nowrap px-2 pb-2 text-xs font-semibold uppercase tracking-wider transition-colors ${
                    this.state.activeTab === tab
                      ? 'border-b-2 border-red-500 text-red-400'
                      : 'text-gray-500 hover:text-gray-300'
                  }`}
                >
                  {tab}
                </button>
              ))}
            </div>
          </div>

          {/* Content */}
          <div className="mx-auto grid w-full max-w-[1600px] flex-1 grid-cols-1 gap-8 p-6 lg:grid-cols-12">
            {this.state.activeTab === 'stack' && (
              <>
                <div className="flex h-[calc(100vh-300px)] flex-col overflow-hidden rounded-xl border border-gray-800 bg-[#161b22] shadow-2xl lg:col-span-4">
                  <div className="border-b border-gray-800 bg-[#1c2128] p-4">
                    <h3 className="flex items-center gap-2 text-sm font-semibold uppercase tracking-wider text-gray-200">
                      <IconListDetails size={16} />
                      Call Stack
                    </h3>
                  </div>
                  <div className="custom-scrollbar flex-1 overflow-y-auto">
                    {frames.length > 0 ? (
                      frames.map((frame, idx) => (
                        <div
                          key={idx}
                          onClick={() => this.setState({ activeFrameIndex: idx })}
                          className={`cursor-pointer border-b border-gray-800/50 p-4 transition-colors ${
                            this.state.activeFrameIndex === idx
                              ? 'border-l-4 border-l-red-500 bg-red-500/10'
                              : 'border-l-4 border-l-transparent hover:bg-gray-800/30'
                          }`}
                        >
                          <div className={`break-all font-mono text-sm ${this.state.activeFrameIndex === idx ? 'text-red-400' : 'text-gray-300'}`}>
                            {frame.function}
                          </div>
                          <div className="mt-2 flex items-center gap-1.5 truncate text-xs text-gray-500">
                            <IconFileText size={14} className="shrink-0" />
                            <span className="truncate">{frame.file}</span>
                            <span className="shrink-0 rounded bg-gray-800 px-1.5 font-mono text-gray-400">:{frame.line}</span>
                          </div>
                        </div>
                      ))
                    ) : (
                      <div className="p-4 text-sm text-gray-500">No JavaScript stack trace available.</div>
                    )}
                  </div>
                </div>

                <div className="flex h-[calc(100vh-300px)] flex-col overflow-hidden rounded-xl border border-gray-800 bg-[#161b22] shadow-2xl lg:col-span-8">
                  <div className="flex items-center gap-2 border-b border-gray-800 bg-[#1c2128] p-4 text-sm text-gray-400">
                    <IconCode size={20} className="text-red-400" />
                    <span className="truncate">{activeFrame?.file || 'unknown'}</span>
                    <span className="rounded bg-gray-900 px-2 py-0.5 font-mono text-gray-600">Line {activeFrame?.line || '0'}</span>
                  </div>
                  <div className="custom-scrollbar flex-1 overflow-auto bg-[#0d1117] p-6">
                    <div className="mb-8 border-b border-gray-800/50 pb-8">
                      <h4 className="mb-3 text-sm font-semibold uppercase tracking-wider text-gray-500">Raw Stack Frame</h4>
                      <div className="relative overflow-hidden rounded-lg border border-red-900/30 bg-[#161b22] p-4 font-mono text-sm shadow-inner">
                        <div className="absolute bottom-0 left-0 top-0 w-1 bg-red-500" />
                        <span className="text-gray-400">at </span>
                        <span className="text-red-300">{activeFrame?.function} </span>
                        <span className="text-gray-500">
                          ({activeFrame?.file}:{activeFrame?.line}:{activeFrame?.column})
                        </span>
                      </div>
                    </div>

                    {this.state.errorInfo?.componentStack && (
                      <div>
                        <h4 className="mb-3 flex items-center gap-2 text-sm font-semibold uppercase tracking-wider text-gray-500">
                          <IconBrandReact size={18} className="text-blue-400" /> React Component Tree
                        </h4>
                        <div className="rounded-xl border border-gray-800 bg-[#161b22] p-1 shadow-inner">
                          <pre className="overflow-x-auto p-4 font-mono text-sm leading-relaxed text-gray-400">
                            {this.state.errorInfo.componentStack}
                          </pre>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </>
            )}

            {this.state.activeTab === 'context' && (
              <div className="overflow-hidden rounded-xl border border-gray-800 bg-[#161b22] p-8 shadow-2xl lg:col-span-12">
                <h3 className="mb-6 text-2xl font-bold text-white">Environment Context</h3>
                <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
                  <div className="rounded-xl border border-gray-800 bg-[#0d1117] p-5 shadow-inner">
                    <h4 className="mb-3 flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-gray-500">
                      <IconWorld size={16} /> Browser User Agent
                    </h4>
                    <p className="break-words font-mono text-sm text-gray-300">{navigator.userAgent}</p>
                  </div>
                  <div className="rounded-xl border border-gray-800 bg-[#0d1117] p-5 shadow-inner">
                    <h4 className="mb-3 flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-gray-500">
                      <IconLink size={16} /> Current URL
                    </h4>
                    <p className="break-all font-mono text-sm text-gray-300">{window.location.href}</p>
                  </div>
                  <div className="rounded-xl border border-gray-800 bg-[#0d1117] p-5 shadow-inner">
                    <h4 className="mb-3 flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-gray-500">
                      <IconDeviceDesktop size={16} /> Viewport
                    </h4>
                    <p className="font-mono text-sm text-gray-300">
                      {window.innerWidth} x {window.innerHeight}
                      <span className="ml-2 text-gray-500">
                        (Screen: {window.screen.width}x{window.screen.height})
                      </span>
                    </p>
                  </div>
                </div>
              </div>
            )}

            {(this.state.activeTab === 'request' || this.state.activeTab === 'app') && (
              <div className="flex h-64 items-center justify-center rounded-xl border border-gray-800 bg-[#161b22] text-gray-500 shadow-2xl lg:col-span-12">
                <div className="text-center">
                  <IconInfoCircle size={64} className="mx-auto mb-4 opacity-30" />
                  <p className="text-lg">Data not available for pure frontend React exceptions.</p>
                </div>
              </div>
            )}
          </div>
        </div>
      )
    }

    return this.props.children
  }
}
