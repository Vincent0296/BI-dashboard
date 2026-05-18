import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || '';
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || '';

// Memory fallback for environments without localStorage (e.g. Node tests or SSR)
const memoryStorage: Record<string, string> = {};

const safeLocalStorage = {
  getItem(key: string): string | null {
    try {
      return typeof localStorage !== 'undefined' ? localStorage.getItem(key) : (memoryStorage[key] || null);
    } catch {
      return memoryStorage[key] || null;
    }
  },
  setItem(key: string, value: string): void {
    try {
      if (typeof localStorage !== 'undefined') {
        localStorage.setItem(key, value);
      } else {
        memoryStorage[key] = value;
      }
    } catch {
      memoryStorage[key] = value;
    }
  }
};

class MockQueryBuilder {
  private tableName: string;
  private filters: Array<(item: any) => boolean> = [];
  private sortKey: string = '';
  private sortOrder: { ascending: boolean } = { ascending: true };
  private singleResult: boolean = false;
  private orFilter: string = '';

  constructor(tableName: string) {
    this.tableName = tableName;
  }

  private getData(): any[] {
    const defaultData: Record<string, any[]> = {
      users: [
        {
          id: 'admin',
          username: 'admin',
          password: 'admin',
          nickname: '超级管理员',
          avatar: 'https://api.dicebear.com/7.x/avataaars/svg?seed=admin',
          lastLoginTime: new Date().toISOString(),
          lastLoginIp: '127.0.0.1'
        }
      ],
      feedback: [],
      comments: [],
      presets: []
    };
    try {
      const stored = safeLocalStorage.getItem(`mock_db_${this.tableName}`);
      return stored ? JSON.parse(stored) : defaultData[this.tableName] || [];
    } catch {
      return defaultData[this.tableName] || [];
    }
  }

  private saveData(data: any[]) {
    try {
      safeLocalStorage.setItem(`mock_db_${this.tableName}`, JSON.stringify(data));
    } catch (e) {
      console.error('Failed to save mock database table:', this.tableName, e);
    }
  }

  select(fields: string = '*') {
    return this;
  }

  eq(field: string, value: any) {
    this.filters.push((item) => String(item[field]) === String(value));
    return this;
  }

  or(filterStr: string) {
    this.orFilter = filterStr;
    return this;
  }

  order(field: string, options: { ascending: boolean } = { ascending: true }) {
    this.sortKey = field;
    this.sortOrder = options;
    return this;
  }

  single() {
    this.singleResult = true;
    return this;
  }

  async execute() {
    let items = this.getData();

    // Apply simple eq filters
    for (const filter of this.filters) {
      items = items.filter(filter);
    }

    // Apply complex or filter if any
    if (this.orFilter) {
      const parts = this.orFilter.split(',');
      items = items.filter((item) => {
        return parts.some((part) => {
          const subparts = part.split('.eq.');
          if (subparts.length === 2) {
            const [f, v] = subparts;
            return String(item[f]) === String(v);
          }
          return false;
        });
      });
    }

    // Apply sorting
    if (this.sortKey) {
      items.sort((a, b) => {
        const valA = a[this.sortKey];
        const valB = b[this.sortKey];
        if (valA === undefined || valA === null) return 1;
        if (valB === undefined || valB === null) return -1;
        if (valA === valB) return 0;
        const result = valA < valB ? -1 : 1;
        return this.sortOrder.ascending ? result : -result;
      });
    }

    if (this.singleResult) {
      if (items.length === 0) {
        return { data: null, error: { message: 'Row not found' } };
      }
      return { data: items[0], error: null };
    }

    return { data: items, error: null };
  }

  then(onfulfilled?: (value: any) => any, onrejected?: (reason: any) => any) {
    return this.execute().then(onfulfilled, onrejected);
  }

  async insert(newItems: any[]) {
    const items = this.getData();
    const updated = [...items, ...newItems];
    this.saveData(updated);
    return { data: newItems, error: null };
  }

  update(fields: any) {
    const queryBuilder = this;
    this.execute = async () => {
      const items = this.getData();
      let updatedCount = 0;
      const updated = items.map((item) => {
        const matches = queryBuilder.filters.every((filter) => filter(item));
        if (matches) {
          updatedCount++;
          return { ...item, ...fields };
        }
        return item;
      });
      queryBuilder.saveData(updated);
      return { data: updated, error: null, count: updatedCount };
    };
    return this;
  }

  delete() {
    const queryBuilder = this;
    this.execute = async () => {
      const items = this.getData();
      const kept = items.filter((item) => {
        const matches = queryBuilder.filters.every((filter) => filter(item));
        return !matches;
      });
      queryBuilder.saveData(kept);
      return { data: [], error: null };
    };
    return this;
  }
}

class MockSupabaseClient {
  from(tableName: string) {
    return new MockQueryBuilder(tableName);
  }
}

const isConfigured = 
  supabaseUrl && 
  supabaseAnonKey && 
  supabaseUrl !== 'undefined' && 
  supabaseAnonKey !== 'undefined';

export const supabase = isConfigured
  ? createClient(supabaseUrl, supabaseAnonKey)
  : (new MockSupabaseClient() as any);


