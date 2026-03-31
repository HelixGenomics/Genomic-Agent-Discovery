import { useState, useEffect, useRef, useCallback } from 'react'
import './App.css'

// ── Helpers ───────────────────────────────────────────────────────────────────

function jobIdFromUrl() {
  const params = new URLSearchParams(window.location.search)
  return params.get('jobId') || null
}

function fmtTime(ts) {
  if (!ts) return ''
  try {
    const d = new Date(ts)
    return d.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', second: '2-digit' })
  } catch {
    return ''
  }
}

function fmtAge(ts) {
  if (!ts) return ''
  const secs = Math.floor((Date.now() - new Date(ts)) / 1000)
  if (secs < 60) return `${secs}s ago`
  if (secs < 3600) return `${Math.floor(secs / 60)}m ago`
  return `${Math.floor(secs / 3600)}h ago`
}

const SIG_ORDER = ['high', 'moderate', 'drug_response', 'protective', 'low', 'other']

function sigClass(cat) {
  if (!cat) return 'sig-other'
  const c = cat.toLowerCase()
  if (c === 'high' || c === 'pathogenic') return 'sig-high'
  if (c === 'moderate' || c === 'likely_pathogenic') return 'sig-moderate'
  if (c.includes('drug') || c.includes('pharma')) return 'sig-drug'
  return 'sig-other'
}

function sigLabel(cat) {
  if (!cat) return 'other'
  const c = cat.toLowerCase()
  if (c === 'high' || c === 'pathogenic') return 'High'
  if (c === 'moderate' || c === 'likely_pathogenic') return 'Moderate'
  if (c.includes('drug') || c.includes('pharma')) return 'Drug'
  return 'Other'
}

// ── Sub-components ────────────────────────────────────────────────────────────

function HelixLogo() {
  return (
    <svg width="22" height="22" viewBox="0 0 22 22" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path
        d="M11 2C7 2 4 5.5 4 9c0 2.5 1.5 4.5 3 6s3 3 3 5"
        stroke="#34D399" strokeWidth="1.8" strokeLinecap="round" fill="none"
      />
      <path
        d="M11 2c4 0 7 3.5 7 7 0 2.5-1.5 4.5-3 6s-3 3-3 5"
        stroke="#06b6d4" strokeWidth="1.8" strokeLinecap="round" fill="none"
      />
      <line x1="5.5" y1="7" x2="16.5" y2="7" stroke="#34D399" strokeWidth="1.2" strokeLinecap="round" opacity="0.6"/>
      <line x1="5" y1="11" x2="17" y2="11" stroke="#34D399" strokeWidth="1.2" strokeLinecap="round" opacity="0.6"/>
      <line x1="5.5" y1="15" x2="16.5" y2="15" stroke="#34D399" strokeWidth="1.2" strokeLinecap="round" opacity="0.6"/>
    </svg>
  )
}

function StatusDot({ status }) {
  const cls = status === 'spawning' ? 'spawning'
    : status === 'running' ? 'running'
    : status === 'done' ? 'done'
    : status === 'error' ? 'error'
    : 'waiting'
  return <span className={`dot ${cls}`} />
}

function StatusPill({ status }) {
  const map = {
    running: { cls: 'running', label: 'Running' },
    complete: { cls: 'complete', label: 'Complete' },
    error: { cls: 'error', label: 'Error' },
    'partial-error': { cls: 'error', label: 'Partial Error' },
    waiting: { cls: 'waiting', label: 'Waiting' },
    idle: { cls: 'idle', label: 'Idle' },
  }
  const { cls, label } = map[status] || map.idle
  return (
    <span className={`status-pill ${cls}`}>
      <StatusDot status={cls === 'running' ? 'running' : cls === 'complete' ? 'done' : cls === 'error' ? 'error' : 'waiting'} />
      {label}
    </span>
  )
}

function AgentCard({ agent, selected, onClick }) {
  const { id, label, model, status, lastActivity, logSize } = agent
  const cardCls = [
    'agent-card',
    `status-${status || 'waiting'}`,
    selected ? 'selected' : '',
  ].filter(Boolean).join(' ')

  const modelShort = model
    ? model.replace('claude-', '').replace('-20251001', '').replace('-20240229', '')
    : '—'

  return (
    <div className={cardCls} onClick={() => onClick(id)}>
      <div className="agent-row">
        <StatusDot status={status || 'waiting'} />
        <span className="agent-icon">
          {status === 'done' ? '✓' : status === 'error' ? '✗' : status === 'running' || status === 'spawning' ? '⟳' : '○'}
        </span>
        <span className="agent-label">{label || id}</span>
        <span className="agent-model">{modelShort}</span>
      </div>
      <div className="agent-meta">
        {logSize != null && (
          <span className="agent-meta-item">{(logSize / 1024).toFixed(1)}kb log</span>
        )}
        {lastActivity && (
          <span className="agent-meta-item highlight">{fmtAge(lastActivity)}</span>
        )}
      </div>
    </div>
  )
}

function AgentsPanel({ agents, selectedId, onSelect, jobStatus }) {
  const entries = Object.entries(agents)
  const running = entries.filter(([, a]) => a.status === 'running' || a.status === 'spawning').length
  const done = entries.filter(([, a]) => a.status === 'done').length

  return (
    <aside className="panel-agents">
      <div className="panel-header">
        <span className="panel-title">Agents</span>
        {entries.length > 0 && (
          <span className="panel-badge">{running > 0 ? `${running} active` : `${done}/${entries.length}`}</span>
        )}
      </div>
      <div className="panel-body pad-sm">
        {entries.length === 0 ? (
          <div className="empty">
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
              <circle cx="12" cy="12" r="9"/>
              <path d="M9 9h.01M15 9h.01M9 15s1 2 3 2 3-2 3-2"/>
            </svg>
            <span>No agents yet</span>
          </div>
        ) : (
          entries.map(([id, agent]) => (
            <AgentCard
              key={id}
              agent={{ id, ...agent }}
              selected={selectedId === id}
              onClick={onSelect}
            />
          ))
        )}
      </div>
    </aside>
  )
}

// Simple SVG activity graph — plots last N log sizes as a sparkline
function ActivityCanvas({ agents, selectedId }) {
  const entries = Object.values(agents)
  const hasData = entries.length > 0

  if (!hasData) {
    return (
      <div className="viz-canvas">
        <div className="viz-placeholder">
          <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.2">
            <path d="M3 3v18h18"/>
            <path d="M7 16l4-4 4 4 4-5"/>
          </svg>
          <span>Run an analysis to see activity</span>
        </div>
      </div>
    )
  }

  const total = entries.length
  const cols = Math.min(total, 8)
  const colW = 100 / cols

  return (
    <div className="viz-canvas">
      <div className="phase-row">
        <span className="phase-label">Agent Activity</span>
        <span className="phase-line"/>
      </div>
      <svg
        width="100%"
        height="calc(100% - 32px)"
        viewBox={`0 0 ${cols * 80} 120`}
        preserveAspectRatio="xMidYMid meet"
        style={{ display: 'block', padding: '8px 16px' }}
      >
        {entries.slice(0, cols).map((agent, i) => {
          const x = i * 80 + 4
          const isSelected = selectedId === agent.id
          const statusColor = agent.status === 'done' ? '#34D399'
            : agent.status === 'running' || agent.status === 'spawning' ? '#06b6d4'
            : agent.status === 'error' ? '#f43f5e'
            : 'rgba(255,255,255,0.12)'

          const barH = agent.logSize ? Math.min(70, Math.max(8, agent.logSize / 200)) : 8
          const barY = 90 - barH

          return (
            <g key={agent.id || i}>
              <rect
                x={x} y={barY} width="68" height={barH}
                rx="3"
                fill={statusColor}
                opacity={isSelected ? 1 : 0.6}
              />
              <text
                x={x + 34} y={105}
                textAnchor="middle"
                fontSize="8"
                fill="rgba(226,232,240,0.5)"
              >
                {(agent.label || agent.id || '').slice(0, 10)}
              </text>
            </g>
          )
        })}
      </svg>
    </div>
  )
}

function FindingCard({ finding }) {
  const cls = sigClass(finding.category || finding.significance)
  const label = sigLabel(finding.category || finding.significance)

  return (
    <div className={`finding-card ${cls}`}>
      <div className="finding-header">
        <span className="finding-gene">{finding.gene || '—'}</span>
        <span className="finding-sig">{label}</span>
      </div>
      <div className="finding-title">{finding.finding || finding.title || finding.summary || '—'}</div>
      {(finding.variants || finding.rsid) && (
        <div className="finding-rsid">
          {Array.isArray(finding.variants)
            ? finding.variants.join(', ')
            : (finding.variants || finding.rsid)}
        </div>
      )}
      {finding.agent && (
        <div className="finding-agent">via {finding.agent}</div>
      )}
    </div>
  )
}

function FindingsPanel({ findings }) {
  const sorted = [...findings].sort((a, b) => {
    const ai = SIG_ORDER.indexOf((a.category || 'other').toLowerCase())
    const bi = SIG_ORDER.indexOf((b.category || 'other').toLowerCase())
    return (ai === -1 ? 99 : ai) - (bi === -1 ? 99 : bi)
  })

  return (
    <aside className="panel-findings">
      <div className="panel-header">
        <span className="panel-title">Findings</span>
        {findings.length > 0 && (
          <span className="panel-badge">{findings.length}</span>
        )}
      </div>
      <div className="panel-body">
        {findings.length === 0 ? (
          <div className="empty">
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
              <path d="M9 5H7a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V7a2 2 0 0 0-2-2h-2"/>
              <rect x="9" y="3" width="6" height="4" rx="1"/>
              <path d="M9 12h6M9 16h4"/>
            </svg>
            <span>Findings will appear here</span>
          </div>
        ) : (
          sorted.map((f, i) => <FindingCard key={i} finding={f} />)
        )}
      </div>
    </aside>
  )
}

function ChatPanel({ messages }) {
  const endRef = useRef(null)

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages.length])

  return (
    <section className="panel-chat">
      <div className="panel-header">
        <span className="panel-title">Agent Communication</span>
        {messages.length > 0 && (
          <span className="panel-badge">{messages.length} msgs</span>
        )}
      </div>
      <div className="panel-body">
        {messages.length === 0 ? (
          <div className="empty" style={{ padding: '16px' }}>
            <span>Agent messages will appear here during analysis</span>
          </div>
        ) : (
          messages.map((msg, i) => (
            <div key={i} className="chat-message">
              <span className={`chat-from ${msg.to ? 'chat-to' : ''}`}>
                {msg.from || 'agent'}
                {msg.to ? ` → ${msg.to}` : ''}
              </span>
              <span className="chat-text">{msg.message || msg.text || ''}</span>
              <span className="chat-time">{fmtTime(msg.timestamp)}</span>
            </div>
          ))
        )}
        <div ref={endRef} />
      </div>
    </section>
  )
}

// ── Main App ──────────────────────────────────────────────────────────────────

const POLL_MS = 3000

export default function App() {
  const [jobId, setJobId] = useState(() => jobIdFromUrl())
  const [jobStatus, setJobStatus] = useState('idle')
  const [agents, setAgents] = useState({})
  const [findings, setFindings] = useState([])
  const [chat, setChat] = useState([])
  const [selectedAgent, setSelectedAgent] = useState(null)
  const [error, setError] = useState(null)
  const [lastPoll, setLastPoll] = useState(null)

  // If no jobId in URL, try health endpoint to find any active job
  const resolveJobId = useCallback(async () => {
    try {
      const res = await fetch('/api/health')
      const data = await res.json()
      if (data.activeJobId) {
        setJobId(data.activeJobId)
      }
    } catch {
      // server not up yet
    }
  }, [])

  useEffect(() => {
    if (!jobId) resolveJobId()
  }, [jobId, resolveJobId])

  const poll = useCallback(async () => {
    if (!jobId) return
    try {
      const res = await fetch(`/api/status/${jobId}`)
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const data = await res.json()
      setJobStatus(data.status || 'idle')
      setAgents(data.agents || {})
      setFindings(data.findings || [])
      setChat(data.chat || [])
      setError(null)
      setLastPoll(new Date())
    } catch (err) {
      setError(err.message)
    }
  }, [jobId])

  useEffect(() => {
    poll()
    const id = setInterval(poll, POLL_MS)
    return () => clearInterval(id)
  }, [poll])

  // Estimate rough cost from agent count + model types
  const costEstimate = (() => {
    const n = Object.keys(agents).length
    if (n === 0) return null
    const haiku = Object.values(agents).filter(a => (a.model || '').includes('haiku')).length
    const sonnet = n - haiku
    // Very rough: haiku ~$0.02, sonnet ~$0.15 per agent
    return (haiku * 0.02 + sonnet * 0.15).toFixed(2)
  })()

  return (
    <div className="app">
      {/* ── Nav ── */}
      <nav className="nav">
        <div className="nav-logo">
          <HelixLogo />
          Helix Genomics
        </div>
        <div className="nav-divider" />
        {jobId ? (
          <span className="nav-job">{jobId}</span>
        ) : (
          <span className="nav-job" style={{ opacity: 0.4 }}>no active job</span>
        )}
        <div className="nav-spacer" />
        {error && (
          <span style={{ fontSize: 11, color: 'var(--red)', fontFamily: 'var(--font-mono)' }}>
            {error}
          </span>
        )}
        {costEstimate && (
          <span className="nav-cost">~${costEstimate}</span>
        )}
        <StatusPill status={jobStatus} />
      </nav>

      {/* ── Body ── */}
      <div className="body">
        <AgentsPanel
          agents={agents}
          selectedId={selectedAgent}
          onSelect={setSelectedAgent}
          jobStatus={jobStatus}
        />

        <main className="panel-viz">
          <ActivityCanvas agents={agents} selectedId={selectedAgent} />
        </main>

        <FindingsPanel findings={findings} />

        <ChatPanel messages={chat} />
      </div>
    </div>
  )
}
