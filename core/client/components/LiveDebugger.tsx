// FluxStack Live Debugger - Draggable Floating Window
//
// A floating, draggable, resizable debug panel for inspecting Live Components.
// Toggle with Ctrl+Shift+D or click the small badge in the corner.
//
// Usage:
//   import { LiveDebugger } from '@/core/client'
//   <LiveDebugger />

import React, { useState, useRef, useEffect, useCallback, useMemo } from 'react'
import { useLiveDebugger, type DebugEvent, type DebugEventType, type ComponentSnapshot } from '../hooks/useLiveDebugger'

// ===== Debugger Settings =====

export interface DebuggerSettings {
  fontSize: 'xs' | 'sm' | 'md' | 'lg'
  showTimestamps: boolean
  compactMode: boolean
  wordWrap: boolean
  maxEvents: number
}

const FONT_SIZES: Record<DebuggerSettings['fontSize'], number> = {
  xs: 9,
  sm: 10,
  md: 11,
  lg: 13,
}

const DEFAULT_SETTINGS: DebuggerSettings = {
  fontSize: 'sm',
  showTimestamps: true,
  compactMode: false,
  wordWrap: false,
  maxEvents: 300,
}

const SETTINGS_KEY = 'fluxstack-debugger-settings'

function loadSettings(): DebuggerSettings {
  try {
    const stored = localStorage.getItem(SETTINGS_KEY)
    if (stored) return { ...DEFAULT_SETTINGS, ...JSON.parse(stored) }
  } catch { /* ignore */ }
  return { ...DEFAULT_SETTINGS }
}

function saveSettings(settings: DebuggerSettings) {
  try {
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings))
  } catch { /* ignore */ }
}

// ===== Event Type Groups =====

type EventGroup = 'lifecycle' | 'state' | 'actions' | 'rooms' | 'connection' | 'errors'

const EVENT_GROUPS: Record<EventGroup, { label: string; color: string; types: DebugEventType[] }> = {
  lifecycle: {
    label: 'Lifecycle',
    color: '#22c55e',
    types: ['COMPONENT_MOUNT', 'COMPONENT_UNMOUNT', 'COMPONENT_REHYDRATE'],
  },
  state: {
    label: 'State',
    color: '#3b82f6',
    types: ['STATE_CHANGE'],
  },
  actions: {
    label: 'Actions',
    color: '#8b5cf6',
    types: ['ACTION_CALL', 'ACTION_RESULT', 'ACTION_ERROR'],
  },
  rooms: {
    label: 'Rooms',
    color: '#10b981',
    types: ['ROOM_JOIN', 'ROOM_LEAVE', 'ROOM_EMIT', 'ROOM_EVENT_RECEIVED'],
  },
  connection: {
    label: 'WS',
    color: '#06b6d4',
    types: ['WS_CONNECT', 'WS_DISCONNECT'],
  },
  errors: {
    label: 'Errors',
    color: '#ef4444',
    types: ['ERROR'],
  },
}

const ALL_GROUPS = Object.keys(EVENT_GROUPS) as EventGroup[]

const COLORS: Record<string, string> = {
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
  ROOM_EVENT_RECEIVED: '#6366f1',
  WS_CONNECT: '#22c55e',
  WS_DISCONNECT: '#ef4444',
  ERROR: '#dc2626',
}

const LABELS: Record<string, string> = {
  COMPONENT_MOUNT: 'MOUNT',
  COMPONENT_UNMOUNT: 'UNMOUNT',
  COMPONENT_REHYDRATE: 'REHYDRATE',
  STATE_CHANGE: 'STATE',
  ACTION_CALL: 'ACTION',
  ACTION_RESULT: 'RESULT',
  ACTION_ERROR: 'ERR',
  ROOM_JOIN: 'JOIN',
  ROOM_LEAVE: 'LEAVE',
  ROOM_EMIT: 'EMIT',
  ROOM_EVENT_RECEIVED: 'ROOM_EVT',
  WS_CONNECT: 'CONNECT',
  WS_DISCONNECT: 'DISCONNECT',
  ERROR: 'ERROR',
}

// ===== Collapsible JSON Tree Viewer =====

function jsonPreview(data: unknown): string {
  if (data === null || data === undefined) return String(data)
  if (typeof data !== 'object') return JSON.stringify(data)
  if (Array.isArray(data)) {
    if (data.length === 0) return '[]'
    const items = data.slice(0, 3).map(jsonPreview).join(', ')
    return data.length <= 3 ? `[${items}]` : `[${items}, ...+${data.length - 3}]`
  }
  const entries = Object.entries(data as Record<string, unknown>)
  if (entries.length === 0) return '{}'
  const items = entries.slice(0, 3).map(([k, v]) => {
    const val = typeof v === 'object' && v !== null
      ? (Array.isArray(v) ? `[${v.length}]` : `{${Object.keys(v).length}}`)
      : JSON.stringify(v)
    return `${k}: ${val}`
  }).join(', ')
  return entries.length <= 3 ? `{ ${items} }` : `{ ${items}, ...+${entries.length - 3} }`
}

function isExpandable(data: unknown): boolean {
  return data !== null && typeof data === 'object' && (
    Array.isArray(data) ? data.length > 0 : Object.keys(data as object).length > 0
  )
}

function JsonNode({ label, data, defaultOpen = false }: {
  label?: string | number
  data: unknown
  defaultOpen?: boolean
}) {
  const [open, setOpen] = useState(defaultOpen)
  const expandable = isExpandable(data)

  // Primitives
  if (!expandable) {
    let rendered: React.ReactNode
    if (data === null || data === undefined) rendered = <span style={{ color: '#6b7280' }}>{String(data)}</span>
    else if (typeof data === 'boolean') rendered = <span style={{ color: '#f59e0b' }}>{String(data)}</span>
    else if (typeof data === 'number') rendered = <span style={{ color: '#60a5fa' }}>{data}</span>
    else if (typeof data === 'string') {
      const display = data.length > 120 ? data.slice(0, 120) + '...' : data
      rendered = <span style={{ color: '#34d399' }}>"{display}"</span>
    } else {
      rendered = <span>{String(data)}</span>
    }

    return (
      <div style={{ lineHeight: '1.6', paddingLeft: 2 }}>
        {label !== undefined && (
          <>
            <span style={{ color: typeof label === 'number' ? '#60a5fa' : '#c084fc' }}>{label}</span>
            <span style={{ color: '#6b7280' }}>: </span>
          </>
        )}
        {rendered}
      </div>
    )
  }

  // Expandable (object / array)
  const isArray = Array.isArray(data)
  const entries = isArray
    ? (data as unknown[]).map((v, i) => [i, v] as [number, unknown])
    : Object.entries(data as Record<string, unknown>)
  const bracketOpen = isArray ? '[' : '{'
  const bracketClose = isArray ? ']' : '}'

  return (
    <div style={{ lineHeight: '1.6' }}>
      <div
        onClick={() => setOpen(!open)}
        style={{ cursor: 'pointer', display: 'flex', alignItems: 'flex-start', gap: 2, paddingLeft: 2 }}
      >
        <span style={{
          color: '#475569', fontSize: 8, width: 10, flexShrink: 0,
          display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
          paddingTop: 4, userSelect: 'none',
        }}>
          {open ? '\u25BC' : '\u25B6'}
        </span>
        <span>
          {label !== undefined && (
            <>
              <span style={{ color: typeof label === 'number' ? '#60a5fa' : '#c084fc' }}>{label}</span>
              <span style={{ color: '#6b7280' }}>: </span>
            </>
          )}
          {!open && (
            <span style={{ color: '#64748b' }}>
              {bracketOpen} {jsonPreview(data).slice(1, -1)} {bracketClose}
            </span>
          )}
          {open && (
            <span style={{ color: '#64748b' }}>
              {bracketOpen}
              <span style={{ color: '#475569', fontSize: 9, marginLeft: 4 }}>
                {entries.length} {isArray ? (entries.length === 1 ? 'item' : 'items') : (entries.length === 1 ? 'key' : 'keys')}
              </span>
            </span>
          )}
        </span>
      </div>
      {open && (
        <div style={{ paddingLeft: 14 }}>
          {entries.map(([key, val]) => (
            <JsonNode
              key={String(key)}
              label={key}
              data={val}
              defaultOpen={false}
            />
          ))}
          <div style={{ color: '#64748b', paddingLeft: 2 }}>{bracketClose}</div>
        </div>
      )}
    </div>
  )
}

function Json({ data, depth = 0 }: { data: unknown; depth?: number }) {
  return <JsonNode data={data} defaultOpen={depth === 0} />
}

// ===== Event Summary =====

function eventSummary(e: DebugEvent): string {
  switch (e.type) {
    case 'STATE_CHANGE': {
      const delta = e.data.delta as Record<string, unknown> | undefined
      if (!delta) return ''
      const keys = Object.keys(delta)
      if (keys.length <= 2) return keys.map(k => `${k}=${JSON.stringify(delta[k])}`).join(' ')
      return `${keys.length} props`
    }
    case 'ACTION_CALL':
      return String(e.data.action || '')
    case 'ACTION_RESULT':
      return `${e.data.action} ${e.data.duration}ms`
    case 'ACTION_ERROR':
      return `${e.data.action}: ${e.data.error}`
    case 'ROOM_JOIN':
    case 'ROOM_LEAVE':
      return String(e.data.roomId || '')
    case 'ROOM_EMIT':
      return `${e.data.event} -> ${e.data.roomId}`
    case 'ERROR':
      return String(e.data.error || '')
    default:
      return ''
  }
}

function displayName(comp: ComponentSnapshot): string {
  return comp.debugLabel || comp.componentName
}

// ===== Drag Hook =====

function useDrag(
  initialPos: { x: number; y: number },
  onDragEnd?: (pos: { x: number; y: number }) => void
) {
  const [pos, setPos] = useState(initialPos)
  const dragging = useRef(false)
  const offset = useRef({ x: 0, y: 0 })

  const onMouseDown = useCallback((e: React.MouseEvent) => {
    // Only drag from title bar, not from buttons
    if ((e.target as HTMLElement).closest('button, input, select')) return
    dragging.current = true
    offset.current = { x: e.clientX - pos.x, y: e.clientY - pos.y }
    e.preventDefault()
  }, [pos])

  useEffect(() => {
    const onMouseMove = (e: MouseEvent) => {
      if (!dragging.current) return
      const newX = Math.max(0, Math.min(window.innerWidth - 100, e.clientX - offset.current.x))
      const newY = Math.max(0, Math.min(window.innerHeight - 40, e.clientY - offset.current.y))
      setPos({ x: newX, y: newY })
    }
    const onMouseUp = () => {
      if (dragging.current) {
        dragging.current = false
        onDragEnd?.(pos)
      }
    }
    window.addEventListener('mousemove', onMouseMove)
    window.addEventListener('mouseup', onMouseUp)
    return () => {
      window.removeEventListener('mousemove', onMouseMove)
      window.removeEventListener('mouseup', onMouseUp)
    }
  }, [pos, onDragEnd])

  return { pos, setPos, onMouseDown }
}

// ===== Resize Hook =====

function useResize(
  initialSize: { w: number; h: number },
  minSize = { w: 420, h: 300 }
) {
  const [size, setSize] = useState(initialSize)
  const resizing = useRef(false)
  const startData = useRef({ mouseX: 0, mouseY: 0, w: 0, h: 0 })

  const onResizeStart = useCallback((e: React.MouseEvent) => {
    resizing.current = true
    startData.current = { mouseX: e.clientX, mouseY: e.clientY, w: size.w, h: size.h }
    e.preventDefault()
    e.stopPropagation()
  }, [size])

  useEffect(() => {
    const onMouseMove = (e: MouseEvent) => {
      if (!resizing.current) return
      const dw = e.clientX - startData.current.mouseX
      const dh = e.clientY - startData.current.mouseY
      setSize({
        w: Math.max(minSize.w, startData.current.w + dw),
        h: Math.max(minSize.h, startData.current.h + dh),
      })
    }
    const onMouseUp = () => { resizing.current = false }
    window.addEventListener('mousemove', onMouseMove)
    window.addEventListener('mouseup', onMouseUp)
    return () => {
      window.removeEventListener('mousemove', onMouseMove)
      window.removeEventListener('mouseup', onMouseUp)
    }
  }, [minSize.w, minSize.h])

  return { size, onResizeStart }
}

// ===== Component Card =====

function ComponentCard({
  comp,
  isSelected,
  onSelect,
}: {
  comp: ComponentSnapshot
  isSelected: boolean
  onSelect: () => void
}) {
  return (
    <button
      onClick={onSelect}
      style={{
        width: '100%', textAlign: 'left', cursor: 'pointer',
        padding: '6px 8px', borderRadius: 4, border: 'none',
        background: isSelected ? '#1e293b' : 'transparent',
        color: '#e2e8f0', fontFamily: 'monospace', fontSize: 11,
        display: 'flex', flexDirection: 'column', gap: 1,
        transition: 'background 0.15s',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
        <span style={{ color: '#22c55e', fontSize: 6 }}>&#9679;</span>
        <strong style={{ fontSize: 11 }}>{displayName(comp)}</strong>
      </div>
      {comp.debugLabel && (
        <div style={{ fontSize: 9, color: '#64748b', paddingLeft: 11 }}>{comp.componentName}</div>
      )}
      <div style={{ display: 'flex', gap: 8, color: '#64748b', fontSize: 9, paddingLeft: 11 }}>
        <span>S:{comp.stateChangeCount}</span>
        <span>A:{comp.actionCount}</span>
        {comp.errorCount > 0 && <span style={{ color: '#f87171' }}>E:{comp.errorCount}</span>}
      </div>
    </button>
  )
}

// ===== Filter Bar =====

function FilterBar({
  activeGroups,
  toggleGroup,
  search,
  setSearch,
  groupCounts,
}: {
  activeGroups: Set<EventGroup>
  toggleGroup: (g: EventGroup) => void
  search: string
  setSearch: (s: string) => void
  groupCounts: Record<EventGroup, number>
}) {
  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 4,
      padding: '4px 8px', borderBottom: '1px solid #1e293b',
      flexShrink: 0, flexWrap: 'wrap',
    }}>
      {ALL_GROUPS.map(g => {
        const group = EVENT_GROUPS[g]
        const active = activeGroups.has(g)
        const count = groupCounts[g] || 0
        return (
          <button
            key={g}
            onClick={() => toggleGroup(g)}
            style={{
              padding: '2px 6px', borderRadius: 3,
              border: `1px solid ${active ? group.color + '60' : '#1e293b'}`,
              cursor: 'pointer', fontFamily: 'monospace', fontSize: 9,
              background: active ? group.color + '20' : 'transparent',
              color: active ? group.color : '#475569',
              transition: 'all 0.15s',
              display: 'flex', alignItems: 'center', gap: 3,
            }}
          >
            {group.label}
            {count > 0 && (
              <span style={{
                fontSize: 8, color: active ? group.color : '#374151',
                fontWeight: 600,
              }}>
                {count}
              </span>
            )}
          </button>
        )
      })}
      <div style={{ flex: 1 }} />
      <input
        type="text"
        value={search}
        onChange={e => setSearch(e.target.value)}
        placeholder="Search..."
        style={{
          width: 120, padding: '2px 6px', borderRadius: 3,
          border: '1px solid #1e293b', background: '#0f172a',
          color: '#e2e8f0', fontFamily: 'monospace', fontSize: 10,
          outline: 'none',
        }}
        onFocus={e => { e.target.style.borderColor = '#334155' }}
        onBlur={e => { e.target.style.borderColor = '#1e293b' }}
      />
    </div>
  )
}

// ===== Settings Panel =====

function SettingsPanel({
  settings,
  onChange,
}: {
  settings: DebuggerSettings
  onChange: (patch: Partial<DebuggerSettings>) => void
}) {
  const sectionStyle: React.CSSProperties = {
    marginBottom: 14,
  }
  const labelStyle: React.CSSProperties = {
    fontFamily: 'monospace', fontSize: 9, color: '#64748b',
    textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 6,
    display: 'block',
  }
  const rowStyle: React.CSSProperties = {
    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
    padding: '5px 0',
  }
  const descStyle: React.CSSProperties = {
    fontFamily: 'monospace', fontSize: 10, color: '#94a3b8',
  }

  return (
    <div style={{ flex: 1, overflow: 'auto', padding: 10 }}>
      {/* Font Size */}
      <div style={sectionStyle}>
        <span style={labelStyle}>Font Size</span>
        <div style={{ display: 'flex', gap: 4 }}>
          {(['xs', 'sm', 'md', 'lg'] as const).map(size => (
            <button
              key={size}
              onClick={() => onChange({ fontSize: size })}
              style={{
                flex: 1, padding: '5px 0', borderRadius: 4, border: 'none', cursor: 'pointer',
                fontFamily: 'monospace', fontSize: FONT_SIZES[size], fontWeight: 600,
                background: settings.fontSize === size ? '#1e3a5f' : '#1e293b',
                color: settings.fontSize === size ? '#60a5fa' : '#64748b',
                transition: 'all 0.15s',
              }}
            >
              {size.toUpperCase()}
            </button>
          ))}
        </div>
        <div style={{
          fontFamily: 'monospace', fontSize: 9, color: '#475569',
          marginTop: 4, textAlign: 'center',
        }}>
          Preview: {FONT_SIZES[settings.fontSize]}px
        </div>
      </div>

      {/* Max Events */}
      <div style={sectionStyle}>
        <span style={labelStyle}>Max Events in Buffer</span>
        <div style={{ display: 'flex', gap: 4 }}>
          {[100, 300, 500, 1000].map(n => (
            <button
              key={n}
              onClick={() => onChange({ maxEvents: n })}
              style={{
                flex: 1, padding: '5px 0', borderRadius: 4, border: 'none', cursor: 'pointer',
                fontFamily: 'monospace', fontSize: 10, fontWeight: 600,
                background: settings.maxEvents === n ? '#1e3a5f' : '#1e293b',
                color: settings.maxEvents === n ? '#60a5fa' : '#64748b',
                transition: 'all 0.15s',
              }}
            >
              {n}
            </button>
          ))}
        </div>
      </div>

      {/* Toggles */}
      <div style={sectionStyle}>
        <span style={labelStyle}>Display</span>

        <div style={rowStyle}>
          <span style={descStyle}>Show timestamps</span>
          <ToggleSwitch
            checked={settings.showTimestamps}
            onChange={v => onChange({ showTimestamps: v })}
          />
        </div>

        <div style={rowStyle}>
          <span style={descStyle}>Compact mode</span>
          <ToggleSwitch
            checked={settings.compactMode}
            onChange={v => onChange({ compactMode: v })}
          />
        </div>

        <div style={rowStyle}>
          <span style={descStyle}>Word wrap in data</span>
          <ToggleSwitch
            checked={settings.wordWrap}
            onChange={v => onChange({ wordWrap: v })}
          />
        </div>
      </div>

      {/* Reset */}
      <button
        onClick={() => onChange(DEFAULT_SETTINGS)}
        style={{
          width: '100%', padding: '6px 0', borderRadius: 4, border: '1px solid #1e293b',
          cursor: 'pointer', fontFamily: 'monospace', fontSize: 10,
          background: 'transparent', color: '#64748b',
          transition: 'all 0.15s',
        }}
      >
        Reset to defaults
      </button>
    </div>
  )
}

function ToggleSwitch({ checked, onChange }: { checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <button
      onClick={() => onChange(!checked)}
      style={{
        width: 32, height: 18, borderRadius: 9, border: 'none', cursor: 'pointer',
        background: checked ? '#2563eb' : '#334155',
        position: 'relative', padding: 0, transition: 'background 0.2s',
        flexShrink: 0,
      }}
    >
      <span style={{
        position: 'absolute', top: 2, left: checked ? 16 : 2,
        width: 14, height: 14, borderRadius: '50%',
        background: '#fff', transition: 'left 0.2s',
        boxShadow: '0 1px 3px rgba(0,0,0,0.3)',
      }} />
    </button>
  )
}

// ===== Main Component =====

export interface LiveDebuggerProps {
  /** Start open. Default: false */
  defaultOpen?: boolean
  /** Initial position. Default: bottom-right corner */
  defaultPosition?: { x: number; y: number }
  /** Initial size. Default: 680x420 */
  defaultSize?: { w: number; h: number }
  /** Force enable even in production. Default: false */
  force?: boolean
}

export function LiveDebugger({
  defaultOpen = false,
  defaultPosition,
  defaultSize = { w: 680, h: 420 },
  force = false,
}: LiveDebuggerProps) {
  const [settings, setSettingsState] = useState<DebuggerSettings>(loadSettings)
  const updateSettings = useCallback((patch: Partial<DebuggerSettings>) => {
    setSettingsState(prev => {
      const next = { ...prev, ...patch }
      saveSettings(next)
      return next
    })
  }, [])
  const fs = FONT_SIZES[settings.fontSize]

  const dbg = useLiveDebugger({ maxEvents: settings.maxEvents })
  const [open, setOpen] = useState(defaultOpen)
  const [tab, setTab] = useState<'events' | 'state' | 'rooms' | 'settings'>('events')
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [expandedEvents, setExpandedEvents] = useState<Set<string>>(new Set())
  const [activeGroups, setActiveGroups] = useState<Set<EventGroup>>(new Set(ALL_GROUPS))
  const [search, setSearch] = useState('')
  const feedRef = useRef<HTMLDivElement>(null)
  const [autoScroll, setAutoScroll] = useState(true)

  // Default position: bottom-right with padding
  const initPos = defaultPosition ?? {
    x: typeof window !== 'undefined' ? window.innerWidth - defaultSize.w - 16 : 100,
    y: typeof window !== 'undefined' ? window.innerHeight - defaultSize.h - 16 : 100,
  }

  const { pos, onMouseDown } = useDrag(initPos)
  const { size, onResizeStart } = useResize(defaultSize)

  // Keyboard shortcut: Ctrl+Shift+D
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.ctrlKey && e.shiftKey && e.key === 'D') {
        e.preventDefault()
        setOpen(prev => !prev)
      }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [])

  const selectedComp = selectedId
    ? dbg.components.find(c => c.componentId === selectedId) ?? null
    : null

  // Compute allowed event types from active groups
  const allowedTypes = useMemo(() => {
    const types = new Set<DebugEventType>()
    for (const g of activeGroups) {
      for (const t of EVENT_GROUPS[g].types) types.add(t)
    }
    return types
  }, [activeGroups])

  // Filter events
  const visibleEvents = useMemo(() => {
    return dbg.events.filter(e => {
      if (!allowedTypes.has(e.type)) return false
      if (selectedId && e.componentId !== selectedId) return false
      if (search) {
        const s = search.toLowerCase()
        const inData = JSON.stringify(e.data).toLowerCase().includes(s)
        const inName = e.componentName?.toLowerCase().includes(s)
        const inType = e.type.toLowerCase().includes(s)
        if (!inData && !inName && !inType) return false
      }
      return true
    })
  }, [dbg.events, allowedTypes, selectedId, search])

  // Count events per group (unfiltered by group, but filtered by component)
  const groupCounts = useMemo(() => {
    const counts = {} as Record<EventGroup, number>
    for (const g of ALL_GROUPS) counts[g] = 0
    const baseEvents = selectedId
      ? dbg.events.filter(e => e.componentId === selectedId)
      : dbg.events
    for (const e of baseEvents) {
      for (const g of ALL_GROUPS) {
        if (EVENT_GROUPS[g].types.includes(e.type)) {
          counts[g]++
          break
        }
      }
    }
    return counts
  }, [dbg.events, selectedId])

  // Build rooms map: roomId -> list of components in that room
  const roomsMap = useMemo(() => {
    const map = new Map<string, ComponentSnapshot[]>()
    for (const comp of dbg.components) {
      for (const roomId of comp.rooms) {
        if (!map.has(roomId)) map.set(roomId, [])
        map.get(roomId)!.push(comp)
      }
    }
    return map
  }, [dbg.components])

  // Room events (filtered to room-related types)
  const roomEvents = useMemo(() => {
    return dbg.events.filter(e =>
      e.type === 'ROOM_JOIN' || e.type === 'ROOM_LEAVE' ||
      e.type === 'ROOM_EMIT' || e.type === 'ROOM_EVENT_RECEIVED'
    ).slice(-50)
  }, [dbg.events])

  // Auto-scroll feed
  useEffect(() => {
    if (feedRef.current && autoScroll && !dbg.paused) {
      feedRef.current.scrollTop = feedRef.current.scrollHeight
    }
  }, [visibleEvents.length, dbg.paused, autoScroll])

  // Detect manual scroll to disable auto-scroll
  const handleFeedScroll = useCallback(() => {
    if (!feedRef.current) return
    const { scrollTop, scrollHeight, clientHeight } = feedRef.current
    const atBottom = scrollHeight - scrollTop - clientHeight < 30
    setAutoScroll(atBottom)
  }, [])

  const toggleEvent = useCallback((id: string) => {
    setExpandedEvents(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }, [])

  const toggleGroup = useCallback((g: EventGroup) => {
    setActiveGroups(prev => {
      const next = new Set(prev)
      if (next.has(g)) next.delete(g)
      else next.add(g)
      return next
    })
  }, [])

  // Server has debugging disabled — render nothing, no resources used
  if (dbg.serverDisabled && !force) return null

  // Badge (when closed) - small floating circle in bottom-right
  if (!open) {
    const hasErrors = dbg.events.some(e => e.type === 'ERROR' || e.type === 'ACTION_ERROR')
    return (
      <button
        onClick={() => setOpen(true)}
        title="Live Debugger (Ctrl+Shift+D)"
        style={{
          position: 'fixed',
          bottom: 16,
          right: 16,
          zIndex: 99999,
          width: 40,
          height: 40,
          borderRadius: '50%',
          border: `2px solid ${dbg.connected ? '#22c55e50' : '#ef444450'}`,
          background: '#020617e0',
          color: dbg.connected ? '#22c55e' : '#ef4444',
          cursor: 'pointer',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontSize: 16,
          boxShadow: '0 2px 12px rgba(0,0,0,0.4)',
          transition: 'all 0.2s',
          fontFamily: 'monospace',
          padding: 0,
        }}
      >
        {hasErrors ? (
          <span style={{ color: '#ef4444', fontSize: 14, fontWeight: 700 }}>!</span>
        ) : (
          <span style={{ fontSize: 14 }}>{dbg.componentCount}</span>
        )}
      </button>
    )
  }

  // Floating window
  return (
    <div
      style={{
        position: 'fixed',
        left: pos.x,
        top: pos.y,
        width: size.w,
        height: size.h,
        zIndex: 99999,
        display: 'flex',
        flexDirection: 'column',
        background: '#020617',
        border: '1px solid #1e293b',
        borderRadius: 8,
        boxShadow: '0 8px 32px rgba(0,0,0,0.6)',
        fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
        color: '#e2e8f0',
        overflow: 'hidden',
      }}
    >
      {/* Title bar - draggable */}
      <div
        onMouseDown={onMouseDown}
        style={{
          display: 'flex', alignItems: 'center', gap: 8,
          padding: '5px 10px', borderBottom: '1px solid #1e293b',
          flexShrink: 0, cursor: 'grab', userSelect: 'none',
          background: '#0f172a',
        }}
      >
        {/* Status dot */}
        <span style={{
          width: 7, height: 7, borderRadius: '50%', flexShrink: 0,
          background: dbg.connected ? '#22c55e' : '#ef4444',
        }} />

        <span style={{
          fontFamily: 'monospace', fontSize: 11, fontWeight: 700,
          letterSpacing: 0.5, color: '#94a3b8',
        }}>
          LIVE DEBUGGER
        </span>

        {/* Tabs */}
        <div style={{ display: 'flex', gap: 1, marginLeft: 4 }}>
          {(['events', 'state', 'rooms', 'settings'] as const).map(t => (
            <button
              key={t}
              onClick={() => setTab(t)}
              style={{
                padding: '2px 8px', borderRadius: 3, border: 'none', cursor: 'pointer',
                fontFamily: 'monospace', fontSize: 10, textTransform: 'uppercase',
                background: tab === t ? '#1e293b' : 'transparent',
                color: tab === t
                  ? (t === 'settings' ? '#f59e0b' : '#e2e8f0')
                  : '#475569',
              }}
            >
              {t === 'settings' ? '\u2699' : t}
            </button>
          ))}
        </div>

        <div style={{ flex: 1 }} />

        {/* Controls */}
        <button
          onClick={dbg.togglePause}
          title={dbg.paused ? 'Resume' : 'Pause'}
          style={{
            padding: '2px 6px', borderRadius: 3, border: 'none', cursor: 'pointer',
            fontFamily: 'monospace', fontSize: 10,
            background: dbg.paused ? '#7c2d12' : '#1e293b',
            color: dbg.paused ? '#fdba74' : '#94a3b8',
          }}
        >
          {dbg.paused ? '\u25B6' : '\u23F8'}
        </button>
        <button
          onClick={dbg.clearEvents}
          title="Clear events"
          style={{
            padding: '2px 6px', borderRadius: 3, border: 'none', cursor: 'pointer',
            fontFamily: 'monospace', fontSize: 10,
            background: '#1e293b', color: '#94a3b8',
          }}
        >
          Clear
        </button>
        <span style={{ fontFamily: 'monospace', fontSize: 9, color: '#475569' }}>
          {dbg.componentCount}C {visibleEvents.length}/{dbg.eventCount}E
        </span>
        <button
          onClick={() => setOpen(false)}
          title="Close (Ctrl+Shift+D)"
          style={{
            width: 18, height: 18, borderRadius: 3, border: 'none', cursor: 'pointer',
            fontFamily: 'monospace', fontSize: 12, lineHeight: '18px',
            background: 'transparent', color: '#64748b',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            padding: 0,
          }}
        >
          &#x2715;
        </button>
      </div>

      {/* Body */}
      <div style={{ display: 'flex', flex: 1, overflow: 'hidden', minHeight: 0 }}>
        {/* Component sidebar */}
        <div style={{
          width: 160, borderRight: '1px solid #1e293b',
          overflow: 'auto', flexShrink: 0, padding: '3px',
        }}>
          <button
            onClick={() => setSelectedId(null)}
            style={{
              width: '100%', textAlign: 'left', cursor: 'pointer',
              padding: '5px 8px', borderRadius: 4, border: 'none',
              background: selectedId === null ? '#1e293b' : 'transparent',
              color: '#94a3b8', fontFamily: 'monospace', fontSize: 10,
            }}
          >
            All ({dbg.componentCount})
          </button>

          {dbg.components.map(comp => (
            <ComponentCard
              key={comp.componentId}
              comp={comp}
              isSelected={selectedId === comp.componentId}
              onSelect={() => {
                setSelectedId(selectedId === comp.componentId ? null : comp.componentId)
              }}
            />
          ))}

          {dbg.components.length === 0 && (
            <div style={{
              padding: 10, textAlign: 'center', color: '#475569',
              fontFamily: 'monospace', fontSize: 10,
            }}>
              No components
            </div>
          )}
        </div>

        {/* Main content */}
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', minWidth: 0 }}>
          {/* === Events Tab === */}
          {tab === 'events' && (
            <>
              <FilterBar
                activeGroups={activeGroups}
                toggleGroup={toggleGroup}
                search={search}
                setSearch={setSearch}
                groupCounts={groupCounts}
              />
              <div
                ref={feedRef}
                onScroll={handleFeedScroll}
                style={{ flex: 1, overflow: 'auto' }}
              >
                {visibleEvents.length === 0 ? (
                  <div style={{
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    height: '100%', color: '#475569', fontFamily: 'monospace', fontSize: 11,
                  }}>
                    {dbg.connected
                      ? dbg.paused ? 'Paused' : 'Waiting for events...'
                      : 'Connecting...'}
                  </div>
                ) : (
                  visibleEvents.map(event => {
                    const color = COLORS[event.type] || '#6b7280'
                    const label = LABELS[event.type] || event.type
                    const summary = eventSummary(event)
                    const isExpanded = expandedEvents.has(event.id)
                    const time = new Date(event.timestamp)
                    const ts = `${time.toLocaleTimeString('en-US', { hour12: false })}.${String(time.getMilliseconds()).padStart(3, '0')}`
                    const py = settings.compactMode ? 1 : 3

                    return (
                      <div
                        key={event.id}
                        style={{ borderBottom: '1px solid #0f172a', cursor: 'pointer' }}
                        onClick={() => toggleEvent(event.id)}
                      >
                        <div style={{
                          display: 'flex', alignItems: 'center', gap: 5,
                          padding: `${py}px 8px`, fontSize: fs, fontFamily: 'monospace',
                          background: isExpanded ? '#0f172a' : 'transparent',
                        }}>
                          {settings.showTimestamps && (
                            <span style={{ color: '#4b5563', fontSize: fs - 1, flexShrink: 0 }}>{ts}</span>
                          )}
                          <span style={{
                            display: 'inline-block', padding: '0 4px', borderRadius: 2,
                            fontSize: Math.max(8, fs - 2), fontWeight: 700, color: '#fff',
                            background: color, flexShrink: 0, lineHeight: `${fs + 4}px`,
                          }}>
                            {label}
                          </span>
                          {!selectedId && event.componentName && (() => {
                            const comp = dbg.components.find(c => c.componentId === event.componentId)
                            const name = comp?.debugLabel || event.componentName
                            return (
                              <span style={{ color: '#64748b', flexShrink: 0, fontSize: fs - 1 }}>
                                {name}
                              </span>
                            )
                          })()}
                          <span style={{
                            color: '#94a3b8', fontSize: fs - 1, overflow: 'hidden',
                            textOverflow: 'ellipsis',
                            whiteSpace: settings.wordWrap ? 'normal' : 'nowrap',
                            flex: 1,
                          }}>
                            {summary}
                          </span>
                        </div>
                        {isExpanded && (
                          <div
                            onClick={e => e.stopPropagation()}
                            style={{
                              padding: '3px 8px 6px 42px', fontSize: fs - 1,
                              fontFamily: 'monospace', color: '#cbd5e1',
                              background: '#0f172a',
                              wordBreak: settings.wordWrap ? 'break-all' : undefined,
                            }}>
                            <Json data={event.data} />
                          </div>
                        )}
                      </div>
                    )
                  })
                )}
                {!autoScroll && visibleEvents.length > 0 && (
                  <button
                    onClick={() => {
                      setAutoScroll(true)
                      if (feedRef.current) feedRef.current.scrollTop = feedRef.current.scrollHeight
                    }}
                    style={{
                      position: 'sticky', bottom: 4, left: '50%',
                      transform: 'translateX(-50%)',
                      padding: '3px 10px', borderRadius: 10,
                      border: '1px solid #1e293b',
                      background: '#0f172ae0', color: '#94a3b8',
                      fontFamily: 'monospace', fontSize: 9, cursor: 'pointer',
                    }}
                  >
                    &#8595; Scroll to bottom
                  </button>
                )}
              </div>
            </>
          )}

          {/* === State Tab === */}
          {tab === 'state' && (
            <div style={{ flex: 1, overflow: 'auto', padding: 10 }}>
              {selectedComp ? (
                <div>
                  <div style={{
                    fontFamily: 'monospace', fontSize: 12, fontWeight: 700,
                    marginBottom: 2, color: '#f1f5f9',
                  }}>
                    {displayName(selectedComp)}
                  </div>
                  {selectedComp.debugLabel && (
                    <div style={{
                      fontFamily: 'monospace', fontSize: 9, color: '#64748b',
                      marginBottom: 6,
                    }}>
                      {selectedComp.componentName}
                    </div>
                  )}

                  <div style={{
                    display: 'flex', gap: 4, marginBottom: 10, flexWrap: 'wrap',
                    fontFamily: 'monospace', fontSize: 9,
                  }}>
                    {[
                      { label: 'state', value: selectedComp.stateChangeCount, color: '#3b82f6' },
                      { label: 'actions', value: selectedComp.actionCount, color: '#8b5cf6' },
                      { label: 'errors', value: selectedComp.errorCount, color: selectedComp.errorCount > 0 ? '#ef4444' : '#22c55e' },
                    ].map(s => (
                      <span key={s.label} style={{
                        padding: '2px 6px', borderRadius: 3, background: '#1e293b',
                      }}>
                        <span style={{ color: s.color }}>{s.value}</span>
                        <span style={{ color: '#64748b' }}> {s.label}</span>
                      </span>
                    ))}
                    {selectedComp.rooms.length > 0 && (
                      <span style={{
                        padding: '2px 6px', borderRadius: 3, background: '#1e293b', color: '#64748b',
                      }}>
                        rooms: {selectedComp.rooms.join(', ')}
                      </span>
                    )}
                  </div>

                  <div style={{
                    fontFamily: 'monospace', fontSize: 9, color: '#475569', marginBottom: 8,
                  }}>
                    {selectedComp.componentId}
                  </div>

                  <div style={{
                    fontFamily: 'monospace', fontSize: 9, color: '#64748b',
                    textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 4,
                  }}>
                    Current State
                  </div>
                  <div style={{
                    padding: 8, background: '#0f172a', borderRadius: 4,
                    fontFamily: 'monospace', fontSize: fs, color: '#e2e8f0',
                    overflow: 'auto',
                    wordBreak: settings.wordWrap ? 'break-all' : undefined,
                  }}>
                    <Json data={selectedComp.state} />
                  </div>
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  {dbg.components.length === 0 ? (
                    <div style={{
                      textAlign: 'center', color: '#475569',
                      fontFamily: 'monospace', fontSize: 11, padding: 20,
                    }}>
                      No active components
                    </div>
                  ) : (
                    dbg.components.map(comp => (
                      <div key={comp.componentId} style={{
                        padding: 8, background: '#0f172a', borderRadius: 4,
                      }}>
                        <div style={{
                          display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4,
                        }}>
                          <span style={{
                            fontFamily: 'monospace', fontSize: 11, fontWeight: 700, color: '#f1f5f9',
                          }}>
                            {displayName(comp)}
                          </span>
                          <span style={{ fontFamily: 'monospace', fontSize: 9, color: '#475569' }}>
                            S:{comp.stateChangeCount} A:{comp.actionCount}
                            {comp.errorCount > 0 && <span style={{ color: '#f87171' }}> E:{comp.errorCount}</span>}
                          </span>
                        </div>
                        <div style={{ fontFamily: 'monospace', fontSize: fs, color: '#e2e8f0' }}>
                          <Json data={comp.state} />
                        </div>
                      </div>
                    ))
                  )}
                </div>
              )}
            </div>
          )}

          {/* === Rooms Tab === */}
          {tab === 'rooms' && (
            <div style={{ flex: 1, overflow: 'auto', padding: 10, display: 'flex', flexDirection: 'column', gap: 8 }}>
              {roomsMap.size === 0 ? (
                <div style={{
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  height: '100%', color: '#475569', fontFamily: 'monospace', fontSize: 11,
                }}>
                  No active rooms
                </div>
              ) : (
                <>
                  {/* Room cards */}
                  {Array.from(roomsMap.entries()).map(([roomId, members]) => (
                    <div key={roomId} style={{
                      padding: 10, background: '#0f172a', borderRadius: 6,
                      border: '1px solid #1e293b',
                    }}>
                      {/* Room header */}
                      <div style={{
                        display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8,
                      }}>
                        <span style={{
                          width: 8, height: 8, borderRadius: '50%',
                          background: '#10b981', flexShrink: 0,
                        }} />
                        <span style={{
                          fontFamily: 'monospace', fontSize: 12, fontWeight: 700, color: '#f1f5f9',
                        }}>
                          {roomId}
                        </span>
                        <span style={{
                          fontFamily: 'monospace', fontSize: 9, color: '#64748b',
                          padding: '1px 6px', borderRadius: 3, background: '#1e293b',
                        }}>
                          {members.length} {members.length === 1 ? 'member' : 'members'}
                        </span>
                      </div>

                      {/* Members list */}
                      <div style={{
                        display: 'flex', flexDirection: 'column', gap: 4,
                        paddingLeft: 16,
                      }}>
                        {members.map(comp => (
                          <div key={comp.componentId} style={{
                            display: 'flex', alignItems: 'center', gap: 6,
                            fontFamily: 'monospace', fontSize: 10,
                          }}>
                            <span style={{ color: '#22c55e', fontSize: 5 }}>&#9679;</span>
                            <span style={{ color: '#e2e8f0' }}>{displayName(comp)}</span>
                            {comp.debugLabel && (
                              <span style={{ color: '#475569', fontSize: 9 }}>({comp.componentName})</span>
                            )}
                            <span style={{ color: '#475569', fontSize: 9 }}>
                              S:{comp.stateChangeCount} A:{comp.actionCount}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}

                  {/* Recent room events */}
                  {roomEvents.length > 0 && (
                    <div style={{ marginTop: 4 }}>
                      <div style={{
                        fontFamily: 'monospace', fontSize: 9, color: '#64748b',
                        textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 6,
                      }}>
                        Recent Room Activity
                      </div>
                      <div style={{
                        background: '#0f172a', borderRadius: 4, border: '1px solid #1e293b',
                        overflow: 'auto', maxHeight: 160,
                      }}>
                        {roomEvents.map(event => {
                          const color = COLORS[event.type] || '#6b7280'
                          const label = LABELS[event.type] || event.type
                          const summary = eventSummary(event)
                          const time = new Date(event.timestamp)
                          const ts = `${time.toLocaleTimeString('en-US', { hour12: false })}.${String(time.getMilliseconds()).padStart(3, '0')}`
                          const comp = dbg.components.find(c => c.componentId === event.componentId)
                          const name = comp?.debugLabel || event.componentName

                          return (
                            <div key={event.id} style={{
                              display: 'flex', alignItems: 'center', gap: 5,
                              padding: '2px 8px', fontSize: 10, fontFamily: 'monospace',
                              borderBottom: '1px solid #020617',
                            }}>
                              <span style={{ color: '#4b5563', fontSize: 9, flexShrink: 0 }}>{ts}</span>
                              <span style={{
                                display: 'inline-block', padding: '0 4px', borderRadius: 2,
                                fontSize: 8, fontWeight: 700, color: '#fff',
                                background: color, flexShrink: 0, lineHeight: '14px',
                              }}>
                                {label}
                              </span>
                              {name && <span style={{ color: '#64748b', fontSize: 9 }}>{name}</span>}
                              <span style={{
                                color: '#94a3b8', fontSize: 9, overflow: 'hidden',
                                textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1,
                              }}>
                                {summary}
                              </span>
                            </div>
                          )
                        })}
                      </div>
                    </div>
                  )}
                </>
              )}
            </div>
          )}

          {/* === Settings Tab === */}
          {tab === 'settings' && (
            <SettingsPanel settings={settings} onChange={updateSettings} />
          )}
        </div>
      </div>

      {/* Resize handle - bottom-right corner */}
      <div
        onMouseDown={onResizeStart}
        style={{
          position: 'absolute', bottom: 0, right: 0,
          width: 14, height: 14, cursor: 'nwse-resize',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}
      >
        <svg width="8" height="8" viewBox="0 0 8 8" style={{ opacity: 0.3 }}>
          <line x1="7" y1="1" x2="1" y2="7" stroke="#94a3b8" strokeWidth="1" />
          <line x1="7" y1="4" x2="4" y2="7" stroke="#94a3b8" strokeWidth="1" />
        </svg>
      </div>
    </div>
  )
}
