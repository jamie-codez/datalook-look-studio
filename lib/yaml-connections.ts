// Lightweight YAML parser/serializer for connection configuration files.
//
// Supports a subset of YAML sufficient for connection configs:
//   - key: value pairs (string, number, boolean)
//   - nested maps via indentation
//   - lists via "- " prefix
//   - comments (#)
//
// Example YAML:
//   connections:
//     - name: Analytics Replica
//       driver: postgres
//       host: db.example.internal
//       port: 5432
//       database: analytics
//       username: readonly
//       readOnly: true
//       topology: replicaSet
//       replicaHosts:
//         - host: replica-1.example.internal
//           port: 5432
//           role: secondary
//         - host: replica-2.example.internal
//           port: 5432
//           role: secondary

import type { DriverId, ReplicaHost } from './types'
import { DRIVERS } from './drivers'

export interface YamlConnectionConfig {
  name: string
  driver: DriverId
  host: string
  port: number
  database: string
  username: string
  password?: string
  readOnly: boolean
  topology?: 'standalone' | 'replicaSet' | 'masterSlave'
  replicaHosts?: ReplicaHost[]
}

// --- Parser ---

interface ParseLine {
  indent: number
  key?: string
  value?: string
  isListItem: boolean
  raw: string
}

function parseLine(raw: string): ParseLine {
  const trimmed = raw.replace(/#.*$/, '').trimEnd()
  const indent = raw.length - raw.trimStart().length
  const content = trimmed.trimStart()

  if (!content) return { indent, isListItem: false, raw }

  if (content.startsWith('- ')) {
    const rest = content.slice(2).trim()
    const colonIdx = rest.indexOf(':')
    if (colonIdx > 0) {
      const key = rest.slice(0, colonIdx).trim()
      const value = rest.slice(colonIdx + 1).trim()
      return { indent: indent + 2, key, value, isListItem: true, raw }
    }
    return { indent: indent + 2, value: rest, isListItem: true, raw }
  }

  const colonIdx = content.indexOf(':')
  if (colonIdx > 0) {
    const key = content.slice(0, colonIdx).trim()
    const value = content.slice(colonIdx + 1).trim()
    return { indent, key, value, isListItem: false, raw }
  }

  return { indent, value: content, isListItem: false, raw }
}

function coerceValue(value: string): string | number | boolean {
  if (value === 'true') return true
  if (value === 'false') return false
  if (/^-?\d+$/.test(value)) return parseInt(value, 10)
  if (/^-?\d+\.\d+$/.test(value)) return parseFloat(value)
  // strip quotes
  if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
    return value.slice(1, -1)
  }
  return value
}

function buildTree(lines: ParseLine[], startIdx: number, parentIndent: number): { obj: Record<string, unknown>; nextIdx: number } {
  const obj: Record<string, unknown> = {}
  let i = startIdx

  while (i < lines.length) {
    const line = lines[i]
    if (!line.key && !line.value && !line.isListItem) {
      i++
      continue
    }
    if (line.indent < parentIndent) break
    if (line.indent > parentIndent + 4) {
      i++
      continue
    }

    if (line.isListItem) {
      // This is a list item at parentIndent level — collect all items
      const list: unknown[] = []
      while (i < lines.length && lines[i].isListItem && lines[i].indent === line.indent) {
        const item = lines[i]
        if (item.key && item.value !== undefined) {
          // inline key-value in list item
          const itemObj: Record<string, unknown> = { [item.key]: coerceValue(item.value) }
          // collect nested keys
          i++
          while (i < lines.length && !lines[i].isListItem && lines[i].indent > item.indent && lines[i].key) {
            if (lines[i].value !== undefined && lines[i].value !== '') {
              itemObj[lines[i].key!] = coerceValue(lines[i].value!)
            } else {
              // nested map or list
              const { obj: nested, nextIdx } = buildTree(lines, i + 1, lines[i].indent)
              if (Array.isArray(nested.__list__)) {
                itemObj[lines[i].key!] = nested.__list__
              } else {
                itemObj[lines[i].key!] = nested
              }
              i = nextIdx
              continue
            }
            i++
          }
          list.push(itemObj)
        } else if (item.value) {
          list.push(coerceValue(item.value))
          i++
        } else {
          i++
        }
      }
      obj.__list__ = list
      continue
    }

    if (line.key && line.value !== undefined && line.value !== '') {
      obj[line.key] = coerceValue(line.value)
      i++
    } else if (line.key) {
      // nested map or list
      const { obj: nested, nextIdx } = buildTree(lines, i + 1, line.indent)
      if (Array.isArray(nested.__list__)) {
        obj[line.key] = nested.__list__
      } else {
        obj[line.key] = nested
      }
      i = nextIdx
    } else {
      i++
    }
  }

  return { obj, nextIdx: i }
}

export function parseYamlConnections(yaml: string): YamlConnectionConfig[] {
  const rawLines = yaml.split('\n')
  const parsedLines = rawLines.map(parseLine)
  const { obj } = buildTree(parsedLines, 0, -1)

  const connectionsRaw = (obj.connections as unknown[] | undefined) ?? (obj.__list__ as unknown[] | undefined) ?? []
  const configs: YamlConnectionConfig[] = []

  for (const item of connectionsRaw) {
    if (typeof item !== 'object' || item === null) continue
    const c = item as Record<string, unknown>
    const driver = c.driver as string
    if (!driver || !(driver in DRIVERS)) continue

    configs.push({
      name: String(c.name ?? 'Unnamed'),
      driver: driver as DriverId,
      host: String(c.host ?? ''),
      port: Number(c.port ?? 0),
      database: String(c.database ?? ''),
      username: String(c.username ?? 'app'),
      password: c.password ? String(c.password) : undefined,
      readOnly: Boolean(c.readOnly ?? false),
      topology: (c.topology as YamlConnectionConfig['topology']) ?? 'standalone',
      replicaHosts: Array.isArray(c.replicaHosts)
        ? (c.replicaHosts as Record<string, unknown>[]).map((r) => ({
            host: String(r.host ?? ''),
            port: Number(r.port ?? 0),
            role: (r.role as ReplicaHost['role']) ?? 'secondary',
            priority: r.priority !== undefined ? Number(r.priority) : undefined,
          }))
        : undefined,
    })
  }

  return configs
}

// --- Serializer ---

function serializeValue(value: unknown): string {
  if (typeof value === 'boolean') return String(value)
  if (typeof value === 'number') return String(value)
  if (typeof value === 'string') return value
  return String(value)
}

export function serializeYamlConnections(configs: YamlConnectionConfig[]): string {
  const lines: string[] = ['connections:']

  for (const c of configs) {
    lines.push(`  - name: ${serializeValue(c.name)}`)
    lines.push(`    driver: ${serializeValue(c.driver)}`)
    lines.push(`    host: ${serializeValue(c.host)}`)
    lines.push(`    port: ${serializeValue(c.port)}`)
    lines.push(`    database: ${serializeValue(c.database)}`)
    lines.push(`    username: ${serializeValue(c.username)}`)
    if (c.password) {
      lines.push(`    password: ${serializeValue(c.password)}`)
    }
    lines.push(`    readOnly: ${serializeValue(c.readOnly)}`)
    if (c.topology && c.topology !== 'standalone') {
      lines.push(`    topology: ${serializeValue(c.topology)}`)
    }
    if (c.replicaHosts && c.replicaHosts.length > 0) {
      lines.push('    replicaHosts:')
      for (const r of c.replicaHosts) {
        lines.push(`      - host: ${serializeValue(r.host)}`)
        lines.push(`        port: ${serializeValue(r.port)}`)
        lines.push(`        role: ${serializeValue(r.role)}`)
        if (r.priority !== undefined) {
          lines.push(`        priority: ${serializeValue(r.priority)}`)
        }
      }
    }
  }

  return lines.join('\n')
}
