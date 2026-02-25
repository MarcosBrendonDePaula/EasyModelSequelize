/**
 * FluxStack Auth - In-Memory User Provider
 *
 * Provider que armazena usuários em memória.
 * Ideal para desenvolvimento, demos e testes.
 *
 * Para produção, implemente UserProvider com seu ORM:
 * ```ts
 * class DrizzleUserProvider implements UserProvider {
 *   async retrieveById(id) {
 *     return db.select().from(users).where(eq(users.id, id)).get()
 *   }
 *   // ...
 * }
 * ```
 */

import type { Authenticatable, UserProvider } from '../contracts'
import { Hash } from '../HashManager'

// ===== In-Memory User Model =====

export class InMemoryUser implements Authenticatable {
  id: number
  name: string
  email: string
  passwordHash: string
  rememberToken: string | null = null
  createdAt: Date

  constructor(data: {
    id: number
    name: string
    email: string
    passwordHash: string
    createdAt?: Date
  }) {
    this.id = data.id
    this.name = data.name
    this.email = data.email
    this.passwordHash = data.passwordHash
    this.createdAt = data.createdAt ?? new Date()
  }

  getAuthId(): number {
    return this.id
  }

  getAuthIdField(): string {
    return 'id'
  }

  getAuthPassword(): string {
    return this.passwordHash
  }

  getRememberToken(): string | null {
    return this.rememberToken
  }

  setRememberToken(token: string | null): void {
    this.rememberToken = token
  }

  toJSON(): Record<string, unknown> {
    return {
      id: this.id,
      name: this.name,
      email: this.email,
      createdAt: this.createdAt.toISOString(),
    }
  }
}

// ===== Provider =====

export class InMemoryUserProvider implements UserProvider {
  private users: InMemoryUser[] = []
  private nextId = 1

  async retrieveById(id: string | number): Promise<Authenticatable | null> {
    return this.users.find(u => u.id === Number(id)) ?? null
  }

  async retrieveByCredentials(credentials: Record<string, unknown>): Promise<Authenticatable | null> {
    // Buscar por qualquer campo EXCETO password
    const { password: _, ...searchFields } = credentials

    return this.users.find(user => {
      return Object.entries(searchFields).every(([key, value]) => {
        return (user as any)[key] === value
      })
    }) ?? null
  }

  async validateCredentials(user: Authenticatable, credentials: Record<string, unknown>): Promise<boolean> {
    const password = credentials.password as string | undefined
    if (!password) return false

    const valid = await Hash.check(password, user.getAuthPassword())

    // Rehash transparente se necessário
    if (valid && Hash.needsRehash(user.getAuthPassword())) {
      const newHash = await Hash.make(password)
      // Atualizar hash in-memory
      const memUser = user as InMemoryUser
      memUser.passwordHash = newHash
    }

    return valid
  }

  async retrieveByToken(id: string | number, token: string): Promise<Authenticatable | null> {
    const user = this.users.find(u => u.id === Number(id))
    if (!user) return null
    if (user.getRememberToken() !== token) return null
    return user
  }

  async updateRememberToken(user: Authenticatable, token: string | null): Promise<void> {
    user.setRememberToken(token)
  }

  async createUser(data: Record<string, unknown>): Promise<Authenticatable> {
    const name = data.name as string
    const email = data.email as string
    const password = data.password as string

    if (!name || !email || !password) {
      throw new Error('Name, email and password are required')
    }

    // Verificar email duplicado
    const existing = this.users.find(u => u.email === email)
    if (existing) {
      throw new Error('Email already in use')
    }

    const passwordHash = await Hash.make(password)

    const user = new InMemoryUser({
      id: this.nextId++,
      name,
      email,
      passwordHash,
    })

    this.users.push(user)
    return user
  }

  /** Para testes: reset completo */
  reset(): void {
    this.users = []
    this.nextId = 1
  }

  /** Para testes: retorna todos os usuários */
  getAll(): InMemoryUser[] {
    return [...this.users]
  }
}
