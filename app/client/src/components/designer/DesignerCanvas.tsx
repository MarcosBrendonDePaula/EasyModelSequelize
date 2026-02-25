import { useState, useRef, useCallback, useMemo, useEffect } from 'react'
import type { SchemaModel, SchemaAssociation, AssociationType } from '@shared/types/schema'
import { nameToColor } from '@shared/types/schema'
import { ModelCard } from './ModelCard'
import { ModelEditorModal } from './ModelEditorModal'
import { DRAG_TYPE_TABLE, DRAG_TYPE_FIELD } from './Toolbox'

interface RemoteCursor {
  x: number
  y: number
  color: string
  name: string
  lastSeen: number
}

interface Props {
  designer: any
}

const CARD_WIDTH = 224
const CARD_MIN_HEIGHT = 60

// Calculate best edge anchor points between two rects
function getEdgeAnchors(
  src: { x: number; y: number; w: number; h: number },
  tgt: { x: number; y: number; w: number; h: number }
) {
  const srcCx = src.x + src.w / 2
  const srcCy = src.y + src.h / 2
  const tgtCx = tgt.x + tgt.w / 2
  const tgtCy = tgt.y + tgt.h / 2

  const dx = tgtCx - srcCx
  const dy = tgtCy - srcCy

  let x1: number, y1: number, x2: number, y2: number
  let srcSide: 'left' | 'right' | 'top' | 'bottom'
  let tgtSide: 'left' | 'right' | 'top' | 'bottom'

  // Source anchor
  if (Math.abs(dx) > Math.abs(dy)) {
    if (dx > 0) { x1 = src.x + src.w; y1 = srcCy; srcSide = 'right' }
    else { x1 = src.x; y1 = srcCy; srcSide = 'left' }
  } else {
    if (dy > 0) { x1 = srcCx; y1 = src.y + src.h; srcSide = 'bottom' }
    else { x1 = srcCx; y1 = src.y; srcSide = 'top' }
  }

  // Target anchor
  if (Math.abs(dx) > Math.abs(dy)) {
    if (dx > 0) { x2 = tgt.x; y2 = tgtCy; tgtSide = 'left' }
    else { x2 = tgt.x + tgt.w; y2 = tgtCy; tgtSide = 'right' }
  } else {
    if (dy > 0) { x2 = tgtCx; y2 = tgt.y; tgtSide = 'top' }
    else { x2 = tgtCx; y2 = tgt.y + tgt.h; tgtSide = 'bottom' }
  }

  return { x1, y1, x2, y2, srcSide, tgtSide }
}

// Build cubic bezier path
function buildBezierPath(x1: number, y1: number, x2: number, y2: number, srcSide: string, tgtSide: string): string {
  const dist = Math.max(40, Math.hypot(x2 - x1, y2 - y1) * 0.4)
  let cx1 = x1, cy1 = y1, cx2 = x2, cy2 = y2

  if (srcSide === 'right') cx1 = x1 + dist
  else if (srcSide === 'left') cx1 = x1 - dist
  else if (srcSide === 'bottom') cy1 = y1 + dist
  else cy1 = y1 - dist

  if (tgtSide === 'left') cx2 = x2 - dist
  else if (tgtSide === 'right') cx2 = x2 + dist
  else if (tgtSide === 'top') cy2 = y2 - dist
  else cy2 = y2 + dist

  return `M${x1},${y1} C${cx1},${cy1} ${cx2},${cy2} ${x2},${y2}`
}

// ER cardinality labels
function getCardinalityLabels(type: string): [string, string] {
  switch (type) {
    case '1:1': return ['1', '1']
    case '1:M': return ['1', '*']
    case 'M:N': return ['*', '*']
    default: return ['', '']
  }
}

function getCardHeight(model: SchemaModel): number {
  const fieldsH = Math.min(model.fields.length, 8) * 22 + (model.fields.length > 8 ? 18 : 0)
  const assocsH = model.associations.length > 0 ? model.associations.length * 22 + 8 : 0
  return Math.max(CARD_MIN_HEIGHT, 36 + fieldsH + assocsH)
}

// Type picker state
interface TypePickerState {
  sourceModelId: string
  targetModelId: string
  screenX: number  // screen coordinates for popup
  screenY: number
}

export function DesignerCanvas({ designer }: Props) {
  const models: SchemaModel[] = designer.$state.models
  const activeModelId: string | null = designer.$state.activeModelId

  // Pan/zoom state (local only)
  const [offset, setOffset] = useState({ x: 0, y: 0 })
  const [zoom, setZoom] = useState(1)
  const isPanning = useRef(false)
  const panStart = useRef({ x: 0, y: 0 })
  const offsetStart = useRef({ x: 0, y: 0 })
  const containerRef = useRef<HTMLDivElement>(null)

  // Linking state: sourceModelId in state (rare changes), cursor in ref (every frame)
  const [linkingSourceId, setLinkingSourceId] = useState<string | null>(null)
  const [linkTarget, setLinkTarget] = useState<string | null>(null)
  const [typePicker, setTypePicker] = useState<TypePickerState | null>(null)
  const [editorModelId, setEditorModelId] = useState<string | null>(null)
  const linkCursorRef = useRef({ x: 0, y: 0 })
  const linkPreviewRef = useRef<SVGPathElement>(null)
  // Keep offset/zoom in refs so pointermove can read fresh values without re-creating callbacks
  const offsetRef = useRef(offset)
  const zoomRef = useRef(zoom)
  offsetRef.current = offset
  zoomRef.current = zoom
  // Ref to latest models so the DOM-updater can read them without stale closures
  const modelsRef = useRef(models)
  modelsRef.current = models

  // === Remote cursor sync ===
  const [remoteCursors, setRemoteCursors] = useState<Map<string, RemoteCursor>>(new Map())
  const cursorThrottleRef = useRef(0)

  // Register broadcast handler for cursor events
  useEffect(() => {
    designer.$onBroadcast((event: { type: string; data: any }) => {
      if (event.type === 'cursor:move') {
        const { userId, x, y, color, name } = event.data
        setRemoteCursors(prev => {
          const next = new Map(prev)
          next.set(userId, { x, y, color, name, lastSeen: Date.now() })
          return next
        })
      } else if (event.type === 'cursor:leave') {
        const { userId } = event.data
        setRemoteCursors(prev => {
          const next = new Map(prev)
          next.delete(userId)
          return next
        })
      }
    })
  }, [designer])

  // Clean up stale cursors (no activity for 10s)
  useEffect(() => {
    const interval = setInterval(() => {
      setRemoteCursors(prev => {
        const now = Date.now()
        let changed = false
        const next = new Map(prev)
        for (const [uid, cursor] of next) {
          if (now - cursor.lastSeen > 10000) {
            next.delete(uid)
            changed = true
          }
        }
        return changed ? next : prev
      })
    }, 5000)
    return () => clearInterval(interval)
  }, [])

  // Send local cursor position (throttled ~80ms)
  const sendCursorUpdate = useCallback((canvasX: number, canvasY: number) => {
    const now = Date.now()
    if (now - cursorThrottleRef.current < 80) return
    cursorThrottleRef.current = now
    designer.updateCursor({ x: Math.round(canvasX), y: Math.round(canvasY) })
  }, [designer])

  // Direct DOM update for the link preview path (no React re-render)
  const updateLinkPreviewDOM = useCallback(() => {
    const path = linkPreviewRef.current
    if (!path || !linkingSourceId) { path?.setAttribute('d', ''); return }

    const currentModels = modelsRef.current
    const src = currentModels.find(m => m.id === linkingSourceId)
    if (!src) return
    const srcPos = src.position || { x: 0, y: 0 }
    const srcH = getCardHeight(src)

    const tgt = linkTarget ? currentModels.find(m => m.id === linkTarget) : null

    if (tgt && tgt.id !== src.id) {
      const tgtPos = tgt.position || { x: 0, y: 0 }
      const tgtH = getCardHeight(tgt)
      const { x1, y1, x2, y2, srcSide, tgtSide } = getEdgeAnchors(
        { x: srcPos.x, y: srcPos.y, w: CARD_WIDTH, h: srcH },
        { x: tgtPos.x, y: tgtPos.y, w: CARD_WIDTH, h: tgtH }
      )
      path.setAttribute('d', buildBezierPath(x1, y1, x2, y2, srcSide, tgtSide))
      path.setAttribute('stroke', '#34d399')
    } else {
      const cx = linkCursorRef.current.x
      const cy = linkCursorRef.current.y
      const cursorRect = { x: cx - 1, y: cy - 1, w: 2, h: 2 }
      const { x1, y1, srcSide } = getEdgeAnchors(
        { x: srcPos.x, y: srcPos.y, w: CARD_WIDTH, h: srcH },
        cursorRect
      )
      const dist = Math.max(30, Math.hypot(cx - x1, cy - y1) * 0.3)
      let cx1 = x1, cy1 = y1
      if (srcSide === 'right') cx1 = x1 + dist
      else if (srcSide === 'left') cx1 = x1 - dist
      else if (srcSide === 'bottom') cy1 = y1 + dist
      else cy1 = y1 - dist
      path.setAttribute('d', `M${x1},${y1} C${cx1},${cy1} ${cx},${cy} ${cx},${cy}`)
      path.setAttribute('stroke', '#fbbf24')
    }
  }, [linkingSourceId, linkTarget])

  // Re-draw preview when linkTarget changes (enter/leave a card)
  useEffect(() => {
    updateLinkPreviewDOM()
  }, [linkTarget, updateLinkPreviewDOM])

  // Pan handlers
  const handleCanvasPointerDown = useCallback((e: React.PointerEvent) => {
    // Close type picker on canvas click
    if (typePicker) {
      setTypePicker(null)
      return
    }
    // Pan on middle button or when clicking empty canvas
    if (e.button === 1 || (e.button === 0 && e.target === e.currentTarget)) {
      if (e.button === 1) e.preventDefault()
      if (e.target !== e.currentTarget && e.button !== 1) return
      isPanning.current = true
      panStart.current = { x: e.clientX, y: e.clientY }
      offsetStart.current = { ...offset }
      ;(e.currentTarget as HTMLElement).setPointerCapture(e.pointerId)
    }
  }, [offset, typePicker])

  const handleCanvasPointerMove = useCallback((e: React.PointerEvent) => {
    // Always send cursor position to other users (throttled)
    const rect = containerRef.current?.getBoundingClientRect()
    if (rect) {
      const cx = (e.clientX - rect.left - offsetRef.current.x) / zoomRef.current
      const cy = (e.clientY - rect.top - offsetRef.current.y) / zoomRef.current
      sendCursorUpdate(cx, cy)
    }

    // Update linking cursor position via ref + direct DOM (no re-render)
    if (linkingSourceId) {
      if (rect) {
        linkCursorRef.current = {
          x: (e.clientX - rect.left - offsetRef.current.x) / zoomRef.current,
          y: (e.clientY - rect.top - offsetRef.current.y) / zoomRef.current
        }
        updateLinkPreviewDOM()
      }
      return
    }
    if (!isPanning.current) return
    const dx = e.clientX - panStart.current.x
    const dy = e.clientY - panStart.current.y
    setOffset({ x: offsetStart.current.x + dx, y: offsetStart.current.y + dy })
  }, [linkingSourceId, updateLinkPreviewDOM, sendCursorUpdate])

  const handleCanvasPointerUp = useCallback((e: React.PointerEvent) => {
    // If linking and released on empty canvas, cancel
    if (linkingSourceId) {
      setLinkingSourceId(null)
      setLinkTarget(null)
      return
    }
    isPanning.current = false
  }, [linkingSourceId])

  // Zoom handler
  const handleWheel = useCallback((e: React.WheelEvent) => {
    e.preventDefault()
    const rect = containerRef.current?.getBoundingClientRect()
    if (!rect) return

    const mouseX = e.clientX - rect.left
    const mouseY = e.clientY - rect.top

    const factor = e.deltaY > 0 ? 0.9 : 1.1
    const newZoom = Math.max(0.2, Math.min(3, zoom * factor))

    // Zoom toward cursor
    const scale = newZoom / zoom
    const newOffsetX = mouseX - (mouseX - offset.x) * scale
    const newOffsetY = mouseY - (mouseY - offset.y) * scale

    setZoom(newZoom)
    setOffset({ x: newOffsetX, y: newOffsetY })
  }, [zoom, offset])

  // Double-click to create model
  const handleDoubleClick = useCallback((e: React.MouseEvent) => {
    if (e.target !== e.currentTarget) return
    if (typePicker) return
    const rect = containerRef.current?.getBoundingClientRect()
    if (!rect) return
    const x = (e.clientX - rect.left - offset.x) / zoom
    const y = (e.clientY - rect.top - offset.y) / zoom
    designer.addModel({ name: `Model${models.length + 1}` }).then((result: any) => {
      if (result?.modelId) {
        designer.updateModelPosition({ modelId: result.modelId, x: Math.round(x), y: Math.round(y) })
      }
    })
  }, [offset, zoom, models.length, designer, typePicker])

  // Drag-and-drop: accept table from toolbox
  const handleDragOver = useCallback((e: React.DragEvent) => {
    if (e.dataTransfer.types.includes(DRAG_TYPE_TABLE) || e.dataTransfer.types.includes(DRAG_TYPE_FIELD)) {
      e.preventDefault()
      e.dataTransfer.dropEffect = 'copy'
    }
  }, [])

  const handleDrop = useCallback((e: React.DragEvent) => {
    const tableData = e.dataTransfer.getData(DRAG_TYPE_TABLE)
    if (tableData) {
      e.preventDefault()
      const rect = containerRef.current?.getBoundingClientRect()
      if (!rect) return
      const x = (e.clientX - rect.left - offset.x) / zoom
      const y = (e.clientY - rect.top - offset.y) / zoom

      const existing = models.map(m => m.name)
      let i = models.length + 1
      let name = `Model${i}`
      while (existing.includes(name)) { i++; name = `Model${i}` }

      designer.addModel({ name }).then((result: any) => {
        if (result?.modelId) {
          designer.updateModelPosition({ modelId: result.modelId, x: Math.round(x), y: Math.round(y) })
        }
      })
    }
  }, [offset, zoom, models, designer])

  // === Linking callbacks (passed to ModelCard) ===

  const handleLinkStart = useCallback((modelId: string, clientX: number, clientY: number) => {
    const rect = containerRef.current?.getBoundingClientRect()
    if (rect) {
      linkCursorRef.current = {
        x: (clientX - rect.left - offsetRef.current.x) / zoomRef.current,
        y: (clientY - rect.top - offsetRef.current.y) / zoomRef.current
      }
    }
    setLinkingSourceId(modelId)
  }, [])

  const handleLinkHover = useCallback((modelId: string | null) => {
    setLinkTarget(modelId)
  }, [])

  const handleLinkEnd = useCallback((targetModelId: string, clientX: number, clientY: number) => {
    if (!linkingSourceId) return
    if (linkingSourceId === targetModelId) {
      setLinkingSourceId(null)
      setLinkTarget(null)
      return
    }
    // Show type picker popup at drop position
    setTypePicker({
      sourceModelId: linkingSourceId,
      targetModelId,
      screenX: clientX,
      screenY: clientY
    })
    setLinkingSourceId(null)
    setLinkTarget(null)
  }, [linkingSourceId])

  const handleTypeSelect = useCallback((type: AssociationType) => {
    if (!typePicker) return
    designer.addAssociation({
      modelId: typePicker.sourceModelId,
      type,
      targetModelId: typePicker.targetModelId
    })
    setTypePicker(null)
  }, [typePicker, designer])

  const handleOpenEditor = useCallback((modelId: string) => {
    setEditorModelId(modelId)
  }, [])

  const handleManyToManyWithTable = useCallback(() => {
    if (!typePicker) return
    designer.createManyToMany({
      sourceModelId: typePicker.sourceModelId,
      targetModelId: typePicker.targetModelId
    })
    setTypePicker(null)
  }, [typePicker, designer])

  // Toolbar actions
  const handleZoomIn = () => {
    setZoom(z => Math.min(3, z * 1.2))
  }

  const handleZoomOut = () => {
    setZoom(z => Math.max(0.2, z / 1.2))
  }

  const handleFitToView = () => {
    if (models.length === 0) return
    const rect = containerRef.current?.getBoundingClientRect()
    if (!rect) return

    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity
    for (const m of models) {
      const px = m.position?.x || 0
      const py = m.position?.y || 0
      const h = getCardHeight(m)
      if (px < minX) minX = px
      if (py < minY) minY = py
      if (px + CARD_WIDTH > maxX) maxX = px + CARD_WIDTH
      if (py + h > maxY) maxY = py + h
    }

    const contentW = maxX - minX + 100
    const contentH = maxY - minY + 100
    const newZoom = Math.min(1.5, Math.min(rect.width / contentW, rect.height / contentH))
    const cx = (minX + maxX) / 2
    const cy = (minY + maxY) / 2

    setZoom(newZoom)
    setOffset({
      x: rect.width / 2 - cx * newZoom,
      y: rect.height / 2 - cy * newZoom
    })
  }

  const handleResetZoom = () => {
    setZoom(1)
    setOffset({ x: 0, y: 0 })
  }

  // Compute association lines
  const lines = useMemo(() => {
    const result: {
      key: string
      path: string
      type: string
      srcLabel: string
      tgtLabel: string
      srcLabelX: number; srcLabelY: number
      tgtLabelX: number; tgtLabelY: number
    }[] = []

    for (const model of models) {
      const srcPos = model.position || { x: 0, y: 0 }
      const srcH = getCardHeight(model)

      for (const assoc of model.associations) {
        const target = models.find(m => m.id === assoc.targetModelId)
        if (!target) continue
        const tgtPos = target.position || { x: 0, y: 0 }
        const tgtH = getCardHeight(target)

        const { x1, y1, x2, y2, srcSide, tgtSide } = getEdgeAnchors(
          { x: srcPos.x, y: srcPos.y, w: CARD_WIDTH, h: srcH },
          { x: tgtPos.x, y: tgtPos.y, w: CARD_WIDTH, h: tgtH }
        )

        const path = buildBezierPath(x1, y1, x2, y2, srcSide, tgtSide)
        const [srcLabel, tgtLabel] = getCardinalityLabels(assoc.type)

        const labelOffsetSrc = 18
        const labelOffsetTgt = 18
        const srcLabelX = srcSide === 'right' ? x1 + labelOffsetSrc : srcSide === 'left' ? x1 - labelOffsetSrc : x1
        const srcLabelY = srcSide === 'bottom' ? y1 + labelOffsetSrc : srcSide === 'top' ? y1 - labelOffsetSrc : y1
        const tgtLabelX = tgtSide === 'right' ? x2 + labelOffsetTgt : tgtSide === 'left' ? x2 - labelOffsetTgt : x2
        const tgtLabelY = tgtSide === 'bottom' ? y2 + labelOffsetTgt : tgtSide === 'top' ? y2 - labelOffsetTgt : y2

        result.push({
          key: `${model.id}-${assoc.id}`,
          path,
          type: assoc.type,
          srcLabel,
          tgtLabel,
          srcLabelX, srcLabelY,
          tgtLabelX, tgtLabelY
        })
      }
    }
    return result
  }, [models])

  // Grid background style (scales with zoom)
  const gridSize = 24 * zoom
  const gridStyle = {
    backgroundImage: 'radial-gradient(circle, rgba(148,163,184,0.15) 1px, transparent 1px)',
    backgroundSize: `${gridSize}px ${gridSize}px`,
    backgroundPosition: `${offset.x % gridSize}px ${offset.y % gridSize}px`
  }

  // Type picker popup position relative to container
  const pickerPos = useMemo(() => {
    if (!typePicker) return null
    const rect = containerRef.current?.getBoundingClientRect()
    if (!rect) return null
    return {
      x: typePicker.screenX - rect.left,
      y: typePicker.screenY - rect.top
    }
  }, [typePicker])

  return (
    <div
      ref={containerRef}
      className={`flex-1 relative overflow-hidden bg-slate-950 ${
        linkingSourceId ? 'cursor-crosshair' : 'cursor-grab active:cursor-grabbing'
      }`}
      style={gridStyle}
      onPointerDown={handleCanvasPointerDown}
      onPointerMove={handleCanvasPointerMove}
      onPointerUp={handleCanvasPointerUp}
      onWheel={handleWheel}
      onDoubleClick={handleDoubleClick}
      onDragOver={handleDragOver}
      onDrop={handleDrop}
    >
      {/* Transformed container */}
      <div
        className="absolute origin-top-left"
        style={{ transform: `translate(${offset.x}px, ${offset.y}px) scale(${zoom})` }}
      >
        {/* SVG lines */}
        <svg className="absolute top-0 left-0 pointer-events-none overflow-visible" width="1" height="1">
          <defs>
            <marker id="arrow-one" markerWidth="8" markerHeight="6" refX="8" refY="3" orient="auto">
              <polygon points="0 0, 8 3, 0 6" fill="#818cf8" />
            </marker>
            <marker id="arrow-many" markerWidth="12" markerHeight="8" refX="12" refY="4" orient="auto">
              <polyline points="0,0 12,4 0,8" fill="none" stroke="#818cf8" strokeWidth="1.5" />
            </marker>
          </defs>

          {/* Existing association lines */}
          {lines.map((line) => (
            <g key={line.key}>
              <path
                d={line.path}
                fill="none"
                stroke="#818cf8"
                strokeWidth="2"
                strokeDasharray={line.type === 'M:N' ? '8 4' : undefined}
                markerEnd={line.type === '1:1' ? undefined : 'url(#arrow-one)'}
                opacity={0.7}
              />
              <text x={line.srcLabelX} y={line.srcLabelY} textAnchor="middle" dominantBaseline="central" fill="#c7d2fe" fontSize="13" fontWeight="bold">
                {line.srcLabel}
              </text>
              <text x={line.tgtLabelX} y={line.tgtLabelY} textAnchor="middle" dominantBaseline="central" fill="#c7d2fe" fontSize="13" fontWeight="bold">
                {line.tgtLabel}
              </text>
            </g>
          ))}

          {/* Linking preview line (updated via DOM ref, not React state) */}
          <path
            ref={linkPreviewRef}
            fill="none"
            stroke="#fbbf24"
            strokeWidth="2.5"
            strokeDasharray="6 4"
            opacity={0.9}
          />
        </svg>

        {/* Model cards */}
        {models.map((model) => (
          <ModelCard
            key={model.id}
            model={model}
            allModels={models}
            designer={designer}
            isActive={model.id === activeModelId}
            hasActiveSelection={activeModelId !== null}
            isLinking={linkingSourceId !== null}
            isLinkSource={linkingSourceId === model.id}
            isLinkTarget={linkTarget === model.id && linkingSourceId !== model.id}
            onLinkStart={handleLinkStart}
            onLinkHover={handleLinkHover}
            onLinkEnd={handleLinkEnd}
            onOpenEditor={handleOpenEditor}
          />
        ))}

        {/* Remote user cursors */}
        {Array.from(remoteCursors.entries()).map(([uid, cursor]) => (
          <div
            key={uid}
            className="absolute pointer-events-none"
            style={{
              left: cursor.x,
              top: cursor.y,
              transform: 'translate(-2px, -2px)',
              transition: 'left 80ms linear, top 80ms linear',
              zIndex: 9999
            }}
          >
            {/* Cursor arrow */}
            <svg width="16" height="20" viewBox="0 0 16 20" fill="none" style={{ filter: 'drop-shadow(0 1px 2px rgba(0,0,0,0.5))' }}>
              <path
                d="M0 0L15 10.5L8.5 11.5L5 19.5L0 0Z"
                fill={cursor.color}
                stroke="rgba(0,0,0,0.4)"
                strokeWidth="1"
              />
            </svg>
            {/* Name label */}
            <div
              className="absolute left-4 top-3 text-[10px] font-medium px-1.5 py-0.5 rounded whitespace-nowrap"
              style={{
                backgroundColor: cursor.color,
                color: '#fff',
                textShadow: '0 1px 1px rgba(0,0,0,0.3)'
              }}
            >
              {cursor.name}
            </div>
          </div>
        ))}
      </div>

      {/* Empty state */}
      {models.length === 0 && (
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
          <div className="text-center">
            <div className="text-5xl mb-3 text-slate-700/50">+</div>
            <p className="text-slate-600 text-sm">Drag a table from the toolbox</p>
            <p className="text-slate-700 text-xs mt-1">or double-click to add a model</p>
          </div>
        </div>
      )}

      {/* Association type picker popup */}
      {typePicker && pickerPos && (
        <div
          className="absolute z-50"
          style={{ left: pickerPos.x, top: pickerPos.y, transform: 'translate(-50%, -50%)' }}
          onPointerDown={(e) => e.stopPropagation()}
        >
          <div className="bg-slate-800 border border-slate-600 rounded-lg shadow-2xl p-2 flex flex-col gap-1 min-w-[140px]">
            <div className="text-[10px] text-slate-500 uppercase tracking-wider text-center mb-1 px-2">
              Relationship type
            </div>
            <button
              onClick={() => handleTypeSelect('1:1')}
              className="flex items-center gap-2 px-3 py-1.5 text-xs rounded hover:bg-indigo-500/20 text-slate-300 hover:text-white transition-colors"
            >
              <span className="font-mono text-indigo-400 w-8">1 : 1</span>
              <span>One to One</span>
            </button>
            <button
              onClick={() => handleTypeSelect('1:M')}
              className="flex items-center gap-2 px-3 py-1.5 text-xs rounded hover:bg-indigo-500/20 text-slate-300 hover:text-white transition-colors"
            >
              <span className="font-mono text-indigo-400 w-8">1 : *</span>
              <span>One to Many</span>
            </button>
            <button
              onClick={() => handleTypeSelect('M:N')}
              className="flex items-center gap-2 px-3 py-1.5 text-xs rounded hover:bg-indigo-500/20 text-slate-300 hover:text-white transition-colors"
            >
              <span className="font-mono text-indigo-400 w-8">* : *</span>
              <span>Many to Many</span>
            </button>
            <div className="border-t border-slate-700 mt-1 pt-1">
              <div className="text-[10px] text-slate-500 uppercase tracking-wider text-center mb-1 px-2">
                With junction table
              </div>
              <button
                onClick={handleManyToManyWithTable}
                className="flex items-center gap-2 px-3 py-1.5 text-xs rounded hover:bg-amber-500/20 text-slate-300 hover:text-white transition-colors w-full"
              >
                <span className="font-mono text-amber-400 w-8">* : *</span>
                <span>M:N + Table</span>
              </button>
            </div>
            <div className="border-t border-slate-700 mt-1 pt-1">
              <button
                onClick={() => setTypePicker(null)}
                className="w-full px-3 py-1 text-[10px] text-slate-500 hover:text-slate-300 transition-colors rounded hover:bg-slate-700/50"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Toolbar */}
      <div className="absolute bottom-4 right-4 flex items-center gap-1 bg-slate-800/90 backdrop-blur-sm rounded-lg border border-slate-700 p-1 shadow-lg">
        <button onClick={handleZoomOut} className="w-8 h-8 flex items-center justify-center text-slate-400 hover:text-white hover:bg-slate-700 rounded transition-colors text-lg" title="Zoom out">-</button>
        <button onClick={handleResetZoom} className="px-2 h-8 flex items-center justify-center text-xs text-slate-400 hover:text-white hover:bg-slate-700 rounded transition-colors font-mono min-w-[3rem]" title="Reset zoom">
          {Math.round(zoom * 100)}%
        </button>
        <button onClick={handleZoomIn} className="w-8 h-8 flex items-center justify-center text-slate-400 hover:text-white hover:bg-slate-700 rounded transition-colors text-lg" title="Zoom in">+</button>
        <div className="w-px h-5 bg-slate-600 mx-0.5" />
        <button onClick={handleFitToView} className="px-2 h-8 flex items-center justify-center text-xs text-slate-400 hover:text-white hover:bg-slate-700 rounded transition-colors" title="Fit to view">Fit</button>
      </div>

      {/* Linking hint */}
      {linkingSourceId && (
        <div className="absolute top-4 left-1/2 -translate-x-1/2 bg-amber-900/80 border border-amber-600 rounded-lg px-4 py-1.5 text-xs text-amber-200 pointer-events-none shadow-lg">
          Drop on another model to create association — or release to cancel
        </div>
      )}

      {/* Model editor modal */}
      {editorModelId && (() => {
        const editorModel = models.find(m => m.id === editorModelId)
        if (!editorModel) return null
        return (
          <ModelEditorModal
            model={editorModel}
            designer={designer}
            onClose={() => setEditorModelId(null)}
          />
        )
      })()}
    </div>
  )
}
