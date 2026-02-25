/**
 * Services Configuration
 * Optional service settings (email, JWT, storage, redis) for compatibility
 */

import { defineNestedConfig, config } from '@core/utils/config-schema'

const emailSchema = {
  host: config.string('MAIL_HOST', 'smtp.example.com'),
  port: config.number('MAIL_PORT', 587),
  username: config.string('MAIL_USERNAME', ''),
  password: config.string('MAIL_PASSWORD', ''),
  fromAddress: config.string('MAIL_FROM_ADDRESS', 'no-reply@example.com'),
  secure: config.boolean('MAIL_SECURE', false)
} as const

const jwtSchema = {
  secret: config.string('JWT_SECRET', 'change-me'),
  expiresIn: config.string('JWT_EXPIRES_IN', '1h'),
  audience: config.string('JWT_AUDIENCE', 'fluxstack'),
  issuer: config.string('JWT_ISSUER', 'fluxstack')
} as const

const storageSchema = {
  driver: config.enum('STORAGE_DRIVER', ['local', 's3'] as const, 'local'),
  localDir: config.string('STORAGE_LOCAL_DIR', 'uploads'),
  s3Bucket: config.string('STORAGE_S3_BUCKET', ''),
  s3Region: config.string('STORAGE_S3_REGION', ''),
  s3Endpoint: config.string('STORAGE_S3_ENDPOINT', '')
} as const

const redisSchema = {
  enabled: config.boolean('REDIS_ENABLED', false),
  url: config.string('REDIS_URL', 'redis://localhost:6379')
} as const

export const servicesConfig = defineNestedConfig({
  email: emailSchema,
  jwt: jwtSchema,
  storage: storageSchema,
  redis: redisSchema
})

export type ServicesConfig = typeof servicesConfig

export default servicesConfig
