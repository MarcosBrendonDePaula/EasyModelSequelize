// 🔥 RoomChatDemo - Chat multi-salas simplificado

import { useState, useEffect, useRef, useMemo } from 'react'
import { Live } from '@/core/client'
import { LiveRoomChat } from '@server/live/LiveRoomChat'

const AVAILABLE_ROOMS = [
  { id: 'geral', name: '💬 Geral' },
  { id: 'tech', name: '💻 Tecnologia' },
  { id: 'random', name: '🎲 Random' },
  { id: 'vip', name: '⭐ VIP' }
]

export function RoomChatDemo() {
  const [text, setText] = useState('')
  const messagesEndRef = useRef<HTMLDivElement>(null)

  const defaultUsername = useMemo(() => {
    const adj = ['Happy', 'Cool', 'Fast', 'Smart', 'Brave'][Math.floor(Math.random() * 5)]
    const noun = ['Panda', 'Tiger', 'Eagle', 'Wolf', 'Bear'][Math.floor(Math.random() * 5)]
    return `${adj}${noun}${Math.floor(Math.random() * 100)}`
  }, [])

  const chat = Live.use(LiveRoomChat, {
    initialState: { ...LiveRoomChat.defaultState, username: defaultUsername }
  })

  const activeRoom = chat.$state.activeRoom
  const activeMessages = activeRoom ? (chat.$state.messages[activeRoom] || []) : []

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [activeMessages.length])

  const handleJoinRoom = async (roomId: string, roomName: string) => {
    if (chat.$rooms.includes(roomId)) {
      await chat.switchRoom({ roomId })
    } else {
      await chat.joinRoom({ roomId, roomName })
    }
  }

  const handleSendMessage = async () => {
    if (!text.trim() || !activeRoom) return
    await chat.sendMessage({ text })
    setText('')
  }

  return (
    <div className="flex flex-col md:flex-row h-[calc(100vh-200px)] md:h-[600px] w-full max-w-4xl mx-auto bg-gray-900 rounded-2xl overflow-hidden border border-white/10">
      {/* Sidebar */}
      <div className={`${activeRoom ? 'hidden md:flex' : 'flex'} w-full md:w-64 bg-gray-800/50 md:border-r border-white/10 flex-col ${!activeRoom ? 'flex-1 md:flex-initial' : ''}`}>
        <div className="p-4 border-b border-white/10">
          <h2 className="text-lg font-bold text-white mb-2">Room Chat</h2>
          <div className="flex items-center gap-2">
            <div className={`w-2 h-2 rounded-full ${chat.$connected ? 'bg-emerald-400' : 'bg-red-400'}`} />
            <span className="text-sm text-gray-400">{chat.$state.username}</span>
          </div>
        </div>

        <div className="flex-1 overflow-auto p-2">
          <p className="text-xs text-gray-500 px-2 py-1">SALAS</p>
          {AVAILABLE_ROOMS.map(room => {
            const isJoined = chat.$rooms.includes(room.id)
            const isActive = activeRoom === room.id

            return (
              <div
                key={room.id}
                onClick={() => handleJoinRoom(room.id, room.name)}
                className={`
                  flex items-center justify-between px-3 py-2 rounded-lg cursor-pointer mb-1 transition-all group
                  ${isActive ? 'bg-purple-500/20 text-purple-300' : isJoined ? 'bg-white/5 text-gray-300 hover:bg-white/10' : 'text-gray-500 hover:bg-white/5'}
                `}
              >
                <span className="flex items-center gap-2">
                  {room.name}
                  {isJoined && <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />}
                </span>
                {isJoined && !isActive && (
                  <button
                    onClick={(e) => { e.stopPropagation(); chat.leaveRoom({ roomId: room.id }) }}
                    className="opacity-0 group-hover:opacity-100 text-red-400 hover:text-red-300 text-xs"
                  >✕</button>
                )}
              </div>
            )
          })}
        </div>

        <div className="p-3 border-t border-white/10">
          <p className="text-xs text-gray-500">Em {chat.$rooms.length} sala(s)</p>
        </div>
      </div>

      {/* Chat Area */}
      <div className={`${!activeRoom ? 'hidden md:flex' : 'flex'} flex-1 flex-col`}>
        {activeRoom ? (
          <>
            <div className="px-4 py-3 border-b border-white/10 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <button
                  onClick={() => chat.switchRoom({ roomId: '' })}
                  className="md:hidden px-2 py-1 text-sm text-gray-400 hover:text-white"
                >
                  ←
                </button>
                <div>
                  <h3 className="text-white font-semibold">
                    {chat.$state.rooms.find(r => r.id === activeRoom)?.name || activeRoom}
                  </h3>
                  <p className="text-xs text-gray-500">{activeMessages.length} mensagens</p>
                </div>
              </div>
              <button
                onClick={() => chat.leaveRoom({ roomId: activeRoom })}
                className="px-3 py-1 text-sm bg-red-500/20 text-red-300 rounded-lg hover:bg-red-500/30"
              >Sair</button>
            </div>

            <div className="flex-1 overflow-auto p-3 sm:p-4 space-y-3">
              {activeMessages.length === 0 ? (
                <div className="text-center text-gray-500 py-8">
                  <p>Nenhuma mensagem ainda</p>
                  <p className="text-sm">Seja o primeiro a enviar!</p>
                </div>
              ) : (
                activeMessages.map(msg => (
                  <div key={msg.id} className={`flex flex-col ${msg.user === chat.$state.username ? 'items-end' : 'items-start'}`}>
                    <div className={`max-w-[85%] sm:max-w-[80%] rounded-2xl px-3 sm:px-4 py-2 ${msg.user === chat.$state.username ? 'bg-purple-500/30 text-purple-100' : 'bg-white/10 text-gray-200'}`}>
                      <p className="text-xs text-gray-400 mb-1">{msg.user}</p>
                      <p className="text-sm sm:text-base">{msg.text}</p>
                    </div>
                    <span className="text-xs text-gray-600 mt-1">{new Date(msg.timestamp).toLocaleTimeString()}</span>
                  </div>
                ))
              )}
              <div ref={messagesEndRef} />
            </div>

            <div className="p-3 sm:p-4 border-t border-white/10">
              <div className="flex gap-2">
                <input
                  value={text}
                  onChange={(e) => setText(e.target.value)}
                  onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSendMessage() } }}
                  placeholder="Digite uma mensagem..."
                  className="flex-1 px-3 sm:px-4 py-2 rounded-xl bg-white/10 border border-white/20 text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-purple-500/50 text-sm sm:text-base"
                />
                <button
                  onClick={handleSendMessage}
                  disabled={!text.trim()}
                  className="px-4 sm:px-6 py-2 rounded-xl bg-purple-500/30 text-purple-200 hover:bg-purple-500/40 disabled:opacity-50 text-sm sm:text-base"
                >Enviar</button>
              </div>
            </div>
          </>
        ) : (
          <div className="flex-1 flex items-center justify-center text-gray-500">
            <div className="text-center">
              <p className="text-4xl mb-4">←</p>
              <p>Selecione uma sala para começar</p>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
