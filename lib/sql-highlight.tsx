import * as React from 'react'

const KEYWORDS = new Set(
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

// Tokenize into styled spans. Purely presentational (no external deps).
const TOKEN_RE =
  /(--[^\n]*|\/\*[\s\S]*?\*\/)|('(?:[^'\\]|\\.)*'|"(?:[^"\\]|\\.)*")|(\b\d+(?:\.\d+)?\b)|([A-Za-z_][A-Za-z0-9_]*)|([(),.;*=<>!+\-/%]+)|(\s+)/g

export function highlightSql(sql: string): React.ReactNode[] {
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
      if (KEYWORDS.has(word.toUpperCase())) {
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
