# Controllers & Services

**Version:** 1.11.0 | **Updated:** 2025-02-08

## Quick Facts

- Controllers handle business logic, separate from routes
- Use static methods for stateless operations
- Return structured responses: `{ success: boolean, data?, error? }`
- Service layer optional for complex business logic
- Error handling uses FluxStackError classes
- Database integration via controllers or separate services

## Controller Pattern

Controllers separate business logic from route definitions:

```typescript
// app/server/controllers/users.controller.ts
import type { CreateUserRequest } from '@app/shared/types'

export class UsersController {
  static async getUsers() {
    return {
      success: true as const,
      users: this.users,
      count: this.users.length
    }
  }

  static async getUserById(id: number) {
    const user = await findUser(id)
    if (!user) {
      return {
        success: false as const,
        error: 'User not found'
      }
    }
    return {
      success: true as const,
      user
    }
  }

  static async createUser(data: CreateUserRequest) {
    // Validation
    const existingUser = await findByEmail(data.email)
    if (existingUser) {
      return {
        success: false as const,
        error: 'Email already in use'
      }
    }

    // Business logic
    const newUser = await saveUser(data)

    return {
      success: true as const,
      user: newUser,
      message: 'User created successfully'
    }
  }
}
```

## Route Integration

Routes call controllers, handle HTTP concerns:

```typescript
// app/server/routes/users.routes.ts
import { Elysia, t } from 'elysia'
import { UsersController } from '@app/server/controllers/users.controller'

export const usersRoutes = new Elysia({ prefix: '/users' })
  .get('/', async () => UsersController.getUsers(), {
    response: GetUsersResponseSchema
  })
  
  .get('/:id', async ({ params, set }) => {
    const id = Number(params.id)
    
    if (!Number.isFinite(id)) {
      set.status = 400
      return { success: false, error: 'Invalid ID' }
    }

    const result = await UsersController.getUserById(id)
    
    if (!result.success) {
      set.status = 404
    }
    
    return result
  }, {
    params: t.Object({ id: t.String() }),
    response: GetUserResponseSchema
  })
```

## Response Structure

Consistent response format across all controllers:

```typescript
// Success response
{
  success: true,
  data: any,
  message?: string
}

// Error response
{
  success: false,
  error: string,
  details?: any
}
```

Use `as const` for literal types in responses:

```typescript
return {
  success: true as const,  // Type: true (not boolean)
  user: newUser
}
```

## Service Layer Pattern

For complex business logic, separate into services:

```typescript
// app/server/services/user.service.ts
export class UserService {
  static async validateUserData(data: CreateUserRequest) {
    // Complex validation logic
    if (!this.isValidEmail(data.email)) {
      throw new ValidationError('Invalid email format')
    }
    
    const exists = await this.checkEmailExists(data.email)
    if (exists) {
      throw new ConflictError('Email already registered')
    }
  }

  static async createUserWithProfile(data: CreateUserRequest) {
    // Multi-step business logic
    const user = await this.createUser(data)
    const profile = await this.createProfile(user.id)
    await this.sendWelcomeEmail(user.email)
    
    return { user, profile }
  }

  private static isValidEmail(email: string): boolean {
    // Validation logic
  }
}
```

Controller uses service:

```typescript
// app/server/controllers/users.controller.ts
import { UserService } from '@app/server/services/user.service'

export class UsersController {
  static async createUser(data: CreateUserRequest) {
    try {
      await UserService.validateUserData(data)
      const result = await UserService.createUserWithProfile(data)
      
      return {
        success: true as const,
        user: result.user,
        profile: result.profile
      }
    } catch (error) {
      if (error instanceof FluxStackError) {
        return {
          success: false as const,
          error: error.message
        }
      }
      throw error
    }
  }
}
```

## Error Handling

Use FluxStackError classes for structured errors:

```typescript
import {
  ValidationError,
  NotFoundError,
  ConflictError,
  UnauthorizedError,
  DatabaseError
} from '@core/utils/errors'

export class UsersController {
  static async updateUser(id: number, data: UpdateUserRequest) {
    // Validation errors (400)
    if (!data.name || data.name.length < 2) {
      throw new ValidationError('Name must be at least 2 characters')
    }

    // Not found errors (404)
    const user = await findUser(id)
    if (!user) {
      throw new NotFoundError('User', { id })
    }

    // Conflict errors (409)
    if (data.email !== user.email) {
      const emailExists = await checkEmailExists(data.email)
      if (emailExists) {
        throw new ConflictError('Email already in use', { email: data.email })
      }
    }

    // Database errors (500)
    try {
      const updated = await updateUserInDb(id, data)
      return { success: true, user: updated }
    } catch (error) {
      throw new DatabaseError('update', { id, error })
    }
  }
}
```

## Available Error Classes

```typescript
// Validation (400)
ValidationError
InvalidInputError
MissingRequiredFieldError

// Authentication (401)
UnauthorizedError
InvalidTokenError
TokenExpiredError

// Authorization (403)
ForbiddenError
InsufficientPermissionsError

// Not Found (404)
NotFoundError
ResourceNotFoundError
EndpointNotFoundError

// Conflict (409)
ConflictError
ResourceAlreadyExistsError

// Rate Limiting (429)
RateLimitExceededError

// Server Errors (500)
InternalServerError
DatabaseError
ExternalServiceError

// Service Unavailable (503)
ServiceUnavailableError
MaintenanceModeError
```

## Database Integration

Example with in-memory store (replace with real database):

```typescript
export class UsersController {
  private static users: User[] = []
  private static nextId = 1

  static async getUsers() {
    // In production: const users = await db.select().from(usersTable)
    return {
      success: true as const,
      users: this.users,
      count: this.users.length
    }
  }

  static async createUser(data: CreateUserRequest) {
    // In production: const user = await db.insert(usersTable).values(data)
    const newUser: User = {
      id: this.nextId++,
      ...data,
      createdAt: new Date()
    }
    
    this.users.push(newUser)
    
    return {
      success: true as const,
      user: newUser
    }
  }
}
```

With Drizzle ORM:

```typescript
import { db } from '@app/server/db'
import { users } from '@app/server/db/schema'
import { eq } from 'drizzle-orm'

export class UsersController {
  static async getUsers() {
    const userList = await db.select().from(users)
    
    return {
      success: true as const,
      users: userList,
      count: userList.length
    }
  }

  static async getUserById(id: number) {
    const [user] = await db
      .select()
      .from(users)
      .where(eq(users.id, id))
    
    if (!user) {
      return {
        success: false as const,
        error: 'User not found'
      }
    }
    
    return {
      success: true as const,
      user
    }
  }

  static async createUser(data: CreateUserRequest) {
    try {
      const [newUser] = await db
        .insert(users)
        .values(data)
        .returning()
      
      return {
        success: true as const,
        user: newUser
      }
    } catch (error) {
      throw new DatabaseError('insert', { error })
    }
  }
}
```

## Organization Patterns

### Simple Apps
```
app/server/
├── controllers/
│   ├── users.controller.ts
│   ├── posts.controller.ts
│   └── auth.controller.ts
└── routes/
    ├── users.routes.ts
    ├── posts.routes.ts
    └── auth.routes.ts
```

### Complex Apps
```
app/server/
├── controllers/
│   ├── users.controller.ts
│   └── posts.controller.ts
├── services/
│   ├── user.service.ts
│   ├── email.service.ts
│   └── storage.service.ts
├── repositories/
│   ├── user.repository.ts
│   └── post.repository.ts
└── routes/
    ├── users.routes.ts
    └── posts.routes.ts
```

## Testing Controllers

```typescript
// tests/unit/controllers/users.controller.test.ts
import { describe, it, expect, beforeEach } from 'vitest'
import { UsersController } from '@app/server/controllers/users.controller'

describe('UsersController', () => {
  beforeEach(() => {
    UsersController.resetForTesting()
  })

  it('should create a user', async () => {
    const result = await UsersController.createUser({
      name: 'John Doe',
      email: 'john@example.com'
    })

    expect(result.success).toBe(true)
    expect(result.user).toMatchObject({
      name: 'John Doe',
      email: 'john@example.com'
    })
  })

  it('should return error for duplicate email', async () => {
    await UsersController.createUser({
      name: 'John',
      email: 'john@example.com'
    })

    const result = await UsersController.createUser({
      name: 'Jane',
      email: 'john@example.com'
    })

    expect(result.success).toBe(false)
    expect(result.error).toContain('already in use')
  })
})
```

## Critical Rules

**ALWAYS:**
- Separate business logic from routes
- Return structured `{ success, data?, error? }` responses
- Use `as const` for literal types
- Handle errors with FluxStackError classes
- Validate input in controllers or services

**NEVER:**
- Put business logic directly in routes
- Return raw data without success/error structure
- Ignore error handling
- Mix database queries with route handlers
- Forget to set HTTP status codes in routes

## Related

- [Routes with Eden Treaty](./routes-eden.md)
- [Project Structure](../patterns/project-structure.md)
- [Anti-Patterns](../patterns/anti-patterns.md)
