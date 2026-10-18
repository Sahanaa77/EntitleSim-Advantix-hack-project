import React, { useState, useEffect } from 'react'
import { Copy, Download, Check, FileCode, Terminal, Sparkles, X } from 'lucide-react'
import { useApp } from '../context/AppContext'
import { exportCounterexample, exportSuite } from '../lib/api'

export const RegressionExport: React.FC = () => {
  const { selectedCx, currentRun } = useApp()

  const [format, setFormat] = useState<'pytest' | 'json'>('pytest')
  const [copied, setCopied] = useState(false)
  const [exportData, setExportData] = useState<{ filename: string; content: string } | null>(null)
  const [isLoading, setIsLoading] = useState(false)

  // CI Suite Export State
  const [isSuiteModalOpen, setIsSuiteModalOpen] = useState(false)
  const [suiteFiles, setSuiteFiles] = useState<Array<{ filename: string; content: string }>>([])
  const [activeSuiteTab, setActiveSuiteTab] = useState(0)
  const [suiteCopied, setSuiteCopied] = useState(false)

  const activeCx = selectedCx || currentRun?.counterexamples?.[0]

  useEffect(() => {
    if (!activeCx) return
    setIsLoading(true)
    exportCounterexample(activeCx.id, format)
      .then((data) => setExportData(data))
      .catch((err) => console.error('Export failed:', err))
      .finally(() => setIsLoading(false))
  }, [activeCx?.id, format])

  const handleCopy = () => {
    if (!exportData) return
    navigator.clipboard.writeText(exportData.content)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const handleDownload = () => {
    if (!exportData) return
    const blob = new Blob([exportData.content], { type: 'text/plain' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = exportData.filename
    a.click()
    URL.revokeObjectURL(url)
  }

  const handleExportSuite = async () => {
    if (!currentRun) return
    try {
      const res = await exportSuite(currentRun.id)
      setSuiteFiles(res.files)
      setIsSuiteModalOpen(true)
    } catch (err: any) {
      console.error('Suite export failed:', err)
    }
  }

  const handleCopySuite = () => {
    if (!suiteFiles[activeSuiteTab]) return
    navigator.clipboard.writeText(suiteFiles[activeSuiteTab].content)
    setSuiteCopied(true)
    setTimeout(() => setSuiteCopied(false), 2000)
  }

  const handleDownloadSuite = () => {
    const file = suiteFiles[activeSuiteTab]
    if (!file) return
    const blob = new Blob([file.content], { type: 'text/plain' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = file.filename
    a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">Step 6: Regression Export</h1>
          <p className="text-sm text-slate-500 mt-1">
            Export deterministic regression tests and CI workflows to safeguard against regressions.
          </p>
        </div>

        <div className="flex items-center gap-2">
          {currentRun && (
            <button
              onClick={handleExportSuite}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-slate-700 bg-white border border-slate-200 rounded-lg hover:bg-slate-50 shadow-xs cursor-pointer"
            >
              <Sparkles className="w-3.5 h-3.5 text-blue-600" />
              <span>Export CI Suite & Workflow</span>
            </button>
          )}

          <button
            onClick={handleCopy}
            disabled={!exportData}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-slate-700 bg-white border border-slate-200 rounded-lg hover:bg-slate-50 shadow-xs cursor-pointer disabled:opacity-50"
          >
            {copied ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
            <span>{copied ? 'Copied!' : 'Copy Code'}</span>
          </button>

          <button
            onClick={handleDownload}
            disabled={!exportData}
            className="inline-flex items-center gap-1.5 px-4 py-1.5 text-xs font-semibold text-white bg-blue-600 rounded-lg hover:bg-blue-700 shadow-xs cursor-pointer disabled:opacity-50"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Download</span>
          </button>
        </div>
      </div>

      {/* Format Selector Tabs */}
      <div className="flex items-center gap-2 border-b border-slate-200">
        <button
          onClick={() => setFormat('pytest')}
          className={`px-4 py-2 text-xs font-semibold border-b-2 -mb-px transition-colors cursor-pointer ${
            format === 'pytest'
              ? 'border-blue-600 text-blue-600'
              : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          pytest (Python)
        </button>
        <button
          onClick={() => setFormat('json')}
          className={`px-4 py-2 text-xs font-semibold border-b-2 -mb-px transition-colors cursor-pointer ${
            format === 'json'
              ? 'border-blue-600 text-blue-600'
              : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          Counterexample JSON
        </button>
      </div>

      {/* Code Preview Card */}
      <div className="bg-slate-900 rounded-xl border border-slate-800 shadow-xl overflow-hidden">
        <div className="px-4 py-2.5 bg-slate-950 border-b border-slate-800 flex items-center justify-between text-xs">
          <div className="flex items-center gap-2 text-slate-400 font-mono">
            <FileCode className="w-4 h-4 text-blue-400" />
            <span>{exportData?.filename || 'test_regression.py'}</span>
          </div>
          <span className="text-[10px] uppercase font-bold text-slate-500 tracking-wider">
            {format}
          </span>
        </div>

        <div className="p-4 overflow-x-auto">
          {isLoading ? (
            <div className="py-12 text-center text-slate-500 text-xs">Generating export...</div>
          ) : (
            <pre className="font-mono text-xs text-slate-200 leading-relaxed">
              {exportData?.content || '# No counterexample selected for export'}
            </pre>
          )}
        </div>
      </div>

      {/* Runnable in CI Instructions */}
      <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-xs space-y-3">
        <div className="flex items-center gap-2 text-xs font-bold text-slate-900">
          <Terminal className="w-4 h-4 text-blue-600" />
          <span>Runnable in CI/CD</span>
        </div>
        <p className="text-xs text-slate-600">
          Drop the exported file into your test directory. The test runs the minimal counterexample sequence
          against your entitlement adapter and fails if regressions occur.
        </p>
        <div className="p-3 bg-slate-900 rounded-lg text-xs font-mono text-slate-300 flex items-center justify-between">
          <code>pytest -v tests/{exportData?.filename || 'test_regression_*.py'}</code>
        </div>
      </div>

      {/* CI Suite Export Modal */}
      {isSuiteModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-xs p-4">
          <div className="bg-white rounded-xl shadow-2xl border border-slate-200 max-w-3xl w-full p-6 space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <Sparkles className="w-5 h-5 text-blue-600" />
                <h3 className="text-base font-bold text-slate-900">One-Click CI Suite Export</h3>
              </div>
              <button
                onClick={() => setIsSuiteModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 p-1 rounded-md hover:bg-slate-100"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Suite Tabs */}
            <div className="flex items-center gap-2 border-b border-slate-200">
              {suiteFiles.map((file: { filename: string; content: string }, idx: number) => (
                <button
                  key={file.filename}
                  onClick={() => setActiveSuiteTab(idx)}
                  className={`px-3 py-1.5 text-xs font-semibold border-b-2 -mb-px transition-colors cursor-pointer ${
                    activeSuiteTab === idx
                      ? 'border-blue-600 text-blue-600'
                      : 'border-transparent text-slate-500 hover:text-slate-800'
                  }`}
                >
                  {file.filename}
                </button>
              ))}
            </div>

            {/* Suite Code Viewer */}
            <div className="bg-slate-900 rounded-lg p-4 max-h-80 overflow-y-auto">
              <pre className="font-mono text-xs text-slate-200 leading-relaxed">
                {suiteFiles[activeSuiteTab]?.content}
              </pre>
            </div>

            <div className="flex items-center justify-between pt-2">
              <span className="text-xs text-slate-500">
                Consolidates all discovered counterexamples and GitHub Actions configuration.
              </span>
              <div className="flex items-center gap-2">
                <button
                  onClick={handleCopySuite}
                  className="px-3 py-1.5 text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg cursor-pointer flex items-center gap-1.5"
                >
                  {suiteCopied ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                  <span>{suiteCopied ? 'Copied!' : 'Copy'}</span>
                </button>
                <button
                  onClick={handleDownloadSuite}
                  className="px-3 py-1.5 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-lg cursor-pointer flex items-center gap-1.5"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>Download File</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
