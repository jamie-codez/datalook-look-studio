# YAML Configuration

Datalook Studio supports importing and exporting connection configurations as YAML files. This is useful for version-controlling your database connections and reproducing environments.

## Format

```yaml
connections:
  - name: Primary DB
    driver: postgres
    host: db.example.internal
    port: 5432
    database: appdb
    username: app
    readOnly: false
    topology: standalone

  - name: Analytics Replica
    driver: postgres
    host: replica-1.example.internal
    port: 5432
    database: analytics
    username: reader
    readOnly: true
    topology: replicaSet
    replicaHosts:
      - host: replica-2.example.internal
        port: 5432
        role: secondary
      - host: replica-3.example.internal
        port: 5432
        role: secondary

  - name: Cache
    driver: redis
    host: redis.example.internal
    port: 6379
    database: 0
    username: ""
    readOnly: false
    topology: standalone
```

## Importing

1. Open **New Connection** dialog
2. Expand **Import / Export YAML**
3. Either:
   - Click **Upload .yaml** to load a file
   - Paste YAML text into the textarea and click **Parse YAML text**
4. The first connection in the file populates the form
5. If multiple connections are found, a toast indicates the count

## Exporting

1. Open **New Connection** dialog
2. Fill in the connection details
3. Expand **Import / Export YAML**
4. Click **Export current**
5. A `connections.yaml` file is downloaded

## Using with version control

Store your `connections.yaml` in a private repository. Team members can import it to quickly set up their local environment with the same connections.

!!! warning
    YAML files contain host, port, database, and username — but **not passwords**. Passwords are never exported. Users must enter passwords separately in the app.
