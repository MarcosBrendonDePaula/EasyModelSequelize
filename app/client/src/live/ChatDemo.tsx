import { useEffect, useMemo, useRef, useState } from 'react'
import { Live } from '@/core/client'
import { LiveChat } from '@server/live/LiveChat'

export function ChatDemo() {
  const [text, setText] = useState('')
  const [user, setUser] = useState('')
  const containerRef = useRef<HTMLDivElement | null>(null)
  const wasNearBottomRef = useRef(true)
  const defaultUser = useMemo(() => {
    if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
      return `user-${crypto.randomUUID().slice(0, 6)}`
    }
    return `user-${Math.random().toString(36).slice(2, 8)}`
  }, [])

  const chat = Live.use(LiveChat, {
    room: 'global-chat',
    initialState: LiveChat.defaultState,
    persistState: false
  })

  const handleSend = async () => {
    if (!text.trim()) return
    const finalUser = user.trim() || defaultUser
    await chat.sendMessage({ user: finalUser, text })
    setText('')
  }

  useEffect(() => {
    const el = containerRef.current
    if (!el) return

    if (wasNearBottomRef.current) {
      el.scrollTop = el.scrollHeight
    }
  }, [chat.$state.messages.length])

  const handleScroll = () => {
    const el = containerRef.current
    if (!el) return
    const distance = el.scrollHeight - (el.scrollTop + el.clientHeight)
    wasNearBottomRef.current = distance < 80
  }

  return (
    <div className="bg-white/5 backdrop-blur-sm border border-white/10 rounded-2xl p-4 sm:p-6 md:p-8 w-full max-w-2xl mx-auto">
      <h2 className="text-2xl font-bold text-white mb-2 text-center">Chat Compartilhado</h2>
      <p className="text-gray-400 text-sm text-center mb-4">
        Sala global em tempo real. Abra em várias abas para testar.
      </p>

      <div className="flex flex-wrap items-center gap-2 mb-4 text-xs">
        <span className={`px-3 py-1 rounded-full ${chat.$connected ? 'bg-emerald-500/20 text-emerald-300' : 'bg-red-500/20 text-red-300'}`}>
          {chat.$connected ? 'Conectado' : 'Desconectado'}
        </span>
        <span className="text-gray-400">Você: {user.trim() || defaultUser}</span>
      </div>

      <div className="mb-4">
        <label className="block text-xs text-gray-400 mb-2">Seu nome</label>
        <input
          value={user}
          onChange={(e) => setUser(e.target.value)}
          placeholder={`Ex: ${defaultUser}`}
          className="w-full px-4 py-2 rounded-lg bg-white/10 border border-white/20 text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-purple-500/50"
        />
      </div>

      <div
        ref={containerRef}
        onScroll={handleScroll}
        className="bg-black/40 border border-white/10 rounded-xl p-3 sm:p-5 h-72 sm:h-96 md:h-[28rem] overflow-auto space-y-3"
      >
        {chat.$state.messages.length === 0 && (
          <div className="text-gray-500 text-sm text-center">Nenhuma mensagem ainda</div>
        )}
        {chat.$state.messages.map((m) => (
          <div key={m.id} className="text-sm">
            <span className="text-purple-300 font-semibold">{m.user}</span>
            <span className="text-gray-500 text-xs ml-2">{new Date(m.timestamp).toLocaleTimeString()}</span>
            <div className="text-gray-200">{m.text}</div>
          </div>
        ))}
      </div>

      <div className="mt-4 flex gap-2">
        <input
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') void handleSend()
          }}
          placeholder="Digite uma mensagem..."
          className="flex-1 px-4 py-2 rounded-lg bg-white/10 border border-white/20 text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-purple-500/50"
        />
        <button
          onClick={handleSend}
          disabled={!chat.$connected}
          className="px-4 py-2 rounded-lg bg-purple-500/20 border border-purple-500/30 text-purple-200 hover:bg-purple-500/30 transition-all disabled:opacity-50"
        >
          Enviar
        </button>
      </div>
    </div>
  )
}
