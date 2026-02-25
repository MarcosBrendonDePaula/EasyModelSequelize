import { Elysia, t } from 'elysia'
import { UsersController } from '@app/server/controllers/users.controller'
import type { CreateUserRequest } from '@app/shared/types'

// ===== Request/Response Schemas =====

const UserSchema = t.Object({
  id: t.Number(),
  name: t.String(),
  email: t.String()
}, {
  description: 'User object'
})

const CreateUserRequestSchema = t.Object({
  name: t.String({ minLength: 2, description: 'User name (minimum 2 characters)' }),
  email: t.String({ format: 'email', description: 'Valid email address' })
}, {
  description: 'Request body for creating a new user'
})

const CreateUserResponseSchema = t.Union([
  t.Object({
    success: t.Literal(true),
    user: UserSchema,
    message: t.Optional(t.String())
  }),
  t.Object({
    success: t.Literal(false),
    error: t.String()
  })
], {
  description: 'Response after attempting to create a user'
})

const GetUsersResponseSchema = t.Object({
  success: t.Boolean(),
  users: t.Array(UserSchema),
  count: t.Number()
}, {
  description: 'List of all users'
})

const GetUserResponseSchema = t.Union([
  t.Object({
    success: t.Literal(true),
    user: UserSchema
  }),
  t.Object({
    success: t.Literal(false),
    error: t.String()
  })
], {
  description: 'Single user or error'
})

const DeleteUserResponseSchema = t.Union([
  t.Object({
    success: t.Literal(true),
    message: t.String()
  }),
  t.Object({
    success: t.Literal(false),
    message: t.String()
  })
], {
  description: 'Result of delete operation'
})

const ErrorResponseSchema = t.Object({
  error: t.String()
}, {
  description: 'Error response'
})

/**
 * Users API Routes
 */
export const usersRoutes = new Elysia({ prefix: '/users', tags: ['Users'] })
  // GET /users - Get all users
  .get('/', async () => UsersController.getUsers(), {
    detail: {
      summary: 'Get All Users',
      description: 'Retrieves a list of all registered users',
      tags: ['Users', 'CRUD']
    },
    response: GetUsersResponseSchema
  })

  // GET /users/:id - Get user by ID
  .get('/:id', async ({ params, set }) => {
    const id = Number(params.id)

    if (!Number.isFinite(id)) {
      set.status = 400
      return { success: false, error: 'ID invalido' }
    }

    const result = await UsersController.getUserById(id)

    if (!result.success) {
      set.status = 404
      return result
    }

    return result
  }, {
    detail: {
      summary: 'Get User by ID',
      description: 'Retrieves a single user by their unique identifier',
      tags: ['Users', 'CRUD']
    },
    params: t.Object({
      id: t.String({ description: 'User ID' })
    }),
    response: {
      200: GetUserResponseSchema,
      400: ErrorResponseSchema,
      404: ErrorResponseSchema
    }
  })

  // POST /users - Create new user
  .post('/', async ({ body, set }) => {
    const payload = body as CreateUserRequest

    if (!payload.name || !payload.email) {
      set.status = 400
      return {
        success: false,
        error: 'Nome e email sao obrigatorios'
      }
    }

    if (payload.name.trim().length < 2) {
      set.status = 400
      return {
        success: false,
        error: 'Nome deve ter pelo menos 2 caracteres'
      }
    }

    const emailRegex = /^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)+$/
    if (!emailRegex.test(payload.email)) {
      set.status = 400
      return {
        success: false,
        error: 'Email invalido'
      }
    }

    const sanitizedPayload: CreateUserRequest = {
      name: payload.name.trim(),
      email: payload.email.trim()
    }

    const result = await UsersController.createUser(sanitizedPayload)

    if (!result.success) {
      set.status = 409
      return result
    }

    set.status = 201
    return result
  }, {
    detail: {
      summary: 'Create New User',
      description: 'Creates a new user with name and email. Email must be unique.',
      tags: ['Users', 'CRUD']
    },
    body: CreateUserRequestSchema,
    response: {
      201: CreateUserResponseSchema,
      400: t.Object({
        success: t.Literal(false),
        error: t.String()
      }),
      409: t.Object({
        success: t.Literal(false),
        error: t.String()
      })
    }
  })

  // DELETE /users/:id - Delete user
  .delete('/:id', async ({ params, set }) => {
    const id = Number(params.id)

    if (!Number.isFinite(id)) {
      set.status = 400
      return {
        success: false,
        message: 'ID invalido'
      }
    }

    const result = await UsersController.deleteUser(id)

    if (!result.success) {
      set.status = 404
      return result
    }

    return result
  }, {
    detail: {
      summary: 'Delete User',
      description: 'Deletes a user by their ID',
      tags: ['Users', 'CRUD']
    },
    params: t.Object({
      id: t.String({ description: 'User ID to delete' })
    }),
    response: {
      200: DeleteUserResponseSchema,
      400: t.Object({
        success: t.Literal(false),
        message: t.String()
      }),
      404: DeleteUserResponseSchema
    }
  })
