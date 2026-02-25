# Routes with Eden Treaty

**Version:** 1.11.0 | **Updated:** 2025-02-08

## Quick Facts

- Routes use Elysia with `t.Object()` validation schemas
- **Response schemas are REQUIRED** for Eden Treaty type inference
- Frontend gets automatic type inference via Eden Treaty
- Route grouping uses `prefix` option
- Validation happens automatically via schemas

## Route Definition Pattern

```typescript
import { Elysia, t } from 'elysia'

export const usersRoutes = new Elysia({ prefix: '/users', tags: ['Users'] })
  .get('/', async () => {
    // Handler logic
    return { success: true, users: [], count: 0 }
  }, {
    detail: {
      summary: 'Get All Users',
      description: 'Retrieves a list of all registered users',
      tags: ['Users', 'CRUD']
    },
    response: t.Object({
      success: t.Boolean(),
      users: t.Array(UserSchema),
      count: t.Number()
    })
  })
```

## Schema Definition

Define schemas at the top of route files:

```typescript
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
```

## Response Schema (REQUIRED!)

**Every route MUST define a response schema** for Eden Treaty type inference:

```typescript
.get('/users', async () => {
  return { success: true, users: [] }
}, {
  response: t.Object({
    success: t.Boolean(),
    users: t.Array(UserSchema)
  })
})
```

Without response schema, frontend loses type inference.

## Multiple Status Code Responses

```typescript
.post('/', async ({ body, set }) => {
  // Validation error
  if (!body.name) {
    set.status = 400
    return { success: false, error: 'Name required' }
  }
  
  // Success
  set.status = 201
  return { success: true, user: newUser }
}, {
  body: CreateUserRequestSchema,
  response: {
    201: t.Object({
      success: t.Literal(true),
      user: UserSchema
    }),
    400: t.Object({
      success: t.Literal(false),
      error: t.String()
    })
  }
})
```

## Route Parameters

```typescript
.get('/:id', async ({ params }) => {
  const id = Number(params.id)
  return { success: true, user: foundUser }
}, {
  params: t.Object({
    id: t.String({ description: 'User ID' })
  }),
  response: {
    200: GetUserResponseSchema,
    404: ErrorResponseSchema
  }
})
```

## Request Body Validation

```typescript
.post('/', async ({ body }) => {
  // body is automatically validated against schema
  const user = await createUser(body)
  return { success: true, user }
}, {
  body: t.Object({
    name: t.String({ minLength: 2 }),
    email: t.String({ format: 'email' })
  }),
  response: CreateUserResponseSchema
})
```

## Route Grouping

```typescript
// Main API routes with prefix
export const apiRoutes = new Elysia({ prefix: "/api" })
  .get("/health", () => ({ status: "ok" }), {
    response: t.Object({ status: t.String() })
  })
  // Register sub-routes
  .use(usersRoutes)
  .use(postsRoutes)
```

## Frontend Usage (Eden Treaty)

Once routes are defined with response schemas, frontend gets automatic type inference:

```typescript
import { api } from '@/lib/eden-api'

// GET request - types inferred from response schema
const { data, error } = await api.users.get()
// data: { success: boolean, users: User[], count: number } | undefined
// error: Error | undefined

// POST request - body type inferred from body schema
const { data, error } = await api.users.post({
  name: 'John Doe',
  email: 'john@example.com'
})
// TypeScript validates body matches CreateUserRequestSchema

// Path parameters
const { data } = await api.users({ id: '123' }).get()

// Query parameters
const { data } = await api.users.get({ 
  query: { page: 1, limit: 10 } 
})
```

## Type Flow Diagram

```
Backend Route Definition
  ↓
t.Object() Schema (response)
  ↓
Eden Treaty Type Inference
  ↓
Frontend api.users.get()
  ↓
Typed { data, error }
```

## Common Validation Types

```typescript
// String validations
t.String({ minLength: 2, maxLength: 100 })
t.String({ format: 'email' })
t.String({ pattern: '^[a-z]+$' })

// Number validations
t.Number({ minimum: 0, maximum: 100 })
t.Integer()

// Arrays
t.Array(t.String())
t.Array(UserSchema, { minItems: 1 })

// Optional fields
t.Optional(t.String())

// Unions (multiple types)
t.Union([
  t.Object({ success: t.Literal(true), data: t.Any() }),
  t.Object({ success: t.Literal(false), error: t.String() })
])

// Enums
t.Union([t.Literal('active'), t.Literal('inactive')])
```

## OpenAPI Documentation

The `detail` object generates OpenAPI/Swagger documentation:

```typescript
.get('/users', handler, {
  detail: {
    summary: 'Get All Users',
    description: 'Retrieves a list of all registered users',
    tags: ['Users', 'CRUD']
  },
  response: ResponseSchema
})
```

Access Swagger UI at `/swagger` when server is running.

## Critical Rules

**ALWAYS:**
- Define response schema for every route
- Use `t.Object()` for validation
- Set `set.status` for non-200 responses
- Define schemas at file top for reusability

**NEVER:**
- Omit response schema (breaks type inference)
- Use plain objects without `t.Object()`
- Forget to validate user input
- Mix route logic with business logic (use controllers)

## Related

- [Controllers & Services](./controllers.md)
- [Type Safety Patterns](../patterns/type-safety.md)
- [Anti-Patterns](../patterns/anti-patterns.md)
