"use client";

import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { DataTable, Column } from '@/components/DataTable';
import { Badge } from '@/components/Badge';
import { formatIDR } from '@/lib/format/currency';

export interface SalesRepRow {
  id: string;
  code: string;
  name: string;
  region: string | null;
  isActive: boolean;
  totalOrders: number;
  cancelledOrders: number;
  cancelRate: number;
  totalRevenue: number;
  deliveredOrders: number;
}

export function SalesRepsTableClient({ data }: { data: SalesRepRow[] }) {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [region, setRegion] = useState<string>("ALL");
  const [activeOnly, setActiveOnly] = useState<boolean>(false);
  const [highRiskOnly, setHighRiskOnly] = useState<boolean>(false);
  const [sortKey, setSortKey] = useState<keyof SalesRepRow>('cancelRate');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');

  const regions = useMemo(() => {
    const set = new Set<string>();
    data.forEach((d) => d.region && set.add(d.region));
    return ['ALL', ...Array.from(set)];
  }, [data]);

  const toggleSort = (key: keyof SalesRepRow) => {
    if (sortKey === key) {
      setSortDir(sortDir === 'asc' ? 'desc' : 'asc');
    } else {
      setSortKey(key);
      setSortDir('asc');
    }
  };

  const SortHeader = ({ label, colKey }: { label: string; colKey: keyof SalesRepRow }) => (
    <button
      type="button"
      onClick={() => toggleSort(colKey)}
      className="flex items-center gap-1 select-none"
      title="Urutkan"
    >
      <span>{label}</span>
      <span className="text-xs" style={{ color: 'var(--muted)' }}>
        {sortKey === colKey ? (sortDir === 'asc' ? '▲' : '▼') : '↕'}
      </span>
    </button>
  );

  const columns: Column<SalesRepRow>[] = [
    { key: 'code', header: <SortHeader label="Code" colKey="code" /> },
    { key: 'name', header: <SortHeader label="Name" colKey="name" /> },
    { key: 'region', header: <SortHeader label="Region" colKey="region" />, render: (item) => item.region || '-' },
    {
      key: 'isActive',
      header: <SortHeader label="Status" colKey="isActive" />,
      render: (item) => (
        <Badge variant={item.isActive ? 'success' : 'default'}>
          {item.isActive ? 'Active' : 'Inactive'}
        </Badge>
      ),
    },
    { key: 'totalOrders', header: <SortHeader label="Orders (90d)" colKey="totalOrders" /> },
    { key: 'deliveredOrders', header: <SortHeader label="Delivered" colKey="deliveredOrders" /> },
    {
      key: 'cancelRate',
      header: <SortHeader label="Cancel Rate" colKey="cancelRate" />,
      render: (item) => {
        const rate = (item.cancelRate * 100).toFixed(1);
        const variant = item.cancelRate > 0.25 ? 'high' : item.cancelRate > 0.15 ? 'warn' : item.totalOrders > 0 ? 'success' : 'default';
        return <Badge variant={variant}>{rate}%</Badge>;
      },
    },
    {
      key: 'totalRevenue',
      header: <SortHeader label="Revenue (90d)" colKey="totalRevenue" />,
      render: (item) => formatIDR(item.totalRevenue),
    },
  ];

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    let rows = data.filter((r) =>
      [r.code, r.name, r.region || ""].join(" ").toLowerCase().includes(q)
    );
    if (region !== 'ALL') rows = rows.filter((r) => r.region === region);
    if (activeOnly) rows = rows.filter((r) => r.isActive);
    if (highRiskOnly) rows = rows.filter((r) => r.cancelRate > 0.25 && r.totalOrders >= 5);
    rows.sort((a, b) => {
      const va = a[sortKey];
      const vb = b[sortKey];
      let cmp = 0;
      if (typeof va === 'number' && typeof vb === 'number') cmp = va - vb;
      else cmp = String(va ?? '').localeCompare(String(vb ?? ''));
      return sortDir === 'asc' ? cmp : -cmp;
    });
    return rows;
  }, [data, query, region, activeOnly, highRiskOnly, sortKey, sortDir]);

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <div className="flex items-center gap-2 flex-wrap">
          <div className="input-icon">
            <span className="icon">🔎</span>
            <input
              className="input"
              placeholder="Cari kode/nama/region..."
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
          </div>
          <select className="input" value={region} onChange={(e) => setRegion(e.target.value)}>
            {regions.map((r) => (
              <option key={r} value={r}>{r}</option>
            ))}
          </select>
          <button
            className={`chip ${activeOnly ? 'chip-active' : ''}`}
            onClick={() => setActiveOnly((v) => !v)}
            aria-pressed={activeOnly}
          >
            Active saja
          </button>
          <button
            className={`chip ${highRiskOnly ? 'chip-danger' : ''}`}
            onClick={() => setHighRiskOnly((v) => !v)}
            aria-pressed={highRiskOnly}
          >
            High risk
          </button>
          {(query || region !== 'ALL' || activeOnly || highRiskOnly) && (
            <button className="btn btn-secondary" onClick={() => { setQuery(''); setRegion('ALL'); setActiveOnly(false); setHighRiskOnly(false); }}>Reset</button>
          )}
        </div>
        <div className="text-sm" style={{ color: 'var(--muted)' }}>
          Menampilkan {filtered.length} dari {data.length}
        </div>
      </div>
      <DataTable
        columns={columns}
        data={filtered}
        keyExtractor={(item) => item.id}
        emptyMessage="Tidak ada data sales rep"
        onRowClick={(item) => router.push(`/orders?salesRepId=${item.id}`)}
      />
    </div>
  );
}
