import {
  DynamoDBClient,
  ListTablesCommand,
  DescribeTableCommand,
  ScanCommand,
  PutItemCommand,
  UpdateItemCommand,
  DeleteItemCommand,
} from '@aws-sdk/client-dynamodb'
import type { DBAdapter, ConnectionConfig, ColumnDef, FieldSample, QueryResult } from '../types'
import { DBError } from '../types'

export class DynamoDBAdapter implements DBAdapter {
  private client: DynamoDBClient | null = null
  private config: ConnectionConfig | null = null

  async connect(config: ConnectionConfig): Promise<void> {
    this.config = config
    try {
      // DynamoDB is region-scoped, not host-scoped.
      // For DynamoDB Local, endpoint is http://host:port
      const endpoint =
        config.host && config.port
          ? `http://${config.host}:${config.port}`
          : undefined

      this.client = new DynamoDBClient({
        region: config.region || 'us-east-1',
        endpoint,
        credentials: {
          accessKeyId: config.username || 'local',
          secretAccessKey: config.password || 'local',
        },
      })
      // Verify connectivity
      await this.client.send(new ListTablesCommand({ Limit: 1 }))
    } catch (err: any) {
      this.classifyError(err)
    }
  }

  async testConnection(): Promise<boolean> {
    if (!this.client) return false
    try {
      await this.client.send(new ListTablesCommand({ Limit: 1 }))
      return true
    } catch {
      return false
    }
  }

  async listDatabases(): Promise<string[]> {
    // DynamoDB has no "databases" — tables live directly under the account/region.
    // listDatabases returns an empty array; use listTablesOrCollections for tables.
    return []
  }

  async listTablesOrCollections(_database: string, _schema?: string): Promise<string[]> {
    if (!this.client) throw new DBError('Not connected', 'unknown')
    try {
      const tables: string[] = []
      let lastEvaluatedKey: Record<string, unknown> | undefined
      do {
        const res = await this.client.send(
          new ListTablesCommand({ ExclusiveStartTableName: lastEvaluatedKey as any }),
        )
        tables.push(...(res.TableNames || []))
        lastEvaluatedKey = res.LastEvaluatedTableName as any
      } while (lastEvaluatedKey)
      return tables.sort()
    } catch (err: any) {
      this.classifyError(err)
    }
  }

  async getStructure(table: string, _schema?: string): Promise<ColumnDef[]> {
    if (!this.client) throw new DBError('Not connected', 'unknown')
    try {
      const res = await this.client.send(
        new DescribeTableCommand({ TableName: table }),
      )
      const tableDesc = res.Table
      if (!tableDesc) throw new DBError(`Table not found: ${table}`, 'not-found')
      const keySchema = tableDesc.KeySchema || []
      const pkNames = new Set(keySchema.map((k) => k.AttributeName))
      const attrDefs = tableDesc.AttributeDefinitions || []
      const attrTypeMap = new Map(attrDefs.map((a) => [a.AttributeName, a.AttributeType]))
      return keySchema.map((k) => ({
        name: k.AttributeName || '',
        type: attrTypeMap.get(k.AttributeName) || 'S',
        nullable: false,
        isPrimaryKey: true,
      }))
    } catch (err: any) {
      this.classifyError(err)
    }
  }

  async query(raw: unknown): Promise<QueryResult> {
    if (!this.client) throw new DBError('Not connected', 'unknown')
    const start = Date.now()
    try {
      const q = typeof raw === 'string' ? JSON.parse(raw) : raw as any
      const tableName = q.tableName || q.collection

      // Scan / find
      if (!q.operation || q.operation === 'find' || q.operation === 'scan') {
        const res = await this.client.send(
          new ScanCommand({
            TableName: tableName,
            Limit: q.limit || 25,
          }),
        )
        const rows = (res.Items || []).map((item) => {
          const row: Record<string, unknown> = {}
          for (const [key, val] of Object.entries(item)) {
            const v = Object.values(val as any)[0]
            row[key] = v
          }
          return row
        })
        const durationMs = Date.now() - start
        const columns = rows.length > 0 ? Object.keys(rows[0]) : []
        return { columns, rows, durationMs, statement: JSON.stringify(q) }
      }

      // Insert — PutItem
      if (q.operation === 'insert') {
        const item: Record<string, any> = {}
        for (const [key, val] of Object.entries(q.document || {})) {
          if (typeof val === 'number') item[key] = { N: String(val) }
          else if (typeof val === 'boolean') item[key] = { BOOL: val }
          else item[key] = { S: String(val) }
        }
        await this.client.send(new PutItemCommand({ TableName: tableName, Item: item }))
        const durationMs = Date.now() - start
        return { columns: ['result'], rows: [{ result: 'OK' }], affectedRows: 1, durationMs, statement: JSON.stringify(q) }
      }

      // Update — UpdateItem
      if (q.operation === 'update') {
        const key: Record<string, any> = {}
        for (const [k, v] of Object.entries(q.filter || {})) {
          if (typeof v === 'number') key[k] = { N: String(v) }
          else key[k] = { S: String(v) }
        }
        const updates: Record<string, any> = {}
        for (const [k, v] of Object.entries(q.document || {})) {
          if (typeof v === 'number') updates[k] = { Value: { N: String(v) } }
          else if (typeof v === 'boolean') updates[k] = { Value: { BOOL: v } }
          else updates[k] = { Value: { S: String(v) } }
        }
        await this.client.send(new UpdateItemCommand({
          TableName: tableName,
          Key: key,
          AttributeUpdates: updates,
        }))
        const durationMs = Date.now() - start
        return { columns: ['result'], rows: [{ result: 'OK' }], affectedRows: 1, durationMs, statement: JSON.stringify(q) }
      }

      // Delete — DeleteItem
      if (q.operation === 'delete') {
        const key: Record<string, any> = {}
        for (const [k, v] of Object.entries(q.filter || {})) {
          if (typeof v === 'number') key[k] = { N: String(v) }
          else key[k] = { S: String(v) }
        }
        await this.client.send(new DeleteItemCommand({ TableName: tableName, Key: key }))
        const durationMs = Date.now() - start
        return { columns: ['result'], rows: [{ result: 'OK' }], affectedRows: 1, durationMs, statement: JSON.stringify(q) }
      }

      throw new Error('DynamoDB query expects { tableName, operation? }')
    } catch (err: any) {
      return {
        columns: [],
        rows: [],
        durationMs: Date.now() - start,
        error: err.message,
        statement: String(raw),
      }
    }
  }

  async disconnect(): Promise<void> {
    if (this.client) {
      this.client.destroy()
      this.client = null
    }
  }

  private classifyError(err: any): never {
    const msg = err.message || String(err)
    const name = err.name
    if (name === 'UnrecognizedClientException' || msg.includes('credentials') || msg.includes('ExpiredToken')) {
      throw new DBError(`Authentication failed: ${msg}`, 'auth', err)
    }
    if (name === 'AccessDeniedException' || name === 'ConditionalCheckFailedException') {
      throw new DBError(`Permission denied: ${msg}`, 'permission', err)
    }
    if (name === 'ResourceNotFoundException') {
      throw new DBError(`Table not found: ${msg}`, 'not-found', err)
    }
    if (msg.includes('timeout') || msg.includes('ETIMEDOUT')) {
      throw new DBError(`Connection timeout: ${msg}`, 'timeout', err)
    }
    if (msg.includes('ECONNREFUSED') || msg.includes('ENOTFOUND') || msg.includes('connect')) {
      throw new DBError(`Network error: ${msg}`, 'network', err)
    }
    throw new DBError(msg, 'unknown', err)
  }
}
