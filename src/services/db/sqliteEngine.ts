import type { SqlQueryResult } from '../../types/chat.ts';

export interface ColumnDef {
  name: string;
  type: 'TEXT' | 'INTEGER' | 'REAL' | 'BLOB';
  primaryKey?: boolean;
  notNull?: boolean;
  defaultValue?: string | number | null;
}

export interface TableSchema {
  name: string;
  columns: ColumnDef[];
  rows: Record<string, unknown>[];
}

const DB_NAME = 'arc_irobot_sqlite_db';
const DB_VERSION = 1;
const STORE_NAME = 'sqlite_tables';

class SqliteEngine {
  private tables: Map<string, TableSchema> = new Map();
  private isInitialized = false;
  private initPromise: Promise<void> | null = null;
  private saveQueue: Set<string> = new Set();
  private saveTimeout: ReturnType<typeof setTimeout> | null = null;

  constructor() {
    this.initPromise = this.init();
  }

  public async ready(): Promise<void> {
    if (this.isInitialized) return;
    if (this.initPromise) {
      await this.initPromise;
    }
  }

  private async openIdb(): Promise<IDBDatabase | null> {
    if (typeof window === 'undefined' || !window.indexedDB) {
      return null;
    }

    return new Promise((resolve) => {
      try {
        const req = window.indexedDB.open(DB_NAME, DB_VERSION);
        req.onupgradeneeded = () => {
          const db = req.result;
          if (!db.objectStoreNames.contains(STORE_NAME)) {
            db.createObjectStore(STORE_NAME, { keyPath: 'name' });
          }
        };
        req.onsuccess = () => resolve(req.result);
        req.onerror = () => resolve(null);
      } catch {
        resolve(null);
      }
    });
  }

  private async init(): Promise<void> {
    const idb = await this.openIdb();
    if (idb) {
      await new Promise<void>((resolve) => {
        try {
          const tx = idb.transaction(STORE_NAME, 'readonly');
          const store = tx.objectStore(STORE_NAME);
          const req = store.getAll();
          req.onsuccess = () => {
            const list = req.result as TableSchema[];
            if (Array.isArray(list)) {
              for (const tbl of list) {
                this.tables.set(tbl.name.toLowerCase(), tbl);
              }
            }
            resolve();
          };
          req.onerror = () => resolve();
        } catch {
          resolve();
        }
      });
    } else {
      // Fallback: localStorage
      try {
        if (typeof window !== 'undefined' && window.localStorage) {
          for (let i = 0; i < localStorage.length; i++) {
            const key = localStorage.key(i);
            if (key?.startsWith('sqlite_tbl_')) {
              const raw = localStorage.getItem(key);
              if (raw) {
                const tbl = JSON.parse(raw) as TableSchema;
                this.tables.set(tbl.name.toLowerCase(), tbl);
              }
            }
          }
        }
      } catch {}
    }

    this.isInitialized = true;
  }

  private scheduleSave(tableName: string): void {
    this.saveQueue.add(tableName.toLowerCase());
    if (this.saveTimeout) {
      clearTimeout(this.saveTimeout);
    }
    this.saveTimeout = setTimeout(() => {
      void this.flushSaves();
    }, 40);
  }

  private async flushSaves(): Promise<void> {
    const tablesToSave = Array.from(this.saveQueue);
    this.saveQueue.clear();
    this.saveTimeout = null;

    if (tablesToSave.length === 0) return;

    const idb = await this.openIdb();
    if (idb) {
      try {
        const tx = idb.transaction(STORE_NAME, 'readwrite');
        const store = tx.objectStore(STORE_NAME);
        for (const name of tablesToSave) {
          const tbl = this.tables.get(name);
          if (tbl) {
            store.put(tbl);
          } else {
            store.delete(name);
          }
        }
      } catch {}
    } else {
      // LocalStorage fallback
      try {
        if (typeof window !== 'undefined' && window.localStorage) {
          for (const name of tablesToSave) {
            const tbl = this.tables.get(name);
            const key = `sqlite_tbl_${name}`;
            if (tbl) {
              localStorage.setItem(key, JSON.stringify(tbl));
            } else {
              localStorage.removeItem(key);
            }
          }
        }
      } catch {}
    }
  }

  public async execute<T = Record<string, unknown>>(
    sql: string,
    params: unknown[] = []
  ): Promise<SqlQueryResult<T>> {
    await this.ready();
    const startTime = performance.now();
    const trimmed = sql.trim().replace(/;+$/, '');

    try {
      if (/^CREATE\s+TABLE/i.test(trimmed)) {
        return this.handleCreateTable<T>(trimmed, startTime);
      }
      if (/^INSERT\s+INTO/i.test(trimmed)) {
        return this.handleInsert<T>(trimmed, params, startTime);
      }
      if (/^SELECT/i.test(trimmed)) {
        return this.handleSelect<T>(trimmed, params, startTime);
      }
      if (/^UPDATE/i.test(trimmed)) {
        return this.handleUpdate<T>(trimmed, params, startTime);
      }
      if (/^DELETE\s+FROM/i.test(trimmed)) {
        return this.handleDelete<T>(trimmed, params, startTime);
      }
      if (/^DROP\s+TABLE/i.test(trimmed)) {
        return this.handleDropTable<T>(trimmed, startTime);
      }
      if (/^PRAGMA/i.test(trimmed)) {
        return this.handlePragma<T>(trimmed, startTime);
      }

      throw new Error(`Unsupported SQL statement: ${trimmed.slice(0, 30)}...`);
    } catch (err) {
      const execTime = performance.now() - startTime;
      const errorMsg = err instanceof Error ? err.message : String(err);
      return {
        rows: [],
        rowCount: 0,
        columns: [],
        executionTimeMs: execTime,
        error: errorMsg
      };
    }
  }

  private handleCreateTable<T>(sql: string, startTime: number): SqlQueryResult<T> {
    const match = sql.match(/CREATE\s+TABLE\s+(?:IF\s+NOT\s+EXISTS\s+)?([a-zA-Z0-9_]+)\s*\(([\s\S]+)\)/i);
    if (!match) {
      throw new Error('Invalid CREATE TABLE syntax.');
    }
    const tableName = match[1].toLowerCase();
    const colDefsRaw = match[2];

    if (this.tables.has(tableName)) {
      return {
        rows: [],
        rowCount: 0,
        columns: [],
        executionTimeMs: performance.now() - startTime
      };
    }

    const colLines = colDefsRaw.split(',').map((l) => l.trim()).filter(Boolean);
    const columns: ColumnDef[] = [];

    for (const line of colLines) {
      const parts = line.split(/\s+/);
      const colName = parts[0].replace(/[`"]/g, '');
      const colType = (parts[1]?.toUpperCase() || 'TEXT') as ColumnDef['type'];
      const upperLine = line.toUpperCase();
      const primaryKey = upperLine.includes('PRIMARY KEY');
      const notNull = upperLine.includes('NOT NULL');
      let defaultValue: string | number | null = null;

      const defMatch = line.match(/DEFAULT\s+('([^']*)'|(\d+(?:\.\d+)?)|NULL)/i);
      if (defMatch) {
        if (defMatch[2] !== undefined) defaultValue = defMatch[2];
        else if (defMatch[3] !== undefined) defaultValue = Number(defMatch[3]);
      }

      columns.push({
        name: colName,
        type: ['INTEGER', 'REAL', 'BLOB'].includes(colType) ? colType : 'TEXT',
        primaryKey,
        notNull,
        defaultValue
      });
    }

    const tableSchema: TableSchema = {
      name: tableName,
      columns,
      rows: []
    };
    this.tables.set(tableName, tableSchema);
    this.scheduleSave(tableName);

    return {
      rows: [],
      rowCount: 0,
      columns: columns.map((c) => c.name),
      executionTimeMs: performance.now() - startTime
    };
  }

  private handleInsert<T>(sql: string, params: unknown[], startTime: number): SqlQueryResult<T> {
    const match = sql.match(/INSERT\s+INTO\s+([a-zA-Z0-9_]+)\s*(?:\(([^)]+)\))?\s*VALUES\s*\(([\s\S]+)\)/i);
    if (!match) {
      throw new Error('Invalid INSERT INTO syntax.');
    }
    const tableName = match[1].toLowerCase();
    const table = this.tables.get(tableName);
    if (!table) {
      throw new Error(`Table '${tableName}' does not exist.`);
    }

    const specifiedCols = match[2]
      ? match[2].split(',').map((c) => c.trim().replace(/[`"]/g, ''))
      : table.columns.map((c) => c.name);

    const valuesTokens = this.parseValueTokens(match[3]);
    let paramIndex = 0;
    const rowObj: Record<string, unknown> = {};

    // Initialize with defaults
    for (const col of table.columns) {
      rowObj[col.name] = col.defaultValue !== undefined ? col.defaultValue : null;
    }

    for (let i = 0; i < specifiedCols.length; i++) {
      const colName = specifiedCols[i];
      const token = valuesTokens[i]?.trim();
      if (token === '?') {
        rowObj[colName] = params[paramIndex++];
      } else if (token !== undefined) {
        rowObj[colName] = this.parseLiteral(token);
      }
    }

    // Check primary key constraint
    const pkCol = table.columns.find((c) => c.primaryKey);
    if (pkCol && rowObj[pkCol.name] !== undefined) {
      const existingIdx = table.rows.findIndex((r) => r[pkCol.name] === rowObj[pkCol.name]);
      if (existingIdx >= 0) {
        // Replace (INSERT OR REPLACE behavior)
        table.rows[existingIdx] = rowObj;
        this.scheduleSave(tableName);
        return {
          rows: [rowObj as unknown as T],
          rowCount: 1,
          columns: table.columns.map((c) => c.name),
          executionTimeMs: performance.now() - startTime
        };
      }
    }

    table.rows.push(rowObj);
    this.scheduleSave(tableName);

    return {
      rows: [rowObj as unknown as T],
      rowCount: 1,
      columns: table.columns.map((c) => c.name),
      executionTimeMs: performance.now() - startTime
    };
  }

  private handleSelect<T>(sql: string, params: unknown[], startTime: number): SqlQueryResult<T> {
    const match = sql.match(/SELECT\s+([\s\S]+?)\s+FROM\s+([a-zA-Z0-9_]+)([\s\S]*)/i);
    if (!match) {
      throw new Error('Invalid SELECT syntax.');
    }
    const selectColsRaw = match[1].trim();
    const tableName = match[2].toLowerCase();
    const rest = match[3] || '';

    // Virtual SQLite master table
    if (tableName === 'sqlite_master') {
      const rows = Array.from(this.tables.values()).map((t) => ({
        type: 'table',
        name: t.name,
        tbl_name: t.name,
        sql: `CREATE TABLE ${t.name} (${t.columns.map((c) => `${c.name} ${c.type}`).join(', ')})`
      }));
      return {
        rows: rows as unknown as T[],
        rowCount: rows.length,
        columns: ['type', 'name', 'tbl_name', 'sql'],
        executionTimeMs: performance.now() - startTime
      };
    }

    const table = this.tables.get(tableName);
    if (!table) {
      throw new Error(`Table '${tableName}' does not exist.`);
    }

    let filtered = [...table.rows];

    // WHERE clause
    let paramIndex = 0;
    const whereMatch = rest.match(/WHERE\s+([\s\S]+?)(?=\s+ORDER\s+BY|\s+LIMIT|\s*$)/i);
    if (whereMatch) {
      const whereExpr = whereMatch[1].trim();
      const whereResult = this.filterRows(filtered, whereExpr, params, paramIndex);
      filtered = whereResult.rows;
      paramIndex = whereResult.nextParamIndex;
    }

    // ORDER BY clause
    const orderMatch = rest.match(/ORDER\s+BY\s+([a-zA-Z0-9_,\s]+?)(?=\s+LIMIT|\s*$)/i);
    if (orderMatch) {
      const orderDef = orderMatch[1].trim();
      const [colPart, dirPart] = orderDef.split(/\s+/);
      const col = colPart.replace(/[`"]/g, '');
      const isDesc = dirPart?.toUpperCase() === 'DESC';

      filtered.sort((a, b) => {
        const valA = a[col];
        const valB = b[col];
        if (valA === valB) return 0;
        if (valA === null || valA === undefined) return 1;
        if (valB === null || valB === undefined) return -1;
        if (typeof valA === 'number' && typeof valB === 'number') {
          return isDesc ? valB - valA : valA - valB;
        }
        const strA = String(valA);
        const strB = String(valB);
        return isDesc ? strB.localeCompare(strA) : strA.localeCompare(strB);
      });
    }

    // LIMIT & OFFSET clause
    const limitMatch = rest.match(/LIMIT\s+(\d+|\?)(?:\s+OFFSET\s+(\d+|\?))?/i);
    if (limitMatch) {
      let limitVal = limitMatch[1] === '?' ? Number(params[paramIndex++]) : parseInt(limitMatch[1], 10);
      let offsetVal = 0;
      if (limitMatch[2]) {
        offsetVal = limitMatch[2] === '?' ? Number(params[paramIndex++]) : parseInt(limitMatch[2], 10);
      }
      filtered = filtered.slice(offsetVal, offsetVal + limitVal);
    }

    // Project columns
    let resultRows: Record<string, unknown>[] = [];
    let columns: string[] = [];

    if (selectColsRaw === '*') {
      resultRows = filtered;
      columns = table.columns.map((c) => c.name);
    } else {
      const requested = selectColsRaw.split(',').map((c) => c.trim().replace(/[`"]/g, ''));
      columns = requested;
      resultRows = filtered.map((row) => {
        const item: Record<string, unknown> = {};
        for (const col of requested) {
          item[col] = row[col] !== undefined ? row[col] : null;
        }
        return item;
      });
    }

    return {
      rows: resultRows as unknown as T[],
      rowCount: resultRows.length,
      columns,
      executionTimeMs: performance.now() - startTime
    };
  }

  private handleUpdate<T>(sql: string, params: unknown[], startTime: number): SqlQueryResult<T> {
    const match = sql.match(/UPDATE\s+([a-zA-Z0-9_]+)\s+SET\s+([\s\S]+?)(?=\s+WHERE|\s*$)/i);
    if (!match) {
      throw new Error('Invalid UPDATE syntax.');
    }
    const tableName = match[1].toLowerCase();
    const table = this.tables.get(tableName);
    if (!table) {
      throw new Error(`Table '${tableName}' does not exist.`);
    }

    const setClause = match[2].trim();
    const setAssignments = setClause.split(',').map((s) => s.trim());
    let paramIndex = 0;

    const updates: Record<string, unknown> = {};
    for (const assign of setAssignments) {
      const [colRaw, valRaw] = assign.split('=').map((s) => s.trim());
      const col = colRaw.replace(/[`"]/g, '');
      if (valRaw === '?') {
        updates[col] = params[paramIndex++];
      } else {
        updates[col] = this.parseLiteral(valRaw);
      }
    }

    let affectedCount = 0;
    const whereMatch = sql.match(/WHERE\s+([\s\S]+)$/i);

    if (whereMatch) {
      const whereExpr = whereMatch[1].trim();
      for (const row of table.rows) {
        if (this.evaluateCondition(row, whereExpr, params, paramIndex)) {
          Object.assign(row, updates);
          affectedCount++;
        }
      }
    } else {
      for (const row of table.rows) {
        Object.assign(row, updates);
        affectedCount++;
      }
    }

    if (affectedCount > 0) {
      this.scheduleSave(tableName);
    }

    return {
      rows: [],
      rowCount: affectedCount,
      columns: table.columns.map((c) => c.name),
      executionTimeMs: performance.now() - startTime
    };
  }

  private handleDelete<T>(sql: string, params: unknown[], startTime: number): SqlQueryResult<T> {
    const match = sql.match(/DELETE\s+FROM\s+([a-zA-Z0-9_]+)([\s\S]*)/i);
    if (!match) {
      throw new Error('Invalid DELETE FROM syntax.');
    }
    const tableName = match[1].toLowerCase();
    const table = this.tables.get(tableName);
    if (!table) {
      throw new Error(`Table '${tableName}' does not exist.`);
    }

    const rest = match[2] || '';
    const whereMatch = rest.match(/WHERE\s+([\s\S]+)$/i);
    let beforeCount = table.rows.length;

    if (whereMatch) {
      const whereExpr = whereMatch[1].trim();
      table.rows = table.rows.filter((row) => !this.evaluateCondition(row, whereExpr, params, 0));
    } else {
      table.rows = [];
    }

    const affectedCount = beforeCount - table.rows.length;
    if (affectedCount > 0) {
      this.scheduleSave(tableName);
    }

    return {
      rows: [],
      rowCount: affectedCount,
      columns: table.columns.map((c) => c.name),
      executionTimeMs: performance.now() - startTime
    };
  }

  private handleDropTable<T>(sql: string, startTime: number): SqlQueryResult<T> {
    const match = sql.match(/DROP\s+TABLE\s+(?:IF\s+EXISTS\s+)?([a-zA-Z0-9_]+)/i);
    if (!match) throw new Error('Invalid DROP TABLE syntax.');
    const tableName = match[1].toLowerCase();
    const existed = this.tables.delete(tableName);
    if (existed) {
      this.scheduleSave(tableName);
    }
    return {
      rows: [],
      rowCount: existed ? 1 : 0,
      columns: [],
      executionTimeMs: performance.now() - startTime
    };
  }

  private handlePragma<T>(sql: string, startTime: number): SqlQueryResult<T> {
    const infoMatch = sql.match(/PRAGMA\s+table_info\s*\(\s*([a-zA-Z0-9_]+)\s*\)/i);
    if (infoMatch) {
      const tableName = infoMatch[1].toLowerCase();
      const table = this.tables.get(tableName);
      if (!table) return { rows: [], rowCount: 0, columns: [], executionTimeMs: performance.now() - startTime };
      const rows = table.columns.map((col, idx) => ({
        cid: idx,
        name: col.name,
        type: col.type,
        notnull: col.notNull ? 1 : 0,
        dflt_value: col.defaultValue,
        pk: col.primaryKey ? 1 : 0
      }));
      return {
        rows: rows as unknown as T[],
        rowCount: rows.length,
        columns: ['cid', 'name', 'type', 'notnull', 'dflt_value', 'pk'],
        executionTimeMs: performance.now() - startTime
      };
    }

    return {
      rows: [],
      rowCount: 0,
      columns: [],
      executionTimeMs: performance.now() - startTime
    };
  }

  private filterRows(
    rows: Record<string, unknown>[],
    whereExpr: string,
    params: unknown[],
    startParamIndex: number
  ): { rows: Record<string, unknown>[]; nextParamIndex: number } {
    const result: Record<string, unknown>[] = [];
    const paramCount = (whereExpr.match(/\?/g) || []).length;

    for (const row of rows) {
      if (this.evaluateCondition(row, whereExpr, params, startParamIndex)) {
        result.push(row);
      }
    }
    return { rows: result, nextParamIndex: startParamIndex + paramCount };
  }

  private evaluateCondition(
    row: Record<string, unknown>,
    expr: string,
    params: unknown[],
    paramIndex: number
  ): boolean {
    const andClauses = expr.split(/\s+AND\s+/i);
    let pIdx = paramIndex;

    for (const clause of andClauses) {
      const orClauses = clause.split(/\s+OR\s+/i);
      let orMatched = false;

      for (const single of orClauses) {
        if (this.evaluateSinglePredicate(row, single.trim(), params, pIdx)) {
          orMatched = true;
          break;
        }
      }
      pIdx += (clause.match(/\?/g) || []).length;
      if (!orMatched) return false;
    }
    return true;
  }

  private evaluateSinglePredicate(
    row: Record<string, unknown>,
    predicate: string,
    params: unknown[],
    pIdx: number
  ): boolean {
    // 1. IS NULL / IS NOT NULL
    const isNullMatch = predicate.match(/^([a-zA-Z0-9_]+)\s+IS\s+(NOT\s+)?NULL$/i);
    if (isNullMatch) {
      const col = isNullMatch[1];
      const val = row[col];
      const isNot = Boolean(isNullMatch[2]);
      const isNull = val === null || val === undefined;
      return isNot ? !isNull : isNull;
    }

    // 2. LIKE
    const likeMatch = predicate.match(/^([a-zA-Z0-9_]+)\s+LIKE\s+(.+)$/i);
    if (likeMatch) {
      const col = likeMatch[1];
      let pattern = likeMatch[2].trim();
      if (pattern === '?') {
        pattern = String(params[pIdx] || '');
      } else {
        pattern = pattern.replace(/^['"]|['"]$/g, '');
      }
      const regexStr = '^' + pattern.replace(/%/g, '.*').replace(/_/g, '.') + '$';
      const reg = new RegExp(regexStr, 'i');
      return reg.test(String(row[col] ?? ''));
    }

    // 3. Comparison operators (=, !=, <>, >, <, >=, <=)
    const opMatch = predicate.match(/^([a-zA-Z0-9_]+)\s*(=|!=|<>|>=|<=|>|<)\s*(.+)$/i);
    if (opMatch) {
      const col = opMatch[1];
      const op = opMatch[2];
      let targetVal: unknown = opMatch[3].trim();
      if (targetVal === '?') {
        targetVal = params[pIdx];
      } else {
        targetVal = this.parseLiteral(String(targetVal));
      }

      const rowVal = row[col];
      if (op === '=' || op === '==') {
        return rowVal === targetVal || String(rowVal) === String(targetVal);
      }
      if (op === '!=' || op === '<>') {
        return rowVal !== targetVal && String(rowVal) !== String(targetVal);
      }
      if (op === '>') return Number(rowVal) > Number(targetVal);
      if (op === '<') return Number(rowVal) < Number(targetVal);
      if (op === '>=') return Number(rowVal) >= Number(targetVal);
      if (op === '<=') return Number(rowVal) <= Number(targetVal);
    }

    return true;
  }

  private parseValueTokens(raw: string): string[] {
    const tokens: string[] = [];
    let current = '';
    let inQuotes = false;
    let quoteChar = '';

    for (let i = 0; i < raw.length; i++) {
      const ch = raw[i];
      if ((ch === "'" || ch === '"') && (i === 0 || raw[i - 1] !== '\\')) {
        if (!inQuotes) {
          inQuotes = true;
          quoteChar = ch;
        } else if (quoteChar === ch) {
          inQuotes = false;
        }
      }
      if (ch === ',' && !inQuotes) {
        tokens.push(current.trim());
        current = '';
      } else {
        current += ch;
      }
    }
    if (current.trim()) {
      tokens.push(current.trim());
    }
    return tokens;
  }

  private parseLiteral(token: string): unknown {
    if (token === 'NULL' || token === 'null') return null;
    if (token === 'TRUE' || token === 'true') return 1;
    if (token === 'FALSE' || token === 'false') return 0;
    if (/^-?\d+$/.test(token)) return parseInt(token, 10);
    if (/^-?\d+\.\d+$/.test(token)) return parseFloat(token);
    if ((token.startsWith("'") && token.endsWith("'")) || (token.startsWith('"') && token.endsWith('"'))) {
      return token.slice(1, -1).replace(/\\'/g, "'").replace(/\\"/g, '"');
    }
    return token;
  }

  public exportDatabaseDump(): Record<string, unknown> {
    const dump: Record<string, unknown> = {};
    for (const [name, tbl] of this.tables.entries()) {
      dump[name] = {
        columns: tbl.columns,
        rowCount: tbl.rows.length,
        rows: tbl.rows
      };
    }
    return dump;
  }

  public async clearDatabase(): Promise<void> {
    this.tables.clear();
    const idb = await this.openIdb();
    if (idb) {
      const tx = idb.transaction(STORE_NAME, 'readwrite');
      tx.objectStore(STORE_NAME).clear();
    }
    try {
      if (typeof window !== 'undefined' && window.localStorage) {
        const keysToRemove: string[] = [];
        for (let i = 0; i < localStorage.length; i++) {
          const k = localStorage.key(i);
          if (k?.startsWith('sqlite_tbl_')) keysToRemove.push(k);
        }
        for (const k of keysToRemove) localStorage.removeItem(k);
      }
    } catch {}
  }
}

export const sqliteEngine = new SqliteEngine();
