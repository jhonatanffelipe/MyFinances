import fs from 'node:fs';
import path from 'node:path';
import initSqlJs, { type Database } from 'sql.js';
import { createSqlJsAdapter, type DbAdapter } from '@myfinances/core';

/**
 * SQLite local do desktop (sql.js em memória + arquivo em userData/data).
 *
 * Cada escrita agenda a gravação em disco (debounce de 500 ms). A gravação é atômica:
 * escreve num arquivo temporário e renomeia por cima, então uma queda no meio nunca
 * deixa o banco corrompido. No fechamento do app, `close()` grava o que estiver pendente.
 */
export class LocalDatabaseFile {
  private timer: NodeJS.Timeout | null = null;
  private dirty = false;

  private constructor(
    readonly filePath: string,
    private readonly db: Database,
    readonly adapter: DbAdapter,
  ) {}

  static async open(filePath: string): Promise<LocalDatabaseFile> {
    const SQL = await initSqlJs();
    fs.mkdirSync(path.dirname(filePath), { recursive: true });
    const db = fs.existsSync(filePath) ? new SQL.Database(fs.readFileSync(filePath)) : new SQL.Database();
    let instance: LocalDatabaseFile | null = null;
    const adapter = createSqlJsAdapter(db, { onWrite: () => instance?.scheduleSave() });
    instance = new LocalDatabaseFile(filePath, db, adapter);
    return instance;
  }

  private scheduleSave() {
    this.dirty = true;
    if (this.timer) clearTimeout(this.timer);
    this.timer = setTimeout(() => this.flush(), 500);
  }

  /** Grava agora (se houver alteração pendente). */
  flush() {
    if (this.timer) {
      clearTimeout(this.timer);
      this.timer = null;
    }
    if (!this.dirty) return;
    const tmp = `${this.filePath}.${process.pid}.tmp`;
    fs.writeFileSync(tmp, Buffer.from(this.db.export()), { mode: 0o600 });
    fs.renameSync(tmp, this.filePath);
    this.dirty = false;
  }

  close() {
    this.flush();
    this.db.close();
  }
}
