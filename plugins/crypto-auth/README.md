# 🔐 FluxStack Crypto Auth Plugin

Sistema de autenticação baseado em criptografia **Ed25519** para FluxStack. Autenticação stateless sem sessões, usando assinaturas criptográficas.

## 📋 Índice

- [O Que É](#-o-que-é)
- [Como Funciona](#-como-funciona)
- [Instalação](#-instalação)
- [Configuração](#️-configuração)
- [Uso Básico](#-uso-básico)
- [CLI Commands](#-cli-commands)
- [Middlewares Disponíveis](#-middlewares-disponíveis)
- [Helpers e Utilitários](#-helpers-e-utilitários)
- [Fluxo de Autenticação](#-fluxo-de-autenticação)
- [Segurança](#-segurança)
- [Troubleshooting](#-troubleshooting)

---

## 🎯 O Que É

**Crypto Auth** é um plugin de autenticação que usa **assinaturas digitais Ed25519** ao invés de sessões tradicionais.

### ✨ Principais Características

- ✅ **Stateless**: Sem sessões, sem armazenamento de tokens
- ✅ **Zero Trust**: Cada requisição é validada independentemente
- ✅ **Ed25519**: Criptografia de curva elíptica (rápida e segura)
- ✅ **Anti-Replay**: Proteção contra replay attacks com timestamps e nonces
- ✅ **Admin Support**: Sistema de permissões com chaves administrativas
- ✅ **TypeScript**: Totalmente tipado
- ✅ **CLI Integration**: Geração automática de rotas protegidas

### 🔄 Diferenças vs. Auth Tradicional

| Característica | Auth Tradicional | Crypto Auth |
|----------------|------------------|-------------|
| **Armazenamento** | Sessões no servidor | Nenhum |
| **Escalabilidade** | Limitada (sessões) | Infinita (stateless) |
| **Segurança** | Token JWT ou session | Assinatura Ed25519 |
| **Chave privada** | Armazenada no servidor | **NUNCA** sai do cliente |
| **Performance** | Depende do DB/cache | Ultra-rápida (validação local) |

---

## 🔬 Como Funciona

### 1. **Cliente Gera Par de Chaves (Uma Vez)**

```typescript
// No navegador (usando TweetNaCl ou similar)
const keypair = nacl.sign.keyPair()

// Armazenar no localStorage (chave privada NUNCA sai do navegador)
localStorage.setItem('privateKey', toHex(keypair.secretKey))
localStorage.setItem('publicKey', toHex(keypair.publicKey))
```

### 2. **Cliente Assina Cada Requisição**

```typescript
// Para cada request
const timestamp = Date.now()
const nonce = generateRandomNonce()
const message = `${timestamp}:${nonce}:${requestBody}`

// Assinar com chave privada
const signature = nacl.sign.detached(message, privateKey)

// Enviar headers
headers = {
  'x-public-key': publicKeyHex,
  'x-timestamp': timestamp,
  'x-nonce': nonce,
  'x-signature': toHex(signature)
}
```

### 3. **Servidor Valida Assinatura**

```typescript
// Plugin valida automaticamente
const isValid = nacl.sign.detached.verify(
  message,
  signature,
  publicKey
)

if (!isValid) {
  throw new Error('Invalid signature')
}

// Verificar timestamp (previne replay attacks)
if (Math.abs(Date.now() - timestamp) > maxTimeDrift) {
  throw new Error('Timestamp expired')
}
```

### 4. **Sem Armazenamento de Estado**

- ✅ Servidor valida usando **apenas** a chave pública enviada
- ✅ Nenhuma sessão ou token armazenado
- ✅ Cada requisição é independente

---

## 📦 Instalação

O plugin já vem incluído no FluxStack. Para habilitá-lo:

### 1. **Adicionar ao `fluxstack.config.ts`**

```typescript
import { cryptoAuthPlugin } from './plugins/crypto-auth'

export default defineConfig({
  plugins: {
    enabled: [
      cryptoAuthPlugin
    ],
    config: {
      'crypto-auth': {
        enabled: true,
        maxTimeDrift: 300000, // 5 minutos
        adminKeys: [
          'a1b2c3d4e5f6...', // Chaves públicas de admins (hex 64 chars)
          'f6e5d4c3b2a1...'
        ],
        enableMetrics: true
      }
    }
  }
})
```

### 2. **Variáveis de Ambiente (Opcional)**

```bash
# .env
CRYPTO_AUTH_ENABLED=true
CRYPTO_AUTH_MAX_TIME_DRIFT=300000
CRYPTO_AUTH_ADMIN_KEYS=a1b2c3d4e5f6...,f6e5d4c3b2a1...
CRYPTO_AUTH_ENABLE_METRICS=true
```

---

## ⚙️ Configuração

### Schema de Configuração

```typescript
{
  enabled: boolean              // Habilitar/desabilitar plugin
  maxTimeDrift: number          // Máximo drift de tempo (ms) - previne replay
  adminKeys: string[]           // Chaves públicas de administradores
  enableMetrics: boolean        // Habilitar logs de métricas
}
```

### Valores Padrão

```typescript
{
  enabled: true,
  maxTimeDrift: 300000,    // 5 minutos
  adminKeys: [],
  enableMetrics: true
}
```

---

## 🚀 Uso Básico

### Opção 1: CLI (Recomendado)

```bash
# Criar rota com auth obrigatória
bun flux crypto-auth:make:route users

# Criar rota admin-only
bun flux crypto-auth:make:route admin-panel --auth admin

# Criar rota com auth opcional
bun flux crypto-auth:make:route blog --auth optional

# Criar rota pública
bun flux crypto-auth:make:route public-api --auth public
```

### Opção 2: Manual

```typescript
// app/server/routes/users.routes.ts
import { Elysia, t } from 'elysia'
import { cryptoAuthRequired, getCryptoAuthUser } from '@/plugins/crypto-auth/server'

export const usersRoutes = new Elysia({ prefix: '/users' })

  // ========================================
  // 🔒 ROTAS PROTEGIDAS
  // ========================================
  .guard({}, (app) =>
    app.use(cryptoAuthRequired())

      .get('/', ({ request }) => {
        const user = getCryptoAuthUser(request)!

        return {
          message: 'Lista de usuários',
          authenticatedAs: user.publicKey.substring(0, 8) + '...',
          isAdmin: user.isAdmin
        }
      })

      .post('/', ({ request, body }) => {
        const user = getCryptoAuthUser(request)!

        return {
          message: 'Usuário criado',
          createdBy: user.publicKey.substring(0, 8) + '...'
        }
      }, {
        body: t.Object({
          name: t.String(),
          email: t.String()
        })
      })
  )
```

### Registrar Rotas

```typescript
// app/server/routes/index.ts
import { usersRoutes } from './users.routes'

export const apiRoutes = new Elysia({ prefix: '/api' })
  .use(usersRoutes)
```

---

## 🎛️ CLI Commands

### `crypto-auth:make:route`

Gera arquivos de rotas com proteção crypto-auth automaticamente.

#### **Sintaxe**

```bash
bun flux crypto-auth:make:route <name> [options]
```

#### **Argumentos**

- `name` - Nome da rota (ex: posts, users, admin)

#### **Opções**

- `--auth, -a` - Tipo de autenticação (required, admin, optional, public)
- `--output, -o` - Diretório de saída (padrão: app/server/routes)
- `--force, -f` - Sobrescrever arquivo existente

#### **Exemplos**

```bash
# Rota com auth obrigatória
bun flux crypto-auth:make:route posts

# Rota admin-only com output customizado
bun flux crypto-auth:make:route admin --auth admin --output src/routes

# Forçar sobrescrita
bun flux crypto-auth:make:route users --force
```

#### **Templates Gerados**

| Tipo | Descrição | Rotas Geradas |
|------|-----------|---------------|
| `required` | Auth obrigatória | GET, POST, PUT, DELETE (CRUD completo) |
| `admin` | Apenas admins | GET, POST, DELETE |
| `optional` | Auth opcional | GET (lista), GET (detalhes com conteúdo extra) |
| `public` | Sem auth | GET (lista), GET (detalhes) |

---

## 🛡️ Middlewares Disponíveis

### 1. `cryptoAuthRequired()`

Autenticação **obrigatória**. Bloqueia requisições não autenticadas.

```typescript
import { cryptoAuthRequired, getCryptoAuthUser } from '@/plugins/crypto-auth/server'

.guard({}, (app) =>
  app.use(cryptoAuthRequired())
    .get('/protected', ({ request }) => {
      const user = getCryptoAuthUser(request)!  // ✅ Sempre existe
      return { user }
    })
)
```

**Comportamento:**
- ✅ Requisição autenticada → Prossegue
- ❌ Requisição não autenticada → `401 Unauthorized`

---

### 2. `cryptoAuthAdmin()`

Apenas **administradores**. Valida se a chave pública está em `adminKeys`.

```typescript
import { cryptoAuthAdmin, getCryptoAuthUser } from '@/plugins/crypto-auth/server'

.guard({}, (app) =>
  app.use(cryptoAuthAdmin())
    .delete('/delete/:id', ({ request }) => {
      const user = getCryptoAuthUser(request)!  // ✅ Sempre admin
      return { message: 'Deletado' }
    })
)
```

**Comportamento:**
- ✅ Chave pública está em `adminKeys` → Prossegue
- ❌ Não é admin → `403 Forbidden`
- ❌ Não autenticado → `401 Unauthorized`

---

### 3. `cryptoAuthOptional()`

Autenticação **opcional**. Não bloqueia, mas identifica usuários autenticados.

```typescript
import { cryptoAuthOptional, getCryptoAuthUser } from '@/plugins/crypto-auth/server'

.guard({}, (app) =>
  app.use(cryptoAuthOptional())
    .get('/feed', ({ request }) => {
      const user = getCryptoAuthUser(request)  // ⚠️ Pode ser null

      if (user) {
        return {
          message: 'Feed personalizado',
          recommendations: [...],
          user: user.publicKey.substring(0, 8) + '...'
        }
      }

      return {
        message: 'Feed público',
        trending: [...]
      }
    })
)
```

**Comportamento:**
- ✅ Requisição autenticada → `user` disponível
- ✅ Requisição não autenticada → `user = null`, requisição prossegue

---

### 4. `cryptoAuthPermissions(permissions: string[])`

Valida **permissões customizadas**.

```typescript
import { cryptoAuthPermissions, getCryptoAuthUser } from '@/plugins/crypto-auth/server'

.guard({}, (app) =>
  app.use(cryptoAuthPermissions(['write', 'delete']))
    .put('/edit/:id', ({ request }) => {
      const user = getCryptoAuthUser(request)!  // ✅ Tem as permissões
      return { message: 'Editado' }
    })
)
```

**Comportamento:**
- ✅ Usuário tem todas as permissões → Prossegue
- ❌ Falta alguma permissão → `403 Forbidden`

> **Nota**: Sistema de permissões requer extensão customizada. Por padrão, apenas `isAdmin` é verificado.

---

## 🔧 Helpers e Utilitários

### `getCryptoAuthUser(request)`

Retorna o usuário autenticado ou `null`.

```typescript
import { getCryptoAuthUser } from '@/plugins/crypto-auth/server'

.get('/profile', ({ request }) => {
  const user = getCryptoAuthUser(request)

  if (!user) {
    return { error: 'Not authenticated' }
  }

  return {
    publicKey: user.publicKey,
    isAdmin: user.isAdmin
  }
})
```

**Retorno:**
```typescript
{
  publicKey: string    // Chave pública do usuário (hex)
  isAdmin: boolean     // Se é administrador
} | null
```

---

### `isCryptoAuthAuthenticated(request)`

Verifica se a requisição está autenticada.

```typescript
import { isCryptoAuthAuthenticated } from '@/plugins/crypto-auth/server'

.get('/status', ({ request }) => {
  const isAuth = isCryptoAuthAuthenticated(request)

  return {
    authenticated: isAuth,
    message: isAuth ? 'Você está logado' : 'Você não está logado'
  }
})
```

**Retorno:** `boolean`

---

### `isCryptoAuthAdmin(request)`

Verifica se o usuário é administrador.

```typescript
import { isCryptoAuthAdmin } from '@/plugins/crypto-auth/server'

.get('/admin-check', ({ request }) => {
  const isAdmin = isCryptoAuthAdmin(request)

  return {
    isAdmin,
    access: isAdmin ? 'granted' : 'denied'
  }
})
```

**Retorno:** `boolean`

---

### `hasCryptoAuthPermission(request, permission)`

Verifica se o usuário tem uma permissão específica.

```typescript
import { hasCryptoAuthPermission } from '@/plugins/crypto-auth/server'

.get('/can-delete', ({ request }) => {
  const canDelete = hasCryptoAuthPermission(request, 'delete')

  return { canDelete }
})
```

**Retorno:** `boolean`

---

## 🔄 Fluxo de Autenticação

### Diagrama Completo

```
┌─────────────┐                                    ┌─────────────┐
│   Cliente   │                                    │   Servidor  │
│  (Browser)  │                                    │  (Elysia)   │
└──────┬──────┘                                    └──────┬──────┘
       │                                                  │
       │ 1. Gera par de chaves Ed25519 (uma vez)        │
       │    privateKey, publicKey                        │
       │    localStorage.setItem(...)                    │
       │                                                  │
       │ 2. Para cada request:                           │
       │    - timestamp = Date.now()                     │
       │    - nonce = random()                           │
       │    - message = `${timestamp}:${nonce}:${body}`  │
       │    - signature = sign(message, privateKey)      │
       │                                                  │
       │ 3. Envia request com headers                    │
       │────────────────────────────────────────────────>│
       │    x-public-key: <publicKey>                    │
       │    x-timestamp: <timestamp>                     │
       │    x-nonce: <nonce>                             │
       │    x-signature: <signature>                     │
       │                                                  │
       │                                                  │ 4. Middleware valida:
       │                                                  │    - Reconstrói message
       │                                                  │    - verify(message, signature, publicKey)
       │                                                  │    - Verifica timestamp
       │                                                  │    - Verifica se é admin (se necessário)
       │                                                  │
       │ 5a. ✅ Válido                                   │
       │<────────────────────────────────────────────────│
       │    200 OK { data: ... }                         │
       │                                                  │
       │ 5b. ❌ Inválido                                 │
       │<────────────────────────────────────────────────│
       │    401 Unauthorized { error: ... }              │
       │                                                  │
```

---

## 🔒 Segurança

### ✅ Proteções Implementadas

1. **Anti-Replay Attacks**
   - Timestamp validation (maxTimeDrift)
   - Nonce único por requisição
   - Assinatura inclui timestamp + nonce

2. **Stateless Security**
   - Sem sessões (não há o que roubar)
   - Chave privada **NUNCA** sai do cliente
   - Validação criptográfica a cada request

3. **Admin Protection**
   - Lista whitelist de chaves públicas administrativas
   - Validação dupla (auth + isAdmin)

4. **Type Safety**
   - TypeScript completo
   - Validação de schemas com TypeBox

### ⚠️ Considerações de Segurança

1. **HTTPS Obrigatório**
   ```typescript
   // Sempre use HTTPS em produção
   if (process.env.NODE_ENV === 'production' && !request.url.startsWith('https')) {
     throw new Error('HTTPS required')
   }
   ```

2. **Rotação de Chaves**
   ```typescript
   // Cliente deve permitir rotação de chaves
   function rotateKeys() {
     const newKeypair = nacl.sign.keyPair()
     // Migrar dados assinados com chave antiga
     // Atualizar localStorage
   }
   ```

3. **Rate Limiting**
   ```typescript
   // Adicionar rate limiting para prevenir brute force
   import { rateLimit } from '@/plugins/rate-limit'

   .use(rateLimit({ max: 100, window: '15m' }))
   .use(cryptoAuthRequired())
   ```

4. **Admin Keys em Ambiente**
   ```bash
   # .env
   CRYPTO_AUTH_ADMIN_KEYS=key1,key2,key3
   ```

---

## 🧪 Troubleshooting

### ❌ Erro: "Authentication required"

**Problema**: Requisição sem headers de autenticação.

**Solução**:
```typescript
// Cliente deve enviar headers
headers: {
  'x-public-key': publicKeyHex,
  'x-timestamp': Date.now().toString(),
  'x-nonce': generateNonce(),
  'x-signature': signatureHex
}
```

---

### ❌ Erro: "Invalid signature"

**Problema**: Assinatura não corresponde à mensagem.

**Causas comuns**:
1. Chave privada incorreta
2. Mensagem reconstruída diferente
3. Ordem dos campos alterada

**Solução**:
```typescript
// Garantir ordem exata dos campos
const message = `${timestamp}:${nonce}:${JSON.stringify(body)}`
```

---

### ❌ Erro: "Timestamp drift too large"

**Problema**: Diferença entre timestamp do cliente e servidor excede `maxTimeDrift`.

**Solução**:
```typescript
// Sincronizar relógio do cliente com servidor
const serverTime = await fetch('/api/time').then(r => r.json())
const timeDrift = Date.now() - serverTime.timestamp
// Ajustar timestamps futuros
```

---

### ❌ Erro: "Admin access required"

**Problema**: Usuário não está na lista de `adminKeys`.

**Solução**:
```typescript
// Adicionar chave pública ao config
{
  'crypto-auth': {
    adminKeys: [
      'a1b2c3d4e5f6...',  // Sua chave pública
    ]
  }
}
```

---

### 🔍 Debug Mode

Habilitar logs detalhados:

```typescript
// fluxstack.config.ts
{
  'crypto-auth': {
    enableMetrics: true
  }
}
```

Verificar logs:
```bash
# Requisições autenticadas
Requisição autenticada {
  publicKey: "a1b2c3d4...",
  isAdmin: false,
  path: "/api/users",
  method: "GET"
}

# Falhas de autenticação
Falha na autenticação {
  error: "Invalid signature",
  path: "/api/users",
  method: "POST"
}
```

---

## 📚 Recursos Adicionais

### Documentação Relacionada

- [`QUICK-START-CRYPTO-AUTH.md`](../../QUICK-START-CRYPTO-AUTH.md) - Início rápido em 5 minutos
- [`EXEMPLO-ROTA-PROTEGIDA.md`](../../EXEMPLO-ROTA-PROTEGIDA.md) - Tutorial passo-a-passo
- [`CRYPTO-AUTH-MIDDLEWARE-GUIDE.md`](../../CRYPTO-AUTH-MIDDLEWARE-GUIDE.md) - Referência de middlewares

### Bibliotecas Cliente Recomendadas

- **JavaScript/TypeScript**: [TweetNaCl.js](https://github.com/dchest/tweetnacl-js)
- **React**: [@stablelib/ed25519](https://github.com/StableLib/stablelib)

### Exemplo de Cliente

```typescript
// client-auth.ts
import nacl from 'tweetnacl'
import { encodeHex, decodeHex } from 'tweetnacl-util'

export class CryptoAuthClient {
  private privateKey: Uint8Array
  private publicKey: Uint8Array

  constructor() {
    // Carregar ou gerar chaves
    const stored = localStorage.getItem('cryptoAuthKeys')

    if (stored) {
      const keys = JSON.parse(stored)
      this.privateKey = decodeHex(keys.privateKey)
      this.publicKey = decodeHex(keys.publicKey)
    } else {
      const keypair = nacl.sign.keyPair()
      this.privateKey = keypair.secretKey
      this.publicKey = keypair.publicKey

      localStorage.setItem('cryptoAuthKeys', JSON.stringify({
        privateKey: encodeHex(keypair.secretKey),
        publicKey: encodeHex(keypair.publicKey)
      }))
    }
  }

  async fetch(url: string, options: RequestInit = {}) {
    const timestamp = Date.now().toString()
    const nonce = encodeHex(nacl.randomBytes(16))
    const body = options.body || ''

    const message = `${timestamp}:${nonce}:${body}`
    const signature = nacl.sign.detached(
      new TextEncoder().encode(message),
      this.privateKey
    )

    const headers = {
      ...options.headers,
      'x-public-key': encodeHex(this.publicKey),
      'x-timestamp': timestamp,
      'x-nonce': nonce,
      'x-signature': encodeHex(signature)
    }

    return fetch(url, { ...options, headers })
  }

  getPublicKey() {
    return encodeHex(this.publicKey)
  }
}

// Uso
const authClient = new CryptoAuthClient()
const response = await authClient.fetch('/api/users', {
  method: 'POST',
  body: JSON.stringify({ name: 'João' })
})
```

---

## 🤝 Contribuindo

Para reportar bugs ou sugerir melhorias, abra uma issue no repositório do FluxStack.

---

## 📄 Licença

Este plugin é parte do FluxStack e segue a mesma licença do framework.

---

**Desenvolvido com ❤️ pela FluxStack Team**
