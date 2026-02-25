export interface ErrorMetadata {
  correlationId?: string
  userId?: string
  requestId?: string
  userAgent?: string
  ip?: string
  [key: string]: any
}

export interface ErrorSerializedResponse {
  error: {
    message: string
    code: string
    statusCode: number
    details?: any
    timestamp: string
    correlationId?: string
    stack?: string
  }
}

export class FluxStackError extends Error {
  public readonly code: string
  public readonly statusCode: number
  public readonly context?: any
  public readonly timestamp: Date
  public readonly metadata: ErrorMetadata
  public readonly isOperational: boolean
  public readonly userMessage?: string

  constructor(
    message: string,
    code: string,
    statusCode: number = 500,
    context?: any,
    metadata: ErrorMetadata = {},
    isOperational: boolean = true,
    userMessage?: string
  ) {
    super(message)
    this.name = 'FluxStackError'
    this.code = code
    this.statusCode = statusCode
    this.context = context
    this.timestamp = new Date()
    this.metadata = metadata
    this.isOperational = isOperational
    this.userMessage = userMessage

    // Maintain proper stack trace
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, FluxStackError)
    }
  }

  /**
   * Format stack trace to string (handles both string and CallSite array)
   */
  private formatStack(): string | undefined {
    if (!this.stack) return undefined

    // If stack is already a string, return it
    if (typeof this.stack === 'string') return this.stack

    // If stack is an array of CallSite objects (Bun), format them
    const stackValue = this.stack as unknown
    if (Array.isArray(stackValue)) {
      return stackValue
        .map((site: any) => {
          try {
            const fileName = site.getFileName?.() || 'unknown'
            const lineNumber = site.getLineNumber?.() || 0
            const columnNumber = site.getColumnNumber?.() || 0
            const functionName = site.getFunctionName?.() || 'anonymous'

            return `    at ${functionName} (${fileName}:${lineNumber}:${columnNumber})`
          } catch {
            return `    at ${String(site)}`
          }
        })
        .join('\n')
    }

    // Fallback: convert to string
    return String(this.stack)
  }

  toJSON() {
    return {
      name: this.name,
      message: this.message,
      code: this.code,
      statusCode: this.statusCode,
      context: this.context,
      timestamp: this.timestamp,
      metadata: this.metadata,
      isOperational: this.isOperational,
      userMessage: this.userMessage,
      stack: this.formatStack()
    }
  }

  toResponse(isDevelopment: boolean = false): ErrorSerializedResponse {
    return {
      error: {
        message: this.userMessage || this.message,
        code: this.code,
        statusCode: this.statusCode,
        ...(this.context && { details: this.context }),
        timestamp: this.timestamp.toISOString(),
        ...(this.metadata.correlationId && { correlationId: this.metadata.correlationId }),
        ...(isDevelopment && { stack: this.formatStack() })
      }
    }
  }

  withMetadata(metadata: ErrorMetadata): FluxStackError {
    return new FluxStackError(
      this.message,
      this.code,
      this.statusCode,
      this.context,
      { ...this.metadata, ...metadata },
      this.isOperational,
      this.userMessage
    )
  }

  withCorrelationId(correlationId: string): FluxStackError {
    return this.withMetadata({ correlationId })
  }
}

// Validation Errors (400)
export class ValidationError extends FluxStackError {
  constructor(message: string, context?: any, metadata?: ErrorMetadata) {
    super(
      message, 
      'VALIDATION_ERROR', 
      400, 
      context, 
      metadata, 
      true,
      'Please check your input and try again'
    )
    this.name = 'ValidationError'
  }
}

export class InvalidInputError extends FluxStackError {
  constructor(field: string, value?: any, metadata?: ErrorMetadata) {
    super(
      `Invalid input for field: ${field}`,
      'INVALID_INPUT',
      400,
      { field, value },
      metadata,
      true,
      `The value provided for ${field} is not valid`
    )
    this.name = 'InvalidInputError'
  }
}

export class MissingRequiredFieldError extends FluxStackError {
  constructor(field: string, metadata?: ErrorMetadata) {
    super(
      `Missing required field: ${field}`,
      'MISSING_REQUIRED_FIELD',
      400,
      { field },
      metadata,
      true,
      `The field ${field} is required`
    )
    this.name = 'MissingRequiredFieldError'
  }
}

// Authentication Errors (401)
export class UnauthorizedError extends FluxStackError {
  constructor(message: string = 'Authentication required', context?: any, metadata?: ErrorMetadata) {
    super(
      message, 
      'UNAUTHORIZED', 
      401, 
      context, 
      metadata, 
      true,
      'Please log in to access this resource'
    )
    this.name = 'UnauthorizedError'
  }
}

export class InvalidTokenError extends FluxStackError {
  constructor(metadata?: ErrorMetadata) {
    super(
      'Invalid authentication token',
      'INVALID_TOKEN',
      401,
      undefined,
      metadata,
      true,
      'Your session has expired. Please log in again'
    )
    this.name = 'InvalidTokenError'
  }
}

export class TokenExpiredError extends FluxStackError {
  constructor(metadata?: ErrorMetadata) {
    super(
      'Authentication token has expired',
      'TOKEN_EXPIRED',
      401,
      undefined,
      metadata,
      true,
      'Your session has expired. Please log in again'
    )
    this.name = 'TokenExpiredError'
  }
}

// Authorization Errors (403)
export class ForbiddenError extends FluxStackError {
  constructor(message: string = 'Access forbidden', context?: any, metadata?: ErrorMetadata) {
    super(
      message, 
      'FORBIDDEN', 
      403, 
      context, 
      metadata, 
      true,
      'You do not have permission to access this resource'
    )
    this.name = 'ForbiddenError'
  }
}

export class InsufficientPermissionsError extends FluxStackError {
  constructor(requiredPermission: string, metadata?: ErrorMetadata) {
    super(
      `Insufficient permissions: ${requiredPermission} required`,
      'INSUFFICIENT_PERMISSIONS',
      403,
      { requiredPermission },
      metadata,
      true,
      'You do not have the required permissions for this action'
    )
    this.name = 'InsufficientPermissionsError'
  }
}

// Not Found Errors (404)
export class NotFoundError extends FluxStackError {
  constructor(resource: string, context?: any, metadata?: ErrorMetadata) {
    super(
      `${resource} not found`, 
      'NOT_FOUND', 
      404, 
      context, 
      metadata, 
      true,
      'The requested resource could not be found'
    )
    this.name = 'NotFoundError'
  }
}

export class ResourceNotFoundError extends FluxStackError {
  constructor(resourceType: string, identifier: string, metadata?: ErrorMetadata) {
    super(
      `${resourceType} with identifier '${identifier}' not found`,
      'RESOURCE_NOT_FOUND',
      404,
      { resourceType, identifier },
      metadata,
      true,
      `The requested ${resourceType.toLowerCase()} could not be found`
    )
    this.name = 'ResourceNotFoundError'
  }
}

export class EndpointNotFoundError extends FluxStackError {
  constructor(method: string, path: string, metadata?: ErrorMetadata) {
    super(
      `Endpoint not found: ${method} ${path}`,
      'ENDPOINT_NOT_FOUND',
      404,
      { method, path },
      metadata,
      true,
      'The requested API endpoint does not exist'
    )
    this.name = 'EndpointNotFoundError'
  }
}

// Conflict Errors (409)
export class ConflictError extends FluxStackError {
  constructor(message: string, context?: any, metadata?: ErrorMetadata) {
    super(
      message, 
      'CONFLICT', 
      409, 
      context, 
      metadata, 
      true,
      'There was a conflict with the current state of the resource'
    )
    this.name = 'ConflictError'
  }
}

export class ResourceAlreadyExistsError extends FluxStackError {
  constructor(resourceType: string, identifier: string, metadata?: ErrorMetadata) {
    super(
      `${resourceType} with identifier '${identifier}' already exists`,
      'RESOURCE_ALREADY_EXISTS',
      409,
      { resourceType, identifier },
      metadata,
      true,
      `A ${resourceType.toLowerCase()} with that identifier already exists`
    )
    this.name = 'ResourceAlreadyExistsError'
  }
}

// Rate Limiting Errors (429)
export class RateLimitExceededError extends FluxStackError {
  constructor(limit: number, windowMs: number, metadata?: ErrorMetadata) {
    super(
      `Rate limit exceeded: ${limit} requests per ${windowMs}ms`,
      'RATE_LIMIT_EXCEEDED',
      429,
      { limit, windowMs },
      metadata,
      true,
      'Too many requests. Please try again later'
    )
    this.name = 'RateLimitExceededError'
  }
}

// Server Errors (500)
export class InternalServerError extends FluxStackError {
  constructor(message: string = 'Internal server error', context?: any, metadata?: ErrorMetadata) {
    super(
      message, 
      'INTERNAL_SERVER_ERROR', 
      500, 
      context, 
      metadata, 
      false,
      'An unexpected error occurred. Please try again later'
    )
    this.name = 'InternalServerError'
  }
}

export class DatabaseError extends FluxStackError {
  constructor(operation: string, details?: any, metadata?: ErrorMetadata) {
    super(
      `Database operation failed: ${operation}`,
      'DATABASE_ERROR',
      500,
      { operation, details },
      metadata,
      false,
      'A database error occurred. Please try again later'
    )
    this.name = 'DatabaseError'
  }
}

export class ExternalServiceError extends FluxStackError {
  constructor(service: string, details?: any, metadata?: ErrorMetadata) {
    super(
      `External service error: ${service}`,
      'EXTERNAL_SERVICE_ERROR',
      500,
      { service, details },
      metadata,
      false,
      'An external service is currently unavailable. Please try again later'
    )
    this.name = 'ExternalServiceError'
  }
}

// Service Unavailable Errors (503)
export class ServiceUnavailableError extends FluxStackError {
  constructor(message: string = 'Service unavailable', context?: any, metadata?: ErrorMetadata) {
    super(
      message, 
      'SERVICE_UNAVAILABLE', 
      503, 
      context, 
      metadata, 
      true,
      'The service is temporarily unavailable. Please try again later'
    )
    this.name = 'ServiceUnavailableError'
  }
}

export class MaintenanceModeError extends FluxStackError {
  constructor(estimatedDuration?: string, metadata?: ErrorMetadata) {
    super(
      'Service is under maintenance',
      'MAINTENANCE_MODE',
      503,
      { estimatedDuration },
      metadata,
      true,
      estimatedDuration 
        ? `The service is under maintenance. Expected to be back ${estimatedDuration}`
        : 'The service is under maintenance. Please try again later'
    )
    this.name = 'MaintenanceModeError'
  }
}

// Plugin Errors
export class PluginError extends FluxStackError {
  constructor(pluginName: string, message: string, context?: any, metadata?: ErrorMetadata) {
    super(
      `Plugin error in ${pluginName}: ${message}`,
      'PLUGIN_ERROR',
      500,
      { pluginName, ...context },
      metadata,
      false,
      'A plugin error occurred. Please contact support if this persists'
    )
    this.name = 'PluginError'
  }
}

export class PluginNotFoundError extends FluxStackError {
  constructor(pluginName: string, metadata?: ErrorMetadata) {
    super(
      `Plugin not found: ${pluginName}`,
      'PLUGIN_NOT_FOUND',
      404,
      { pluginName },
      metadata,
      true,
      `The requested plugin '${pluginName}' is not available`
    )
    this.name = 'PluginNotFoundError'
  }
}

// Configuration Errors
export class ConfigError extends FluxStackError {
  constructor(message: string, context?: any, metadata?: ErrorMetadata) {
    super(
      `Configuration error: ${message}`,
      'CONFIG_ERROR',
      500,
      context,
      metadata,
      false,
      'A configuration error occurred. Please check your settings'
    )
    this.name = 'ConfigError'
  }
}

export class InvalidConfigError extends FluxStackError {
  constructor(field: string, value?: any, metadata?: ErrorMetadata) {
    super(
      `Invalid configuration for field: ${field}`,
      'INVALID_CONFIG',
      500,
      { field, value },
      metadata,
      false,
      'Invalid configuration detected. Please check your settings'
    )
    this.name = 'InvalidConfigError'
  }
}

// Build Errors
export class BuildError extends FluxStackError {
  constructor(message: string, context?: any, metadata?: ErrorMetadata) {
    super(
      `Build error: ${message}`,
      'BUILD_ERROR',
      500,
      context,
      metadata,
      false,
      'A build error occurred'
    )
    this.name = 'BuildError'
  }
}

export class CompilationError extends FluxStackError {
  constructor(file: string, details?: any, metadata?: ErrorMetadata) {
    super(
      `Compilation failed for file: ${file}`,
      'COMPILATION_ERROR',
      500,
      { file, details },
      metadata,
      false,
      'Compilation failed'
    )
    this.name = 'CompilationError'
  }
}

// Utility functions for error handling
export const isFluxStackError = (error: any): error is FluxStackError => {
  return error instanceof FluxStackError
}

export const isOperationalError = (error: any): boolean => {
  return isFluxStackError(error) && error.isOperational
}

export const createErrorFromCode = (
  code: string, 
  message?: string, 
  context?: any, 
  metadata?: ErrorMetadata
): FluxStackError => {
  switch (code) {
    case 'VALIDATION_ERROR':
      return new ValidationError(message || 'Validation failed', context, metadata)
    case 'INVALID_INPUT':
      return new InvalidInputError(context?.field || 'unknown', context?.value, metadata)
    case 'MISSING_REQUIRED_FIELD':
      return new MissingRequiredFieldError(context?.field || 'unknown', metadata)
    case 'UNAUTHORIZED':
      return new UnauthorizedError(message, context, metadata)
    case 'INVALID_TOKEN':
      return new InvalidTokenError(metadata)
    case 'TOKEN_EXPIRED':
      return new TokenExpiredError(metadata)
    case 'FORBIDDEN':
      return new ForbiddenError(message, context, metadata)
    case 'INSUFFICIENT_PERMISSIONS':
      return new InsufficientPermissionsError(context?.requiredPermission || 'unknown', metadata)
    case 'NOT_FOUND':
      return new NotFoundError(context?.resource || 'Resource', context, metadata)
    case 'RESOURCE_NOT_FOUND':
      return new ResourceNotFoundError(
        context?.resourceType || 'Resource', 
        context?.identifier || 'unknown', 
        metadata
      )
    case 'ENDPOINT_NOT_FOUND':
      return new EndpointNotFoundError(
        context?.method || 'GET', 
        context?.path || '/unknown', 
        metadata
      )
    case 'CONFLICT':
      return new ConflictError(message || 'Resource conflict', context, metadata)
    case 'RESOURCE_ALREADY_EXISTS':
      return new ResourceAlreadyExistsError(
        context?.resourceType || 'Resource',
        context?.identifier || 'unknown',
        metadata
      )
    case 'RATE_LIMIT_EXCEEDED':
      return new RateLimitExceededError(
        context?.limit || 100,
        context?.windowMs || 60000,
        metadata
      )
    case 'INTERNAL_SERVER_ERROR':
      return new InternalServerError(message, context, metadata)
    case 'DATABASE_ERROR':
      return new DatabaseError(context?.operation || 'unknown', context?.details, metadata)
    case 'EXTERNAL_SERVICE_ERROR':
      return new ExternalServiceError(context?.service || 'unknown', context?.details, metadata)
    case 'SERVICE_UNAVAILABLE':
      return new ServiceUnavailableError(message, context, metadata)
    case 'MAINTENANCE_MODE':
      return new MaintenanceModeError(context?.estimatedDuration, metadata)
    case 'PLUGIN_ERROR':
      return new PluginError(
        context?.pluginName || 'unknown',
        message || 'Plugin error',
        context,
        metadata
      )
    case 'PLUGIN_NOT_FOUND':
      return new PluginNotFoundError(context?.pluginName || 'unknown', metadata)
    case 'CONFIG_ERROR':
      return new ConfigError(message || 'Configuration error', context, metadata)
    case 'INVALID_CONFIG':
      return new InvalidConfigError(context?.field || 'unknown', context?.value, metadata)
    case 'BUILD_ERROR':
      return new BuildError(message || 'Build error', context, metadata)
    case 'COMPILATION_ERROR':
      return new CompilationError(context?.file || 'unknown', context?.details, metadata)
    default:
      return new FluxStackError(message || 'Unknown error', code, 500, context, metadata)
  }
}

export const wrapError = (error: Error, metadata?: ErrorMetadata): FluxStackError => {
  if (isFluxStackError(error)) {
    return metadata ? error.withMetadata(metadata) : error
  }

  // Detect Elysia validation errors (thrown by TypeBox schema validation)
  const errorAny = error as any
  if (
    error.constructor?.name === 'ValidationError' ||
    error.constructor?.name === 'TransformDecodeError' ||
    (typeof errorAny.status === 'number' && errorAny.status >= 400 && errorAny.status < 500)
  ) {
    const status = errorAny.status ?? 422
    const message = error.message || 'Validation failed'
    return new ValidationError(message, { originalError: error.name, status }, metadata)
  }

  return new InternalServerError(error.message, { originalError: error.name }, metadata)
}

// Re-export error codes for convenience
export { ERROR_CODES, type ErrorCode, getErrorMessage } from './codes'
