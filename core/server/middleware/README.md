# Elysia Middleware Helpers

Utilitários para simplificar a criação de middlewares Elysia no FluxStack.

## 📚 Índice

- [Instalação](#instalação)
- [Helpers Disponíveis](#helpers-disponíveis)
  - [createMiddleware](#createmiddleware)
  - [createDerive](#createderive)
  - [createGuard](#createguard)
  - [createRateLimit](#createratelimit)
  - [composeMiddleware](#composemiddleware)
- [Exemplos Práticos](#exemplos-práticos)
- [Comparação: Antes vs Depois](#comparação-antes-vs-depois)

## 🚀 Instalação

Os helpers já estão disponíveis no core do FluxStack:

```typescript
import {
  createMiddleware,
  createDerive,
  createGuard,
  createRateLimit,
  composeMiddleware,
  isDevelopment
} from '../../../core/server/middleware'
```

## 🛠️ Helpers Disponíveis

### `createMiddleware`

Cria um middleware Elysia simples que pode bloquear ou adicionar ao contexto.

**Parâmetros:**
```typescript
interface MiddlewareOptions<TContext = any> {
  name: string                    // Nome único do middleware
  handler: (context: TContext)    // Handler que roda antes da rota
    => void | any                 // Retorne algo para bloquear
  nonBlocking?: boolean           // Use derive() em vez de onBeforeHandle()
}
```

**Exemplo:**
```typescript
const addRequestId = createMiddleware({
  name: 'requestId',
  handler: ({ store }) => {
    Object.assign(store, { requestId: crypto.randomUUID() })
  }
})

app.use(addRequestId)
```

### `createDerive`

Cria um middleware que **adiciona** dados ao contexto sem bloquear a execução.

**Exemplo:**
```typescript
const addTimestamp = createDerive({
  name: 'timestamp',
  derive: () => ({
    timestamp: Date.now(),
    requestTime: new Date().toISOString()
  })
})

app
  .use(addTimestamp)
  .get('/', ({ timestamp, requestTime }) => ({
    timestamp,
    requestTime
  }))
```

### `createGuard`

Cria um middleware de validação/proteção que bloqueia se uma condição não for atendida.

**Exemplo:**
```typescript
const requireAuth = createGuard({
  name: 'authGuard',
  check: ({ store }) => {
    // Retorne true para permitir, false para bloquear
    return store.user?.isAuthenticated === true
  },
  onFail: (set) => {
    set.status = 401
    return { error: 'Unauthorized' }
  }
})

app.use(requireAuth).get('/protected', () => 'Secret data')
```

**Exemplo Assíncrono:**
```typescript
const requireEmailVerified = createGuard({
  name: 'emailVerified',
  check: async ({ store }) => {
    const user = store.user
    if (!user) return false

    // Pode fazer queries assíncronas
    const dbUser = await User.findById(user.id)
    return dbUser?.isEmailVerified === true
  },
  onFail: (set) => {
    set.status = 403
    return { error: 'Email verification required' }
  }
})
```

### `createRateLimit`

Cria um middleware de rate limiting com janela deslizante.

**Parâmetros:**
```typescript
{
  name: string              // Nome do middleware
  maxRequests: number       // Máximo de requests na janela
  windowMs: number          // Tamanho da janela em ms
  keyGenerator?: Function   // Como gerar chave única (default: IP)
  message?: string          // Mensagem de erro customizada
}
```

**Exemplo:**
```typescript
const apiRateLimit = createRateLimit({
  name: 'apiLimit',
  maxRequests: 100,
  windowMs: 60000, // 1 minuto
  keyGenerator: ({ request }) =>
    request.headers.get('x-api-key') || 'anonymous',
  message: 'API rate limit exceeded'
})

app.use(apiRateLimit)
```

**Exemplo com ambiente:**
```typescript
import { isDevelopment } from '../../../core/server/middleware'

const loginRateLimit = createRateLimit({
  name: 'loginLimit',
  maxRequests: isDevelopment() ? 100 : 5,
  windowMs: isDevelopment() ? 60000 : 900000, // 1min dev, 15min prod
  keyGenerator: ({ request }) => {
    const ip = request.headers.get('x-forwarded-for') || 'unknown'
    return `login:${ip}`
  }
})
```

### `composeMiddleware`

Combina múltiplos middlewares em um único plugin reutilizável.

**Exemplo:**
```typescript
const protectedAdminRoute = composeMiddleware({
  name: 'protectedAdmin',
  middlewares: [
    requireAuth(),
    requireEmailVerified(),
    requireAdmin(),
    apiRateLimit()
  ]
})

// Use em várias rotas
app
  .use(protectedAdminRoute)
  .get('/admin/users', () => getUsers())
  .delete('/admin/users/:id', ({ params }) => deleteUser(params.id))
```

## 💡 Exemplos Práticos

### 1. Sistema de Autenticação Completo

```typescript
// Auth obrigatório
export const auth = () =>
  createGuard({
    name: 'auth',
    check: async ({ headers, store }) => {
      const token = headers.authorization?.replace('Bearer ', '')
      if (!token) return false

      try {
        const payload = jwt.verify(token)
        const user = await User.findById(payload.userId)

        if (!user?.isActive) return false

        Object.assign(store, { user, token })
        return true
      } catch {
        return false
      }
    },
    onFail: (set) => {
      set.status = 401
      return { error: 'Authentication required' }
    }
  })

// Auth opcional
export const optionalAuth = () =>
  createDerive({
    name: 'optionalAuth',
    derive: async ({ headers }) => {
      const token = headers.authorization?.replace('Bearer ', '')
      if (!token) return { user: null }

      try {
        const payload = jwt.verify(token)
        const user = await User.findById(payload.userId)
        return { user: user?.isActive ? user : null }
      } catch {
        return { user: null }
      }
    }
  })
```

### 2. Validação de Permissões de Sala

```typescript
export const requireRoomAccess = (paramName = 'roomId') =>
  createGuard({
    name: 'roomAccess',
    check: async ({ store, params }) => {
      const user = store.user
      const roomId = params[paramName]

      if (!user || !roomId) return false

      const room = await Room.findById(roomId)
      if (!room) return false

      const hasAccess = room.participants.some(
        p => p.userId.toString() === user.id
      )

      if (hasAccess) {
        Object.assign(store, { room })
      }

      return hasAccess
    },
    onFail: (set, { params }) => {
      if (!params[paramName]) {
        set.status = 400
        return { error: 'Room ID required' }
      }
      set.status = 403
      return { error: 'Room access denied' }
    }
  })
```

### 3. Logging e Métricas

```typescript
const requestLogger = createDerive({
  name: 'logger',
  derive: ({ request, store }) => {
    const startTime = Date.now()
    const requestId = crypto.randomUUID()

    console.log(`[${requestId}] ${request.method} ${request.url}`)

    return {
      requestId,
      startTime,
      logEnd: () => {
        const duration = Date.now() - startTime
        console.log(`[${requestId}] Completed in ${duration}ms`)
      }
    }
  }
})

app.use(requestLogger).get('/', ({ logEnd }) => {
  const result = doWork()
  logEnd() // Log duration
  return result
})
```

### 4. Validação de Roles

```typescript
const requireRole = (...roles: string[]) =>
  createGuard({
    name: `requireRole:${roles.join(',')}`,
    check: ({ store }) => {
      const user = store.user
      if (!user?.roles) return false
      return roles.some(role => user.roles.includes(role))
    },
    onFail: (set) => {
      set.status = 403
      return {
        error: 'Insufficient permissions',
        required: roles
      }
    }
  })

// Uso
app
  .use(requireRole('admin', 'moderator'))
  .delete('/posts/:id', deletePost)
```

## 🔄 Comparação: Antes vs Depois

### ❌ Antes (Verboso)

```typescript
export const auth = () =>
  new Elysia({ name: 'auth' })
    .onBeforeHandle(async ({ headers, set, store }) => {
      const authHeader = headers.authorization
      if (!authHeader) {
        set.status = 401
        return {
          success: false,
          error: 'Authorization header missing',
          message: 'Authorization header missing'
        }
      }

      const token = jwtService.extractTokenFromAuthHeader(authHeader)
      if (!token) {
        set.status = 401
        return {
          success: false,
          error: 'Invalid authorization format',
          message: 'Invalid authorization format. Expected: Bearer <token>'
        }
      }

      let payload
      try {
        payload = jwtService.verifyAccessToken(token)
      } catch (err) {
        set.status = 401
        return {
          success: false,
          error: 'Invalid token',
          message: err instanceof Error ? err.message : 'Invalid token'
        }
      }

      const userDoc = await User.findById(payload.userId)
      if (!userDoc) {
        set.status = 401
        return {
          success: false,
          error: 'User not found',
          message: 'User not found'
        }
      }

      Object.assign(store, { user: userDoc, token })
    })
    .as('plugin')
```

### ✅ Depois (Limpo e Direto)

```typescript
export const auth = () =>
  createGuard({
    name: 'auth',
    check: async ({ headers, store }) => {
      const token = headers.authorization?.replace('Bearer ', '')
      if (!token) return false

      try {
        const payload = jwtService.verifyAccessToken(token)
        const user = await User.findById(payload.userId)

        if (!user) return false

        Object.assign(store, { user, token })
        return true
      } catch {
        return false
      }
    },
    onFail: (set) => {
      set.status = 401
      return {
        success: false,
        error: 'Authentication required'
      }
    }
  })
```

### Benefícios:
- ✅ **50% menos código**
- ✅ **Mais legível** - lógica de validação separada da resposta de erro
- ✅ **Mais reutilizável** - padrão consistente
- ✅ **Type-safe** - TypeScript infere tipos automaticamente
- ✅ **Menos bugs** - menos código boilerplate manual

## 🎯 Boas Práticas

### 1. Nomeie seus middlewares descritivamente

```typescript
// ❌ Ruim
const m = createMiddleware({ name: 'm', ... })

// ✅ Bom
const requireEmailVerification = createMiddleware({
  name: 'emailVerification',
  ...
})
```

### 2. Use composição para rotas complexas

```typescript
// ✅ Crie middlewares compostos reutilizáveis
const protectedRoute = composeMiddleware({
  name: 'protected',
  middlewares: [auth(), rateLimit()]
})

const adminRoute = composeMiddleware({
  name: 'admin',
  middlewares: [protectedRoute(), requireAdmin()]
})
```

### 3. Use helpers de ambiente

```typescript
import { isDevelopment, isProduction } from '../../../core/server/middleware'

const debugMiddleware = createMiddleware({
  name: 'debug',
  handler: ({ request }) => {
    if (isDevelopment()) {
      console.log('Request:', request.method, request.url)
    }
  },
  nonBlocking: true
})
```

### 4. Separe validação de resposta de erro

```typescript
// ✅ Bom - lógica clara e separada
const requirePremium = createGuard({
  name: 'premium',
  check: ({ store }) => store.user?.subscription === 'premium',
  onFail: (set) => {
    set.status = 402
    return { error: 'Premium subscription required' }
  }
})
```

## 📖 Ver Também

- [Documentação Elysia](https://elysiajs.com)
- [Exemplo completo em `auth-refactored-example.ts`](../../../app/server/middleware/auth-refactored-example.ts)
- [Código dos helpers](./elysia-helpers.ts)
