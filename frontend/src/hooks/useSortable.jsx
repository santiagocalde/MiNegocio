import { useState, useMemo } from 'react';

export default function useSortable(data, defaultKey = null) {
  const [sortKey, setSortKey] = useState(defaultKey);
  const [sortDir, setSortDir] = useState('asc');

  const toggleSort = (key) => {
    if (sortKey === key) {
      setSortDir(prev => prev === 'asc' ? 'desc' : 'asc');
    } else {
      setSortKey(key);
      setSortDir('asc');
    }
  };

  const sorted = useMemo(() => {
    if (!sortKey) return data;
    return [...data].sort((a, b) => {
      const aVal = a[sortKey];
      const bVal = b[sortKey];
      if (aVal == null) return 1;
      if (bVal == null) return -1;
      let cmp = 0;
      if (typeof aVal === 'number' && typeof bVal === 'number') {
        cmp = aVal - bVal;
      } else if (typeof aVal === 'string' && typeof bVal === 'string') {
        cmp = aVal.localeCompare(bVal, 'es', { numeric: true });
      } else {
        cmp = String(aVal).localeCompare(String(bVal), 'es', { numeric: true });
      }
      return sortDir === 'asc' ? cmp : -cmp;
    });
  }, [data, sortKey, sortDir]);

  const SortIcon = ({ columnKey }) => {
    if (sortKey !== columnKey) {
      return <span style={{ opacity: 0.3, marginLeft: 4, fontSize: '0.7rem' }}>↕</span>;
    }
    return <span style={{ marginLeft: 4, fontSize: '0.7rem' }}>{sortDir === 'asc' ? '↑' : '↓'}</span>;
  };

  return { sorted, sortKey, sortDir, toggleSort, SortIcon };
}