/**
 * FluxStack Testing Setup
 * Core testing utilities and configuration
 */

import { beforeEach, vi } from 'vitest'

/**
 * Setup global test environment
 */
export function setupFluxStackTests() {
  // Mock fetch globally
  global.fetch = vi.fn() as any

  // Mock localStorage
  const localStorageMock = {
    getItem: vi.fn(),
    setItem: vi.fn(),
    removeItem: vi.fn(),
    clear: vi.fn(),
    length: 0,
    key: vi.fn()
  }
  
  Object.defineProperty(window, 'localStorage', {
    value: localStorageMock
  })

  // Mock sessionStorage
  Object.defineProperty(window, 'sessionStorage', {
    value: localStorageMock
  })

  // Reset all mocks before each test
  beforeEach(() => {
    vi.clearAllMocks()
  })
}

/**
 * Create mock logger for testing
 */
export function createMockLogger() {
  return {
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    child: vi.fn().mockReturnValue({
      debug: vi.fn(),
      info: vi.fn(),
      warn: vi.fn(),
      error: vi.fn(),
      child: vi.fn()
    })
  }
}

/**
 * Create mock service context for testing
 */
export function createMockServiceContext(overrides: any = {}) {
  return {
    config: {},
    logger: createMockLogger(),
    services: {
      get: vi.fn(),
      register: vi.fn(),
      has: vi.fn(),
      remove: vi.fn()
    },
    ...overrides
  }
}