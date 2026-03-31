import { useState, useRef, useCallback, useEffect } from 'react'

// ── Preset definitions ────────────────────────────────────────────────────────

const PRESETS = [
  {
    id: 'quick-scan',
    icon: '⚡',
    name: 'Quick Scan',
    description: 'Fast overview across all genomic domains',
    agents: 2,
    cost: '$0.05–0.10',
    time: '2–4 min',
    color: '#06b6d4',
  },
  {
    id: 'cancer-research',
    icon: '🔬',
    name: 'Cancer Research',
    description: 'Deep cancer & tumor genetics analysis',
    agents: 10,
    cost: '$0.50–2.00',
    time: '10–20 min',
    color: '#f43f5e',
  },
  {
    id: 'cardiovascular',
    icon: '❤️',
    name: 'Cardiovascular',
    description: 'Heart & vascular genetic risk factors',
    agents: 6,
    cost: '$0.30–1.00',
    time: '8–15 min',
    color: '#f97316',
  },
  {
    id: 'pharmacogenomics',
    icon: '💊',
    name: 'Pharmacogenomics',
    description: 'Drug metabolism & interaction genetics',
    agents: 5,
    cost: '$0.20–0.80',
    time: '6–12 min',
    color: '#8b5cf6',
  },
  {
    id: 'rare-disease',
    icon: '🧬',
    name: 'Rare Disease',
    description: 'Rare & orphan disease variant panel',
    agents: 8,
    cost: '$0.40–1.50',
    time: '10–18 min',
    color: '#34D399',
  },
  {
    id: 'custom',
    icon: '⚙️',
    name: 'Custom',
    description: 'Build your own analysis pipeline',
    agents: null,
    cost: 'Varies',
    time: 'Varies',
    color: '#9CA3AF',
  },
]

// ── Default custom agent pipeline ────────────────────────────────────────────

function defaultAgents() {
  return [
    {
      phase: 'analysis',
      phaseLabel: 'Analysis Phase',
      agents: [
        { id: 'general-scanner', label: 'General Scanner', model: 'haiku', icon: '🧬', prompt: 'Scan the DNA data for significant variants across all genes.', focusGenes: '', webSearch: true, expanded: false },
        { id: 'drug-metabolism', label: 'Drug Metabolism', model: 'haiku', icon: '💊', prompt: 'Analyze pharmacogenomic variants affecting drug metabolism.', focusGenes: 'CYP2D6,CYP2C19,CYP2C9', webSearch: false, expanded: false },
      ],
    },
    {
      phase: 'synthesis',
      phaseLabel: 'Synthesis Phase',
      agents: [
        { id: 'synthesizer', label: 'Synthesizer', model: 'sonnet', icon: '📋', prompt: 'Synthesize all research agent findings into a coherent report.', focusGenes: '', webSearch: false, expanded: false },
      ],
    },
  ]
}

// ── Helper: detect format from filename ──────────────────────────────────────

function detectFormat(filename) {
  if (!filename) return null
  const lower = filename.toLowerCase()
  if (lower.includes('23andme') || lower.endsWith('.txt')) return '23andMe'
  if (lower.includes('ancestry')) return 'AncestryDNA'
  if (lower.includes('myheritage')) return 'MyHeritage'
  if (lower.endsWith('.vcf')) return 'VCF'
  if (lower.endsWith('.csv')) return 'CSV'
  return 'Auto-detect'
}

// ── Sub-components ────────────────────────────────────────────────────────────

function AgentPipelineEditor({ pipeline, onChange }) {
  function updateAgent(phaseIdx, agentIdx, patch) {
    const next = pipeline.map((ph, pi) =>
      pi !== phaseIdx ? ph : {
        ...ph,
        agents: ph.agents.map((ag, ai) => ai !== agentIdx ? ag : { ...ag, ...patch }),
      }
    )
    onChange(next)
  }

  function removeAgent(phaseIdx, agentIdx) {
    const next = pipeline.map((ph, pi) =>
      pi !== phaseIdx ? ph : {
        ...ph,
        agents: ph.agents.filter((_, ai) => ai !== agentIdx),
      }
    )
    onChange(next)
  }

  function addAgent(phaseIdx) {
    const ph = pipeline[phaseIdx]
    const newAgent = {
      id: `agent-${Date.now()}`,
      label: 'New Agent',
      model: 'haiku',
      icon: '🧬',
      prompt: '',
      focusGenes: '',
      webSearch: false,
      expanded: true,
    }
    const next = pipeline.map((p, pi) =>
      pi !== phaseIdx ? p : { ...p, agents: [...p.agents, newAgent] }
    )
    onChange(next)
  }

  function toggleExpand(phaseIdx, agentIdx) {
    updateAgent(phaseIdx, agentIdx, { expanded: !pipeline[phaseIdx].agents[agentIdx].expanded })
  }

  return (
    <div className="ss-pipeline">
      {pipeline.map((phase, pi) => (
        <div key={phase.phase} className="ss-phase">
          <div className="ss-phase-label">{phase.phaseLabel}</div>
          {phase.agents.map((agent, ai) => (
            <div key={agent.id} className={`ss-agent-card ${agent.expanded ? 'expanded' : ''}`}>
              <div className="ss-agent-header" onClick={() => toggleExpand(pi, ai)}>
                <span className="ss-agent-icon">{agent.icon}</span>
                <input
                  className="ss-agent-label-input"
                  value={agent.label}
                  onClick={e => e.stopPropagation()}
                  onChange={e => updateAgent(pi, ai, { label: e.target.value })}
                  placeholder="Agent name"
                />
                <select
                  className="ss-model-select"
                  value={agent.model}
                  onClick={e => e.stopPropagation()}
                  onChange={e => updateAgent(pi, ai, { model: e.target.value })}
                >
                  <option value="haiku">Haiku</option>
                  <option value="sonnet">Sonnet</option>
                  <option value="opus">Opus</option>
                </select>
                <button
                  className="ss-btn-remove"
                  onClick={e => { e.stopPropagation(); removeAgent(pi, ai) }}
                  title="Remove agent"
                  disabled={phase.agents.length <= 1}
                >×</button>
                <span className="ss-agent-expand-arrow">{agent.expanded ? '▲' : '▼'}</span>
              </div>
              {agent.expanded && (
                <div className="ss-agent-body">
                  <label className="ss-field-label">Prompt / Instructions</label>
                  <textarea
                    className="ss-textarea"
                    value={agent.prompt}
                    onChange={e => updateAgent(pi, ai, { prompt: e.target.value })}
                    placeholder="Research instructions for this agent…"
                    rows={3}
                  />
                  <label className="ss-field-label">Focus Genes (comma-separated)</label>
                  <input
                    className="ss-input"
                    value={agent.focusGenes}
                    onChange={e => updateAgent(pi, ai, { focusGenes: e.target.value })}
                    placeholder="e.g. BRCA1, BRCA2, TP53"
                  />
                  <div className="ss-toggle-row">
                    <label className="ss-field-label">Web Search</label>
                    <button
                      className={`ss-toggle ${agent.webSearch ? 'on' : 'off'}`}
                      onClick={() => updateAgent(pi, ai, { webSearch: !agent.webSearch })}
                    >
                      {agent.webSearch ? 'Enabled' : 'Disabled'}
                    </button>
                  </div>
                </div>
              )}
            </div>
          ))}
          <button className="ss-btn-add-agent" onClick={() => addAgent(pi)}>
            + Add Agent to {phase.phaseLabel}
          </button>
        </div>
      ))}
    </div>
  )
}

// ── Main SetupScreen ──────────────────────────────────────────────────────────

export default function SetupScreen({ onStart }) {
  const [dnaPath, setDnaPath] = useState('')
  const [dnaFile, setDnaFile] = useState(null)
  const [dragOver, setDragOver] = useState(false)
  const [selectedPreset, setSelectedPreset] = useState(null)
  const [showAgents, setShowAgents] = useState(false)
  const [pipeline, setPipeline] = useState(defaultAgents())
  const [medicalHistory, setMedicalHistory] = useState('')
  const [defaultModel, setDefaultModel] = useState('haiku')
  const [costLimit, setCostLimit] = useState(10)
  const [webSearch, setWebSearch] = useState(true)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const [chipInfo, setChipInfo] = useState(null)
  const [chipLoading, setChipLoading] = useState(false)
  const fileInputRef = useRef(null)

  // Auto-run chip check when dnaPath changes
  useEffect(() => {
    if (!dnaPath || dnaPath.length < 3) {
      setChipInfo(null)
      return
    }
    const timer = setTimeout(async () => {
      setChipLoading(true)
      setChipInfo(null)
      try {
        const res = await fetch('/api/check-chip', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ dnaPath }),
        })
        const data = await res.json()
        if (res.ok) {
          setChipInfo(data)
          setError(null)
        } else {
          setChipInfo(null)
          setError(data.error || 'Could not analyze file')
        }
      } catch {
        setChipInfo(null)
      } finally {
        setChipLoading(false)
      }
    }, 500)
    return () => clearTimeout(timer)
  }, [dnaPath])

  const detectedFormat = detectFormat(dnaFile?.name || dnaPath)

  function handleFileDrop(e) {
    e.preventDefault()
    setDragOver(false)
    const file = e.dataTransfer.files[0]
    if (file) {
      setDnaFile(file)
      setDnaPath(file.path || file.name)
    }
  }

  function handleFileInput(e) {
    const file = e.target.files[0]
    if (file) {
      setDnaFile(file)
      setDnaPath(file.path || file.name)
    }
  }

  function selectPreset(preset) {
    setSelectedPreset(preset.id)
    if (preset.id === 'custom') {
      setShowAgents(true)
    }
  }

  async function startAnalysis() {
    if (!dnaPath) {
      setError('Please select or enter a DNA file path.')
      return
    }
    if (!selectedPreset) {
      setError('Please select an analysis preset.')
      return
    }

    setLoading(true)
    setError(null)

    try {
      const body = {
        dnaPath,
        preset: selectedPreset,
        settings: {
          defaultModel,
          medicalHistory,
          costLimit,
          webSearch,
        },
        customAgents: selectedPreset === 'custom' ? pipeline : null,
      }

      const res = await fetch('/api/start-analysis', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })

      const data = await res.json()
      if (!res.ok) {
        throw new Error(data.error || `Server error ${res.status}`)
      }

      onStart()
    } catch (err) {
      setError(err.message)
      setLoading(false)
    }
  }

  return (
    <>
      <style>{`
        .ss-screen {
          min-height: 100svh;
          background: var(--bg, #0f1923);
          display: flex;
          flex-direction: column;
          align-items: center;
          padding: 40px 16px 80px;
          font-family: var(--font-sans, 'Inter', sans-serif);
          color: var(--text, #e2e8f0);
        }

        .ss-header {
          display: flex;
          align-items: center;
          gap: 14px;
          margin-bottom: 8px;
        }

        .ss-logo-mark {
          width: 44px;
          height: 44px;
        }

        .ss-title {
          font-size: 26px;
          font-weight: 700;
          letter-spacing: -0.5px;
          background: linear-gradient(135deg, #34D399 0%, #06b6d4 100%);
          -webkit-background-clip: text;
          -webkit-text-fill-color: transparent;
          background-clip: text;
        }

        .ss-subtitle {
          text-align: center;
          color: var(--text-dim, #9CA3AF);
          font-size: 14px;
          margin-bottom: 48px;
        }

        .ss-card {
          background: var(--bg-card, #1a2332);
          border: 1px solid var(--border, rgba(52,211,153,0.12));
          border-radius: 16px;
          padding: 28px 32px;
          width: 100%;
          max-width: 860px;
          margin-bottom: 20px;
        }

        .ss-section-title {
          font-size: 13px;
          font-weight: 600;
          text-transform: uppercase;
          letter-spacing: 0.08em;
          color: var(--green, #34D399);
          margin-bottom: 18px;
          display: flex;
          align-items: center;
          gap: 8px;
        }

        .ss-section-num {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          width: 22px;
          height: 22px;
          border-radius: 50%;
          background: rgba(52,211,153,0.15);
          font-size: 11px;
          font-weight: 700;
          color: var(--green, #34D399);
          flex-shrink: 0;
        }

        /* DNA Drop Zone */
        .ss-dropzone {
          border: 2px dashed rgba(52,211,153,0.25);
          border-radius: 12px;
          padding: 36px 24px;
          text-align: center;
          cursor: pointer;
          transition: all 0.2s;
          background: rgba(52,211,153,0.03);
          margin-bottom: 16px;
        }

        .ss-dropzone:hover,
        .ss-dropzone.drag-over {
          border-color: rgba(52,211,153,0.55);
          background: rgba(52,211,153,0.07);
        }

        .ss-dropzone-icon {
          font-size: 36px;
          margin-bottom: 10px;
          display: block;
        }

        .ss-dropzone-text {
          font-size: 14px;
          color: var(--text-dim, #9CA3AF);
          margin-bottom: 6px;
        }

        .ss-dropzone-hint {
          font-size: 12px;
          color: var(--text-faint, rgba(226,232,240,0.4));
        }

        .ss-dropzone.has-file {
          border-color: rgba(52,211,153,0.45);
          background: rgba(52,211,153,0.06);
        }

        .ss-file-selected {
          font-size: 13px;
          font-family: var(--font-mono, monospace);
          color: var(--green, #34D399);
          font-weight: 600;
          margin-bottom: 4px;
        }

        .ss-format-badge {
          display: inline-block;
          background: rgba(6,182,212,0.15);
          color: var(--cyan, #06b6d4);
          border: 1px solid rgba(6,182,212,0.3);
          border-radius: 6px;
          font-size: 11px;
          font-weight: 600;
          padding: 2px 8px;
          margin-top: 6px;
          letter-spacing: 0.04em;
        }

        .ss-path-input {
          width: 100%;
          background: var(--bg-elevated, #1e2a3d);
          border: 1px solid var(--border-dim, rgba(255,255,255,0.06));
          border-radius: 8px;
          padding: 10px 14px;
          color: var(--text, #e2e8f0);
          font-family: var(--font-mono, monospace);
          font-size: 13px;
          outline: none;
          transition: border-color 0.15s;
        }

        .ss-path-input:focus {
          border-color: rgba(52,211,153,0.4);
        }

        .ss-path-input::placeholder {
          color: var(--text-faint, rgba(226,232,240,0.35));
        }

        .ss-formats {
          display: flex;
          gap: 8px;
          flex-wrap: wrap;
          margin-top: 12px;
        }

        .ss-format-tag {
          font-size: 11px;
          color: var(--text-dim, #9CA3AF);
          background: var(--bg-elevated, #1e2a3d);
          border: 1px solid var(--border-dim, rgba(255,255,255,0.06));
          border-radius: 6px;
          padding: 3px 8px;
        }

        /* Preset Grid */
        .ss-preset-grid {
          display: grid;
          grid-template-columns: repeat(auto-fill, minmax(240px, 1fr));
          gap: 12px;
        }

        .ss-preset-card {
          background: var(--bg-elevated, #1e2a3d);
          border: 2px solid var(--border-dim, rgba(255,255,255,0.06));
          border-radius: 12px;
          padding: 18px 20px;
          cursor: pointer;
          transition: all 0.18s;
          position: relative;
        }

        .ss-preset-card:hover {
          border-color: rgba(52,211,153,0.3);
          background: rgba(52,211,153,0.04);
        }

        .ss-preset-card.selected {
          border-color: var(--green, #34D399);
          background: rgba(52,211,153,0.07);
          box-shadow: 0 0 0 1px rgba(52,211,153,0.2), 0 4px 20px rgba(52,211,153,0.08);
        }

        .ss-preset-icon {
          font-size: 24px;
          margin-bottom: 10px;
          display: block;
        }

        .ss-preset-name {
          font-size: 14px;
          font-weight: 600;
          color: var(--text, #e2e8f0);
          margin-bottom: 5px;
        }

        .ss-preset-desc {
          font-size: 12px;
          color: var(--text-dim, #9CA3AF);
          margin-bottom: 12px;
          line-height: 1.5;
        }

        .ss-preset-meta {
          display: flex;
          gap: 10px;
          flex-wrap: wrap;
        }

        .ss-preset-meta-item {
          font-size: 11px;
          color: var(--text-faint, rgba(226,232,240,0.5));
          display: flex;
          align-items: center;
          gap: 4px;
        }

        .ss-preset-meta-item strong {
          color: var(--text-dim, #9CA3AF);
          font-weight: 500;
        }

        .ss-selected-check {
          position: absolute;
          top: 12px;
          right: 12px;
          width: 20px;
          height: 20px;
          background: var(--green, #34D399);
          border-radius: 50%;
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 11px;
          color: #0f1923;
          font-weight: 700;
        }

        .ss-customize-btn {
          display: inline-flex;
          align-items: center;
          gap: 6px;
          margin-top: 16px;
          font-size: 12px;
          color: var(--cyan, #06b6d4);
          background: none;
          border: 1px solid rgba(6,182,212,0.3);
          border-radius: 6px;
          padding: 5px 12px;
          cursor: pointer;
          transition: all 0.15s;
        }

        .ss-customize-btn:hover {
          background: rgba(6,182,212,0.08);
          border-color: rgba(6,182,212,0.5);
        }

        /* Pipeline editor */
        .ss-pipeline {
          display: flex;
          flex-direction: column;
          gap: 20px;
        }

        .ss-phase {
          background: var(--bg, #0f1923);
          border: 1px solid var(--border-dim, rgba(255,255,255,0.06));
          border-radius: 10px;
          padding: 16px 18px;
        }

        .ss-phase-label {
          font-size: 11px;
          font-weight: 600;
          text-transform: uppercase;
          letter-spacing: 0.08em;
          color: var(--cyan, #06b6d4);
          margin-bottom: 12px;
        }

        .ss-agent-card {
          background: var(--bg-card, #1a2332);
          border: 1px solid var(--border-dim, rgba(255,255,255,0.06));
          border-radius: 8px;
          margin-bottom: 8px;
          overflow: hidden;
          transition: border-color 0.15s;
        }

        .ss-agent-card.expanded {
          border-color: rgba(52,211,153,0.2);
        }

        .ss-agent-header {
          display: flex;
          align-items: center;
          gap: 8px;
          padding: 10px 12px;
          cursor: pointer;
          user-select: none;
        }

        .ss-agent-icon {
          font-size: 16px;
          flex-shrink: 0;
        }

        .ss-agent-label-input {
          flex: 1;
          background: transparent;
          border: none;
          color: var(--text, #e2e8f0);
          font-size: 13px;
          font-weight: 500;
          outline: none;
          min-width: 0;
        }

        .ss-agent-label-input:focus {
          color: var(--green, #34D399);
        }

        .ss-model-select {
          background: var(--bg, #0f1923);
          border: 1px solid var(--border-dim, rgba(255,255,255,0.06));
          border-radius: 5px;
          color: var(--text-dim, #9CA3AF);
          font-size: 11px;
          padding: 3px 6px;
          cursor: pointer;
          outline: none;
          flex-shrink: 0;
        }

        .ss-model-select:focus {
          border-color: rgba(52,211,153,0.3);
        }

        .ss-btn-remove {
          background: none;
          border: none;
          color: rgba(244,63,94,0.5);
          font-size: 16px;
          cursor: pointer;
          padding: 0 4px;
          line-height: 1;
          transition: color 0.15s;
          flex-shrink: 0;
        }

        .ss-btn-remove:hover:not(:disabled) {
          color: #f43f5e;
        }

        .ss-btn-remove:disabled {
          opacity: 0.25;
          cursor: not-allowed;
        }

        .ss-agent-expand-arrow {
          font-size: 9px;
          color: var(--text-faint, rgba(226,232,240,0.3));
          flex-shrink: 0;
        }

        .ss-agent-body {
          padding: 12px 16px 16px;
          border-top: 1px solid var(--border-dim, rgba(255,255,255,0.06));
          display: flex;
          flex-direction: column;
          gap: 10px;
        }

        .ss-field-label {
          font-size: 11px;
          font-weight: 600;
          text-transform: uppercase;
          letter-spacing: 0.06em;
          color: var(--text-dim, #9CA3AF);
          display: block;
          margin-bottom: 5px;
        }

        .ss-textarea {
          width: 100%;
          background: var(--bg, #0f1923);
          border: 1px solid var(--border-dim, rgba(255,255,255,0.06));
          border-radius: 7px;
          padding: 10px 12px;
          color: var(--text, #e2e8f0);
          font-family: var(--font-sans, 'Inter', sans-serif);
          font-size: 13px;
          line-height: 1.5;
          outline: none;
          resize: vertical;
          transition: border-color 0.15s;
        }

        .ss-textarea:focus {
          border-color: rgba(52,211,153,0.35);
        }

        .ss-input {
          width: 100%;
          background: var(--bg, #0f1923);
          border: 1px solid var(--border-dim, rgba(255,255,255,0.06));
          border-radius: 7px;
          padding: 9px 12px;
          color: var(--text, #e2e8f0);
          font-family: var(--font-mono, monospace);
          font-size: 12px;
          outline: none;
          transition: border-color 0.15s;
        }

        .ss-input:focus {
          border-color: rgba(52,211,153,0.35);
        }

        .ss-input::placeholder {
          color: var(--text-faint, rgba(226,232,240,0.3));
        }

        .ss-toggle-row {
          display: flex;
          align-items: center;
          justify-content: space-between;
        }

        .ss-toggle {
          border: none;
          border-radius: 20px;
          padding: 5px 14px;
          font-size: 12px;
          font-weight: 600;
          cursor: pointer;
          transition: all 0.15s;
        }

        .ss-toggle.on {
          background: rgba(52,211,153,0.18);
          color: var(--green, #34D399);
          border: 1px solid rgba(52,211,153,0.35);
        }

        .ss-toggle.off {
          background: rgba(255,255,255,0.04);
          color: var(--text-faint, rgba(226,232,240,0.4));
          border: 1px solid rgba(255,255,255,0.06);
        }

        .ss-btn-add-agent {
          margin-top: 10px;
          background: none;
          border: 1px dashed rgba(52,211,153,0.2);
          border-radius: 7px;
          color: rgba(52,211,153,0.55);
          font-size: 12px;
          padding: 8px 16px;
          cursor: pointer;
          width: 100%;
          transition: all 0.15s;
        }

        .ss-btn-add-agent:hover {
          border-color: rgba(52,211,153,0.45);
          color: var(--green, #34D399);
          background: rgba(52,211,153,0.04);
        }

        /* Settings */
        .ss-settings-grid {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 16px;
        }

        @media (max-width: 560px) {
          .ss-settings-grid { grid-template-columns: 1fr; }
        }

        .ss-settings-full {
          grid-column: 1 / -1;
        }

        .ss-field {
          display: flex;
          flex-direction: column;
          gap: 6px;
        }

        .ss-settings-textarea {
          width: 100%;
          background: var(--bg, #0f1923);
          border: 1px solid var(--border-dim, rgba(255,255,255,0.06));
          border-radius: 8px;
          padding: 10px 12px;
          color: var(--text, #e2e8f0);
          font-family: var(--font-sans, 'Inter', sans-serif);
          font-size: 13px;
          line-height: 1.5;
          outline: none;
          resize: none;
          transition: border-color 0.15s;
        }

        .ss-settings-textarea:focus {
          border-color: rgba(52,211,153,0.35);
        }

        .ss-settings-textarea::placeholder {
          color: var(--text-faint, rgba(226,232,240,0.3));
        }

        .ss-select {
          background: var(--bg, #0f1923);
          border: 1px solid var(--border-dim, rgba(255,255,255,0.06));
          border-radius: 8px;
          padding: 9px 12px;
          color: var(--text, #e2e8f0);
          font-family: var(--font-sans, 'Inter', sans-serif);
          font-size: 13px;
          outline: none;
          cursor: pointer;
          transition: border-color 0.15s;
        }

        .ss-select:focus {
          border-color: rgba(52,211,153,0.35);
        }

        .ss-number-input {
          background: var(--bg, #0f1923);
          border: 1px solid var(--border-dim, rgba(255,255,255,0.06));
          border-radius: 8px;
          padding: 9px 12px;
          color: var(--text, #e2e8f0);
          font-family: var(--font-mono, monospace);
          font-size: 13px;
          outline: none;
          transition: border-color 0.15s;
          width: 100%;
        }

        .ss-number-input:focus {
          border-color: rgba(52,211,153,0.35);
        }

        .ss-toggle-field {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 10px 0;
        }

        .ss-toggle-field-label {
          font-size: 13px;
          color: var(--text, #e2e8f0);
        }

        .ss-toggle-field-sub {
          font-size: 11px;
          color: var(--text-faint, rgba(226,232,240,0.45));
          margin-top: 2px;
        }

        /* Start button */
        .ss-start-wrap {
          width: 100%;
          max-width: 860px;
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 12px;
          margin-top: 8px;
        }

        .ss-start-btn {
          width: 100%;
          padding: 16px 32px;
          background: linear-gradient(135deg, #34D399 0%, #06b6d4 100%);
          border: none;
          border-radius: 12px;
          font-size: 15px;
          font-weight: 700;
          color: #0f1923;
          cursor: pointer;
          letter-spacing: 0.02em;
          transition: all 0.2s;
          box-shadow: 0 4px 20px rgba(52,211,153,0.25);
        }

        .ss-start-btn:hover:not(:disabled) {
          box-shadow: 0 6px 30px rgba(52,211,153,0.4);
          transform: translateY(-1px);
        }

        .ss-start-btn:active:not(:disabled) {
          transform: translateY(0);
        }

        .ss-start-btn:disabled {
          opacity: 0.6;
          cursor: not-allowed;
        }

        .ss-error {
          background: rgba(244,63,94,0.1);
          border: 1px solid rgba(244,63,94,0.3);
          border-radius: 8px;
          padding: 10px 14px;
          font-size: 13px;
          color: #f43f5e;
          width: 100%;
          text-align: center;
        }

        .ss-loading-dot {
          display: inline-block;
          animation: ss-spin 1s linear infinite;
        }

        @keyframes ss-spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
      `}</style>

      <div className="ss-screen">
        {/* Header */}
        <div className="ss-header">
          <svg className="ss-logo-mark" viewBox="0 0 44 44" fill="none" xmlns="http://www.w3.org/2000/svg">
            <defs>
              <linearGradient id="ss-grad" x1="0" y1="0" x2="1" y2="1">
                <stop offset="0%" stopColor="#34D399" />
                <stop offset="100%" stopColor="#06b6d4" />
              </linearGradient>
            </defs>
            <path d="M22 2C11.5 2 3 10.5 3 21c0 13 19 22 19 22s19-9 19-22C41 10.5 32.5 2 22 2z" fill="url(#ss-grad)" opacity="0.9" />
            <circle cx="22" cy="21" r="7" fill="#0f1923" />
            <circle cx="22" cy="21" r="3.5" fill="url(#ss-grad)" />
          </svg>
          <span className="ss-title">Helix Genomics Agents</span>
        </div>
        <div className="ss-subtitle">Configure your DNA analysis pipeline below, then click Start Analysis.</div>

        {/* Section 1: DNA File */}
        <div className="ss-card">
          <div className="ss-section-title">
            <span className="ss-section-num">1</span>
            DNA File
          </div>

          <div
            className={`ss-dropzone ${dragOver ? 'drag-over' : ''} ${dnaFile ? 'has-file' : ''}`}
            onClick={() => fileInputRef.current?.click()}
            onDragOver={e => { e.preventDefault(); setDragOver(true) }}
            onDragLeave={() => setDragOver(false)}
            onDrop={handleFileDrop}
          >
            <input
              ref={fileInputRef}
              type="file"
              accept=".txt,.csv,.vcf,.gz"
              style={{ display: 'none' }}
              onChange={handleFileInput}
            />
            {dnaFile ? (
              <>
                <div className="ss-file-selected">📂 {dnaFile.name}</div>
                <div style={{ fontSize: '12px', color: 'var(--text-dim)' }}>Click to change file</div>
                {detectedFormat && <div className="ss-format-badge">{detectedFormat}</div>}
              </>
            ) : (
              <>
                <span className="ss-dropzone-icon">🧬</span>
                <div className="ss-dropzone-text">Drop your DNA file here or click to browse</div>
                <div className="ss-dropzone-hint">Supported: 23andMe, AncestryDNA, MyHeritage, VCF (.zip/.gz ok)</div>
              </>
            )}
          </div>

          <div style={{ marginBottom: '10px', fontSize: '12px', color: 'var(--text-faint)' }}>
            Or enter an absolute file path:
          </div>
          <input
            className="ss-path-input"
            value={dnaPath}
            onChange={e => { setDnaPath(e.target.value); setDnaFile(null) }}
            placeholder="/absolute/path/to/genome.txt"
            spellCheck={false}
          />

          <div className="ss-formats">
            {['23andMe (.txt)', 'AncestryDNA (.txt)', 'MyHeritage (.csv)', 'VCF (.vcf)', '.zip', '.gz'].map(f => (
              <span key={f} className="ss-format-tag">{f}</span>
            ))}
          </div>
        </div>

        {/* Chip Detection Results */}
          {chipLoading && (
            <div style={{
              marginTop: '16px',
              padding: '16px 20px',
              background: 'rgba(94, 234, 212, 0.04)',
              border: '1px solid rgba(94, 234, 212, 0.15)',
              borderRadius: '12px',
              fontSize: '13px',
              color: '#94a3b8',
              display: 'flex',
              alignItems: 'center',
              gap: '10px',
            }}>
              <span style={{ animation: 'spin 1s linear infinite', display: 'inline-block' }}>🧬</span>
              Analyzing your DNA file...
            </div>
          )}

          {chipInfo && !chipLoading && (
            <div style={{
              marginTop: '16px',
              padding: '20px',
              background: 'rgba(94, 234, 212, 0.04)',
              border: '1px solid rgba(94, 234, 212, 0.15)',
              borderRadius: '14px',
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '14px' }}>
                <span style={{ fontSize: '22px' }}>🧬</span>
                <div>
                  <div style={{ fontSize: '15px', fontWeight: 700, color: '#fff' }}>
                    {chipInfo.provider} — {chipInfo.chipVersion}
                  </div>
                  <div style={{ fontSize: '11px', color: '#94a3b8' }}>
                    {chipInfo.sex} · {chipInfo.format} format{chipInfo.build ? ` · ${chipInfo.build}` : ''}
                  </div>
                </div>
              </div>

              <div style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))',
                gap: '10px',
                marginBottom: '14px',
              }}>
                <div style={{
                  background: 'rgba(45, 212, 191, 0.06)',
                  border: '1px solid rgba(45, 212, 191, 0.15)',
                  borderRadius: '10px',
                  padding: '12px',
                  textAlign: 'center',
                }}>
                  <div style={{ fontSize: '22px', fontWeight: 900, color: '#2DD4BF' }}>
                    {chipInfo.snpCount?.toLocaleString()}
                  </div>
                  <div style={{ fontSize: '9px', color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '1px', marginTop: '2px' }}>
                    SNPs on Chip
                  </div>
                </div>
                <div style={{
                  background: 'rgba(94, 234, 212, 0.06)',
                  border: '1px solid rgba(94, 234, 212, 0.15)',
                  borderRadius: '10px',
                  padding: '12px',
                  textAlign: 'center',
                }}>
                  <div style={{ fontSize: '22px', fontWeight: 900, color: '#5EEAD4' }}>
                    ~{(chipInfo.estimatedImputedSnps / 1000000).toFixed(1)}M
                  </div>
                  <div style={{ fontSize: '9px', color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '1px', marginTop: '2px' }}>
                    After Imputation
                  </div>
                </div>
                {chipInfo.noCallRate != null && (
                  <div style={{
                    background: 'rgba(0, 230, 138, 0.06)',
                    border: '1px solid rgba(0, 230, 138, 0.15)',
                    borderRadius: '10px',
                    padding: '12px',
                    textAlign: 'center',
                  }}>
                    <div style={{ fontSize: '22px', fontWeight: 900, color: chipInfo.noCallRate < 0.03 ? '#00e68a' : '#ffd166' }}>
                      {(chipInfo.noCallRate * 100).toFixed(1)}%
                    </div>
                    <div style={{ fontSize: '9px', color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '1px', marginTop: '2px' }}>
                      No-Call Rate
                    </div>
                  </div>
                )}
              </div>

              <div style={{
                padding: '10px 14px',
                background: 'rgba(45, 212, 191, 0.06)',
                border: '1px solid rgba(45, 212, 191, 0.12)',
                borderRadius: '10px',
                fontSize: '12px',
                color: '#e2e8f0',
                lineHeight: 1.6,
              }}>
                💡 {chipInfo.recommendation}
              </div>
            </div>
          )}
        </div>

        {/* Section 2: Preset */}
        <div className="ss-card">
          <div className="ss-section-title">
            <span className="ss-section-num">2</span>
            Analysis Preset
          </div>

          <div className="ss-preset-grid">
            {PRESETS.map(preset => (
              <div
                key={preset.id}
                className={`ss-preset-card ${selectedPreset === preset.id ? 'selected' : ''}`}
                onClick={() => selectPreset(preset)}
                style={selectedPreset === preset.id ? { borderColor: preset.color } : {}}
              >
                {selectedPreset === preset.id && (
                  <div className="ss-selected-check" style={{ background: preset.color }}>✓</div>
                )}
                <span className="ss-preset-icon">{preset.icon}</span>
                <div className="ss-preset-name">{preset.name}</div>
                <div className="ss-preset-desc">{preset.description}</div>
                <div className="ss-preset-meta">
                  {preset.agents && (
                    <span className="ss-preset-meta-item">
                      🤖 <strong>{preset.agents}</strong> agents
                    </span>
                  )}
                  <span className="ss-preset-meta-item">
                    💰 <strong>{preset.cost}</strong>
                  </span>
                  <span className="ss-preset-meta-item">
                    ⏱ <strong>{preset.time}</strong>
                  </span>
                </div>
              </div>
            ))}
          </div>

          {selectedPreset && selectedPreset !== 'custom' && (
            <button
              className="ss-customize-btn"
              onClick={() => setShowAgents(v => !v)}
            >
              ⚙️ {showAgents ? 'Hide' : 'Customize'} Agent Pipeline
            </button>
          )}
        </div>

        {/* Section 3: Agents (shown for custom or when customizing) */}
        {(selectedPreset === 'custom' || showAgents) && (
          <div className="ss-card">
            <div className="ss-section-title">
              <span className="ss-section-num">3</span>
              Agent Pipeline
            </div>
            <AgentPipelineEditor pipeline={pipeline} onChange={setPipeline} />
          </div>
        )}

        {/* Section 4: Settings */}
        <div className="ss-card">
          <div className="ss-section-title">
            <span className="ss-section-num">{selectedPreset === 'custom' || showAgents ? '4' : '3'}</span>
            Settings
          </div>

          <div className="ss-settings-grid">
            <div className="ss-field ss-settings-full">
              <label className="ss-field-label">Medical History (optional context for agents)</label>
              <textarea
                className="ss-settings-textarea"
                rows={3}
                value={medicalHistory}
                onChange={e => setMedicalHistory(e.target.value)}
                placeholder="e.g. 45-year-old female, family history of breast cancer, no major conditions…"
              />
            </div>

            <div className="ss-field">
              <label className="ss-field-label">Default Model</label>
              <select
                className="ss-select"
                value={defaultModel}
                onChange={e => setDefaultModel(e.target.value)}
              >
                <option value="haiku">Haiku — Fast & cheap</option>
                <option value="sonnet">Sonnet — Balanced</option>
                <option value="opus">Opus — Most capable</option>
              </select>
            </div>

            <div className="ss-field">
              <label className="ss-field-label">Cost Limit (USD)</label>
              <input
                className="ss-number-input"
                type="number"
                min="0.01"
                step="0.50"
                value={costLimit}
                onChange={e => setCostLimit(parseFloat(e.target.value) || 0)}
              />
            </div>

            <div className="ss-field ss-settings-full">
              <div className="ss-toggle-field">
                <div>
                  <div className="ss-toggle-field-label">Web Search</div>
                  <div className="ss-toggle-field-sub">Allow agents to search the web for research context</div>
                </div>
                <button
                  className={`ss-toggle ${webSearch ? 'on' : 'off'}`}
                  onClick={() => setWebSearch(v => !v)}
                >
                  {webSearch ? 'Enabled' : 'Disabled'}
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Start Button */}
        <div className="ss-start-wrap">
          {error && <div className="ss-error">⚠ {error}</div>}
          <button
            className="ss-start-btn"
            onClick={startAnalysis}
            disabled={loading}
          >
            {loading
              ? <><span className="ss-loading-dot">⟳</span> Starting Analysis…</>
              : '🚀 Start Analysis'}
          </button>
        </div>
      </div>
    </>
  )
}
