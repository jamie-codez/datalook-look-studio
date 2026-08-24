# Data Export

## Exporting query results

After running a query, use the **Export** dropdown in the results grid toolbar to export data in multiple formats:

### CSV

Comma-separated values with proper quoting. Fields containing commas, quotes, or newlines are wrapped in double quotes.

```csv
id,name,email
1,"Alice, B.","alice@example.com"
2,Bob,bob@example.com
```

### TSV

Tab-separated values. Useful for pasting into spreadsheets.

### JSON

Array of objects with column names as keys.

```json
[
  { "id": 1, "name": "Alice", "email": "alice@example.com" },
  { "id": 2, "name": "Bob", "email": "bob@example.com" }
]
```

### Text

Aligned plain-text table. Useful for terminal output or documentation.

```text
id  name   email
--- -----  ------------------
1   Alice  alice@example.com
2   Bob    bob@example.com
```

## Exporting audit logs

Admins can export the full audit log as a JSON file from **Settings → Administration → Export audit log**.
