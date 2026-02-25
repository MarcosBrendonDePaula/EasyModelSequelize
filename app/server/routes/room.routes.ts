// 🔥 Room API Routes - Enviar mensagens para salas via HTTP
//
// Permite que sistemas externos (webhooks, outros serviços, etc)
// enviem mensagens para salas de chat via API REST

import { Elysia, t } from 'elysia'
import { liveRoomManager } from '@core/server/live/LiveRoomManager'
import { roomEvents } from '@core/server/live/RoomEventBus'

export const roomRoutes = new Elysia({ prefix: '/rooms' })

  // Enviar mensagem para uma sala
  .post('/:roomId/messages', ({ params, body }) => {
    const { roomId } = params
    const { user, text } = body

    const message = {
      id: `api-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      user: user || 'API Bot',
      text,
      timestamp: Date.now()
    }

    // Emitir evento para a sala
    // Isso vai:
    // 1. Notificar handlers server-side via roomEvents
    // 2. Broadcast via WebSocket para frontends
    const notified = liveRoomManager.emitToRoom(roomId, 'message:new', message)

    return {
      success: true,
      message,
      notified,
      roomId
    }
  }, {
    params: t.Object({
      roomId: t.String({ description: 'ID da sala (ex: geral, tech, random)' })
    }),
    body: t.Object({
      user: t.Optional(t.String({ description: 'Nome do usuário (opcional, default: API Bot)' })),
      text: t.String({ description: 'Texto da mensagem', minLength: 1, maxLength: 1000 })
    }),
    response: t.Object({
      success: t.Boolean(),
      message: t.Object({
        id: t.String(),
        user: t.String(),
        text: t.String(),
        timestamp: t.Number()
      }),
      notified: t.Number(),
      roomId: t.String()
    }),
    detail: {
      tags: ['Rooms'],
      summary: 'Enviar mensagem para sala',
      description: 'Envia uma mensagem para todos os usuários conectados em uma sala específica'
    }
  })

  // Emitir evento customizado para uma sala
  .post('/:roomId/emit', ({ params, body }) => {
    const { roomId } = params
    const { event, data } = body

    const notified = liveRoomManager.emitToRoom(roomId, event, data)

    return {
      success: true,
      event,
      notified,
      roomId
    }
  }, {
    params: t.Object({
      roomId: t.String({ description: 'ID da sala' })
    }),
    body: t.Object({
      event: t.String({ description: 'Nome do evento (ex: user:typing, notification)' }),
      data: t.Any({ description: 'Dados do evento' })
    }),
    response: t.Object({
      success: t.Boolean(),
      event: t.String(),
      notified: t.Number(),
      roomId: t.String()
    }),
    detail: {
      tags: ['Rooms'],
      summary: 'Emitir evento customizado',
      description: 'Emite um evento customizado para todos os componentes em uma sala'
    }
  })

  // Obter estatísticas das salas
  .get('/stats', () => {
    const roomStats = liveRoomManager.getStats()
    const eventStats = roomEvents.getStats()

    return {
      success: true,
      rooms: roomStats,
      events: eventStats
    }
  }, {
    response: t.Object({
      success: t.Boolean(),
      rooms: t.Any(),
      events: t.Any()
    }),
    detail: {
      tags: ['Rooms'],
      summary: 'Estatísticas das salas',
      description: 'Retorna estatísticas sobre salas ativas e eventos registrados'
    }
  })
