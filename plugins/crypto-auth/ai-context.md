# 🔐 Crypto Auth Plugin - AI Context Documentation

> **Plugin de Autenticação Criptográfica FluxStack**
> Sistema de autenticação **STATELESS** baseado em assinaturas Ed25519

---

## 📖 Índice Rápido

1. [Overview e Conceitos](#overview-e-conceitos)
2. [Arquitetura do Sistema](#arquitetura-do-sistema)
3. [Fluxo de Autenticação](#fluxo-de-autenticação)
4. [Componentes Principais](#componentes-principais)
5. [Padrões e Boas Práticas](#padrões-e-boas-práticas)
6. [Troubleshooting](#troubleshooting)
7. [Exemplos de Uso](#exemplos-de-uso)
8. [Segurança](#segurança)
9. [Testes](#testes)

---

## 🎯 Overview e Conceitos

### O que é este plugin?

Sistema de autenticação **SEM SESSÕES** que usa criptografia Ed25519 para validar requisições.

### Conceitos-chave

**🚫 NÃO HÁ SESSÕES NO SERVIDOR**
- Servidor NÃO armazena estado de autenticação
- Cada requisição é validada independentemente
- Chave pública identifica o usuário

**🔑 Par de Chaves Ed25519**
- **Chave Privada**: NUNCA sai do navegador, armazenada em localStorage
- **Chave Pública**: Enviada em cada requisição, identifica o usuário

**✍️ Assinatura Digital**
- Cliente assina cada requisição com chave privada
- Servidor valida assinatura usando chave pública recebida
- Assinatura inclui: `publicKey:timestamp:nonce:message`

**🛡️ Proteções**
- **Replay Attack**: Nonces únicos impedem reutilização de assinaturas
- **Time Drift**: Timestamps impedem requisições muito antigas (5 min)
- **Man-in-the-Middle**: Assinaturas são únicas por requisição

---

## 🏗️ Arquitetura do Sistema

### Estrutura de Arquivos

```
plugins/crypto-auth/
├── index.ts                    # Plugin principal e hooks
├── ai-context.md              # Esta documentação
├── server/
│   ├── index.ts               # Exports do servidor
│   ├── CryptoAuthService.ts   # Validação de assinaturas
│   └── AuthMiddleware.ts      # Middleware de autenticação
├── client/
│   ├── index.ts               # Exports do cliente
│   ├── CryptoAuthClient.ts    # Cliente de autenticação
│   └── components/
│       └── AuthProvider.tsx   # React Context Provider
└── README.md                  # Documentação do usuário
```

### Fluxo de Dados

```
┌─────────────────────────────────────────────────────────────┐
│                         CLIENTE                             │
├─────────────────────────────────────────────────────────────┤
│ 1. Gera par de chaves Ed25519 (local)                      │
│    privateKey → NUNCA enviada                               │
│    publicKey  → Enviada em cada request                     │
│                                                              │
│ 2. Para cada requisição:                                    │
│    - timestamp = Date.now()                                 │
│    - nonce = crypto.randomBytes(16)                         │
│    - message = "GET:/api/users"                             │
│    - fullMessage = publicKey:timestamp:nonce:message        │
│    - signature = sign(fullMessage, privateKey)              │
│                                                              │
│ 3. Headers enviados:                                        │
│    x-public-key: <publicKey>                                │
│    x-timestamp: <timestamp>                                 │
│    x-nonce: <nonce>                                         │
│    x-signature: <signature>                                 │
└─────────────────────────────────────────────────────────────┘
                            ↓
┌─────────────────────────────────────────────────────────────┐
│                       SERVIDOR                              │
├─────────────────────────────────────────────────────────────┤
│ 1. Plugin Hook onRequest                                    │
│    - AuthMiddleware.authenticate(context)                   │
│                                                              │
│ 2. AuthMiddleware                                           │
│    - Extrai headers (public-key, timestamp, nonce, sig)     │
│    - Chama CryptoAuthService.validateRequest()              │
│                                                              │
│ 3. CryptoAuthService.validateRequest()                      │
│    ✓ Valida formato da chave pública                        │
│    ✓ Verifica time drift (< 5 min)                          │
│    ✓ Verifica se nonce já foi usado                         │
│    ✓ Reconstrói mensagem: publicKey:timestamp:nonce:message │
│    ✓ Verifica assinatura: verify(signature, message, publicKey) │
│    ✓ Marca nonce como usado                                 │
│    ✓ Retorna user: { publicKey, isAdmin, permissions }     │
│                                                              │
│ 4. Se válido:                                               │
│    - context.request.user = user                            │
│    - Processa rota normalmente                              │
│                                                              │
│ 5. Se inválido:                                             │
│    - context.handled = true                                 │
│    - context.response = 401 Unauthorized                    │
│    - Rota NÃO é executada                                   │
└─────────────────────────────────────────────────────────────┘
```

---

## 🔄 Fluxo de Autenticação

### 1. Inicialização do Cliente

```typescript
// Cliente inicializa automaticamente ou manualmente
const client = new CryptoAuthClient({
  autoInit: true,           // Gera chaves automaticamente
  storage: 'localStorage'   // Onde armazenar chaves
})

// Se autoInit: true
//   → Verifica se já existem chaves no localStorage
//   → Se sim: carrega chaves existentes
//   → Se não: gera novo par de chaves

// Chaves armazenadas em: localStorage['fluxstack_crypto_keys']
// Formato: { publicKey, privateKey, createdAt }
```

### 2. Requisição Assinada

```typescript
// Método automático (recomendado)
const response = await client.fetch('/api/users')

// O que acontece internamente:
// 1. timestamp = Date.now()
// 2. nonce = generateNonce() // 16 bytes aleatórios
// 3. message = buildMessage('GET', '/api/users', null)
//    → "GET:/api/users"
// 4. fullMessage = `${publicKey}:${timestamp}:${nonce}:${message}`
// 5. messageHash = sha256(fullMessage)
// 6. signature = ed25519.sign(messageHash, privateKey)
// 7. Headers adicionados automaticamente
```

### 3. Validação no Servidor

```typescript
// Plugin Hook onRequest (automático)
onRequest: async (context) => {
  const authResult = await authMiddleware.authenticate(context)

  if (authResult.success) {
    // ✅ Usuário autenticado
    context.request.user = authResult.user
    // Rota é executada normalmente
  } else if (authResult.required) {
    // ❌ Falha na autenticação
    context.handled = true
    context.response = new Response(JSON.stringify({
      success: false,
      error: authResult.error
    }), { status: 401 })
    // Rota NÃO é executada
  }
}
```

### 4. Acesso nas Rotas

```typescript
// Rotas protegidas podem acessar user
.get('/api/users', ({ request }) => {
  const user = (request as any).user

  return {
    user: {
      publicKey: user.publicKey,
      isAdmin: user.isAdmin,
      permissions: user.permissions
    }
  }
})
```

---

## 🧩 Componentes Principais

### 1. CryptoAuthService (Backend)

**Localização**: `plugins/crypto-auth/server/CryptoAuthService.ts`

**Responsabilidades**:
- Validar assinaturas Ed25519
- Gerenciar nonces (prevenir replay attacks)
- Verificar drift de tempo
- Identificar usuários admin

**Métodos Principais**:

```typescript
class CryptoAuthService {
  // Validar uma requisição assinada
  async validateRequest(data: {
    publicKey: string
    timestamp: number
    nonce: string
    signature: string
    message?: string
  }): Promise<AuthResult>

  // Verificar se chave pública é válida (64 hex chars)
  private isValidPublicKey(publicKey: string): boolean

  // Limpar nonces antigos (executado a cada 5 min)
  private cleanupOldNonces(): void

  // Retornar estatísticas
  getStats(): { usedNonces: number; adminKeys: number }
}
```

**Estado Interno**:
```typescript
private usedNonces: Map<string, number>  // `${publicKey}:${nonce}` → timestamp
```

**Importante**:
- `usedNonces` é limpo automaticamente a cada 5 minutos
- Nonces mais antigos que `maxTimeDrift * 2` são removidos
- NÃO HÁ armazenamento de sessões!

---

### 2. AuthMiddleware (Backend)

**Localização**: `plugins/crypto-auth/server/AuthMiddleware.ts`

**Responsabilidades**:
- Verificar se rota requer autenticação
- Extrair headers de autenticação
- Chamar CryptoAuthService para validar
- Decidir se permite acesso

**Métodos Principais**:

```typescript
class AuthMiddleware {
  // Autenticar uma requisição
  async authenticate(context: RequestContext): Promise<{
    success: boolean
    required: boolean  // Se autenticação é obrigatória
    error?: string
    user?: User
  }>

  // Verificar se rota está protegida
  private isProtectedRoute(path: string): boolean

  // Verificar se rota é pública
  private isPublicRoute(path: string): boolean

  // Extrair headers de auth
  private extractAuthHeaders(headers): AuthHeaders | null

  // Construir mensagem para validação
  private buildMessage(context: RequestContext): string
}
```

**Lógica de Decisão**:
```typescript
// 1. Se rota pública → success: true, required: false
// 2. Se rota protegida sem headers → success: false, required: true
// 3. Se rota protegida com headers → valida assinatura
//    - Se válida → success: true, required: true, user: {...}
//    - Se inválida → success: false, required: true, error: "..."
```

---

### 3. CryptoAuthClient (Frontend)

**Localização**: `plugins/crypto-auth/client/CryptoAuthClient.ts`

**Responsabilidades**:
- Gerar e gerenciar par de chaves
- Assinar requisições automaticamente
- Armazenar chaves em localStorage

**Métodos Públicos**:

```typescript
class CryptoAuthClient {
  // Inicializar (gerar ou carregar chaves)
  initialize(): KeyPair

  // Criar novo par de chaves
  createNewKeys(): KeyPair

  // Fazer requisição autenticada
  async fetch(url: string, options?: RequestInit): Promise<Response>

  // Obter chaves atuais
  getKeys(): KeyPair | null

  // Verificar se está inicializado
  isInitialized(): boolean

  // Limpar chaves (logout)
  clearKeys(): void
}
```

**Métodos Privados**:

```typescript
// Assinar mensagem
private signMessage(message: string, timestamp: number, nonce: string): string

// Construir mensagem para assinar
private buildMessage(method: string, url: string, body?: any): string

// Gerar nonce aleatório
private generateNonce(): string

// Carregar chaves do storage
private loadKeys(): KeyPair | null

// Salvar chaves no storage
private saveKeys(keys: KeyPair): void
```

**Formato de Mensagem**:
```typescript
// Para GET /api/users
message = "GET:/api/users"

// Para POST /api/users com body
message = "POST:/api/users:{\"name\":\"João\"}"

// Mensagem completa assinada
fullMessage = `${publicKey}:${timestamp}:${nonce}:${message}`
```

---

### 4. AuthProvider (React Component)

**Localização**: `plugins/crypto-auth/client/components/AuthProvider.tsx`

**Responsabilidades**:
- Prover contexto de autenticação via React Context
- Gerenciar estado de chaves
- Callbacks para eventos (onKeysChange, onError)

**Interface**:

```typescript
export interface AuthContextValue {
  client: CryptoAuthClient
  keys: KeyPair | null
  hasKeys: boolean
  isLoading: boolean
  error: string | null
  createKeys: () => void
  clearKeys: () => void
}

// Hook para usar o contexto
export const useAuth = (): AuthContextValue
```

**Uso**:

```tsx
// Wrapper da aplicação
<AuthProvider
  config={{ storage: 'localStorage' }}
  onKeysChange={(hasKeys, keys) => console.log('Keys changed')}
  onError={(error) => console.error(error)}
>
  <App />
</AuthProvider>

// Dentro de componentes
function MyComponent() {
  const { keys, hasKeys, createKeys, clearKeys } = useAuth()

  if (!hasKeys) {
    return <button onClick={createKeys}>Login</button>
  }

  return <button onClick={clearKeys}>Logout</button>
}
```

---

### 5. Plugin Principal (index.ts)

**Localização**: `plugins/crypto-auth/index.ts`

**Responsabilidades**:
- Definir schema de configuração
- Hooks do plugin (setup, onRequest, onResponse, onServerStart)
- Rotas de informação (/api/auth/info)

**Configuração**:

```typescript
defaultConfig: {
  enabled: true,
  maxTimeDrift: 300000,  // 5 minutos em ms
  adminKeys: [],         // Array de chaves públicas admin
  protectedRoutes: [
    "/api/admin/*",
    "/api/crypto-auth/protected",
    "/api/crypto-auth/admin"
  ],
  publicRoutes: [
    "/api/crypto-auth/public",
    "/api/health",
    "/api/docs",
    "/swagger"
  ],
  enableMetrics: true
}
```

**Hooks**:

```typescript
// 1. setup - Inicialização
setup: async (context) => {
  const authService = new CryptoAuthService(...)
  const authMiddleware = new AuthMiddleware(...)

  // Armazenar no global para acesso nos hooks
  (global as any).cryptoAuthService = authService
  (global as any).cryptoAuthMiddleware = authMiddleware
}

// 2. onRequest - Validar cada requisição
onRequest: async (context) => {
  const authResult = await authMiddleware.authenticate(context)

  if (authResult.success) {
    context.request.user = authResult.user  // ✅
  } else if (authResult.required) {
    context.handled = true                  // ❌
    context.response = new Response(...)
  }
}

// 3. onResponse - Métricas (opcional)
onResponse: async (context) => {
  // Log de requisições autenticadas
}

// 4. onServerStart - Log de status
onServerStart: async (context) => {
  logger.info("Crypto Auth plugin ativo")
}
```

---

## 📋 Padrões e Boas Práticas

### ✅ Sempre Fazer

1. **Usar cliente nativo para requisições protegidas**
```typescript
// ✅ Correto
const response = await authClient.fetch('/api/protected')

// ❌ Errado - não inclui assinatura
const response = await fetch('/api/protected')
```

2. **Verificar se usuário está autenticado nas rotas**
```typescript
// ✅ Correto
.get('/api/users', ({ request }) => {
  const user = (request as any).user
  if (!user) {
    return { error: 'Unauthorized' }
  }
  // ...
})
```

3. **Adicionar novas rotas protegidas na config**
```typescript
// config/app.config.ts
plugins: {
  config: {
    'crypto-auth': {
      protectedRoutes: [
        "/api/admin/*",
        "/api/crypto-auth/protected",
        "/api/users/*"  // ✅ Nova rota
      ]
    }
  }
}
```

4. **Tratar erros de autenticação no frontend**
```typescript
try {
  const response = await authClient.fetch('/api/protected')
  if (response.status === 401) {
    // Chaves inválidas, criar novas
    authClient.clearKeys()
    authClient.createNewKeys()
  }
} catch (error) {
  console.error('Auth error:', error)
}
```

5. **Verificar permissões de admin quando necessário**
```typescript
.get('/api/admin/users', ({ request, set }) => {
  const user = (request as any).user

  if (!user?.isAdmin) {
    set.status = 403
    return { error: 'Admin access required' }
  }

  // Lógica admin
})
```

---

### ❌ Nunca Fazer

1. **NÃO enviar chave privada ao servidor**
```typescript
// ❌ NUNCA FAZER ISSO!
await fetch('/api/register', {
  body: JSON.stringify({
    privateKey: keys.privateKey  // PERIGO!
  })
})
```

2. **NÃO armazenar sessões no servidor**
```typescript
// ❌ Viola arquitetura stateless
const sessions = new Map()
sessions.set(publicKey, userData)
```

3. **NÃO confiar apenas na chave pública**
```typescript
// ❌ Permite spoofing
.get('/api/users', ({ headers }) => {
  const publicKey = headers['x-public-key']
  // FALTA: validar assinatura!
})

// ✅ Correto - middleware já validou
.get('/api/users', ({ request }) => {
  const user = (request as any).user  // Validado!
})
```

4. **NÃO permitir timestamp muito antigo/futuro**
```typescript
// ❌ Vulnerável a replay attack
const maxTimeDrift = 24 * 60 * 60 * 1000  // 24 horas - MUITO!

// ✅ Correto
const maxTimeDrift = 5 * 60 * 1000  // 5 minutos
```

5. **NÃO reutilizar nonces**
```typescript
// ❌ Cliente NÃO deve fazer isso
const nonce = "fixed-nonce"  // Sempre igual!

// ✅ Correto
const nonce = generateNonce()  // Aleatório sempre
```

---

## 🔧 Troubleshooting

### Problema 1: "Assinatura inválida"

**Sintomas**: Requisições retornam 401 com erro "Assinatura inválida"

**Causas Possíveis**:
1. Chaves públicas/privadas não correspondem
2. Mensagem construída incorretamente
3. Timestamp/nonce diferentes no cliente e servidor
4. Corpo da requisição não incluído na assinatura

**Debug**:
```typescript
// No cliente - log mensagem assinada
const fullMessage = `${publicKey}:${timestamp}:${nonce}:${message}`
console.log('Client message:', fullMessage)
console.log('Signature:', signature)

// No servidor - log mensagem reconstruída
const messageToVerify = `${publicKey}:${timestamp}:${nonce}:${message}`
console.log('Server message:', messageToVerify)
```

**Solução**:
- Verificar se cliente e servidor constroem mensagem idêntica
- Confirmar que timestamp e nonce estão sendo enviados corretamente
- Para POST/PUT, verificar se body está sendo incluído na mensagem

---

### Problema 2: "Nonce já utilizado"

**Sintomas**: Segunda requisição idêntica retorna 401

**Causa**: Replay attack protection funcionando (comportamento esperado!)

**Quando é bug**:
- Se acontece com requisições DIFERENTES
- Se nonce não está sendo gerado aleatoriamente

**Debug**:
```typescript
// Verificar geração de nonce
console.log('Nonce 1:', generateNonce())
console.log('Nonce 2:', generateNonce())
// Devem ser SEMPRE diferentes!
```

**Solução**:
- Se está testando manualmente, gerar novo nonce a cada tentativa
- Verificar que `crypto.randomBytes()` está funcionando

---

### Problema 3: "Timestamp inválido ou expirado"

**Sintomas**: Requisições retornam 401 com erro de timestamp

**Causas Possíveis**:
1. Relógio do cliente desincronizado
2. Requisição demorou muito para chegar ao servidor
3. `maxTimeDrift` configurado muito curto

**Debug**:
```typescript
const clientTime = Date.now()
const serverTime = Date.now()  // No servidor
const drift = Math.abs(serverTime - clientTime)
console.log('Time drift:', drift, 'ms')
console.log('Max allowed:', maxTimeDrift, 'ms')
```

**Solução**:
- Sincronizar relógio do sistema
- Aumentar `maxTimeDrift` se necessário (mas não muito!)
- Verificar latência de rede

---

### Problema 4: "User undefined nas rotas"

**Sintomas**: `request.user` é `undefined` mesmo com autenticação válida

**Causa**: User não está sendo propagado corretamente do middleware

**Debug**:
```typescript
// No plugin index.ts - verificar hook onRequest
if (authResult.success && authResult.user) {
  context.request.user = authResult.user  // ✅ Deve estar aqui
  console.log('User set:', authResult.user)
}

// Na rota
console.log('User received:', (request as any).user)
```

**Solução**:
- Verificar que `context.request.user` está sendo definido no hook
- Confirmar que middleware está retornando `user` no authResult

---

### Problema 5: Rotas públicas retornando 401

**Sintomas**: Rotas que deveriam ser públicas exigem autenticação

**Causa**: Rota não está na lista de `publicRoutes`

**Debug**:
```typescript
// Verificar configuração
console.log('Public routes:', config.publicRoutes)
console.log('Request path:', context.path)
console.log('Is public?:', isPublicRoute(context.path))
```

**Solução**:
```typescript
// config/app.config.ts
plugins: {
  config: {
    'crypto-auth': {
      publicRoutes: [
        "/api/health",
        "/api/docs",
        "/api/crypto-auth/public",  // Adicionar rota
        "/swagger"
      ]
    }
  }
}
```

---

## 💡 Exemplos de Uso

### Exemplo 1: Requisição Simples

```typescript
// Cliente
import { CryptoAuthClient } from '@/plugins/crypto-auth/client'

const client = new CryptoAuthClient({ autoInit: true })

// Fazer requisição protegida
const response = await client.fetch('/api/users')
const data = await response.json()

console.log('Users:', data)
```

```typescript
// Servidor - Rota
.get('/api/users', ({ request }) => {
  const user = (request as any).user

  return {
    success: true,
    user: {
      publicKey: user.publicKey,
      isAdmin: user.isAdmin
    },
    users: [/* ... */]
  }
})
```

---

### Exemplo 2: Requisição POST com Body

```typescript
// Cliente
const newUser = { name: 'João', email: 'joao@test.com' }

const response = await client.fetch('/api/users', {
  method: 'POST',
  body: JSON.stringify(newUser)
})

const data = await response.json()
```

```typescript
// Servidor
.post('/api/users', async ({ request, body }) => {
  const user = (request as any).user

  // Body é assinado automaticamente
  const newUser = await createUser(body)

  return {
    success: true,
    user: newUser,
    authenticatedBy: user.publicKey
  }
})
```

---

### Exemplo 3: Rota Admin

```typescript
// Cliente
const response = await client.fetch('/api/admin/stats')

if (response.status === 403) {
  console.error('Você não é admin!')
}
```

```typescript
// Servidor
.get('/api/admin/stats', ({ request, set }) => {
  const user = (request as any).user

  // Verificar permissões
  if (!user?.isAdmin) {
    set.status = 403
    return {
      success: false,
      error: 'Admin access required',
      yourPermissions: user?.permissions || []
    }
  }

  return {
    success: true,
    stats: {
      totalUsers: 100,
      activeUsers: 50
    }
  }
})
```

---

### Exemplo 4: React Component com AuthProvider

```tsx
import { useAuth } from '@/plugins/crypto-auth/client'

function LoginButton() {
  const { keys, hasKeys, isLoading, createKeys, clearKeys } = useAuth()

  if (isLoading) {
    return <div>Carregando...</div>
  }

  if (!hasKeys) {
    return (
      <button onClick={createKeys}>
        Gerar Chaves de Autenticação
      </button>
    )
  }

  return (
    <div>
      <p>Autenticado: {keys.publicKey.substring(0, 16)}...</p>
      <button onClick={clearKeys}>Logout</button>
    </div>
  )
}

function ProtectedData() {
  const { client, hasKeys } = useAuth()
  const [data, setData] = useState(null)

  useEffect(() => {
    if (hasKeys) {
      client.fetch('/api/protected')
        .then(r => r.json())
        .then(setData)
    }
  }, [hasKeys])

  return <pre>{JSON.stringify(data, null, 2)}</pre>
}
```

---

### Exemplo 5: Adicionar Chave Admin

```typescript
// 1. Gerar chave pública de um usuário admin
const adminClient = new CryptoAuthClient()
const adminKeys = adminClient.createNewKeys()
console.log('Admin Public Key:', adminKeys.publicKey)

// 2. Adicionar na configuração
// config/app.config.ts
plugins: {
  config: {
    'crypto-auth': {
      adminKeys: [
        "7443b54b3c8e2f1a9d5c6e4b2f8a1d3c9e5b7a2f4d8c1e6b3a9d5c7e2f4b8a1d"
      ]
    }
  }
}

// 3. Usuário com essa chave pública terá isAdmin: true
const response = await adminClient.fetch('/api/admin/users')
// ✅ Acesso permitido
```

---

## 🔒 Segurança

### Princípios de Segurança

1. **Zero Trust**
   - Servidor NUNCA confia apenas na chave pública
   - SEMPRE valida assinatura antes de processar requisição

2. **Defesa em Profundidade**
   - Validação de formato de chave
   - Verificação de timestamp
   - Proteção contra replay (nonces)
   - Assinatura criptográfica

3. **Least Privilege**
   - Usuários normais: apenas `read` permission
   - Admins: `admin`, `read`, `write`, `delete`

---

### Vetores de Ataque e Mitigações

#### 1. Man-in-the-Middle (MITM)

**Ataque**: Interceptar e modificar requisição

**Mitigação**:
- ✅ Assinatura detecta qualquer modificação
- ✅ HTTPS obrigatório em produção
- ✅ Chave privada nunca transmitida

```typescript
// Atacante modifica mensagem
Original: "GET:/api/users"
Modificado: "GET:/api/admin/users"

// Assinatura não corresponde → 401 Unauthorized
```

---

#### 2. Replay Attack

**Ataque**: Reutilizar requisição válida capturada

**Mitigação**:
- ✅ Nonces únicos por requisição
- ✅ Timestamp expira em 5 minutos
- ✅ Nonces armazenados até expiração

```typescript
// Atacante captura requisição válida
Request 1: nonce = "abc123" → ✅ 200 OK

// Tenta reutilizar
Request 2: nonce = "abc123" → ❌ 401 "Nonce já utilizado"
```

---

#### 3. Brute Force de Chave Privada

**Ataque**: Tentar adivinhar chave privada

**Mitigação**:
- ✅ Ed25519 com 256 bits de segurança
- ✅ 2^256 combinações possíveis
- ✅ Computacionalmente inviável

---

#### 4. Key Theft (Roubo de Chave)

**Ataque**: Acessar localStorage e roubar chave privada

**Mitigação**:
- ⚠️ Se atacante tem acesso ao localStorage, chave está comprometida
- ✅ Usar sempre HTTPS
- ✅ Implementar Content Security Policy
- ✅ XSS protection (sanitize inputs)

**Procedimento de Resposta**:
```typescript
// 1. Usuário reporta suspeita de roubo
// 2. Gerar novas chaves
client.clearKeys()
client.createNewKeys()

// 3. Revogar chave antiga (se houver blacklist)
// 4. Notificar usuário
```

---

#### 5. Time Manipulation

**Ataque**: Modificar relógio do sistema

**Mitigação**:
- ✅ `maxTimeDrift` limita divergência a 5 minutos
- ✅ Servidor usa seu próprio timestamp como referência

```typescript
// Cliente com relógio 1 hora no futuro
clientTime: 2025-01-01 14:00:00
serverTime: 2025-01-01 13:00:00

drift = 3600000ms > maxTimeDrift (300000ms)
→ 401 "Timestamp inválido ou expirado"
```

---

### Boas Práticas de Segurança

1. **Sempre usar HTTPS em produção**
```typescript
// config/server.config.ts
if (process.env.NODE_ENV === 'production') {
  config.enforceHTTPS = true
}
```

2. **Rotacionar chaves periodicamente**
```typescript
// A cada 30 dias, sugerir nova chave
const keyAge = Date.now() - keys.createdAt.getTime()
if (keyAge > 30 * 24 * 60 * 60 * 1000) {
  showRotateKeyDialog()
}
```

3. **Rate limiting em rotas sensíveis**
```typescript
// Limitar tentativas de autenticação
const rateLimit = new Map()

.post('/api/auth/verify', ({ headers }) => {
  const publicKey = headers['x-public-key']
  const attempts = rateLimit.get(publicKey) || 0

  if (attempts > 10) {
    return { error: 'Too many attempts' }
  }

  rateLimit.set(publicKey, attempts + 1)
})
```

4. **Logging de eventos de segurança**
```typescript
// Log failed auth attempts
if (!authResult.success) {
  logger.warn('Failed authentication', {
    publicKey: publicKey.substring(0, 8) + '...',
    error: authResult.error,
    ip: context.headers['x-forwarded-for'],
    timestamp: new Date()
  })
}
```

---

## 🧪 Testes

### Teste Automatizado

```bash
# Executar script de teste
bun run test-crypto-auth.ts
```

**Saída Esperada**:
```
🔐 Testando Autenticação Criptográfica Ed25519

1️⃣ Gerando par de chaves Ed25519...
   ✅ Chave pública: 7443b54b...
   ✅ Chave privada: ******** (NUNCA enviar ao servidor!)

2️⃣ Preparando requisição assinada...
   ✅ Mensagem construída

3️⃣ Assinando mensagem com chave privada...
   ✅ Assinatura: e29d2819...

4️⃣ Enviando requisição ao servidor...
   📡 Status: 200
   ✅ SUCESSO! Assinatura validada

5️⃣ Testando proteção contra replay attack...
   📡 Replay Status: 401
   ✅ Proteção funcionando! Replay attack bloqueado
```

---

### Teste Manual no Frontend

1. Abrir http://localhost:5173
2. Navegar para "Crypto Auth Demo"
3. Clicar em "Gerar Novo Par de Chaves"
4. Verificar chaves exibidas
5. Clicar em "GET /api/crypto-auth/public" → 200 OK
6. Clicar em "GET /api/crypto-auth/protected" → 200 OK com dados
7. Clicar em "Limpar Chaves"
8. Clicar em "GET /api/crypto-auth/protected" → 401 Unauthorized

---

### Teste de Casos Edge

```typescript
// Teste 1: Timestamp muito antigo
const oldTimestamp = Date.now() - (10 * 60 * 1000)  // 10 min atrás
// Esperado: 401 "Timestamp inválido"

// Teste 2: Chave pública inválida
const invalidKey = "not-a-hex-string"
// Esperado: 401 "Chave pública inválida"

// Teste 3: Assinatura incorreta
const wrongSignature = "0000000000000000000000000000000000000000"
// Esperado: 401 "Assinatura inválida"

// Teste 4: Nonce reutilizado
const sameNonce = "abc123"
// Request 1: 200 OK
// Request 2: 401 "Nonce já utilizado"

// Teste 5: Usuário não-admin tentando rota admin
// Esperado: 403 "Permissão negada"
```

---

## 🔍 Debug e Logging

### Ativar Logs Detalhados

```typescript
// config/app.config.ts
plugins: {
  config: {
    'crypto-auth': {
      enableMetrics: true,  // Ativa logs de métricas
      logLevel: 'debug'     // Nível de log
    }
  }
}
```

### Logs Úteis

```typescript
// Cliente
console.log('Keys:', client.getKeys())
console.log('Is initialized:', client.isInitialized())

// Middleware
logger.debug('Authenticating request', {
  path: context.path,
  method: context.method,
  hasAuthHeaders: !!authHeaders
})

// Service
logger.info('Request validated', {
  publicKey: publicKey.substring(0, 8) + '...',
  isAdmin,
  permissions
})
```

---

## 📚 Referências Técnicas

### Bibliotecas Utilizadas

- **@noble/curves**: Implementação Ed25519
- **@noble/hashes**: SHA256 e utilitários

### Algoritmos

- **Ed25519**: Curva elíptica para assinatura digital
- **SHA-256**: Hash da mensagem antes de assinar

### Padrões de Segurança

- **NIST FIPS 186-5**: Digital Signature Standard
- **RFC 8032**: Edwards-Curve Digital Signature Algorithm (EdDSA)

---

## 🚀 Próximos Passos / Melhorias Futuras

### Funcionalidades Planejadas

1. **Key Rotation Automática**
   - Sugerir rotação de chaves antigas
   - Transição suave entre chaves

2. **Blacklist de Chaves**
   - Revogar chaves comprometidas
   - Armazenamento distribuído de revogações

3. **Multi-Device Support**
   - Mesmo usuário, múltiplas chaves
   - Sincronização de permissões

4. **Audit Log**
   - Histórico de autenticações
   - Análise de padrões suspeitos

5. **2FA Opcional**
   - Adicionar segundo fator além da assinatura
   - TOTP ou WebAuthn

---

## ✅ Checklist de Manutenção

Ao modificar este plugin, verificar:

- [ ] Testes automatizados passam (`bun run test-crypto-auth.ts`)
- [ ] Frontend funciona (http://localhost:5173 → Crypto Auth Demo)
- [ ] Replay attack protection ativo
- [ ] Timestamp validation funcionando
- [ ] User context propagado corretamente
- [ ] Rotas públicas acessíveis sem auth
- [ ] Rotas protegidas exigem autenticação
- [ ] Rotas admin verificam `isAdmin`
- [ ] Nonces sendo limpos periodicamente
- [ ] Logs de segurança sendo gerados
- [ ] Documentação atualizada (este arquivo!)

---

## 📞 Suporte

**Logs importantes**: `plugins/crypto-auth/server/*.ts`
**Testes**: `test-crypto-auth.ts`
**Exemplos**: `app/client/src/pages/CryptoAuthPage.tsx`

**Arquivos críticos** (não modificar sem entender):
- `CryptoAuthService.ts` - Validação de assinaturas
- `AuthMiddleware.ts` - Decisões de autenticação
- `CryptoAuthClient.ts` - Geração e assinatura

---

**Última atualização**: Janeiro 2025
**Versão do Plugin**: 1.0.0
**Compatível com**: FluxStack v1.4.1+
