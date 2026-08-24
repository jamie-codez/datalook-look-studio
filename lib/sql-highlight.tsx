import * as React from 'react'
import type { DriverId } from './types'

const SQL_KEYWORDS = new Set(
  [
    'SELECT', 'FROM', 'WHERE', 'INSERT', 'INTO', 'VALUES', 'UPDATE', 'SET',
    'DELETE', 'CREATE', 'TABLE', 'DROP', 'ALTER', 'ADD', 'COLUMN', 'TRUNCATE',
    'JOIN', 'LEFT', 'RIGHT', 'INNER', 'OUTER', 'FULL', 'ON', 'AS', 'AND', 'OR',
    'NOT', 'NULL', 'IS', 'IN', 'LIKE', 'BETWEEN', 'ORDER', 'BY', 'GROUP',
    'HAVING', 'LIMIT', 'OFFSET', 'DISTINCT', 'COUNT', 'SUM', 'AVG', 'MIN',
    'MAX', 'ASC', 'DESC', 'UNION', 'ALL', 'CASE', 'WHEN', 'THEN', 'ELSE', 'END',
    'PRIMARY', 'KEY', 'FOREIGN', 'REFERENCES', 'DEFAULT', 'INDEX', 'VIEW',
    'WITH', 'RETURNING', 'BEGIN', 'COMMIT', 'ROLLBACK', 'EXPLAIN', 'ANALYZE',
  ].map((k) => k.toUpperCase()),
)

const MONGO_KEYWORDS = new Set(
  [
    'DB', 'GETCOLLECTION', 'FIND', 'FINDONE', 'AGGREGATE', 'INSERTONE',
    'INSERTMANY', 'UPDATEONE', 'UPDATEMANY', 'DELETEONE', 'DELETEMANY',
    'REPLACEONE', 'BULKWRITE', 'CREATEINDEX', 'DROPINDEX', 'GETCOLLECTIONNAMES',
    'CREATEDATABASE', 'DROPDATABASE', 'COUNT', 'DISTINCT', 'SORT', 'LIMIT',
    'SKIP', 'PROJECT', 'MATCH', 'GROUP', 'UNWIND', 'LOOKUP', 'COUNT',
    'BUCKET', 'FACET', 'SORTBYCOUNT', 'ADDFIELDS', 'SET', 'UNSET',
    'REPLACEWITH', 'MERGE', 'OUT', 'COLLSTATS', 'INDEXSTATS',
    'SUM', 'AVG', 'MIN', 'MAX', 'PUSH', 'ADDTOSET', 'FIRST', 'LAST',
    'CONCAT', 'TOUPPER', 'TOLOWER', 'STRLEN', 'SUBSTR', 'SPLIT',
    'USE', 'SHOW', 'COLLECTIONS', 'DATABASES',
    'TRUE', 'FALSE', 'NULL', 'UNDEFINED', 'NAN',
  ].map((k) => k.toUpperCase()),
)

const REDIS_KEYWORDS = new Set(
  [
    'GET', 'SET', 'DEL', 'EXISTS', 'EXPIRE', 'PEXPIRE', 'TTL', 'PTTL',
    'PERSIST', 'TYPE', 'KEYS', 'SCAN', 'RENAME', 'RENAMENX', 'RANDOMKEY',
    'DBSIZE', 'FLUSHDB', 'FLUSHALL', 'SELECT', 'MOVE', 'OBJECT', 'DUMP',
    'RESTORE', 'MGET', 'MSET', 'MSETNX', 'APPEND', 'STRLEN', 'INCR', 'DECR',
    'INCRBY', 'DECRBY', 'INCRBYFLOAT', 'GETRANGE', 'SETRANGE', 'GETSET',
    'HSET', 'HGET', 'HGETALL', 'HDEL', 'HEXISTS', 'HINCRBY', 'HKEYS', 'HVALS',
    'HLEN', 'HSETNX', 'HINCRBYFLOAT', 'HRANDFIELD', 'HSCAN',
    'LPUSH', 'RPUSH', 'LPOP', 'RPOP', 'LLEN', 'LRANGE', 'LINDEX', 'LSET',
    'LINSERT', 'LREM', 'LTRIM', 'LPOS', 'LPUSHX', 'RPUSHX',
    'SADD', 'SREM', 'SMEMBERS', 'SISMEMBER', 'SCARD', 'SPOP', 'SRANDMEMBER',
    'SINTER', 'SUNION', 'SDIFF', 'SINTERSTORE', 'SUNIONSTORE', 'SDIFFSTORE',
    'SMOVE', 'SSCAN',
    'ZADD', 'ZRANGE', 'ZRANGEBYSCORE', 'ZRANGEBYLEX', 'ZREVRANGE',
    'ZREVRANGEBYSCORE', 'ZSCORE', 'ZREM', 'ZREMRANGEBYRANK', 'ZREMRANGEBYSCORE',
    'ZCARD', 'ZCOUNT', 'ZINCRBY', 'ZRANK', 'ZREVRANK', 'ZUNIONSTORE',
    'ZINTERSTORE', 'ZSCAN', 'ZPOPMAX', 'ZPOPMIN', 'ZRANDMEMBER',
    'XADD', 'XLEN', 'XRANGE', 'XREVRANGE', 'XREAD', 'XREADGROUP', 'XGROUP',
    'XACK', 'XDEL', 'XTRIM', 'XINFO',
    'PUBLISH', 'SUBSCRIBE', 'UNSUBSCRIBE', 'PSUBSCRIBE', 'PUNSUBSCRIBE',
    'PUBSUB',
    'CLUSTER', 'INFO', 'SLOTS', 'NODES', 'FAILOVER', 'RESET', 'COUNTKEYSINSLOT',
    'GETKEYSINSLOT', 'ADDSLOTS', 'DELSLOTS', 'ADDSLOTSRANGE', 'DELSLOTSRANGE',
    'SETSLOT', 'MEET', 'FORGET', 'REPLICATE', 'BUMPEPOCH',
    'EVAL', 'EVALSHA', 'SCRIPT', 'LOAD', 'EXISTS', 'FLUSH', 'KILL',
    'AUTH', 'PING', 'ECHO', 'QUIT', 'SELECT', 'SWAPDB', 'COMMAND',
    'CONFIG', 'GET', 'SET', 'RESETSTAT', 'REWRITE',
    'CLIENT', 'ID', 'GETNAME', 'SETNAME', 'LIST', 'PAUSE', 'RESUME',
    'UNPAUSE', 'KILL', 'NO-EVICT', 'NO-TOUCH', 'REPLY', 'UNPAUSE',
    'MEMORY', 'USAGE', 'STATS', 'DOCTOR', 'PURGE', 'MALLOC-STATS',
    'LATENCY', 'GRAPH', 'HISTORY', 'LATEST', 'RESET', 'DOCTOR',
    'SLOWLOG', 'GET', 'RESET', 'LEN',
    'ACL', 'SETUSER', 'GETUSER', 'DELUSER', 'CAT', 'WHOAMI', 'LIST',
    'LOG', 'HELP', 'LOADFROMCODE', 'SAVE',
    'BGSAVE', 'BGREWRITEAOF', 'SAVE', 'LASTSAVE', 'DEBUG', 'SLEEP',
    'OBJECT', 'GETREFCOUNT', 'GETENCODING', 'GETIDLETIME', 'GETFREQ',
    'SETFREQ', 'HELP', 'SEGFAULT',
    'WAIT', 'MULTI', 'EXEC', 'DISCARD', 'WATCH', 'UNWATCH',
    'COPY', 'DUMP', 'RESTORE', 'MIGRATE',
    'GEOADD', 'GEODIST', 'GEOHASH', 'GEOPOS', 'GEORADIUS', 'GEORADIUSBYMEMBER',
    'GEOSEARCH', 'GEOSEARCHSTORE',
    'BITCOUNT', 'BITFIELD', 'BITOP', 'BITPOS', 'GETBIT', 'SETBIT',
    'PFADD', 'PFCOUNT', 'PFMERGE',
    'PSYNC', 'REPLICAOF', 'SLAVEOF', 'ROLE', 'SYNC',
    'SHUTDOWN', 'MONITOR', 'DEBUG', 'LOLWUT',
  ].map((k) => k.toUpperCase()),
)

const CASSANDRA_KEYWORDS = new Set(
  [
    'SELECT', 'FROM', 'WHERE', 'INSERT', 'INTO', 'VALUES', 'UPDATE', 'SET',
    'DELETE', 'CREATE', 'KEYSPACE', 'TABLE', 'DROP', 'ALTER', 'ADD', 'COLUMN',
    'TRUNCATE', 'USING', 'TTL', 'WRITETIME', 'TIMESTAMP', 'CONSISTENCY',
    'QUORUM', 'LOCAL', 'ONE', 'TWO', 'THREE', 'ALL', 'EACH', 'SERIAL',
    'LOCAL_QUORUM', 'EACH_QUORUM', 'LOCAL_ONE', 'LOCAL_SERIAL',
    'IF', 'EXISTS', 'NOT', 'NULL', 'IS', 'IN', 'CONTAINS', 'KEYS',
    'ENTRIES', 'FULL', 'PER', 'PARTITION', 'LIMIT', 'ALLOW', 'FILTERING',
    'ORDER', 'BY', 'ASC', 'DESC', 'GROUP', 'DISTINCT', 'AS',
    'AND', 'OR', 'PRIMARY', 'CLUSTERING', 'STATIC', 'FROZEN',
    'COUNTER', 'TUPLE', 'UDT', 'MAP', 'SET', 'LIST', 'COLLECTION',
    'COMPACT', 'STORAGE', 'WITH', 'OPTIONS', 'REPLICATION', 'CLASS',
    'SIMPLESTRATEGY', 'NETWORKTOPOLOGYSTRATEGY', 'REPLICATIONFACTOR',
    'DURABLE_WRITES', 'SUPERUSER', 'NOSUPERUSER', 'PASSWORD', 'LOGIN',
    'GRANT', 'REVOKE', 'CREATE', 'ALTER', 'DROP', 'LIST', 'DESCRIBE',
    'USE', 'SOURCE', 'CAPTURE', 'SHOW', 'HELP', 'EXIT', 'QUIT', 'CLEAR',
    'PAGING', 'EXPAND', 'CONSISTENCYLEVEL', 'TRACING', 'TIMING',
    'BATCH', 'UNLOGGED', 'COUNTER', 'USING', 'TIMESTAMP', 'TTL',
    'FUNCTION', 'AGGREGATE', 'TRIGGER', 'TYPE', 'INDEX', 'MATERIALIZED',
    'VIEW', 'SASI', 'STORAGE', 'ATTACHED', 'INDEXES',
    'COUNT', 'SUM', 'AVG', 'MIN', 'MAX', 'WRITETIME', 'TTL',
    'TOKEN', 'WRITETIME', 'TTL', 'CAST', 'BLOBASTEXT', 'TEXTASBLOB',
    'TODATE', 'TOTIMESTAMP', 'TOUNIXTIMESTAMP', 'DATEOF', 'UNIXTIMESTAMPOF',
    'TIMEUUID', 'NOW', 'MINTIMEUUID', 'MAXTIMEUUID', 'TIMEUUIDTODATE',
    'DATETOTIMEUUID',
    'JSON', 'TOJSON', 'FROMJSON',
    'BEGIN', 'BATCH', 'APPLY', 'BATCH',
  ].map((k) => k.toUpperCase()),
)

const DYNAMODB_KEYWORDS = new Set(
  [
    'QUERY', 'SCAN', 'GETITEM', 'PUTITEM', 'UPDATEITEM', 'DELETEITEM',
    'BATCHGETITEM', 'BATCHWRITEITEM', 'TRANSACTGETITEMS', 'TRANSACTWRITEITEMS',
    'CREATETABLE', 'DELETETABLE', 'UPDATETABLE', 'DESCRIBETABLE',
    'LISTTABLES', 'CREATEINDEX', 'DELETEINDEX', 'UPDATEINDEX',
    'KEYSCHEMA', 'ATTRIBUTENAME', 'KEYTYPE', 'HASH', 'RANGE',
    'ATTRIBUTETYPE', 'S', 'N', 'B', 'SS', 'NS', 'BS', 'BOOL', 'NULL',
    'L', 'M',
    'PROVISIONEDTHROUGHPUT', 'READCAPACITYUNITS', 'WRITECAPACITYUNITS',
    'BILLINGMODE', 'PROVISIONED', 'PAY_PER_REQUEST',
    'GLOBALSECONDARYINDEX', 'LOCALSECONDARYINDEX',
    'PROJECTIONTYPE', 'ALL', 'KEYS_ONLY', 'INCLUDE',
    'NONKEYATTRIBUTES', 'CONSISTENTREAD', 'RETURNCONSUMEDCAPACITY',
    'RETURNITEMCOLLECTIONMETRICS', 'RETURNSPECIFIC',
    'RETURNVALUES', 'NONE', 'ALL_OLD', 'UPDATED_OLD', 'ALL_NEW', 'UPDATED_NEW',
    'CONDITIONEXPRESSION', 'KEYCONDITIONEXPRESSION', 'FILTEREXPRESSION',
    'PROJECTIONEXPRESSION', 'UPDATEEXPRESSION', 'EXPRESSIONATTRIBUTENAMES',
    'EXPRESSIONATTRIBUTEVALUES',
    'SET', 'REMOVE', 'ADD', 'DELETE', 'IF', 'NOT', 'EXISTS', 'BEGINS_WITH',
    'CONTAINS', 'SIZE', 'ATTRIBUTETYPE', 'BETWEEN', 'IN', 'AND', 'OR',
    'NULL', 'TRUE', 'FALSE',
    'TABLENAME', 'INDEXNAME', 'KEYCONDITIONS', 'SCANINDEXFORWARD',
    'LIMIT', 'EXCLUSIVESTARTKEY', 'LASTEVALUATEDKEY',
    'ITEMS', 'COUNT', 'SELECTEDATTRIBUTES',
    'SEGMENT', 'TOTALSEGMENTS', 'PARALLEL',
    'CONSUMEDCAPACITY', 'TABLE', 'INDEXES', 'CAPACITYUNITS',
    'ITEMCOLLECTIONMETRICS', 'ITEMCOLLECTIONKEY',
    'TRANSACTITEMS', 'CONDITIONCHECK', 'CLIENTREQUESTTOKEN',
  ].map((k) => k.toUpperCase()),
)

const COUCHDB_KEYWORDS = new Set(
  [
    'SELECTOR', 'FIELDS', 'SORT', 'LIMIT', 'SKIP', 'FIND', 'CREATEINDEX',
    'DELETEINDEX', 'GETINDEXES', 'EXPLAIN',
    'AND', 'OR', 'NOT', 'NOR',
    'EQ', 'NE', 'GT', 'GTE', 'LT', 'LTE',
    'EXISTS', 'TYPE', 'IN', 'NIN', 'SIZE', 'MOD', 'REGEX',
    'ALL', 'ELEMATCH',
    'TRUE', 'FALSE', 'NULL',
    'VIEW', 'MAP', 'REDUCE', 'KEY', 'KEYS', 'STARTKEY', 'ENDKEY',
    'STARTKEY_DOCID', 'ENDKEY_DOCID', 'LIMIT', 'SKIP', 'DESCENDING',
    'INCLUDE_DOCS', 'INCLUSIVE_END', 'GROUP', 'GROUP_LEVEL', 'STALE',
    'REDUCE', 'UPDATE_SEQ', 'CONFLICTS', 'DELETED_CONFLICTS',
    'ATTACHMENTS', 'ATTACHMENT_ENCODING_INFO', 'ATTACHMENT_INFO',
    'REV', 'REVS', 'REV_INFO', 'LOCAL_SEQ',
    'DB', 'CREATE', 'DELETE', 'GET', 'PUT', 'POST',
    'ALLDOCS', 'BULKDOCS', 'BULKGET',
    'DESIGN', 'DDOC', 'SHOW', 'LIST', 'FILTER', 'UPDATE',
    'VALIDATE', 'REWRITE', 'VHOST',
    'REPLICATOR', 'SOURCE', 'TARGET', 'CREATE_TARGET',
    'CONTINUOUS', 'CANCEL', 'REPL_DOC_ID',
    'CHANGES', 'FEED', 'NORMAL', 'LONGPOLL', 'CONTINUOUS', 'EVENTSOURCE',
    'SINCE', 'HEARTBEAT', 'TIMEOUT', 'STYLE', 'ALL_DOCS',
    'CONFLICTS', 'DELETED_CONFLICTS',
    'SECURITY', 'MEMBERS', 'ROLES', 'ADMINS',
    'SHARDS', 'RANGE', 'NODES', 'BY_NODE', 'BY_RANGE',
    'PURGE', 'PURGED_LIMIT', 'REVS_LIMIT',
    'COMPACTION', 'COMPACT', 'CLEANUP',
    'METADATA', 'INSTANCE_START_TIME', 'UPDATE_SEQ',
    'DOC', 'ID', 'REV', 'DELETED', 'ATTACHMENTS',
    'NAME', 'CONTENT_TYPE', 'LENGTH', 'DIGEST', 'ENCODING',
    'OK', 'ERROR', 'REASON', 'FORBIDDEN', 'CONFLICT',
  ].map((k) => k.toUpperCase()),
)

const KEYWORD_MAP: Record<DriverId, Set<string>> = {
  postgres: SQL_KEYWORDS,
  mysql: SQL_KEYWORDS,
  sqlite: SQL_KEYWORDS,
  clickhouse: SQL_KEYWORDS,
  cockroach: SQL_KEYWORDS,
  mssql: SQL_KEYWORDS,
  mongodb: MONGO_KEYWORDS,
  couchdb: COUCHDB_KEYWORDS,
  redis: REDIS_KEYWORDS,
  cassandra: CASSANDRA_KEYWORDS,
  dynamodb: DYNAMODB_KEYWORDS,
}

// Tokenize into styled spans. Purely presentational (no external deps).
const TOKEN_RE =
  /(--[^\n]*|#[^\n]*|\/\*[\s\S]*?\*\/|\/\/[^\n]*)|('(?:[^'\\]|\\.)*'|"(?:[^"\\]|\\.)*")|(\b\d+(?:\.\d+)?\b)|([A-Za-z_$][A-Za-z0-9_$]*)|([(),.;*=<>!+\-/%]+)|(\s+)/g

export function highlightSql(sql: string, driver?: DriverId): React.ReactNode[] {
  const keywords = driver ? KEYWORD_MAP[driver] ?? SQL_KEYWORDS : SQL_KEYWORDS
  const nodes: React.ReactNode[] = []
  let match: RegExpExecArray | null
  TOKEN_RE.lastIndex = 0
  let key = 0

  while ((match = TOKEN_RE.exec(sql)) !== null) {
    const [full, comment, str, num, word, punct, space] = match
    if (comment) {
      nodes.push(
        <span key={key++} className="text-muted-foreground italic">
          {comment}
        </span>,
      )
    } else if (str) {
      nodes.push(
        <span key={key++} className="text-chart-2">
          {str}
        </span>,
      )
    } else if (num) {
      nodes.push(
        <span key={key++} className="text-chart-3">
          {num}
        </span>,
      )
    } else if (word) {
      if (keywords.has(word.toUpperCase())) {
        nodes.push(
          <span key={key++} className="font-semibold text-primary">
            {word}
          </span>,
        )
      } else {
        nodes.push(<span key={key++}>{word}</span>)
      }
    } else if (punct) {
      nodes.push(
        <span key={key++} className="text-chart-4">
          {punct}
        </span>,
      )
    } else {
      nodes.push(<span key={key++}>{space ?? full}</span>)
    }
  }
  return nodes
}
