# FluxStack Agent Guide

**Version:** 1.13.0 | **Updated:** 2025-02-14

> Guia completo para agentes de IA que auxiliam desenvolvedores a configurar, construir e manter aplicacoes FluxStack.

## Identidade do Agente

Voce e um agente especialista em FluxStack, um framework full-stack TypeScript moderno. Seu papel e:

1. **Guiar** desenvolvedores na configuracao inicial e estruturacao do projeto
2. **Gerar** codigo que segue os padroes do framework (routes, controllers, live components, configs)
3. **Diagnosticar** problemas seguindo a arvore de troubleshooting
4. **Ensinar** boas praticas e prevenir anti-patterns

Sempre priorize type safety, separacao de responsabilidades e as convencoes do framework.

---

## Stack Tecnologica

| Camada | Tecnologia | Versao |
|--------|-----------|--------|
| Runtime | Bun | >= 1.2.0 |
| Backend | Elysia.js | 1.4.6 |
| Frontend | React | 19.1.0 |
| Bundler | Vite | 7.1.7 |
| Linguagem | TypeScript | 5.8.3 |
| Styling | Tailwind CSS | 4.1.13 |
| Type-safe API | Eden Treaty | 1.3.2 |
| Testes | Vitest | 3.2.4 |

---

## Arquitetura do Projeto

```
FluxStack/
├── core/           # FRAMEWORK (SOMENTE LEITURA - nunca modificar)
├── app/            # CODIGO DA APLICACAO (area de trabalho principal)
│   ├── server/     #   Backend: routes, controllers, live components
│   ├── client/     #   Frontend: React components, pages, hooks
│   └── shared/     #   Types compartilhados entre client e server
├── config/         # CONFIGURACOES (declarativas, com validacao)
│   ├── system/     #   Defaults do framework (base)
│   └── *.config.ts #   Overrides do usuario
├── plugins/        # PLUGINS DO PROJETO (auto-discovered, confiaveis)
├── tests/          # TESTES (Vitest)
└── LLMD/           # DOCUMENTACAO LLM-optimizada
```

### Regra Fundamental

```
core/    = READ-ONLY (framework)
app/     = READ-WRITE (seu codigo)
config/  = READ-WRITE (suas configuracoes)
plugins/ = READ-WRITE (seus plugins)
```

---

## Fluxos de Trabalho

### 1. Setup Inicial do Projeto

Quando o desenvolvedor pedir para configurar um novo projeto ou iniciar do zero:

```bash
# 1. Verificar se Bun esta instalado
bun --version || curl -fsSL https://bun.sh/install | bash

# 2. Instalar dependencias
bun install

# 3. Copiar .env de exemplo (se existir)
cp .env.example .env  # ajustar variaveis

# 4. Iniciar em modo desenvolvimento
bun run dev
```

**Validar que tudo funciona:**
- Backend: http://localhost:3000/api/health
- Frontend: http://localhost:5173
- Swagger: http://localhost:3000/swagger

---

### 2. Criar uma Nova Rota API

**Passo 1 - Definir schemas e rota** em `app/server/routes/`:

```typescript
// app/server/routes/{recurso}.routes.ts
import { Elysia, t } from 'elysia'

// 1. Definir schemas (reusaveis)
const ItemSchema = t.Object({
  id: t.Number(),
  name: t.String(),
  status: t.Union([t.Literal('active'), t.Literal('inactive')])
}, { description: 'Item object' })

const CreateItemSchema = t.Object({
  name: t.String({ minLength: 2, description: 'Item name' }),
  status: t.Optional(t.Union([t.Literal('active'), t.Literal('inactive')]))
}, { description: 'Create item request' })

// 2. Definir rotas com response schemas (OBRIGATORIO)
export const itemsRoutes = new Elysia({ prefix: '/items', tags: ['Items'] })
  .get('/', async () => {
    return ItemsController.getAll()
  }, {
    detail: { summary: 'List Items', tags: ['Items'] },
    response: t.Object({
      success: t.Boolean(),
      items: t.Array(ItemSchema),
      count: t.Number()
    })
  })

  .get('/:id', async ({ params, set }) => {
    const result = await ItemsController.getById(Number(params.id))
    if (!result.success) set.status = 404
    return result
  }, {
    params: t.Object({ id: t.String() }),
    response: {
      200: t.Object({ success: t.Literal(true), item: ItemSchema }),
      404: t.Object({ success: t.Literal(false), error: t.String() })
    }
  })

  .post('/', async ({ body, set }) => {
    const result = await ItemsController.create(body)
    if (result.success) set.status = 201
    return result
  }, {
    body: CreateItemSchema,
    response: {
      201: t.Object({ success: t.Literal(true), item: ItemSchema }),
      400: t.Object({ success: t.Literal(false), error: t.String() })
    }
  })
```

**Passo 2 - Criar controller** em `app/server/controllers/`:

```typescript
// app/server/controllers/{recurso}.controller.ts
export class ItemsController {
  private static items: Item[] = []
  private static nextId = 1

  static async getAll() {
    return {
      success: true as const,
      items: this.items,
      count: this.items.length
    }
  }

  static async getById(id: number) {
    const item = this.items.find(i => i.id === id)
    if (!item) {
      return { success: false as const, error: 'Item not found' }
    }
    return { success: true as const, item }
  }

  static async create(data: { name: string; status?: 'active' | 'inactive' }) {
    const item: Item = {
      id: this.nextId++,
      name: data.name,
      status: data.status ?? 'active'
    }
    this.items.push(item)
    return { success: true as const, item }
  }
}
```

**Passo 3 - Registrar a rota** em `app/server/app.ts`:

```typescript
import { itemsRoutes } from './routes/items.routes'

// Dentro da configuracao da app Elysia
app.use(itemsRoutes)
```

**Passo 4 - Usar no frontend** (types automaticos via Eden Treaty):

```typescript
// No componente React - SEM tipos manuais!
import { api } from '@/lib/eden-api'

const { data, error } = await api.items.get()
// data.items e automaticamente tipado como Item[]

const { data: created } = await api.items.post({
  name: 'Novo Item',
  status: 'active'
})
// created.item e automaticamente tipado como Item
```

---

### 3. Criar um Live Component (WebSocket Real-Time)

**Passo 1 - Componente server-side** em `app/server/live/`:

```typescript
// app/server/live/Live{Nome}.ts
import { LiveComponent } from '@core/types/types'

// Link para o componente client (Ctrl+Click no VSCode)
import type { {Nome}Demo as _Client } from '@client/src/live/{Nome}Demo'

export class Live{Nome} extends LiveComponent<typeof Live{Nome}.defaultState> {
  static componentName = 'Live{Nome}'
  static logging = ['lifecycle', 'messages'] as const  // opcional

  static defaultState = {
    // Definir estado inicial aqui
    count: 0,
    items: [] as string[],
    lastUpdated: null as string | null
  }

  // Declarar propriedades para TypeScript
  declare count: number
  declare items: string[]
  declare lastUpdated: string | null

  // Acoes chamadas pelo client
  async increment() {
    this.count++  // Auto-sync via Proxy
    this.lastUpdated = new Date().toISOString()
    return { success: true, count: this.count }
  }

  async addItem(payload: { text: string }) {
    // Batch update (single STATE_DELTA)
    this.setState({
      items: [...this.items, payload.text],
      lastUpdated: new Date().toISOString()
    })
    return { success: true }
  }

  async reset() {
    this.setState({ ...Live{Nome}.defaultState })
    return { success: true }
  }
}
```

**Passo 2 - Componente client-side** em `app/client/src/live/`:

```typescript
// app/client/src/live/{Nome}Demo.tsx
import { Live } from '@/core/client'
import { Live{Nome} } from '@server/live/Live{Nome}'

export function {Nome}Demo() {
  const component = Live.use(Live{Nome}, {
    room: 'default-room',  // opcional: para multi-user sync
    initialState: Live{Nome}.defaultState
  })

  const { count, items, lastUpdated } = component.$state
  const isConnected = component.$connected
  const isLoading = component.$loading

  return (
    <div>
      <p>Status: {isConnected ? 'Conectado' : 'Desconectado'}</p>
      <p>Count: {count}</p>
      <button onClick={() => component.increment()} disabled={isLoading}>
        Incrementar
      </button>
      <button onClick={() => component.addItem({ text: 'Novo' })}>
        Adicionar Item
      </button>
      <ul>
        {items.map((item, i) => <li key={i}>{item}</li>)}
      </ul>
      {lastUpdated && <small>Atualizado: {lastUpdated}</small>}
    </div>
  )
}
```

**Com Room Events (multi-usuario):**

```typescript
// Server: sincronizar entre usuarios
export class LiveChat extends LiveComponent<typeof LiveChat.defaultState> {
  static componentName = 'LiveChat'
  static defaultState = {
    messages: [] as { user: string; text: string; ts: number }[]
  }

  constructor(initialState: any, ws: any, options?: any) {
    super(initialState, ws, options)

    // Escutar eventos de OUTROS usuarios
    this.onRoomEvent<{ user: string; text: string; ts: number }>('NEW_MSG', (msg) => {
      this.setState({
        messages: [...this.state.messages, msg]
      })
    })
  }

  async sendMessage(payload: { user: string; text: string }) {
    const msg = { ...payload, ts: Date.now() }

    // 1. Atualizar MEU estado
    this.setState({ messages: [...this.state.messages, msg] })

    // 2. Notificar OUTROS na sala
    this.emitRoomEvent('NEW_MSG', msg)

    return { success: true }
  }

  destroy() {
    super.destroy()
  }
}
```

---

### 4. Criar Configuracao

**Passo 1 - Definir schema** em `config/`:

```typescript
// config/{nome}.config.ts
import { defineConfig, config } from '@core/utils/config-schema'

const myConfigSchema = {
  apiKey: config.string('MY_API_KEY', '', true),
  maxRetries: config.number('MY_MAX_RETRIES', 3),
  environment: config.enum(
    'MY_ENV',
    ['sandbox', 'production'] as const,
    'sandbox',
    true
  ),
  enableCache: config.boolean('MY_ENABLE_CACHE', true),
  allowedOrigins: config.array('MY_ALLOWED_ORIGINS', ['localhost']),
} as const  // IMPORTANTE: as const para preservar tipos literais

export const myConfig = defineConfig(myConfigSchema)
```

**Passo 2 - Adicionar variaveis** no `.env`:

```env
MY_API_KEY=sk-123456
MY_MAX_RETRIES=5
MY_ENV=sandbox
MY_ENABLE_CACHE=true
MY_ALLOWED_ORIGINS=localhost,myapp.com
```

**Passo 3 - Usar com type safety total:**

```typescript
import { myConfig } from '@config/my.config'

// TypeScript infere automaticamente:
// myConfig.apiKey      → string
// myConfig.maxRetries  → number
// myConfig.environment → "sandbox" | "production"
// myConfig.enableCache → boolean
```

---

### 5. Criar Plugin do Projeto

**Passo 1 - Gerar scaffold:**

```bash
bun run flux make:plugin meu-plugin
```

**Passo 2 - Implementar o plugin** em `plugins/meu-plugin/index.ts`:

```typescript
import type { FluxStackPlugin } from '@core/types/plugin'

const meuPlugin: FluxStackPlugin = {
  name: 'meu-plugin',
  version: '1.0.0',

  // Hooks do ciclo de vida
  async setup(app) {
    // Registrar rotas, middleware, etc.
    app.get('/api/meu-plugin/status', () => ({ active: true }))
  },

  hooks: {
    onServerStart: async (app) => {
      console.log('[meu-plugin] Servidor iniciado')
    },

    onRequest: async (ctx) => {
      // Middleware em cada request
    }
  }
}

export default meuPlugin
```

Plugins em `plugins/` sao auto-discovered e confiaveis. Nao precisam de whitelist.

---

### 6. Adicionar Autenticacao

#### REST API (Session ou Token Guard)

```typescript
// app/server/routes/protected.routes.ts
import { Elysia, t } from 'elysia'
import { authMiddleware } from '@app/server/auth'

export const protectedRoutes = new Elysia({ prefix: '/protected' })
  .use(authMiddleware)  // Aplica auth em todas as rotas deste grupo

  .get('/profile', async ({ user }) => {
    return { success: true, user }
  }, {
    response: t.Object({
      success: t.Boolean(),
      user: t.Object({ id: t.String(), name: t.String() })
    })
  })
```

#### Live Components (Declarativo RBAC)

```typescript
export class AdminPanel extends LiveComponent<typeof AdminPanel.defaultState> {
  static componentName = 'AdminPanel'
  static defaultState = { users: [] as any[] }

  // Auth declarativo na classe
  static auth = {
    required: true,
    roles: ['admin']
  }

  // Auth por acao
  static actionAuth = {
    deleteUser: { permissions: ['users.delete'] }
  }

  async deleteUser(payload: { userId: string }) {
    // $auth disponivel automaticamente
    console.log(`${this.$auth.user?.id} deletando usuario`)
    return { success: true }
  }
}
```

---

## Templates de Codigo por Tipo

### Template: Rota CRUD Completa

```typescript
// app/server/routes/{recurso}.routes.ts
import { Elysia, t } from 'elysia'
import { {Recurso}Controller } from '../controllers/{recurso}.controller'

const {Recurso}Schema = t.Object({
  id: t.Number(),
  name: t.String(),
  createdAt: t.String()
})

const Create{Recurso}Schema = t.Object({
  name: t.String({ minLength: 2 })
})

const Update{Recurso}Schema = t.Object({
  name: t.Optional(t.String({ minLength: 2 }))
})

const SuccessResponse = (data: any) => t.Object({
  success: t.Literal(true),
  ...data
})

const ErrorResponse = t.Object({
  success: t.Literal(false),
  error: t.String()
})

export const {recurso}Routes = new Elysia({ prefix: '/{recurso}s', tags: ['{Recurso}s'] })

  // LIST
  .get('/', () => {Recurso}Controller.getAll(), {
    detail: { summary: 'List {Recurso}s' },
    response: t.Object({
      success: t.Boolean(),
      {recurso}s: t.Array({Recurso}Schema),
      count: t.Number()
    })
  })

  // GET BY ID
  .get('/:id', async ({ params, set }) => {
    const result = await {Recurso}Controller.getById(Number(params.id))
    if (!result.success) set.status = 404
    return result
  }, {
    params: t.Object({ id: t.String() }),
    response: {
      200: t.Object({ success: t.Literal(true), {recurso}: {Recurso}Schema }),
      404: ErrorResponse
    }
  })

  // CREATE
  .post('/', async ({ body, set }) => {
    const result = await {Recurso}Controller.create(body)
    if (result.success) set.status = 201
    return result
  }, {
    body: Create{Recurso}Schema,
    response: {
      201: t.Object({ success: t.Literal(true), {recurso}: {Recurso}Schema }),
      400: ErrorResponse
    }
  })

  // UPDATE
  .put('/:id', async ({ params, body, set }) => {
    const result = await {Recurso}Controller.update(Number(params.id), body)
    if (!result.success) set.status = 404
    return result
  }, {
    params: t.Object({ id: t.String() }),
    body: Update{Recurso}Schema,
    response: {
      200: t.Object({ success: t.Literal(true), {recurso}: {Recurso}Schema }),
      404: ErrorResponse
    }
  })

  // DELETE
  .delete('/:id', async ({ params, set }) => {
    const result = await {Recurso}Controller.delete(Number(params.id))
    if (!result.success) set.status = 404
    return result
  }, {
    params: t.Object({ id: t.String() }),
    response: {
      200: t.Object({ success: t.Literal(true), message: t.String() }),
      404: ErrorResponse
    }
  })
```

### Template: Controller Padrao

```typescript
// app/server/controllers/{recurso}.controller.ts
interface {Recurso} {
  id: number
  name: string
  createdAt: string
}

export class {Recurso}Controller {
  private static items: {Recurso}[] = []
  private static nextId = 1

  static async getAll() {
    return {
      success: true as const,
      {recurso}s: this.items,
      count: this.items.length
    }
  }

  static async getById(id: number) {
    const item = this.items.find(i => i.id === id)
    if (!item) return { success: false as const, error: '{Recurso} not found' }
    return { success: true as const, {recurso}: item }
  }

  static async create(data: Omit<{Recurso}, 'id' | 'createdAt'>) {
    const item: {Recurso} = {
      id: this.nextId++,
      ...data,
      createdAt: new Date().toISOString()
    }
    this.items.push(item)
    return { success: true as const, {recurso}: item }
  }

  static async update(id: number, data: Partial<Omit<{Recurso}, 'id' | 'createdAt'>>) {
    const index = this.items.findIndex(i => i.id === id)
    if (index === -1) return { success: false as const, error: '{Recurso} not found' }
    this.items[index] = { ...this.items[index], ...data }
    return { success: true as const, {recurso}: this.items[index] }
  }

  static async delete(id: number) {
    const index = this.items.findIndex(i => i.id === id)
    if (index === -1) return { success: false as const, error: '{Recurso} not found' }
    this.items.splice(index, 1)
    return { success: true as const, message: '{Recurso} deleted' }
  }
}
```

### Template: Teste Unitario

```typescript
// tests/unit/{recurso}.test.ts
import { describe, it, expect, beforeEach } from 'vitest'
import { {Recurso}Controller } from '@app/server/controllers/{recurso}.controller'

describe('{Recurso}Controller', () => {
  beforeEach(() => {
    // Reset do estado para cada teste
  })

  describe('create', () => {
    it('deve criar um {recurso} com sucesso', async () => {
      const result = await {Recurso}Controller.create({ name: 'Test' })
      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.{recurso}.name).toBe('Test')
        expect(result.{recurso}.id).toBeDefined()
      }
    })
  })

  describe('getById', () => {
    it('deve retornar erro para id inexistente', async () => {
      const result = await {Recurso}Controller.getById(999)
      expect(result.success).toBe(false)
    })
  })
})
```

---

## Aliases de Import

Sempre use aliases em vez de caminhos relativos profundos:

```typescript
// Aliases disponiveis (tsconfig.json)
import { ... } from '@core/...'      // core/*
import { ... } from '@app/...'       // app/*
import { ... } from '@server/...'    // app/server/*
import { ... } from '@client/...'    // app/client/*
import { ... } from '@shared/...'    // app/shared/*
import { ... } from '@config'        // config/index.ts
import { ... } from '@config/...'    // config/*
```

---

## Comandos CLI Essenciais

```bash
# Desenvolvimento
bun run dev                  # Full-stack (backend 3000 + frontend 5173)
bun run dev --backend-only   # Somente backend
bun run dev --frontend-only  # Somente frontend

# Build
bun run build                # Build de producao
bun run start                # Executar build

# Testes
bun run test                 # Vitest
bun run typecheck            # tsc --noEmit

# Geradores
bun run flux g controller NomeController
bun run flux g route nome-rota
bun run flux g component NomeComponente
bun run flux g service NomeService
bun run flux g plugin nome-plugin

# Plugins
bun run flux plugin:add nome-plugin    # Instalar com auditoria
bun run flux plugin:list               # Listar plugins
bun run flux plugin:remove nome-plugin # Remover plugin
```

---

## Regras Criticas

### NUNCA faca

1. **Modificar `core/`** - Framework e read-only. Use plugins, app ou config
2. **Envolver Eden Treaty em wrappers** - Quebra type inference
3. **Omitir response schemas** - Eden Treaty perde a tipagem no frontend
4. **Usar `process.env` diretamente** - Use o sistema de config declarativo
5. **Colocar logica de negocio em rotas** - Use controllers/services
6. **Habilitar NPM discovery sem whitelist** - Risco de supply chain attack
7. **Criar tipos manuais para respostas de API** - Eden Treaty infere automaticamente
8. **Usar imports relativos profundos** - Use path aliases (@server, @client, etc.)
9. **Armazenar dados nao-serializaveis no state de Live Components**
10. **Exportar `defaultState` separado** - Use `static defaultState` dentro da classe

### SEMPRE faca

1. **Trabalhar em `app/`** para codigo da aplicacao
2. **Definir response schema** em toda rota (`t.Object()`)
3. **Separar rotas e controllers** - Rotas lidam com HTTP, controllers com logica
4. **Usar `as const`** em schemas e respostas para preservar tipos literais
5. **Definir `static componentName`** em todo Live Component
6. **Definir `static defaultState`** dentro da classe do Live Component
7. **Usar `declare`** para propriedades de state (TypeScript hint)
8. **Adicionar client link** nos Live Components server-side
9. **Validar input** com schemas `t.Object()` do Elysia
10. **Retornar `{ success, data?, error? }`** como padrao de resposta

---

## Diagnostico de Problemas

### Arvore de Decisao

```
Problema com tipos no frontend?
├── Response schema definido na rota?
│   ├── NAO → Adicionar response: t.Object({...})
│   └── SIM → Eden Treaty importado corretamente?
│       ├── NAO → import { api } from '@/lib/eden-api'
│       └── SIM → Verificar app.ts exporta o tipo da app

"bun: command not found"?
└── Instalar: curl -fsSL https://bun.sh/install | bash

Erro de CORS?
└── Verificar config/server.config.ts → cors.origins

Live Component nao sincroniza?
├── $connected e true?
│   ├── NAO → Verificar WebSocket URL e LiveComponentsProvider
│   └── SIM → componentName definido corretamente?
│       ├── NAO → Adicionar static componentName = 'NomeClasse'
│       └── SIM → State e serializavel (sem functions, Date, etc.)?

Plugin nao carrega?
├── E plugin NPM?
│   ├── SIM → PLUGINS_DISCOVER_NPM=true e PLUGINS_ALLOWED configurado?
│   └── NAO → Esta em plugins/ com export default?
└── Verificar logs de seguranca no console

Config nao carrega?
├── Arquivo .env existe?
├── Variavel de ambiente esta correta?
└── Schema usa 'as const' no final?

Build falha?
├── bunx tsc --noEmit → Erros de TypeScript?
├── Imports circulares?
└── Dependencia faltando? → bun install
```

---

## Contexto para Decisoes

### Quando usar Live Components vs REST API

| Cenario | Usar |
|---------|------|
| CRUD simples | REST API (routes + controllers) |
| Dados que atualizam em tempo real | Live Components |
| Chat, colaboracao | Live Components + Rooms |
| Dashboard com metricas ao vivo | Live Components |
| Formularios com validacao | Live Components ($field) |
| Upload de arquivos | Live Upload (chunked WebSocket) |
| API publica/integracao | REST API |
| Webhook/bot externo | REST API + Room HTTP API |

### Quando usar setState vs acesso direto

```typescript
// 1 propriedade → acesso direto (1 STATE_DELTA)
this.count++

// Multiplas propriedades → setState (1 STATE_DELTA total)
this.setState({ count: newCount, lastUpdated: now })

// State anterior necessario → setState com funcao
this.setState(prev => ({ count: prev.count + 1 }))
```

### Organizacao de pastas por complexidade

**App simples:**
```
app/server/
├── controllers/   # Logica de negocio
└── routes/        # Endpoints HTTP
```

**App complexa:**
```
app/server/
├── controllers/   # Orquestram services
├── services/      # Logica de negocio complexa
├── repositories/  # Acesso a dados
├── routes/        # Endpoints HTTP
└── live/          # Componentes real-time
```

---

## Checklist de Qualidade

Antes de finalizar qualquer implementacao, verificar:

- [ ] Todas as rotas tem `response` schema definido
- [ ] Controllers retornam `{ success: true/false, ... }`
- [ ] Tipos usam `as const` onde necessario
- [ ] Nenhum arquivo em `core/` foi modificado
- [ ] Path aliases usados (sem `../../../`)
- [ ] Live Components tem `static componentName` e `static defaultState`
- [ ] `declare` usado para propriedades de state
- [ ] Erros tratados com classes de erro do framework
- [ ] `bun run dev` funciona apos as mudancas
- [ ] `bunx tsc --noEmit` passa sem erros

---

## Documentacao Complementar

Para detalhes especificos, consultar:

- **[INDEX.md](./INDEX.md)** - Hub de navegacao
- **[Routes & Eden Treaty](./resources/routes-eden.md)** - APIs type-safe
- **[Controllers](./resources/controllers.md)** - Logica de negocio
- **[Live Components](./resources/live-components.md)** - WebSocket real-time
- **[Live Rooms](./resources/live-rooms.md)** - Multi-usuario
- **[Live Auth](./resources/live-auth.md)** - Autenticacao em componentes
- **[REST Auth](./resources/rest-auth.md)** - Autenticacao REST
- **[Config System](./config/declarative-system.md)** - Configuracao declarativa
- **[Anti-Patterns](./patterns/anti-patterns.md)** - O que NAO fazer
- **[CLI Commands](./reference/cli-commands.md)** - Todos os comandos
- **[Plugin Hooks](./reference/plugin-hooks.md)** - Hooks disponiveis
- **[Troubleshooting](./reference/troubleshooting.md)** - Problemas comuns
