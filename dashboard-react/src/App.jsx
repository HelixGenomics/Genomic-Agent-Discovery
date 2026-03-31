import { useState, useEffect, useRef, useCallback, useMemo, useId } from 'react'
import './App.css'
// ── Inline Setup Panel ────────────────────────────────────────────────────────

const PRESETS = [
  { id: 'quick-scan',       icon: '⚡', name: 'Quick Scan',        desc: 'Fast overview across all domains',          agents: 2,  cost: '$0.05–0.10', time: '2–4 min',   color: '#06b6d4' },
  { id: 'cancer-research',  icon: '🔬', name: 'Cancer Research',   desc: 'Deep cancer & tumor genetics',              agents: 10, cost: '$0.50–2.00', time: '10–20 min', color: '#f43f5e' },
  { id: 'cardiovascular',   icon: '❤️', name: 'Cardiovascular',    desc: 'Heart & vascular genetic risk',             agents: 6,  cost: '$0.30–1.00', time: '8–15 min',  color: '#f97316' },
  { id: 'pharmacogenomics', icon: '💊', name: 'Pharmacogenomics',  desc: 'Drug metabolism & interactions',            agents: 5,  cost: '$0.20–0.80', time: '6–12 min',  color: '#8b5cf6' },
  { id: 'rare-disease',     icon: '🧬', name: 'Rare Disease',      desc: 'Rare & orphan disease panel',              agents: 8,  cost: '$0.40–1.50', time: '10–18 min', color: '#34D399' },
]

function SetupPanel({ onStarted }) {
  const [dnaPath, setDnaPath] = useState('')
  const [preset, setPreset] = useState('quick-scan')
  const [model, setModel] = useState('haiku')
  const [costLimit, setCostLimit] = useState('10')
  const [temperature, setTemperature] = useState('0.3')
  const [maxToolCalls, setMaxToolCalls] = useState('100')
  const [checkMessages, setCheckMessages] = useState('7')
  const [webSearch, setWebSearch] = useState(true)
  const [medHistory, setMedHistory] = useState('')
  const [loading, setLoading] = useState(false)
  const [err, setErr] = useState('')
  const fileRef = useRef(null)

  function onDrop(e) {
    e.preventDefault()
    const file = e.dataTransfer?.files?.[0]
    if (file) setDnaPath(file.path || file.name)
  }

  async function startAnalysis() {
    if (!dnaPath.trim()) { setErr('Please enter or drop a DNA file path.'); return }
    setErr(''); setLoading(true)
    try {
      const res = await fetch('/api/start-analysis', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          dnaPath: dnaPath.trim(),
          preset,
          settings: {
            defaultModel: model,
            costLimit: parseFloat(costLimit) || 10,
            temperature: parseFloat(temperature) || 0.3,
            maxToolCalls: parseInt(maxToolCalls) || 100,
            checkMessages: parseInt(checkMessages) || 7,
            webSearch,
            medicalHistory: medHistory,
          },
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Failed to start')
      onStarted()
    } catch (e) {
      setErr(e.message)
      setLoading(false)
    }
  }

  return (
    <div className="setup-panel">
      <div className="setup-logo">
        <HelixLogo />
        <span>Helix Genomics</span>
      </div>
      <p className="setup-sub">Configure your analysis below, then hit Start.</p>

      {/* DNA File */}
      <div className="setup-section">
        <div className="setup-label">DNA File</div>
        <div
          className={`setup-drop${dnaPath ? ' has-file' : ''}`}
          onDragOver={e => e.preventDefault()}
          onDrop={onDrop}
          onClick={() => fileRef.current?.click()}
        >
          {dnaPath
            ? <><span className="setup-drop-icon">✓</span><span className="setup-drop-name">{dnaPath.split('/').pop()}</span></>
            : <><span className="setup-drop-icon">↑</span><span>Drop DNA file here or click to browse</span><span className="setup-drop-hint">23andMe · AncestryDNA · MyHeritage · VCF</span></>
          }
        </div>
        <input ref={fileRef} type="file" style={{ display: 'none' }} accept=".txt,.csv,.vcf,.gz,.zip"
          onChange={e => { if (e.target.files?.[0]) setDnaPath(e.target.files[0].path || e.target.files[0].name) }} />
        <input className="setup-input" placeholder="Or paste full file path…" value={dnaPath}
          onChange={e => setDnaPath(e.target.value)} />
      </div>

      {/* Preset */}
      <div className="setup-section">
        <div className="setup-label">Analysis Preset</div>
        <div className="setup-presets">
          {PRESETS.map(p => (
            <button
              key={p.id}
              className={`setup-preset${preset === p.id ? ' active' : ''}`}
              style={preset === p.id ? { borderColor: p.color, background: `${p.color}14` } : {}}
              onClick={() => setPreset(p.id)}
            >
              <span className="setup-preset-icon">{p.icon}</span>
              <span className="setup-preset-name">{p.name}</span>
              <span className="setup-preset-desc">{p.desc}</span>
              <span className="setup-preset-meta">{p.agents} agents · {p.cost} · {p.time}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Settings row */}
      <div className="setup-section setup-row">
        <div className="setup-field">
          <div className="setup-label">Default Model</div>
          <select className="setup-select" value={model} onChange={e => setModel(e.target.value)}>
            <option value="haiku">Haiku — fast &amp; cheap</option>
            <option value="sonnet">Sonnet — balanced</option>
            <option value="opus">Opus — most capable</option>
          </select>
        </div>
        <div className="setup-field">
          <div className="setup-label">Cost Limit (USD)</div>
          <input className="setup-input" type="number" min="0.5" step="0.5" value={costLimit}
            onChange={e => setCostLimit(e.target.value)} />
        </div>
        <div className="setup-field">
          <div className="setup-label">Temperature</div>
          <input className="setup-input" type="number" min="0" max="1" step="0.05"
            value={temperature} onChange={e => setTemperature(e.target.value)} />
        </div>
        <div className="setup-field">
          <div className="setup-label">Max Tool Calls / Agent</div>
          <input className="setup-input" type="number" min="10" max="500" step="10"
            value={maxToolCalls} onChange={e => setMaxToolCalls(e.target.value)} />
        </div>
        <div className="setup-field">
          <div className="setup-label">Check Messages Every</div>
          <input className="setup-input" type="number" min="1" max="20" step="1"
            value={checkMessages} onChange={e => setCheckMessages(e.target.value)} />
        </div>
        <div className="setup-field setup-field-toggle">
          <div className="setup-label">Web Search</div>
          <button className={`setup-toggle${webSearch ? ' on' : ''}`} onClick={() => setWebSearch(v => !v)}>
            {webSearch ? 'ON' : 'OFF'}
          </button>
        </div>
      </div>

      <div className="setup-section">
        <div className="setup-label">Medical History <span className="setup-opt">(optional)</span></div>
        <textarea className="setup-textarea" rows={2} placeholder="e.g. 45-year-old female, family history of breast cancer, currently on statins…"
          value={medHistory} onChange={e => setMedHistory(e.target.value)} />
      </div>

      {err && <div className="setup-error">{err}</div>}

      <button className="setup-start" onClick={startAnalysis} disabled={loading}>
        {loading ? 'Starting…' : '▶  Start Analysis'}
      </button>
    </div>
  )
}

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
  const d = new Date(ts)
  if (isNaN(d.getTime())) return ''
  const secs = Math.floor((Date.now() - d) / 1000)
  if (secs < 0) return ''
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
    <svg width="20" height="26" viewBox="0 0 20 26" fill="none" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <linearGradient id="pin-grad" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#06b6d4" />
          <stop offset="100%" stopColor="#34D399" />
        </linearGradient>
      </defs>
      {/* Pin body: circle top narrowing to a point */}
      <path
        d="M10 1C5.03 1 1 5.03 1 10c0 6.5 9 15 9 15s9-8.5 9-15c0-4.97-4.03-9-9-9z"
        fill="url(#pin-grad)"
      />
      {/* Inner circle cutout */}
      <circle cx="10" cy="10" r="3.5" fill="#0f1923" />
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

function AgentsPanel({ agents, selectedId, onSelect, jobId }) {
  const entries = Object.entries(agents)
  const running = entries.filter(([, a]) => a.status === 'running' || a.status === 'spawning').length
  const done = entries.filter(([, a]) => a.status === 'done').length
  const [modal, setModal] = useState(false)
  const [form, setForm] = useState({ id: '', label: '', model: 'haiku', prompt: '' })

  function launch() {
    if (!form.id) return
    fetch('/api/spawn-agent', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ jobId, ...form })
    }).catch(() => {})
    setModal(false)
    setForm({ id: '', label: '', model: 'haiku', prompt: '' })
  }

  return (
    <aside className="panel-agents">
      <div className="panel-header">
        <span className="panel-title">Agents</span>
        {entries.length > 0 && (
          <span className="panel-badge">{running > 0 ? `${running} active` : `${done}/${entries.length}`}</span>
        )}
        <button className="btn-add-agent" onClick={() => setModal(true)}>+ Add Agent</button>
      </div>

      {modal && (
        <div className="modal-overlay" onClick={e => e.target === e.currentTarget && setModal(false)}>
          <div className="modal">
            <h3>Launch New Agent</h3>
            <label>Agent ID</label>
            <input value={form.id} onChange={e => setForm(f => ({...f, id: e.target.value}))} placeholder="e.g. drug-metabolism" />
            <label>Label</label>
            <input value={form.label} onChange={e => setForm(f => ({...f, label: e.target.value}))} placeholder="e.g. Drug Metabolism Agent" />
            <label>Model</label>
            <select value={form.model} onChange={e => setForm(f => ({...f, model: e.target.value}))}>
              <option value="haiku">Haiku (fast, cheap)</option>
              <option value="sonnet">Sonnet (balanced)</option>
              <option value="opus">Opus (most capable)</option>
            </select>
            <label>Prompt</label>
            <textarea value={form.prompt} onChange={e => setForm(f => ({...f, prompt: e.target.value}))} placeholder="Research instructions for this agent…" />
            <div className="modal-btns">
              <button className="btn-cancel" onClick={() => setModal(false)}>Cancel</button>
              <button className="btn-launch" onClick={launch}>Launch</button>
            </div>
          </div>
        </div>
      )}
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

function agentIcon(id) {
  const s = (id || '').toLowerCase()
  if (/tumor|genetic/i.test(s)) return '🧬'
  if (/dpyd|safety/i.test(s)) return '💊'
  if (/platinum|chemo/i.test(s)) return '⚗️'
  if (/immunotherap/i.test(s)) return '🔬'
  if (/target/i.test(s)) return '🎯'
  if (/drug|metaboli/i.test(s)) return '💉'
  if (/supplement/i.test(s)) return '🌿'
  if (/inflammat/i.test(s)) return '🔥'
  if (/immune/i.test(s)) return '🛡️'
  if (/dna|repair/i.test(s)) return '🔗'
  if (/neuropath/i.test(s)) return '⚡'
  if (/trial|clinical/i.test(s)) return '🏥'
  if (/synth|narrator/i.test(s)) return '📋'
  if (/novel/i.test(s)) return '🔍'
  if (/scanner|general/i.test(s)) return '🧬'
  return '🧬'
}

function shortLabel(id) {
  if (!id) return '??'
  const parts = id.split('-')
  if (parts.length >= 2) return parts.slice(0, 2).map(p => p.charAt(0).toUpperCase() + p.slice(1, 5)).join(' ')
  return id.slice(0, 8)
}

// Canvas network visualiser — ported from monitor.html
function NetworkCanvas({ agents, selectedId, chat, findings }) {
  const canvasRef = useRef(null)
  const stateRef = useRef({ particles: [], commLines: [], animFrame: 0, prevChatLen: 0, prevFindingsLen: 0 })

  // Spawn comm-line particles when new chat messages arrive
  useEffect(() => {
    const s = stateRef.current
    const ids = Object.keys(agents).sort()
    const canvas = canvasRef.current
    if (!canvas) return
    const cW = canvas.clientWidth, cH = canvas.clientHeight

    function nodePos(id) {
      const idx = ids.indexOf(id)
      if (idx < 0) return null
      const cx = cW / 2, cy = cH / 2
      const r = Math.min(cW, cH) * 0.32
      const angle = (idx / ids.length) * Math.PI * 2 - Math.PI / 2
      return { x: cx + Math.cos(angle) * r, y: cy + Math.sin(angle) * r }
    }

    // New chat messages → comm lines
    if (chat.length > s.prevChatLen) {
      for (let i = s.prevChatLen; i < chat.length; i++) {
        const m = chat[i]
        const from = nodePos(m.from)
        const to = nodePos(m.to)
        if (from && to) {
          const col = m.priority === 'critical' ? '#f43f5e' : m.priority === 'urgent' ? '#f59e0b' : '#06b6d4'
          s.commLines.push({ from, to, life: 1, decay: 0.012, color: col })
          for (let j = 0; j < 3; j++) {
            const t = Math.random()
            s.particles.push({
              x: from.x + (to.x - from.x) * t, y: from.y + (to.y - from.y) * t,
              vx: (to.x - from.x) * 0.02 + (Math.random() - 0.5),
              vy: (to.y - from.y) * 0.02 + (Math.random() - 0.5),
              life: 1, decay: 0.01 + Math.random() * 0.01,
              color: col, radius: 1.5 + Math.random() * 1.5, trail: []
            })
          }
        }
      }
      s.prevChatLen = chat.length
    }

    // New findings → burst particles from agent node
    if (findings.length > s.prevFindingsLen) {
      for (let i = s.prevFindingsLen; i < findings.length; i++) {
        const f = findings[i]
        const pos = nodePos(f.agent || f.from)
        if (pos) {
          const col = sigClass(f.category) === 'sig-high' ? '#f43f5e'
            : sigClass(f.category) === 'sig-moderate' ? '#f59e0b'
            : '#34D399'
          for (let j = 0; j < 8; j++) {
            s.particles.push({
              x: pos.x, y: pos.y,
              vx: (Math.random() - 0.5) * 4, vy: (Math.random() - 0.5) * 4,
              life: 1, decay: 0.007 + Math.random() * 0.008,
              color: col, radius: 2 + Math.random() * 2, trail: []
            })
          }
        }
      }
      s.prevFindingsLen = findings.length
    }
  }, [chat.length, findings.length, agents])

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    const s = stateRef.current
    let rafId
    let dpr = window.devicePixelRatio || 1

    function resize() {
      dpr = window.devicePixelRatio || 1
      canvas.width = canvas.clientWidth * dpr
      canvas.height = canvas.clientHeight * dpr
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
    }
    resize()
    const ro = new ResizeObserver(resize)
    ro.observe(canvas)

    function drawHexGrid(cW, cH) {
      const size = 30, w = size * 2, h = Math.sqrt(3) * size
      ctx.save()
      ctx.strokeStyle = 'rgba(52,211,153,0.025)'
      ctx.lineWidth = 0.5
      for (let row = -1; row < cH / h + 1; row++) {
        for (let col = -1; col < cW / w + 1; col++) {
          const x = col * w * 0.75, y = row * h + (col % 2 ? h / 2 : 0)
          ctx.beginPath()
          for (let k = 0; k < 6; k++) {
            const a = (Math.PI / 3) * k - Math.PI / 6
            const px = x + size * Math.cos(a), py = y + size * Math.sin(a)
            k === 0 ? ctx.moveTo(px, py) : ctx.lineTo(px, py)
          }
          ctx.closePath()
          ctx.stroke()
        }
      }
      ctx.restore()
    }

    function draw() {
      const cW = canvas.clientWidth, cH = canvas.clientHeight
      ctx.clearRect(0, 0, cW, cH)
      s.animFrame++

      drawHexGrid(cW, cH)

      const ids = Object.keys(agents).sort()
      const n = ids.length

      if (n === 0) {
        ctx.save()
        ctx.font = '500 14px Inter, sans-serif'
        ctx.fillStyle = 'rgba(52,211,153,0.2)'
        ctx.textAlign = 'center'
        ctx.textBaseline = 'middle'
        ctx.fillText('Waiting for agents…', cW / 2, cH / 2)
        ctx.font = '11px "JetBrains Mono", monospace'
        ctx.fillStyle = 'rgba(52,211,153,0.1)'
        ctx.fillText('Analysis will appear here', cW / 2, cH / 2 + 22)
        ctx.restore()
        rafId = requestAnimationFrame(draw)
        return
      }

      const cx = cW / 2, cy = cH / 2
      const r = Math.min(cW, cH) * 0.32
      const nodePositions = ids.map((id, i) => {
        const angle = (i / n) * Math.PI * 2 - Math.PI / 2
        return { x: cx + Math.cos(angle) * r, y: cy + Math.sin(angle) * r, id }
      })

      // Faint connection lines between all nodes
      for (let i = 0; i < n; i++) {
        for (let j = i + 1; j < n; j++) {
          const a = nodePositions[i], b = nodePositions[j]
          const g = ctx.createLinearGradient(a.x, a.y, b.x, b.y)
          g.addColorStop(0, 'rgba(52,211,153,0.04)')
          g.addColorStop(0.5, 'rgba(52,211,153,0.08)')
          g.addColorStop(1, 'rgba(52,211,153,0.04)')
          ctx.strokeStyle = g
          ctx.lineWidth = 0.5
          ctx.beginPath()
          ctx.moveTo(a.x, a.y)
          ctx.lineTo(b.x, b.y)
          ctx.stroke()
        }
      }

      // Comm lines
      for (let i = s.commLines.length - 1; i >= 0; i--) {
        const cl = s.commLines[i]
        cl.life -= cl.decay
        if (cl.life <= 0) { s.commLines.splice(i, 1); continue }
        ctx.save()
        ctx.globalAlpha = cl.life * 0.7
        ctx.strokeStyle = cl.color
        ctx.lineWidth = 2 * cl.life
        ctx.shadowColor = cl.color
        ctx.shadowBlur = 12 * cl.life
        ctx.beginPath()
        ctx.moveTo(cl.from.x, cl.from.y)
        ctx.lineTo(cl.to.x, cl.to.y)
        ctx.stroke()
        ctx.restore()
      }

      // Particles with trails
      for (let i = s.particles.length - 1; i >= 0; i--) {
        const p = s.particles[i]
        p.trail.push({ x: p.x, y: p.y })
        if (p.trail.length > 18) p.trail.shift()
        p.x += p.vx; p.y += p.vy
        p.vx *= 0.98; p.vy *= 0.98
        p.life -= p.decay
        if (p.life <= 0) { s.particles.splice(i, 1); continue }
        if (p.trail.length > 1) {
          ctx.save(); ctx.lineCap = 'round'
          for (let t = 1; t < p.trail.length; t++) {
            const al = (t / p.trail.length) * p.life * 0.4
            ctx.globalAlpha = al
            ctx.strokeStyle = p.color
            ctx.lineWidth = p.radius * (t / p.trail.length)
            ctx.beginPath()
            ctx.moveTo(p.trail[t-1].x, p.trail[t-1].y)
            ctx.lineTo(p.trail[t].x, p.trail[t].y)
            ctx.stroke()
          }
          ctx.restore()
        }
        ctx.save()
        ctx.globalAlpha = p.life
        ctx.fillStyle = p.color
        ctx.shadowColor = p.color; ctx.shadowBlur = 10
        ctx.beginPath()
        ctx.arc(p.x, p.y, p.radius * p.life, 0, Math.PI * 2)
        ctx.fill()
        ctx.restore()
      }

      // Agent nodes
      for (const np of nodePositions) {
        const a = agents[np.id] || {}
        const st = a.status || 'waiting'
        const nodeColor = st === 'running' ? '#06b6d4' : st === 'done' ? '#34D399' : st === 'error' ? '#f43f5e' : '#6b7280'
        const glowAlpha = st === 'running' ? 0.3 : st === 'done' ? 0.2 : 0.1

        // Pulsing ring for running
        if (st === 'running' || st === 'spawning') {
          const pulseT = Math.sin(s.animFrame * 0.04) * 0.5 + 0.5
          const pulseR = 24 + pulseT * 10
          ctx.save()
          ctx.globalAlpha = 0.15 + pulseT * 0.15
          ctx.strokeStyle = nodeColor
          ctx.lineWidth = 2
          ctx.shadowColor = nodeColor; ctx.shadowBlur = 20
          ctx.beginPath(); ctx.arc(np.x, np.y, pulseR, 0, Math.PI * 2); ctx.stroke()
          ctx.globalAlpha = 0.08 + pulseT * 0.08
          ctx.beginPath(); ctx.arc(np.x, np.y, pulseR + 8, 0, Math.PI * 2); ctx.stroke()
          ctx.restore()
        }

        // Selection dashed ring
        if (selectedId === np.id) {
          ctx.save()
          ctx.strokeStyle = '#ffffff'
          ctx.lineWidth = 2
          ctx.globalAlpha = 0.5 + Math.sin(s.animFrame * 0.06) * 0.2
          ctx.setLineDash([4, 4])
          ctx.lineDashOffset = -s.animFrame * 0.5
          ctx.beginPath(); ctx.arc(np.x, np.y, 30, 0, Math.PI * 2); ctx.stroke()
          ctx.setLineDash([])
          ctx.restore()
        }

        // Glow
        const grd = ctx.createRadialGradient(np.x, np.y, 0, np.x, np.y, 22)
        grd.addColorStop(0, nodeColor.replace(')', `,${glowAlpha})`).replace('rgb', 'rgba'))
        grd.addColorStop(1, 'transparent')
        ctx.save(); ctx.fillStyle = grd
        ctx.beginPath(); ctx.arc(np.x, np.y, 22, 0, Math.PI * 2); ctx.fill(); ctx.restore()

        // Node circle
        ctx.save()
        ctx.fillStyle = '#0f1923'
        ctx.strokeStyle = nodeColor
        ctx.lineWidth = 1.5
        ctx.shadowColor = nodeColor; ctx.shadowBlur = st === 'running' ? 15 : 8
        ctx.beginPath(); ctx.arc(np.x, np.y, 16, 0, Math.PI * 2)
        ctx.fill(); ctx.stroke(); ctx.restore()

        // Emoji icon
        ctx.save()
        ctx.font = '13px sans-serif'
        ctx.textAlign = 'center'; ctx.textBaseline = 'middle'
        ctx.fillText(agentIcon(np.id), np.x, np.y)
        ctx.restore()

        // Label below
        ctx.save()
        ctx.font = '500 9px "JetBrains Mono", monospace'
        ctx.fillStyle = nodeColor
        ctx.textAlign = 'center'; ctx.globalAlpha = 0.85
        ctx.fillText(shortLabel(np.id), np.x, np.y + 28)
        ctx.restore()
      }

      rafId = requestAnimationFrame(draw)
    }

    rafId = requestAnimationFrame(draw)
    return () => { cancelAnimationFrame(rafId); ro.disconnect() }
  }, [agents, selectedId])

  return (
    <canvas
      ref={canvasRef}
      style={{ width: '100%', height: '100%', display: 'block' }}
    />
  )
}

function ActivityCanvas({ agents, selectedId, chat, findings }) {
  return (
    <div className="viz-canvas">
      <NetworkCanvas agents={agents} selectedId={selectedId} chat={chat} findings={findings} />
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

function ChatPanel({ messages, jobId }) {
  const endRef = useRef(null)
  const [inputMsg, setInputMsg] = useState('')
  const [sending, setSending] = useState(false)

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages.length])

  async function sendMessage(e) {
    e.preventDefault()
    const text = inputMsg.trim()
    if (!text || !jobId) return
    setSending(true)
    try {
      await fetch('/api/inject-chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ jobId, message: text, from: 'user' }),
      })
      setInputMsg('')
    } catch {
      // ignore
    } finally {
      setSending(false)
    }
  }

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
            <div key={i} className={`chat-message ${msg.from === 'user' ? 'chat-message-user' : ''}`}>
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
      <form className="chat-input-row" onSubmit={sendMessage}>
        <input
          className="chat-input"
          value={inputMsg}
          onChange={e => setInputMsg(e.target.value)}
          placeholder="Send a message to agents…"
          disabled={!jobId || sending}
        />
        <button
          className="chat-send-btn"
          type="submit"
          disabled={!jobId || sending || !inputMsg.trim()}
        >
          {sending ? '…' : '↑'}
        </button>
      </form>
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
  const [pollCount, setPollCount] = useState(0)
  const [isRunning, setIsRunning] = useState(false)

  const resolveJobId = useCallback(async () => {
    try {
      const res = await fetch('/api/health')
      const data = await res.json()
      if (data.activeJobId) setJobId(data.activeJobId)
      setIsRunning(!!data.isAnalysisRunning)
    } catch { /* server not up yet */ }
  }, [])

  useEffect(() => {
    resolveJobId()
  }, [resolveJobId])

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
      setPollCount(c => c + 1)
    } catch (err) {
      setError(err.message)
    }
  }, [jobId])

  useEffect(() => {
    poll()
    const id = setInterval(poll, POLL_MS)
    return () => clearInterval(id)
  }, [poll])

  // Cost estimation — persisted in localStorage so refresh doesn't reset it
  const costEstimate = useMemo(() => {
    const rates = { haiku: { i: 0.80, o: 4 }, sonnet: { i: 3, o: 15 }, opus: { i: 15, o: 75 } }
    let current = 0
    for (const a of Object.values(agents)) {
      const tokens = (a.logSize || 0) / 4
      const model = (a.model || 'haiku').toLowerCase()
      const r = rates[model] || rates.haiku
      current += (tokens * 0.6 / 1e6) * r.i + (tokens * 0.4 / 1e6) * r.o
    }
    if (jobId) {
      const key = `helix-cost-${jobId}`
      const prev = parseFloat(localStorage.getItem(key) || '0')
      const peak = Math.max(prev, current)
      if (current > prev) localStorage.setItem(key, current.toFixed(6))
      return peak
    }
    return current
  }, [agents, jobId])

  function saveAllData() {
    const blob = new Blob([JSON.stringify({ jobId, agents, findings, chat }, null, 2)], { type: 'application/json' })
    const a = document.createElement('a')
    a.href = URL.createObjectURL(blob)
    a.download = `helix-${(jobId || 'job').slice(0, 12)}-${Date.now()}.json`
    a.click()
    URL.revokeObjectURL(a.href)
  }

  function runSynthesis() {
    if (!jobId) return
    fetch('/api/spawn-agent', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        jobId,
        id: 'synthesis-' + Date.now().toString(36),
        label: 'Final Synthesis',
        model: 'sonnet',
        prompt: 'Synthesize all findings from the research agents into a comprehensive genomics report.'
      })
    }).catch(() => {})
  }

  const noActivity = !isRunning && Object.keys(agents).length === 0

  return (
    <div className="app">
      {/* ── Body ── */}
      <div className="body">
        <AgentsPanel
          agents={agents}
          selectedId={selectedAgent}
          onSelect={setSelectedAgent}
          jobId={jobId}
        />

        <main className="panel-viz">
          {noActivity
            ? <SetupPanel onStarted={() => { setIsRunning(true); setTimeout(resolveJobId, 2000) }} />
            : <ActivityCanvas agents={agents} selectedId={selectedAgent} chat={chat} findings={findings} />
          }
        </main>

        <FindingsPanel findings={findings} />

        <ChatPanel messages={chat} jobId={jobId} />
      </div>

      {/* ── Status Bar ── */}
      <div className="status-bar">
        <span className="status-bar-brand">HELIX SEQUENCING</span>
        <span className="status-bar-sep">|</span>
        <span className="status-bar-label">Job:</span>
        <span className="status-bar-val" title={jobId || ''}>{jobId ? jobId.slice(0, 12) + '…' : '—'}</span>
        <span className="status-bar-sep">|</span>
        <span className="status-bar-label">Status:</span>
        <span className="status-bar-val">{jobStatus}</span>
        <span className="status-bar-sep">|</span>
        <span className="status-bar-label">Poll:</span>
        <span className="status-bar-val">{pollCount}</span>
        <span className="status-bar-sep">|</span>
        <span className="status-bar-label">Est. Cost:</span>
        <span className="status-bar-cost">${costEstimate.toFixed(3)}</span>
        {error && <><span className="status-bar-sep">|</span><span className="status-bar-error">{error}</span></>}
        <div className="status-bar-btns">
          {isRunning && (
            <button className="btn-status btn-stop" onClick={() => {
              fetch('/api/stop-job', { method: 'POST' }).catch(() => {})
              setIsRunning(false)
            }}>■ Stop</button>
          )}
          {!noActivity && <button className="btn-status btn-save" onClick={saveAllData}>Save All Data</button>}
          {!noActivity && <button className="btn-status btn-synth" onClick={runSynthesis}>Run Synthesis</button>}
          {noActivity && <button className="btn-status btn-start" onClick={() => {}}>▶ New Analysis</button>}
        </div>
      </div>
    </div>
  )
}
