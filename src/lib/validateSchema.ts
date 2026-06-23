export interface ValidationResult {
  valid:  boolean
  errors: string[]
}

type Schema = Record<string, unknown>

function jsType(v: unknown): string {
  return Array.isArray(v) ? 'array' : v === null ? 'null' : typeof v
}

function check(data: unknown, schema: unknown, errors: string[], path: string, maxErrors = 20) {
  if (errors.length >= maxErrors) return
  if (typeof schema !== 'object' || schema === null) return

  const s = schema as Schema

  // type
  if (s['type']) {
    const expected = s['type'] as string
    const actual   = jsType(data)
    if (actual !== expected) {
      errors.push(`${path || 'root'}: expected ${expected}, got ${actual}`)
      return
    }
  }

  if (typeof data !== 'object' || data === null) return

  if (Array.isArray(data)) {
    // items
    const items = s['items']
    if (items) {
      for (let i = 0; i < Math.min(data.length, 5); i++) {
        check(data[i], items, errors, `${path}[${i}]`, maxErrors)
      }
      if (data.length > 5) {
        // spot-check last item too
        check(data[data.length - 1], items, errors, `${path}[${data.length - 1}]`, maxErrors)
      }
    }
    return
  }

  const obj = data as Record<string, unknown>

  // required
  const required = s['required']
  if (Array.isArray(required)) {
    for (const field of required as string[]) {
      if (!(field in obj)) {
        errors.push(`${path ? path + '.' : ''}${field}: required field missing`)
      }
    }
  }

  // properties — only validate fields that are present
  const props = s['properties']
  if (props && typeof props === 'object') {
    for (const [key, propSchema] of Object.entries(props as Schema)) {
      if (key in obj) {
        check(obj[key], propSchema, errors, path ? `${path}.${key}` : key, maxErrors)
      }
    }
  }
}

export function validateAgainstSchema(data: unknown, schema: unknown): ValidationResult {
  const errors: string[] = []
  check(data, schema, errors, '')
  return { valid: errors.length === 0, errors }
}
