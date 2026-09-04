import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { createRequire } from 'node:module'
import { fileURLToPath } from 'node:url'

const require = createRequire(import.meta.url)
const root = fileURLToPath(new URL('..', import.meta.url))
const tsxCli = require.resolve('tsx/cli')

const result = spawnSync(
  process.execPath,
  [tsxCli, '--tsconfig', 'tsconfig.node.json', 'scripts/validate-reports.ts', '--fixtures-only'],
  { cwd: root, encoding: 'utf8' },
)

const output = `${result.stdout}${result.stderr}`.replace(/\x1b\[[0-9;]*m/g, '')

assert.equal(
  result.status,
  0,
  `fixture validation should accept current reviews and legacy runs aggregates\n${output}`,
)
assert.match(output, /reviews\s+2 \(/, 'current reviews aggregate was not validated')
assert.match(output, /runs\s+6 \(/, 'legacy runs aggregate was not validated')

console.log('validate-reports aggregate compatibility: passed')
