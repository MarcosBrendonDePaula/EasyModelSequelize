import { useState, useMemo, useRef, useEffect, useCallback } from 'react'

interface GeneratorMeta {
  id: string
  name: string
  description: string
  language: string
  framework: string
  category?: string
  dialect?: string
}

interface Props {
  generators: GeneratorMeta[]
  activeId: string
  onSelect: (id: string) => void
  onClose: () => void
}

const CATEGORY_STYLE: Record<string, { icon: string; accent: string }> = {
  Sequelize:  { icon: 'bg-blue-600', accent: 'border-blue-500/30 bg-blue-500/5' },
  MongoDB:    { icon: 'bg-green-600', accent: 'border-green-500/30 bg-green-500/5' },
  Prisma:     { icon: 'bg-violet-600', accent: 'border-violet-500/30 bg-violet-500/5' },
  TypeORM:    { icon: 'bg-orange-600', accent: 'border-orange-500/30 bg-orange-500/5' },
  Drizzle:    { icon: 'bg-lime-600', accent: 'border-lime-500/30 bg-lime-500/5' },
  'SQL Raw':  { icon: 'bg-slate-500', accent: 'border-slate-500/30 bg-slate-500/5' },
}

const LANG_BADGE: Record<string, { label: string; cls: string }> = {
  javascript: { label: 'JS', cls: 'bg-yellow-500/20 text-yellow-300 border-yellow-500/40' },
  typescript: { label: 'TS', cls: 'bg-blue-500/20 text-blue-300 border-blue-500/40' },
}

type FilterLang = 'all' | 'javascript' | 'typescript'

export function GeneratorModal({ generators, activeId, onSelect, onClose }: Props) {
  const [search, setSearch] = useState('')
  const [filterLang, setFilterLang] = useState<FilterLang>('all')
  const [focusIdx, setFocusIdx] = useState(-1)
  const inputRef = useRef<HTMLInputElement>(null)
  const listRef = useRef<HTMLDivElement>(null)

  // Focus search on open
  useEffect(() => { inputRef.current?.focus() }, [])

  // Short label
  const shortLabel = (g: GeneratorMeta) => {
    const db = g.dialect || ''
    const framework = g.category || g.framework
    return db ? `${framework} (${db})` : framework
  }

  // All searchable tokens
  const matchSearch = (g: GeneratorMeta, q: string) => {
    if (!q) return true
    const haystack = `${g.name} ${g.category} ${g.dialect} ${g.framework} ${g.language} ${g.id}`.toLowerCase()
    return q.toLowerCase().split(/\s+/).every(w => haystack.includes(w))
  }

  // Filtered + grouped
  const { grouped, flatList } = useMemo(() => {
    const filtered = generators.filter(g => {
      if (filterLang !== 'all' && g.language !== filterLang) return false
      return matchSearch(g, search)
    })

    const map = new Map<string, GeneratorMeta[]>()
    for (const g of filtered) {
      const cat = g.category || 'Other'
      if (!map.has(cat)) map.set(cat, [])
      map.get(cat)!.push(g)
    }

    const flat: GeneratorMeta[] = []
    for (const gens of map.values()) flat.push(...gens)

    return { grouped: map, flatList: flat }
  }, [generators, search, filterLang])

  // Keyboard navigation
  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setFocusIdx(i => Math.min(i + 1, flatList.length - 1))
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setFocusIdx(i => Math.max(i - 1, 0))
    } else if (e.key === 'Enter' && focusIdx >= 0 && focusIdx < flatList.length) {
      e.preventDefault()
      onSelect(flatList[focusIdx].id)
      onClose()
    } else if (e.key === 'Escape') {
      onClose()
    }
  }, [flatList, focusIdx, onSelect, onClose])

  // Reset focus when search/filter changes
  useEffect(() => { setFocusIdx(-1) }, [search, filterLang])

  // Scroll focused item into view
  useEffect(() => {
    if (focusIdx < 0) return
    const el = listRef.current?.querySelector(`[data-idx="${focusIdx}"]`)
    el?.scrollIntoView({ block: 'nearest' })
  }, [focusIdx])

  const handleSelect = (id: string) => {
    onSelect(id)
    onClose()
  }

  const langFilters: { key: FilterLang; label: string }[] = [
    { key: 'all', label: 'All' },
    { key: 'javascript', label: 'JS' },
    { key: 'typescript', label: 'TS' },
  ]

  let globalIdx = -1

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center" onKeyDown={handleKeyDown}>
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />

      <div className="relative w-full max-w-lg mx-4 bg-slate-900 border border-slate-700 rounded-xl shadow-2xl overflow-hidden flex flex-col max-h-[80vh]">
        {/* Search + filters */}
        <div className="px-4 pt-4 pb-3 border-b border-slate-700 space-y-3">
          {/* Search input */}
          <div className="relative">
            <svg className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" width="14" height="14" viewBox="0 0 16 16" fill="currentColor">
              <path d="M11.742 10.344a6.5 6.5 0 1 0-1.397 1.398h-.001l3.85 3.85a1 1 0 0 0 1.415-1.414l-3.85-3.85zm-5.242.156a5 5 0 1 1 0-10 5 5 0 0 1 0 10z"/>
            </svg>
            <input
              ref={inputRef}
              type="text"
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search... postgres, sqlite, mongoose, ts..."
              className="w-full pl-9 pr-3 py-2 text-sm bg-slate-800 border border-slate-600 rounded-lg text-white placeholder-slate-500 outline-none focus:border-indigo-500 transition-colors"
            />
            {search && (
              <button
                onClick={() => setSearch('')}
                className="absolute right-2 top-1/2 -translate-y-1/2 p-0.5 text-slate-500 hover:text-white transition-colors"
              >
                <svg width="12" height="12" viewBox="0 0 16 16" fill="currentColor">
                  <path d="M4.646 4.646a.5.5 0 0 1 .708 0L8 7.293l2.646-2.647a.5.5 0 0 1 .708.708L8.707 8l2.647 2.646a.5.5 0 0 1-.708.708L8 8.707l-2.646 2.647a.5.5 0 0 1-.708-.708L7.293 8 4.646 5.354a.5.5 0 0 1 0-.708z"/>
                </svg>
              </button>
            )}
          </div>

          {/* Language filter pills */}
          <div className="flex items-center gap-1.5">
            <span className="text-[10px] text-slate-500 uppercase tracking-wider mr-1">Lang:</span>
            {langFilters.map(f => (
              <button
                key={f.key}
                onClick={() => setFilterLang(f.key)}
                className={`px-2.5 py-1 text-[11px] font-semibold rounded-md border transition-colors ${
                  filterLang === f.key
                    ? 'border-indigo-500 bg-indigo-500/15 text-indigo-300'
                    : 'border-slate-700 bg-slate-800 text-slate-400 hover:border-slate-500 hover:text-slate-300'
                }`}
              >
                {f.label}
              </button>
            ))}

            <span className="ml-auto text-[10px] text-slate-600">
              {flatList.length} result{flatList.length !== 1 ? 's' : ''}
            </span>
          </div>
        </div>

        {/* Results */}
        <div ref={listRef} className="flex-1 overflow-y-auto px-4 py-3 space-y-4">
          {flatList.length === 0 && (
            <div className="flex flex-col items-center justify-center py-8 text-slate-500">
              <svg width="32" height="32" viewBox="0 0 16 16" fill="currentColor" className="mb-2 opacity-40">
                <path d="M11.742 10.344a6.5 6.5 0 1 0-1.397 1.398h-.001l3.85 3.85a1 1 0 0 0 1.415-1.414l-3.85-3.85zm-5.242.156a5 5 0 1 1 0-10 5 5 0 0 1 0 10z"/>
              </svg>
              <span className="text-xs">No generators found</span>
            </div>
          )}

          {[...grouped.entries()].map(([category, gens]) => {
            const style = CATEGORY_STYLE[category] || { icon: 'bg-slate-600', accent: 'border-slate-600 bg-slate-800/50' }

            return (
              <div key={category}>
                {/* Category header */}
                <div className="flex items-center gap-1.5 mb-1.5">
                  <span className={`w-4 h-4 flex items-center justify-center rounded text-[9px] font-bold text-white ${style.icon}`}>
                    {category.charAt(0)}
                  </span>
                  <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
                    {category}
                  </span>
                </div>

                {/* Items */}
                <div className="grid grid-cols-2 gap-1.5">
                  {gens.map(g => {
                    globalIdx++
                    const idx = globalIdx
                    const isActive = g.id === activeId
                    const isFocused = idx === focusIdx
                    const lang = LANG_BADGE[g.language]

                    return (
                      <button
                        key={g.id}
                        data-idx={idx}
                        onClick={() => handleSelect(g.id)}
                        className={`flex items-center gap-2 px-2.5 py-1.5 rounded-md border text-left transition-all duration-75 ${
                          isActive
                            ? 'border-indigo-500 bg-indigo-500/10'
                            : isFocused
                              ? 'border-slate-500 bg-slate-800'
                              : `${style.accent} hover:border-slate-500 hover:bg-slate-800`
                        }`}
                      >
                        {/* Lang badge */}
                        {lang && (
                          <span className={`shrink-0 px-1 py-px text-[9px] font-bold rounded border ${lang.cls}`}>
                            {lang.label}
                          </span>
                        )}

                        {/* Label */}
                        <span className="text-[11px] font-medium text-white truncate flex-1">
                          {shortLabel(g)}
                        </span>

                        {/* Active check */}
                        {isActive && (
                          <svg className="shrink-0 text-indigo-400" width="14" height="14" viewBox="0 0 16 16" fill="currentColor">
                            <path d="M13.78 4.22a.75.75 0 0 1 0 1.06l-7.25 7.25a.75.75 0 0 1-1.06 0L2.22 9.28a.75.75 0 0 1 1.06-1.06L6 10.94l6.72-6.72a.75.75 0 0 1 1.06 0z"/>
                          </svg>
                        )}
                      </button>
                    )
                  })}
                </div>
              </div>
            )
          })}
        </div>

        {/* Footer hint */}
        <div className="px-4 py-2 border-t border-slate-700 bg-slate-900/80 flex items-center gap-3">
          <div className="flex items-center gap-1 text-[10px] text-slate-600">
            <kbd className="px-1 py-px bg-slate-800 border border-slate-700 rounded text-[9px]">↑↓</kbd>
            <span>navigate</span>
          </div>
          <div className="flex items-center gap-1 text-[10px] text-slate-600">
            <kbd className="px-1 py-px bg-slate-800 border border-slate-700 rounded text-[9px]">Enter</kbd>
            <span>select</span>
          </div>
          <div className="flex items-center gap-1 text-[10px] text-slate-600">
            <kbd className="px-1 py-px bg-slate-800 border border-slate-700 rounded text-[9px]">Esc</kbd>
            <span>close</span>
          </div>
          <button
            onClick={onClose}
            className="ml-auto px-2.5 py-1 text-[11px] bg-slate-800 border border-slate-700 rounded hover:bg-slate-700 text-slate-400 hover:text-slate-300 transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  )
}
