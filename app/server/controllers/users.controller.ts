import type { CreateUserRequest } from '@app/shared/types'

export interface User {
  id: number
  name: string
  email: string
  createdAt: Date
}

/**
 * In-memory user store for demonstration purposes.
 * Replace with a real database (e.g. Drizzle, Prisma) for production use.
 */
export class UsersController {
  private static users: User[] = []
  private static nextId = 1

  static async getUsers() {
    return {
      success: true as const,
      users: this.users,
      count: this.users.length
    }
  }

  static async getUserById(id: number) {
    const user = this.users.find(u => u.id === id)
    if (!user) {
      return {
        success: false as const,
        error: 'Usuario nao encontrado'
      }
    }
    return {
      success: true as const,
      user
    }
  }

  static async createUser(data: CreateUserRequest) {
    const existingUser = this.users.find(u => u.email === data.email)
    if (existingUser) {
      return {
        success: false as const,
        error: 'Email ja esta em uso'
      }
    }

    const newUser: User = {
      id: this.nextId++,
      name: data.name,
      email: data.email,
      createdAt: new Date()
    }

    this.users.push(newUser)

    return {
      success: true as const,
      user: newUser,
      message: 'Usuario criado com sucesso'
    }
  }

  static async deleteUser(id: number) {
    const userIndex = this.users.findIndex(u => u.id === id)

    if (userIndex === -1) {
      return {
        success: false as const,
        message: 'Usuario nao encontrado'
      }
    }

    this.users.splice(userIndex, 1)

    return {
      success: true as const,
      message: 'Usuario deletado com sucesso'
    }
  }

  static resetForTesting() {
    this.users = []
    this.nextId = 1
  }
}
