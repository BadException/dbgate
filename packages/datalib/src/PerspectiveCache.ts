import { RangeDefinition } from 'dbgate-types';
import { PerspectiveDataLoadProps } from './PerspectiveDataProvider';
import _pick from 'lodash/pick';
import _zip from 'lodash/zip';
import _difference from 'lodash/difference';
import debug from 'debug';

const dbg = debug('dbgate:PerspectiveCache');

export class PerspectiveBindingGroup {
  constructor(public table: PerspectiveCacheTable) {}

  groupSize?: number;
  loadedAll: boolean;
  loadedRows: any[] = [];
  bindingValues: any[];
}

export class PerspectiveCacheTable {
  constructor(props: PerspectiveDataLoadProps, public cache: PerspectiveCache) {
    this.schemaName = props.schemaName;
    this.pureName = props.pureName;
    this.bindingColumns = props.bindingColumns;
    this.dataColumns = props.dataColumns;
    this.loadedAll = false;
  }

  schemaName: string;
  pureName: string;
  bindingColumns?: string[];
  dataColumns: string[];
  loadedAll: boolean;
  loadedRows: any[] = [];
  bindingGroups: { [bindingKey: string]: PerspectiveBindingGroup } = {};

  get loadedCount() {
    return this.loadedRows.length;
  }

  getRowsResult(props: PerspectiveDataLoadProps): { rows: any[]; incomplete: boolean } {
    return {
      rows: this.loadedRows.slice(0, props.topCount),
      incomplete: props.topCount < this.loadedCount || !this.loadedAll,
    };
  }

  getBindingGroups(props: PerspectiveDataLoadProps): { cached: PerspectiveBindingGroup[]; uncached: any[][] } {
    const cached: PerspectiveBindingGroup[] = [];
    const uncached = [];
    for (const group in props.bindingValues) {
      const key = this.cache.stableStringify(group);
      const item = this.bindingGroups[key];
      if (item) {
        cached.push(item);
      } else {
        uncached.push(group);
      }
    }
    return { cached, uncached };
  }

  storeGroupSize(props: PerspectiveDataLoadProps, bindingValues: any[], count: number) {
    const originalBindingValue = props.bindingValues.find(v => _zip(v, bindingValues).every(([x, y]) => x == y));
    if (originalBindingValue) {
      const key = this.cache.stableStringify(originalBindingValue);
      const group = new PerspectiveBindingGroup(this);
      group.groupSize = count;
      this.bindingGroups[key] = group;
    }
  }
}

export class PerspectiveCache {
  constructor(public stableStringify) {}

  tables: { [tableKey: string]: PerspectiveCacheTable } = {};

  getTableCache(props: PerspectiveDataLoadProps) {
    const tableKey = this.stableStringify(
      _pick(props, ['schemaName', 'pureName', 'bindingColumns', 'databaseConfig', 'orderBy'])
    );
    let res = this.tables[tableKey];

    if (res && _difference(props.dataColumns, res.dataColumns).length > 0) {
      dbg('Delete cache because incomplete columns', props.pureName, res.dataColumns);

      // we have incomplete cache
      delete this.tables[tableKey];
      res = null;
    }

    if (!res) {
      res = new PerspectiveCacheTable(props, this);
      this.tables[tableKey] = res;
      return res;
    }

    // cache could be used
    return res;
  }
}