// Small SQLite helper for scripts\restore-db.ps1, run by Node (type stripping, node:sqlite): row counts, safety snapshots and an
// offline restore of the development database. Never a raw copy of a database file: everything goes through SQLite's online backup API.
//
//   node scripts/sqlite-tool.ts counts   <db>                      row counts of every table, as JSON
//   node scripts/sqlite-tool.ts info     <db>                      integrity check and newest migration, as JSON
//   node scripts/sqlite-tool.ts snapshot <db> <destination>        consistent copy of a database (online backup API)
//   node scripts/sqlite-tool.ts restore  <backup> <db> [--force]   replace <db> (server stopped!) by the content of <backup>, end all sessions
//
// Exit codes: 0 ok, 2 usage / unusable backup, 3 backup is from a newer schema than the database (override with --force).
import { backup, DatabaseSync } from 'node:sqlite'
import { existsSync, rmSync } from 'node:fs'

const [command, first, second, ...rest] = process.argv.slice(2)

function fail(code: number, message: string): never {
  console.error(message)
  process.exit(code)
}

function openReadOnly(file: string): DatabaseSync {
  if (!existsSync(file)) fail(2, `Datei nicht gefunden: ${file}`)
  try {
    const db = new DatabaseSync(file, { readOnly: true })
    db.prepare('SELECT count(*) FROM sqlite_master').get()
    return db
  } catch (error) {
    return fail(2, `Keine lesbare SQLite-Datenbank: ${file} (${(error as Error).message})`)
  }
}

function tableNames(db: DatabaseSync): string[] {
  return (db.prepare("SELECT name FROM sqlite_master WHERE type = 'table' AND name NOT LIKE 'sqlite_%' ORDER BY name").all() as { name: string }[]).map((row) => row.name)
}

function counts(db: DatabaseSync): Record<string, number> {
  const result: Record<string, number> = {}
  for (const name of tableNames(db)) {
    const row = db.prepare(`SELECT count(*) AS n FROM "${name.replaceAll('"', '""')}"`).get() as { n: number | bigint }
    result[name] = Number(row.n)
  }
  return result
}

function newestMigration(db: DatabaseSync): string {
  if (!tableNames(db).includes('__EFMigrationsHistory')) return ''
  const row = db.prepare('SELECT max(MigrationId) AS id FROM "__EFMigrationsHistory"').get() as { id: string | null }
  return row.id ?? ''
}

function integrity(db: DatabaseSync): string {
  const rows = db.prepare('PRAGMA integrity_check').all() as { integrity_check: string }[]
  return rows.map((row) => row.integrity_check).join('; ')
}

async function main() {
  switch (command) {
    case 'counts': {
      if (!first) fail(2, 'Aufruf: counts <db>')
      const db = openReadOnly(first)
      console.log(JSON.stringify(counts(db)))
      db.close()
      return
    }
    case 'info': {
      if (!first) fail(2, 'Aufruf: info <db>')
      const db = openReadOnly(first)
      console.log(JSON.stringify({ integrity: integrity(db), migration: newestMigration(db), tables: tableNames(db).length }))
      db.close()
      return
    }
    case 'snapshot': {
      if (!first || !second) fail(2, 'Aufruf: snapshot <db> <destination>')
      const db = openReadOnly(first)
      await backup(db, second)
      db.close()
      return
    }
    case 'restore': {
      if (!first || !second) fail(2, 'Aufruf: restore <backup> <db> [--force]')
      const force = rest.includes('--force')
      const source = openReadOnly(first)
      const check = integrity(source)
      if (check !== 'ok') fail(2, `Die Sicherung ist beschaedigt (integrity_check: ${check}).`)
      const names = tableNames(source)
      if (!names.includes('users') || !names.includes('__EFMigrationsHistory')) fail(2, 'Die Datei ist keine Datenbank dieser Anwendung (Tabellen fehlen).')

      let currentMigration = ''
      if (existsSync(second)) {
        const current = openReadOnly(second)
        currentMigration = newestMigration(current)
        current.close()
      }
      const backupMigration = newestMigration(source)
      if (currentMigration && backupMigration > currentMigration && !force) {
        fail(3, `Die Sicherung stammt von einem neueren Schema (${backupMigration}) als die Datenbank (${currentMigration}). Mit --force trotzdem.`)
      }

      // The server is stopped: leftovers of its write-ahead log must not be replayed onto the restored content
      for (const suffix of ['-wal', '-shm']) rmSync(second + suffix, { force: true })
      rmSync(second, { force: true })
      await backup(source, second)
      source.close()

      const target = new DatabaseSync(second)
      target.exec('PRAGMA journal_mode = WAL')
      // Everybody signs in again: end every session (the script also removes the token signing key)
      const sessionColumns = (target.prepare('PRAGMA table_info(sessions)').all() as { name: string }[]).map((c) => c.name)
      if (sessionColumns.includes('RevokedAt')) {
        target.exec("UPDATE sessions SET RevokedAt = strftime('%Y-%m-%d %H:%M:%f', 'now'), RevokedReason = 'restore' WHERE RevokedAt IS NULL")
      }
      // Activity log entry (best effort - the restored database may be from an older schema)
      try {
        const log = (target.prepare('PRAGMA table_info(activity_log)').all() as { name: string }[]).map((c) => c.name)
        if (['At', 'Action', 'Target', 'Details'].every((c) => log.includes(c))) {
          const details = JSON.stringify({ via: 'restore-db.ps1', offline: true, backupMigration })
          target.prepare("INSERT INTO activity_log (At, ActorName, Action, Target, Details) VALUES (strftime('%Y-%m-%d %H:%M:%f', 'now'), 'restore-db.ps1', 'backup.restored', ?, ?)").run(first.split(/[\\/]/).pop() ?? first, details)
        }
      } catch (error) {
        console.error(`Hinweis: kein Aktivitaetsprotokoll-Eintrag geschrieben (${(error as Error).message}).`)
      }
      target.close()
      return
    }
    default:
      fail(2, 'Befehle: counts <db> | info <db> | snapshot <db> <destination> | restore <backup> <db> [--force]')
  }
}

await main()
