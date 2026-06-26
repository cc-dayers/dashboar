/**
 * Run with:  npx tsx src/lib/schemaVersion.test.ts
 */
import assert from 'node:assert/strict'
import { resolveSchemaVersion, isSupportedVersion, SUPPORTED_VERSIONS } from './schemaVersion.js'

let passed = 0
let failed = 0

function test(name: string, fn: () => void) {
  try {
    fn()
    console.log(`  ✓ ${name}`)
    passed++
  } catch (err) {
    console.error(`  ✗ ${name}`)
    console.error(`    ${err instanceof Error ? err.message : err}`)
    failed++
  }
}

// ── resolveSchemaVersion ──────────────────────────────────────────────────────

console.log('\nresolveSchemaVersion')

test('explicit schemaVersion takes precedence', () => {
  const r = resolveSchemaVersion({ schemaVersion: '1', $schema: 'report.v99.schema.json', reviews: [] })
  assert.equal(r.version, '1')
  assert.equal(r.source, 'explicit')
})

test('infers version from $schema when schemaVersion absent', () => {
  const r = resolveSchemaVersion({ $schema: 'report.v1.schema.json', reviews: [] })
  assert.equal(r.version, '1')
  assert.equal(r.source, 'inferred')
})

test('handles $schema with a path prefix', () => {
  const r = resolveSchemaVersion({ $schema: 'https://example.com/schemas/report.v2.schema.json', reviews: [] })
  assert.equal(r.version, '2')
  assert.equal(r.source, 'inferred')
})

test('falls back to legacy when no version fields present', () => {
  const r = resolveSchemaVersion({ title: 'Old report', reviews: [] })
  assert.equal(r.version, 'legacy')
  assert.equal(r.source, 'legacy')
})

test('falls back to legacy for null input', () => {
  const r = resolveSchemaVersion(null)
  assert.equal(r.version, 'legacy')
  assert.equal(r.source, 'legacy')
})

test('falls back to legacy for non-object input', () => {
  const r = resolveSchemaVersion('not an object')
  assert.equal(r.version, 'legacy')
  assert.equal(r.source, 'legacy')
})

test('does not infer from $schema that does not match pattern', () => {
  const r = resolveSchemaVersion({ $schema: 'http://json-schema.org/draft-07/schema#', reviews: [] })
  assert.equal(r.version, 'legacy')
})

test('ignores empty string schemaVersion', () => {
  const r = resolveSchemaVersion({ schemaVersion: '' })
  assert.equal(r.version, 'legacy')
})

// ── isSupportedVersion ────────────────────────────────────────────────────────

console.log('\nisSupportedVersion')

test('"1" is supported', () => assert.ok(isSupportedVersion('1')))
test('"legacy" is supported', () => assert.ok(isSupportedVersion('legacy')))
test('"0" is not supported (use "legacy" for pre-versioned reports)', () => assert.ok(!isSupportedVersion('0')))
test('"99" is not supported (future unknown version)', () => assert.ok(!isSupportedVersion('99')))
test('"2" is supported', () => assert.ok(isSupportedVersion('2')))

// ── SUPPORTED_VERSIONS set ────────────────────────────────────────────────────

console.log('\nSUPPORTED_VERSIONS')

test('contains "1", "2", and "legacy"', () => {
  assert.deepEqual([...SUPPORTED_VERSIONS].sort(), ['1', '2', 'legacy'].sort())
})

// ── Summary ───────────────────────────────────────────────────────────────────

console.log(`\n${passed + failed} tests: ${passed} passed, ${failed} failed\n`)
if (failed > 0) process.exit(1)
