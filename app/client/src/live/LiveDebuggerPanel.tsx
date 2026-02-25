// 🔍 FluxStack Live Component Debugger Panel
//
// Visual debugger for Live Components. Shows:
// - Active components with current state
// - Real-time event timeline (state changes, actions, rooms, errors)
// - Component detail view with state inspector
// - Filtering by component, event type, and search

import { useState, useRef, useEffect, useCallback } from 'react'
import { useLiveDebugger, type DebugEvent, type DebugEventType, type ComponentSnapshot, type DebugFilter } from '@/core/client/hooks/useLiveDebugger'

// ===== Debugger Settings (shared with floating widget) =====

interface DebuggerSettings {
  fontSize: 'xs' | 'sm' | 'md' | 'lg'
  showTimestamps: boolean
  compactMode: boolean
  wordWrap: boolean
  maxEvents: number
}

const FONT_SIZES: Record<DebuggerSettings['fontSize'], number> = { xs: 9, sm: 10, md: 11, lg: 13 }

const DEFAULT_SETTINGS: DebuggerSettings = {
  fontSize: 'sm', showTimestamps: true, compactMode: false,
  wordWrap: false, maxEvents: 300,
}

const SETTINGS_KEY = 'fluxstack-debugger-settings'

function loadSettings(): DebuggerSettings {
  try {
    const stored = localStorage.getItem(SETTINGS_KEY)
    if (stored) return { ...DEFAULT_SETTINGS, ...JSON.parse(stored) }
  } catch { /* ignore */ }
  return { ...DEFAULT_SETTINGS }
}

function saveSettings(s: DebuggerSettings) {
  try { localStorage.setItem(SETTINGS_KEY, JSON.stringify(s)) } catch { /* ignore */ }
}

// ===== Event Type Config =====

const EVENT_COLORS: Record<DebugEventType, string> = {
  COMPONENT_MOUNT: '#22c55e',
  COMPONENT_UNMOUNT: '#ef4444',
  COMPONENT_REHYDRATE: '#f59e0b',
  STATE_CHANGE: '#3b82f6',
  ACTION_CALL: '#8b5cf6',
  ACTION_RESULT: '#06b6d4',
  ACTION_ERROR: '#ef4444',
  ROOM_JOIN: '#10b981',
  ROOM_LEAVE: '#f97316',
  ROOM_EMIT: '#6366f1',
  ROOM_EVENT_RECEIVED: '#a855f7',
  WS_CONNECT: '#22c55e',
  WS_DISCONNECT: '#ef4444',
  ERROR: '#dc2626',
}

const EVENT_LABELS: Record<DebugEventType, string> = {
  COMPONENT_MOUNT: 'Mount',
  COMPONENT_UNMOUNT: 'Unmount',
  COMPONENT_REHYDRATE: 'Rehydrate',
  STATE_CHANGE: 'State',
  ACTION_CALL: 'Action',
  ACTION_RESULT: 'Result',
  ACTION_ERROR: 'Error',
  ROOM_JOIN: 'Room Join',
  ROOM_LEAVE: 'Room Leave',
  ROOM_EMIT: 'Room Emit',
  ROOM_EVENT_RECEIVED: 'Room Event',
  WS_CONNECT: 'WS Connect',
  WS_DISCONNECT: 'WS Disconnect',
  ERROR: 'Error',
}

// ===== Helper Components =====

function Badge({ label, color, small }: { label: string; color: string; small?: boolean }) {
  return (
    <span
      style={{
        display: 'inline-block',
        padding: small ? '1px 6px' : '2px 8px',
        borderRadius: '4px',
        fontSize: small ? '10px' : '11px',
        fontWeight: 600,
        fontFamily: 'monospace',
        color: '#fff',
        backgroundColor: color,
        lineHeight: '1.4',
      }}
    >
      {label}
    </span>
  )
}

function TimeStamp({ ts }: { ts: number }) {
  const d = new Date(ts)
  const time = d.toLocaleTimeString('en-US', { hour12: false })
  const ms = String(d.getMilliseconds()).padStart(3, '0')
  return (
    <span style={{ color: '#6b7280', fontFamily: 'monospace', fontSize: '11px' }}>
      {time}.{ms}
    </span>
  )
}

function JsonTree({ data, depth = 0 }: { data: unknown; depth?: number }) {
  if (data === null || data === undefined) {
    return <span style={{ color: '#9ca3af' }}>{String(data)}</span>
  }

  if (typeof data === 'boolean') {
    return <span style={{ color: '#f59e0b' }}>{String(data)}</span>
  }

  if (typeof data === 'number') {
    return <span style={{ color: '#3b82f6' }}>{data}</span>
  }

  if (typeof data === 'string') {
    if (data.length > 100) {
      return <span style={{ color: '#22c55e' }}>"{data.slice(0, 100)}..."</span>
    }
    return <span style={{ color: '#22c55e' }}>"{data}"</span>
  }

  if (Array.isArray(data)) {
    if (data.length === 0) return <span style={{ color: '#9ca3af' }}>[]</span>
    if (depth > 3) return <span style={{ color: '#9ca3af' }}>[...{data.length}]</span>

    return (
      <div style={{ paddingLeft: depth > 0 ? '16px' : 0 }}>
        <span style={{ color: '#9ca3af' }}>[</span>
        {data.map((item, i) => (
          <div key={i} style={{ paddingLeft: '16px' }}>
            <JsonTree data={item} depth={depth + 1} />
            {i < data.length - 1 && <span style={{ color: '#9ca3af' }}>,</span>}
          </div>
        ))}
        <span style={{ color: '#9ca3af' }}>]</span>
      </div>
    )
  }

  if (typeof data === 'object') {
    const entries = Object.entries(data as Record<string, unknown>)
    if (entries.length === 0) return <span style={{ color: '#9ca3af' }}>{'{}'}</span>
    if (depth > 3) return <span style={{ color: '#9ca3af' }}>{'{'} ...{entries.length} {'}'}</span>

    return (
      <div style={{ paddingLeft: depth > 0 ? '16px' : 0 }}>
        {entries.map(([key, value], i) => (
          <div key={key} style={{ paddingLeft: '4px' }}>
            <span style={{ color: '#e879f9' }}>{key}</span>
            <span style={{ color: '#9ca3af' }}>: </span>
            <JsonTree data={value} depth={depth + 1} />
            {i < entries.length - 1 && <span style={{ color: '#9ca3af' }}>,</span>}
          </div>
        ))}
      </div>
    )
  }

  return <span>{String(data)}</span>
}

// ===== Component List =====

function ComponentList({
  components,
  selectedId,
  onSelect,
}: {
  components: ComponentSnapshot[]
  selectedId: string | null
  onSelect: (id: string | null) => void
}) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
      {/* "All" option */}
      <button
        onClick={() => onSelect(null)}
        style={{
          display: 'flex', alignItems: 'center', gap: '8px',
          padding: '8px 12px', borderRadius: '6px', border: 'none', cursor: 'pointer',
          textAlign: 'left', width: '100%',
          backgroundColor: selectedId === null ? '#1e293b' : 'transparent',
          color: selectedId === null ? '#e2e8f0' : '#94a3b8',
          fontFamily: 'monospace', fontSize: '12px',
        }}
      >
        All Components ({components.length})
      </button>

      {components.map(comp => (
        <button
          key={comp.componentId}
          onClick={() => onSelect(comp.componentId)}
          style={{
            display: 'flex', flexDirection: 'column', gap: '4px',
            padding: '8px 12px', borderRadius: '6px', border: 'none', cursor: 'pointer',
            textAlign: 'left', width: '100%',
            backgroundColor: selectedId === comp.componentId ? '#1e293b' : 'transparent',
            color: selectedId === comp.componentId ? '#e2e8f0' : '#cbd5e1',
            fontFamily: 'monospace', fontSize: '12px',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <span style={{ color: '#22c55e', fontSize: '8px' }}>●</span>
            <strong>{comp.componentName}</strong>
          </div>
          <div style={{ display: 'flex', gap: '8px', fontSize: '10px', color: '#64748b' }}>
            <span>A:{comp.actionCount}</span>
            <span>S:{comp.stateChangeCount}</span>
            {comp.errorCount > 0 && <span style={{ color: '#ef4444' }}>E:{comp.errorCount}</span>}
            {comp.rooms.length > 0 && <span>R:{comp.rooms.join(',')}</span>}
          </div>
        </button>
      ))}

      {components.length === 0 && (
        <div style={{ padding: '16px', textAlign: 'center', color: '#64748b', fontSize: '12px' }}>
          No active components
        </div>
      )}
    </div>
  )
}

// ===== Event Row =====

function EventRow({ event, isSelected, settings }: {
  event: DebugEvent; isSelected: boolean; settings: DebuggerSettings
}) {
  const [expanded, setExpanded] = useState(false)
  const color = EVENT_COLORS[event.type] || '#6b7280'
  const label = EVENT_LABELS[event.type] || event.type
  const fs = FONT_SIZES[settings.fontSize]

  // Build summary line
  let summary = ''
  switch (event.type) {
    case 'STATE_CHANGE': {
      const delta = event.data.delta as Record<string, unknown> | undefined
      if (delta) {
        const keys = Object.keys(delta)
        summary = keys.length <= 3
          ? keys.map(k => `${k} = ${JSON.stringify(delta[k])}`).join(', ')
          : `${keys.length} properties changed`
      }
      break
    }
    case 'ACTION_CALL':
      summary = `${event.data.action as string}(${event.data.payload ? JSON.stringify(event.data.payload).slice(0, 60) : ''})`
      break
    case 'ACTION_RESULT':
      summary = `${event.data.action as string} → ${(event.data.duration as number)}ms`
      break
    case 'ACTION_ERROR':
      summary = `${event.data.action as string} failed: ${event.data.error as string}`
      break
    case 'ROOM_JOIN':
    case 'ROOM_LEAVE':
      summary = event.data.roomId as string
      break
    case 'ROOM_EMIT':
      summary = `${event.data.event as string} → ${event.data.roomId as string}`
      break
    case 'COMPONENT_MOUNT':
      summary = event.data.room ? `room: ${event.data.room as string}` : ''
      break
    case 'ERROR':
      summary = event.data.error as string
      break
    case 'WS_CONNECT':
    case 'WS_DISCONNECT':
      summary = event.data.connectionId as string
      break
  }

  const py = settings.compactMode ? '3px' : '6px'

  return (
    <div
      style={{
        borderBottom: '1px solid #1e293b',
        cursor: 'pointer',
        backgroundColor: expanded ? '#0f172a' : 'transparent',
      }}
      onClick={() => setExpanded(!expanded)}
    >
      <div
        style={{
          display: 'flex', alignItems: 'center', gap: '8px',
          padding: `${py} 12px`, fontSize: `${fs}px`,
        }}
      >
        {settings.showTimestamps && <TimeStamp ts={event.timestamp} />}
        <Badge label={label} color={color} small />
        {event.componentName && (
          <span style={{
            color: isSelected ? '#e2e8f0' : '#64748b',
            fontFamily: 'monospace', fontSize: `${fs}px`
          }}>
            {event.componentName}
          </span>
        )}
        <span style={{
          flex: 1, color: '#94a3b8', fontFamily: 'monospace', fontSize: `${fs}px`,
          overflow: 'hidden', textOverflow: 'ellipsis',
          whiteSpace: settings.wordWrap ? 'normal' : 'nowrap',
        }}>
          {summary}
        </span>
        <span style={{ color: '#475569', fontSize: `${Math.max(8, fs - 2)}px` }}>{expanded ? '\u25BC' : '\u25B6'}</span>
      </div>

      {expanded && (
        <div style={{
          padding: '8px 12px 12px 50px',
          fontSize: `${fs}px`, fontFamily: 'monospace', color: '#cbd5e1',
          backgroundColor: '#0f172a',
          wordBreak: settings.wordWrap ? 'break-all' : undefined,
        }}>
          <JsonTree data={event.data} />
          <div style={{ marginTop: '4px', fontSize: `${Math.max(8, fs - 2)}px`, color: '#475569' }}>
            ID: {event.id} | Component: {event.componentId || 'global'}
          </div>
        </div>
      )}
    </div>
  )
}

// ===== State Inspector =====

function StateInspector({ component, settings }: { component: ComponentSnapshot; settings: DebuggerSettings }) {
  const uptime = Date.now() - component.mountedAt
  const fs = FONT_SIZES[settings.fontSize]

  return (
    <div style={{
      padding: '16px',
      fontFamily: 'monospace', fontSize: `${fs + 1}px`, color: '#e2e8f0',
    }}>
      <h3 style={{ margin: '0 0 12px', fontSize: '14px', color: '#f1f5f9' }}>
        {component.componentName}
      </h3>

      {/* Stats */}
      <div style={{
        display: 'grid', gridTemplateColumns: '1fr 1fr 1fr',
        gap: '8px', marginBottom: '16px',
      }}>
        <div style={{ padding: '8px', backgroundColor: '#1e293b', borderRadius: '6px', textAlign: 'center' }}>
          <div style={{ fontSize: '18px', fontWeight: 700, color: '#3b82f6' }}>{component.stateChangeCount}</div>
          <div style={{ fontSize: '10px', color: '#64748b' }}>State Changes</div>
        </div>
        <div style={{ padding: '8px', backgroundColor: '#1e293b', borderRadius: '6px', textAlign: 'center' }}>
          <div style={{ fontSize: '18px', fontWeight: 700, color: '#8b5cf6' }}>{component.actionCount}</div>
          <div style={{ fontSize: '10px', color: '#64748b' }}>Actions</div>
        </div>
        <div style={{ padding: '8px', backgroundColor: '#1e293b', borderRadius: '6px', textAlign: 'center' }}>
          <div style={{ fontSize: '18px', fontWeight: 700, color: component.errorCount > 0 ? '#ef4444' : '#22c55e' }}>
            {component.errorCount}
          </div>
          <div style={{ fontSize: '10px', color: '#64748b' }}>Errors</div>
        </div>
      </div>

      {/* Info */}
      <div style={{ marginBottom: '16px', fontSize: '11px', color: '#94a3b8' }}>
        <div>ID: {component.componentId}</div>
        <div>Uptime: {formatDuration(uptime)}</div>
        {component.rooms.length > 0 && (
          <div>Rooms: {component.rooms.join(', ')}</div>
        )}
      </div>

      {/* Current State */}
      <div>
        <h4 style={{ margin: '0 0 8px', fontSize: '12px', color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
          Current State
        </h4>
        <div style={{
          padding: '12px', backgroundColor: '#0f172a', borderRadius: '6px',
          maxHeight: '400px', overflow: 'auto',
        }}>
          <JsonTree data={component.state} />
        </div>
      </div>
    </div>
  )
}

// ===== Helpers =====

function formatDuration(ms: number): string {
  if (ms < 1000) return `${ms}ms`
  const seconds = Math.floor(ms / 1000)
  if (seconds < 60) return `${seconds}s`
  const minutes = Math.floor(seconds / 60)
  if (minutes < 60) return `${minutes}m ${seconds % 60}s`
  const hours = Math.floor(minutes / 60)
  return `${hours}h ${minutes % 60}m`
}

// ===== Filter Bar =====

const ALL_EVENT_TYPES: DebugEventType[] = [
  'COMPONENT_MOUNT', 'COMPONENT_UNMOUNT', 'STATE_CHANGE',
  'ACTION_CALL', 'ACTION_RESULT', 'ACTION_ERROR',
  'ROOM_JOIN', 'ROOM_LEAVE', 'ROOM_EMIT',
  'WS_CONNECT', 'WS_DISCONNECT', 'ERROR'
]

function FilterBar({
  filter,
  onFilterChange,
  eventCount,
  totalCount,
}: {
  filter: DebugFilter
  onFilterChange: (f: Partial<DebugFilter>) => void
  eventCount: number
  totalCount: number
}) {
  const [showTypes, setShowTypes] = useState(false)

  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: '8px',
      padding: '8px 12px', borderBottom: '1px solid #1e293b',
      fontSize: '12px',
    }}>
      {/* Search */}
      <input
        type="text"
        placeholder="Search events..."
        value={filter.search || ''}
        onChange={e => onFilterChange({ search: e.target.value || undefined })}
        style={{
          flex: 1, padding: '4px 8px', borderRadius: '4px',
          border: '1px solid #334155', backgroundColor: '#0f172a',
          color: '#e2e8f0', fontSize: '12px', fontFamily: 'monospace',
          outline: 'none',
        }}
      />

      {/* Type filter toggle */}
      <button
        onClick={() => setShowTypes(!showTypes)}
        style={{
          padding: '4px 8px', borderRadius: '4px', cursor: 'pointer',
          border: '1px solid #334155', backgroundColor: filter.types?.size ? '#1e3a5f' : '#0f172a',
          color: '#94a3b8', fontSize: '11px', fontFamily: 'monospace',
        }}
      >
        Types {filter.types?.size ? `(${filter.types.size})` : ''}
      </button>

      {/* Event count */}
      <span style={{ color: '#64748b', fontSize: '11px', fontFamily: 'monospace' }}>
        {eventCount === totalCount ? totalCount : `${eventCount}/${totalCount}`}
      </span>

      {/* Type filter dropdown */}
      {showTypes && (
        <div style={{
          position: 'absolute', top: '100%', right: '12px', zIndex: 10,
          padding: '8px', backgroundColor: '#1e293b', borderRadius: '6px',
          border: '1px solid #334155', display: 'flex', flexWrap: 'wrap', gap: '4px',
          maxWidth: '400px',
        }}>
          {ALL_EVENT_TYPES.map(type => {
            const active = !filter.types || filter.types.has(type)
            return (
              <button
                key={type}
                onClick={() => {
                  const types = new Set(filter.types || ALL_EVENT_TYPES)
                  if (active) types.delete(type)
                  else types.add(type)
                  onFilterChange({ types: types.size === ALL_EVENT_TYPES.length ? undefined : types })
                }}
                style={{
                  padding: '2px 6px', borderRadius: '3px', cursor: 'pointer',
                  border: 'none', fontSize: '10px', fontFamily: 'monospace',
                  backgroundColor: active ? EVENT_COLORS[type] : '#0f172a',
                  color: active ? '#fff' : '#64748b',
                  opacity: active ? 1 : 0.5,
                }}
              >
                {EVENT_LABELS[type]}
              </button>
            )
          })}
        </div>
      )}
    </div>
  )
}

// ===== Main Panel =====

export function LiveDebuggerPanel() {
  const [settings, setSettingsState] = useState<DebuggerSettings>(loadSettings)
  const updateSettings = useCallback((patch: Partial<DebuggerSettings>) => {
    setSettingsState(prev => {
      const next = { ...prev, ...patch }
      saveSettings(next)
      return next
    })
  }, [])
  const fs = FONT_SIZES[settings.fontSize]
  const [showSettings, setShowSettings] = useState(false)

  const dbg = useLiveDebugger({ maxEvents: settings.maxEvents })
  const eventsEndRef = useRef<HTMLDivElement>(null)
  const [autoScroll, setAutoScroll] = useState(true)

  // Auto-scroll to bottom
  useEffect(() => {
    if (autoScroll && eventsEndRef.current) {
      eventsEndRef.current.scrollIntoView({ behavior: 'smooth' })
    }
  }, [dbg.filteredEvents.length, autoScroll])

  return (
    <div style={{
      display: 'flex', flexDirection: 'column',
      height: '100vh', backgroundColor: '#0f172a', color: '#e2e8f0',
      fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
    }}>
      {/* Header */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: '12px',
        padding: '12px 16px', borderBottom: '1px solid #1e293b',
        backgroundColor: '#020617',
      }}>
        <span style={{ fontSize: '16px' }}>🔍</span>
        <h1 style={{ margin: 0, fontSize: '14px', fontWeight: 700, letterSpacing: '0.5px' }}>
          LIVE DEBUGGER
        </h1>

        {/* Connection status */}
        <span style={{
          display: 'flex', alignItems: 'center', gap: '4px',
          fontSize: '11px', fontFamily: 'monospace',
          color: dbg.connected ? '#22c55e' : '#ef4444',
        }}>
          <span style={{ fontSize: '8px' }}>●</span>
          {dbg.connecting ? 'connecting...' : dbg.connected ? 'connected' : 'disconnected'}
        </span>

        <div style={{ flex: 1 }} />

        {/* Controls */}
        <button
          onClick={dbg.togglePause}
          style={{
            padding: '4px 10px', borderRadius: '4px', cursor: 'pointer',
            border: '1px solid #334155',
            backgroundColor: dbg.paused ? '#7c2d12' : '#0f172a',
            color: dbg.paused ? '#fdba74' : '#94a3b8',
            fontSize: '11px', fontFamily: 'monospace',
          }}
        >
          {dbg.paused ? '▶ Resume' : '⏸ Pause'}
        </button>

        <button
          onClick={dbg.clearEvents}
          style={{
            padding: '4px 10px', borderRadius: '4px', cursor: 'pointer',
            border: '1px solid #334155', backgroundColor: '#0f172a',
            color: '#94a3b8', fontSize: '11px', fontFamily: 'monospace',
          }}
        >
          Clear
        </button>

        <button
          onClick={() => setAutoScroll(!autoScroll)}
          style={{
            padding: '4px 10px', borderRadius: '4px', cursor: 'pointer',
            border: '1px solid #334155',
            backgroundColor: autoScroll ? '#1e3a5f' : '#0f172a',
            color: autoScroll ? '#60a5fa' : '#94a3b8',
            fontSize: '11px', fontFamily: 'monospace',
          }}
        >
          Auto-scroll
        </button>

        <button
          onClick={() => setShowSettings(v => !v)}
          title="Settings"
          style={{
            padding: '4px 10px', borderRadius: '4px', cursor: 'pointer',
            border: '1px solid #334155',
            backgroundColor: showSettings ? '#78350f' : '#0f172a',
            color: showSettings ? '#f59e0b' : '#94a3b8',
            fontSize: '13px', fontFamily: 'monospace',
          }}
        >
          {'\u2699'}
        </button>

        {/* Stats */}
        <span style={{ fontSize: '11px', fontFamily: 'monospace', color: '#64748b' }}>
          {dbg.componentCount} components | {dbg.eventCount} events
        </span>
      </div>

      {/* Settings drawer */}
      {showSettings && (
        <div style={{
          display: 'flex', gap: '16px', padding: '12px 16px',
          borderBottom: '1px solid #1e293b', backgroundColor: '#020617',
          flexWrap: 'wrap', alignItems: 'center',
        }}>
          {/* Font size */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <span style={{ fontFamily: 'monospace', fontSize: '10px', color: '#64748b', textTransform: 'uppercase' }}>Font</span>
            {(['xs', 'sm', 'md', 'lg'] as const).map(size => (
              <button
                key={size}
                onClick={() => updateSettings({ fontSize: size })}
                style={{
                  padding: '3px 8px', borderRadius: '3px', border: 'none', cursor: 'pointer',
                  fontFamily: 'monospace', fontSize: FONT_SIZES[size], fontWeight: 600,
                  background: settings.fontSize === size ? '#1e3a5f' : '#1e293b',
                  color: settings.fontSize === size ? '#60a5fa' : '#64748b',
                }}
              >
                {size.toUpperCase()}
              </button>
            ))}
          </div>

          {/* Max events */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <span style={{ fontFamily: 'monospace', fontSize: '10px', color: '#64748b', textTransform: 'uppercase' }}>Buffer</span>
            {[100, 300, 500, 1000].map(n => (
              <button
                key={n}
                onClick={() => updateSettings({ maxEvents: n })}
                style={{
                  padding: '3px 8px', borderRadius: '3px', border: 'none', cursor: 'pointer',
                  fontFamily: 'monospace', fontSize: '10px', fontWeight: 600,
                  background: settings.maxEvents === n ? '#1e3a5f' : '#1e293b',
                  color: settings.maxEvents === n ? '#60a5fa' : '#64748b',
                }}
              >
                {n}
              </button>
            ))}
          </div>

          {/* Toggles */}
          <label style={{ display: 'flex', alignItems: 'center', gap: '4px', cursor: 'pointer', fontFamily: 'monospace', fontSize: '10px', color: '#94a3b8' }}>
            <input type="checkbox" checked={settings.showTimestamps} onChange={e => updateSettings({ showTimestamps: e.target.checked })} />
            Timestamps
          </label>
          <label style={{ display: 'flex', alignItems: 'center', gap: '4px', cursor: 'pointer', fontFamily: 'monospace', fontSize: '10px', color: '#94a3b8' }}>
            <input type="checkbox" checked={settings.compactMode} onChange={e => updateSettings({ compactMode: e.target.checked })} />
            Compact
          </label>
          <label style={{ display: 'flex', alignItems: 'center', gap: '4px', cursor: 'pointer', fontFamily: 'monospace', fontSize: '10px', color: '#94a3b8' }}>
            <input type="checkbox" checked={settings.wordWrap} onChange={e => updateSettings({ wordWrap: e.target.checked })} />
            Word wrap
          </label>

          <button
            onClick={() => updateSettings(DEFAULT_SETTINGS)}
            style={{
              padding: '3px 8px', borderRadius: '3px', border: '1px solid #1e293b', cursor: 'pointer',
              fontFamily: 'monospace', fontSize: '10px', background: 'transparent', color: '#64748b',
            }}
          >
            Reset
          </button>
        </div>
      )}

      {/* Body */}
      <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>
        {/* Left sidebar - Components */}
        <div style={{
          width: '240px', borderRight: '1px solid #1e293b',
          display: 'flex', flexDirection: 'column', overflow: 'hidden',
        }}>
          <div style={{
            padding: '8px 12px', borderBottom: '1px solid #1e293b',
            fontSize: '11px', fontWeight: 600, color: '#64748b',
            textTransform: 'uppercase', letterSpacing: '0.5px',
          }}>
            Components
          </div>
          <div style={{ flex: 1, overflow: 'auto', padding: '4px' }}>
            <ComponentList
              components={dbg.components}
              selectedId={dbg.selectedComponentId}
              onSelect={(id) => {
                dbg.selectComponent(id)
                dbg.setFilter({ componentId: id ?? undefined })
              }}
            />
          </div>
        </div>

        {/* Center - Event Timeline */}
        <div style={{
          flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden',
          minWidth: 0,
        }}>
          {/* Filter bar */}
          <div style={{ position: 'relative' }}>
            <FilterBar
              filter={dbg.filter}
              onFilterChange={dbg.setFilter}
              eventCount={dbg.filteredEvents.length}
              totalCount={dbg.events.length}
            />
          </div>

          {/* Events */}
          <div style={{ flex: 1, overflow: 'auto' }}>
            {dbg.filteredEvents.map(event => (
              <EventRow
                key={event.id}
                event={event}
                isSelected={event.componentId === dbg.selectedComponentId}
                settings={settings}
              />
            ))}

            {dbg.filteredEvents.length === 0 && (
              <div style={{
                display: 'flex', flexDirection: 'column', alignItems: 'center',
                justifyContent: 'center', height: '200px', color: '#475569',
              }}>
                <div style={{ fontSize: '24px', marginBottom: '8px' }}>🔍</div>
                <div style={{ fontSize: '13px' }}>
                  {dbg.connected
                    ? dbg.paused
                      ? 'Paused - click Resume to continue'
                      : 'Waiting for events...'
                    : 'Connecting to debug server...'}
                </div>
                <div style={{ fontSize: '11px', marginTop: '4px', color: '#334155' }}>
                  Use your app to generate Live Component events
                </div>
              </div>
            )}

            <div ref={eventsEndRef} />
          </div>
        </div>

        {/* Right sidebar - State Inspector */}
        {dbg.selectedComponent && (
          <div style={{
            width: '350px', borderLeft: '1px solid #1e293b',
            overflow: 'auto',
          }}>
            <StateInspector component={dbg.selectedComponent} settings={settings} />
          </div>
        )}
      </div>
    </div>
  )
}
