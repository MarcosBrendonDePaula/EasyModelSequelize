/**
 * CLI Command: make:protected-route
 * Gera rotas protegidas automaticamente
 */

import type { CliCommand, CliContext } from '@core/plugins/types'
import { writeFileSync, existsSync, mkdirSync } from 'fs'
import { join } from 'path'

const ROUTE_TEMPLATES = {
  required: (name: string, pascalName: string) => `/**
 * ${pascalName} Routes
 * 🔒 Autenticação obrigatória
 * Auto-gerado pelo comando: flux crypto-auth:make:route ${name} --auth required
 */

import { Elysia, t } from 'elysia'
import { cryptoAuthRequired, getCryptoAuthUser } from '@/plugins/crypto-auth/server'

export const ${name}Routes = new Elysia({ prefix: '/${name}' })

  // ========================================
  // 🔒 ROTAS PROTEGIDAS (autenticação obrigatória)
  // ========================================
  .guard({}, (app) =>
    app.use(cryptoAuthRequired())

      // GET /api/${name}
      .get('/', ({ request }) => {
        const user = getCryptoAuthUser(request)!

        return {
          success: true,
          message: 'Lista de ${name}',
          user: {
            publicKey: user.publicKey.substring(0, 16) + '...',
            isAdmin: user.isAdmin
          },
          data: []
        }
      })

      // GET /api/${name}/:id
      .get('/:id', ({ request, params }) => {
        const user = getCryptoAuthUser(request)!

        return {
          success: true,
          message: 'Detalhes de ${name}',
          id: params.id,
          user: user.publicKey.substring(0, 8) + '...'
        }
      })

      // POST /api/${name}
      .post('/', ({ request, body }) => {
        const user = getCryptoAuthUser(request)!
        const data = body as any

        return {
          success: true,
          message: '${pascalName} criado com sucesso',
          createdBy: user.publicKey.substring(0, 8) + '...',
          data
        }
      }, {
        body: t.Object({
          // Adicione seus campos aqui
          name: t.String({ minLength: 3 })
        })
      })

      // PUT /api/${name}/:id
      .put('/:id', ({ request, params, body }) => {
        const user = getCryptoAuthUser(request)!
        const data = body as any

        return {
          success: true,
          message: '${pascalName} atualizado',
          id: params.id,
          updatedBy: user.publicKey.substring(0, 8) + '...',
          data
        }
      }, {
        body: t.Object({
          name: t.String({ minLength: 3 })
        })
      })

      // DELETE /api/${name}/:id
      .delete('/:id', ({ request, params }) => {
        const user = getCryptoAuthUser(request)!

        return {
          success: true,
          message: '${pascalName} deletado',
          id: params.id,
          deletedBy: user.publicKey.substring(0, 8) + '...'
        }
      })
  )
`,

  admin: (name: string, pascalName: string) => `/**
 * ${pascalName} Routes
 * 👑 Apenas administradores
 * Auto-gerado pelo comando: flux crypto-auth:make:route ${name} --auth admin
 */

import { Elysia, t } from 'elysia'
import { cryptoAuthAdmin, getCryptoAuthUser } from '@/plugins/crypto-auth/server'

export const ${name}Routes = new Elysia({ prefix: '/${name}' })

  // ========================================
  // 👑 ROTAS ADMIN (apenas administradores)
  // ========================================
  .guard({}, (app) =>
    app.use(cryptoAuthAdmin())

      // GET /api/${name}
      .get('/', ({ request }) => {
        const user = getCryptoAuthUser(request)!

        return {
          success: true,
          message: 'Painel administrativo de ${name}',
          admin: user.publicKey.substring(0, 8) + '...',
          data: []
        }
      })

      // POST /api/${name}
      .post('/', ({ request, body }) => {
        const user = getCryptoAuthUser(request)!
        const data = body as any

        return {
          success: true,
          message: '${pascalName} criado pelo admin',
          admin: user.publicKey.substring(0, 8) + '...',
          data
        }
      }, {
        body: t.Object({
          name: t.String({ minLength: 3 })
        })
      })

      // DELETE /api/${name}/:id
      .delete('/:id', ({ request, params }) => {
        const user = getCryptoAuthUser(request)!

        return {
          success: true,
          message: '${pascalName} deletado pelo admin',
          id: params.id,
          admin: user.publicKey.substring(0, 8) + '...'
        }
      })
  )
`,

  optional: (name: string, pascalName: string) => `/**
 * ${pascalName} Routes
 * 🌓 Autenticação opcional
 * Auto-gerado pelo comando: flux crypto-auth:make:route ${name} --auth optional
 */

import { Elysia } from 'elysia'
import { cryptoAuthOptional, getCryptoAuthUser } from '@/plugins/crypto-auth/server'

export const ${name}Routes = new Elysia({ prefix: '/${name}' })

  // ========================================
  // 🌐 ROTA PÚBLICA
  // ========================================
  .get('/', () => ({
    success: true,
    message: 'Lista pública de ${name}',
    data: []
  }))

  // ========================================
  // 🌓 ROTAS COM AUTH OPCIONAL
  // ========================================
  .guard({}, (app) =>
    app.use(cryptoAuthOptional())

      // GET /api/${name}/:id
      .get('/:id', ({ request, params }) => {
        const user = getCryptoAuthUser(request)
        const isAuthenticated = !!user

        return {
          success: true,
          id: params.id,
          message: isAuthenticated
            ? \`${pascalName} personalizado para \${user.publicKey.substring(0, 8)}...\`
            : 'Visualização pública de ${name}',
          // Conteúdo extra apenas para autenticados
          premiumContent: isAuthenticated ? 'Conteúdo exclusivo' : null,
          viewer: isAuthenticated
            ? user.publicKey.substring(0, 8) + '...'
            : 'Visitante anônimo'
        }
      })
  )
`,

  public: (name: string, pascalName: string) => `/**
 * ${pascalName} Routes
 * 🌐 Totalmente público
 * Auto-gerado pelo comando: flux crypto-auth:make:route ${name} --auth public
 */

import { Elysia } from 'elysia'

export const ${name}Routes = new Elysia({ prefix: '/${name}' })

  // ========================================
  // 🌐 ROTAS PÚBLICAS
  // ========================================

  // GET /api/${name}
  .get('/', () => ({
    success: true,
    message: 'Lista de ${name}',
    data: []
  }))

  // GET /api/${name}/:id
  .get('/:id', ({ params }) => ({
    success: true,
    id: params.id,
    message: 'Detalhes de ${name}'
  }))
`
}

function toPascalCase(str: string): string {
  return str
    .split(/[-_]/)
    .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join('')
}

export const makeProtectedRouteCommand: CliCommand = {
  name: 'crypto-auth:make:route',
  description: 'Gera um arquivo de rotas com proteção crypto-auth',
  category: 'Crypto Auth',
  aliases: ['crypto-auth:generate:route'],

  arguments: [
    {
      name: 'name',
      description: 'Nome da rota (ex: posts, users, admin)',
      required: true,
      type: 'string'
    }
  ],

  options: [
    {
      name: 'auth',
      short: 'a',
      description: 'Tipo de autenticação (required, admin, optional, public)',
      type: 'string',
      default: 'required',
      choices: ['required', 'admin', 'optional', 'public']
    },
    {
      name: 'output',
      short: 'o',
      description: 'Diretório de saída (padrão: app/server/routes)',
      type: 'string',
      default: 'app/server/routes'
    },
    {
      name: 'force',
      short: 'f',
      description: 'Sobrescrever arquivo existente',
      type: 'boolean',
      default: false
    }
  ],

  examples: [
    'flux crypto-auth:make:route posts',
    'flux crypto-auth:make:route admin --auth admin',
    'flux crypto-auth:make:route feed --auth optional',
    'flux crypto-auth:make:route articles --auth required --force'
  ],

  handler: async (args, options, context) => {
    const [name] = args as [string]
    const { auth, output, force } = options as {
      auth: 'required' | 'admin' | 'optional' | 'public'
      output: string
      force: boolean
    }

    // Validar nome
    if (!/^[a-z][a-z0-9-]*$/.test(name)) {
      console.error('❌ Nome inválido. Use apenas letras minúsculas, números e hífens.')
      console.error('   Exemplos válidos: posts, my-posts, user-settings')
      return
    }

    const pascalName = toPascalCase(name)
    const fileName = `${name}.routes.ts`
    const outputDir = join(context.workingDir, output)
    const filePath = join(outputDir, fileName)

    // Verificar se arquivo existe
    if (existsSync(filePath) && !force) {
      console.error(`❌ Arquivo já existe: ${filePath}`)
      console.error('   Use --force para sobrescrever')
      return
    }

    // Criar diretório se não existir
    if (!existsSync(outputDir)) {
      mkdirSync(outputDir, { recursive: true })
    }

    // Gerar código
    const template = ROUTE_TEMPLATES[auth]
    const code = template(name, pascalName)

    // Escrever arquivo
    writeFileSync(filePath, code, 'utf-8')

    console.log(`\n✅ Rota criada com sucesso!`)
    console.log(`📁 Arquivo: ${filePath}`)
    console.log(`🔐 Tipo de auth: ${auth}`)

    // Instruções de uso
    console.log(`\n📋 Próximos passos:`)
    console.log(`\n1. Importar a rota em app/server/routes/index.ts:`)
    console.log(`   import { ${name}Routes } from './${name}.routes'`)
    console.log(`\n2. Registrar no apiRoutes:`)
    console.log(`   export const apiRoutes = new Elysia({ prefix: '/api' })`)
    console.log(`     .use(${name}Routes)`)
    console.log(`\n3. Rotas disponíveis:`)

    const routes = {
      required: [
        `GET    /api/${name}`,
        `GET    /api/${name}/:id`,
        `POST   /api/${name}`,
        `PUT    /api/${name}/:id`,
        `DELETE /api/${name}/:id`
      ],
      admin: [
        `GET    /api/${name}`,
        `POST   /api/${name}`,
        `DELETE /api/${name}/:id`
      ],
      optional: [
        `GET    /api/${name}`,
        `GET    /api/${name}/:id`
      ],
      public: [
        `GET    /api/${name}`,
        `GET    /api/${name}/:id`
      ]
    }

    routes[auth].forEach(route => console.log(`   ${route}`))

    console.log(`\n4. Testar (sem auth):`)
    console.log(`   curl http://localhost:3000/api/${name}`)

    if (auth !== 'public') {
      const expectedStatus = auth === 'optional' ? '200 (sem conteúdo premium)' : '401'
      console.log(`   Esperado: ${expectedStatus}`)
    }

    console.log(`\n🚀 Pronto! Inicie o servidor com: bun run dev`)
  }
}
