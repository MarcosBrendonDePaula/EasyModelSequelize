// Shared types between server and client
export interface User {
  id: number
  name: string
  email: string
  createdAt: Date
}

export interface CreateUserRequest {
  name: string
  email: string
}

export interface UserListResponse {
  success: true
  users: User[]
  count: number
}

export interface UserDetailResponse {
  success: boolean
  user?: User
  error?: string
}

export interface MutationResponse {
  success: boolean
  message?: string
  error?: string
}
