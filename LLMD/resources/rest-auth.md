# REST API Authentication

**Version:** 1.14.0 | **Updated:** 2026-02-14

## Quick Facts

- Dois guards disponíveis: **Session** (cookie) e **Token** (Bearer)
- Configuração via `AUTH_DEFAULT_GUARD` no `.env`
- Rate limiting automático no login (5 tentativas / 60s)
- Password hashing com bcrypt ou argon2id
- Provider in-memory por padrão (extensível para database)
- REST test files disponíveis em `rest-tests/`

## Endpoints

| Método | Rota | Auth | Descrição |
|--------|------|------|-----------|
| `POST` | `/api/auth/register` | Guest | Criar conta e auto-login |
| `POST` | `/api/auth/login` | Guest | Autenticar com email + password |
| `GET` | `/api/auth/me` | Required | Retorna usuário autenticado |
| `POST` | `/api/auth/logout` | Required | Encerrar sessão/revogar token |

## Guards

### Session Guard (padrão)

Armazena sessão no servidor e envia cookie httpOnly ao cliente.

```
Login → Servidor cria sessão → Cookie `fluxstack_session` → Browser envia automaticamente
```

**Configuração** (`.env`):
```bash
AUTH_DEFAULT_GUARD=session
SESSION_COOKIE=fluxstack_session
SESSION_LIFETIME=7200        # 2 horas
SESSION_HTTP_ONLY=true
SESSION_SECURE=false          # true em produção
SESSION_SAME_SITE=lax
```

**Response do login** (sem campo token):
```json
{
  "success": true,
  "user": {
    "id": 1,
    "name": "John Doe",
    "email": "john@example.com",
    "createdAt": "2026-02-14T16:00:00.000Z"
  }
}
```

**Requests autenticados**: cookie enviado automaticamente pelo browser.

### Token Guard (Bearer)

Gera token aleatório de 32 bytes, armazena hash SHA256 no cache e retorna o token plain ao cliente.

```
Login → Token gerado → Response inclui token → Cliente envia Authorization: Bearer <token>
```

**Configuração** (`.env`):
```bash
AUTH_DEFAULT_GUARD=token
AUTH_TOKEN_TTL=86400          # 24 horas
```

**Response do login** (com campo token):
```json
{
  "success": true,
  "user": {
    "id": 1,
    "name": "John Doe",
    "email": "john@example.com",
    "createdAt": "2026-02-14T16:00:00.000Z"
  },
  "token": "a1b2c3d4e5f6..."
}
```

**Requests autenticados**:
```
Authorization: Bearer a1b2c3d4e5f6...
```

### Quando usar cada guard

| Guard | Melhor para |
|-------|-------------|
| Session | SPAs web (same-origin), SSR |
| Token | Mobile apps, CLIs, API clients, integrações |

## Fluxos

### Register + Auto-login

```bash
POST /api/auth/register
Content-Type: application/json

{
  "name": "John Doe",
  "email": "john@example.com",
  "password": "secret123"
}

# 201 Created
# Session guard: set-cookie header
# Token guard: token no body (via login automático)
```

### Login

```bash
POST /api/auth/login
Content-Type: application/json

{
  "email": "john@example.com",
  "password": "secret123"
}

# 200 OK → user + token (se token guard)
# 401    → credenciais inválidas
# 429    → rate limit (Retry-After header)
```

### Me (Token Guard)

```bash
GET /api/auth/me
Authorization: Bearer <token>

# 200 OK → { success: true, user: {...} }
# 401    → não autenticado
```

### Logout (Token Guard)

```bash
POST /api/auth/logout
Authorization: Bearer <token>

# 200 OK → token revogado no cache
```

## Rate Limiting

Login é protegido automaticamente contra brute force:

| Config | Default | Env Var |
|--------|---------|---------|
| Max tentativas | 5 | `AUTH_RATE_LIMIT_MAX_ATTEMPTS` |
| Janela (segundos) | 60 | `AUTH_RATE_LIMIT_DECAY_SECONDS` |

Chave de throttle: `email|ip`. Após exceder, retorna `429 Too Many Attempts` com header `Retry-After`.

## Password Hashing

| Config | Default | Env Var |
|--------|---------|---------|
| Algoritmo | bcrypt | `AUTH_HASH_ALGORITHM` |
| Rounds (bcrypt) | 10 | `AUTH_BCRYPT_ROUNDS` |

Opções: `bcrypt` ou `argon2id`.

## Middleware

Três níveis de proteção disponíveis para rotas customizadas:

```typescript
import { auth, guest, authOptional } from '@server/auth'

// Requer autenticação (401 se não autenticado)
app.use(auth()).get('/protected', ({ user }) => user.toJSON())

// Requer NÃO estar autenticado (409 se já logado)
app.use(guest()).post('/login', loginHandler)

// Auth opcional (não bloqueia, injeta user ou null)
app.use(authOptional()).get('/public', ({ user }) => ({ user }))
```

## Schemas TypeBox

As rotas definem schemas para validação e Swagger:

```typescript
// Body do register
RegisterBodySchema = t.Object({
  name: t.String({ minLength: 1 }),
  email: t.String({ format: 'email' }),
  password: t.String({ minLength: 6 }),
})

// Body do login
LoginBodySchema = t.Object({
  email: t.String({ format: 'email' }),
  password: t.String({ minLength: 1 }),
})

// Response do login (token guard)
LoginResponseSchema = t.Object({
  success: t.Literal(true),
  user: t.Object({
    id: t.Union([t.String(), t.Number()]),
    name: t.Optional(t.String()),
    email: t.Optional(t.String()),
    createdAt: t.Optional(t.String()),
  }),
  token: t.Optional(t.String()),
})
```

## REST Test Files

Arquivos `.http` prontos para testar com a extensão REST Client do VSCode:

| Arquivo | Guard | Cobertura |
|---------|-------|-----------|
| `rest-tests/auth.http` | Session (cookie) | Register, Login, Me, Logout |
| `rest-tests/auth-token.http` | Token (Bearer) | Register, Login, Me, Logout + erros |
| `rest-tests/users-token.http` | Token (Bearer) | CRUD de usuários autenticado |
| `rest-tests/rooms-token.http` | Token (Bearer) | Mensagens e eventos em salas |

### Uso rápido

1. Configure `AUTH_DEFAULT_GUARD=token` no `.env`
2. `bun run dev`
3. Abra `rest-tests/auth-token.http` no VSCode
4. Execute **Register** → **Login** (captura token) → **Me** / **Logout**

> O token é capturado automaticamente via `@name login` e injetado com `{{login.response.body.token}}`.

## Configuração Completa

| Variável | Tipo | Default | Descrição |
|----------|------|---------|-----------|
| `AUTH_DEFAULT_GUARD` | enum | `session` | Guard padrão: `session` ou `token` |
| `AUTH_DEFAULT_PROVIDER` | enum | `memory` | Provider: `memory` ou `database` |
| `AUTH_HASH_ALGORITHM` | enum | `bcrypt` | Hash: `bcrypt` ou `argon2id` |
| `AUTH_BCRYPT_ROUNDS` | number | `10` | Rounds do bcrypt |
| `AUTH_RATE_LIMIT_MAX_ATTEMPTS` | number | `5` | Max tentativas de login |
| `AUTH_RATE_LIMIT_DECAY_SECONDS` | number | `60` | Janela do rate limit |
| `AUTH_TOKEN_TTL` | number | `86400` | TTL do token (segundos) |
| `SESSION_COOKIE` | string | `fluxstack_session` | Nome do cookie |
| `SESSION_LIFETIME` | number | `7200` | Duração da sessão (segundos) |
| `SESSION_HTTP_ONLY` | boolean | `true` | Cookie httpOnly |
| `SESSION_SECURE` | boolean | `false` | Cookie secure (HTTPS) |
| `SESSION_SAME_SITE` | enum | `lax` | SameSite policy |

## Arquivos de Referência

| Arquivo | Conteúdo |
|---------|----------|
| `app/server/routes/auth.routes.ts` | Endpoints de autenticação |
| `app/server/auth/middleware.ts` | Middleware `auth()`, `guest()`, `authOptional()` |
| `app/server/auth/guards/SessionGuard.ts` | Lógica do session guard |
| `app/server/auth/guards/TokenGuard.ts` | Lógica do token guard |
| `app/server/auth/AuthManager.ts` | Factory de guards e providers |
| `app/server/auth/providers/InMemoryProvider.ts` | Provider in-memory |
| `app/server/auth/RateLimiter.ts` | Rate limiting de login |
| `config/system/auth.config.ts` | Schema de configuração auth |
| `config/system/session.config.ts` | Schema de configuração session |

## Critical Rules

**ALWAYS:**
- Usar `AUTH_DEFAULT_GUARD=token` para APIs stateless
- Enviar `Authorization: Bearer <token>` em todos os requests autenticados
- Tratar `401` e `429` no frontend
- Armazenar token com segurança no cliente (httpOnly cookie ou secure storage)

**NEVER:**
- Expor token em URLs (query params)
- Armazenar token em localStorage sem necessidade (preferir httpOnly cookie)
- Ignorar rate limiting responses (`429`)
- Enviar passwords sem HTTPS em produção

## Related

- [Live Auth](./live-auth.md) - Autenticação para Live Components (WebSocket)
- [Routes with Eden Treaty](./routes-eden.md) - Criação de rotas type-safe
- [Environment Variables](../config/environment-vars.md) - Referência de variáveis
- [Troubleshooting](../reference/troubleshooting.md) - Problemas comuns
