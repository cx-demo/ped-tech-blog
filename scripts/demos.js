#!/usr/bin/env node
import { writeFile } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { exportDemo, loadCatalog } from '../src/catalog.js'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const demosDir = path.resolve(process.env.DEMOS_DIR || path.join(root, 'demos'))
const [command, id, output] = process.argv.slice(2)

const usage = `Usage:
  npm run demos:check                      Validate every demo folder
  npm run demos:pack -- <id> [file.zip]    Write a demo archive (same as web export)

Set DEMOS_DIR to use a directory other than ./demos.`

async function check() {
  const { demos, warnings } = await loadCatalog({ bundledDir: demosDir, demosDir })
  for (const demo of demos) console.log(`ok    ${demo.id}  (${demo.files.length} files, tags: ${demo.tags.join(', ')})`)
  for (const warning of warnings) console.error(`error ${warning}`)
  console.log(`\n${demos.length} valid demo(s), ${warnings.length} problem(s) in ${path.relative(process.cwd(), demosDir) || '.'}`)
  if (warnings.length) process.exitCode = 1
}

async function pack() {
  if (!id) throw new Error(`Missing demo ID.\n\n${usage}`)
  const { demos } = await loadCatalog({ bundledDir: demosDir, demosDir })
  const demo = demos.find((value) => value.id === id)
  if (!demo) throw new Error(`No valid demo with ID "${id}". Run "npm run demos:check" for details.`)
  const destination = path.resolve(output || `${id}.zip`)
  await writeFile(destination, await exportDemo(demo))
  const shown = path.relative(process.cwd(), destination)
  console.log(`Wrote ${shown.startsWith('..') ? destination : shown}`)
}

try {
  if (command === 'check') await check()
  else if (command === 'pack') await pack()
  else {
    console.log(usage)
    if (command && command !== 'help') process.exitCode = 1
  }
} catch (error) {
  console.error(error.message)
  process.exitCode = 1
}
