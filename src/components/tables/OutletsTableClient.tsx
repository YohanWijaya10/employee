"use client";

import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { DataTable, Column } from '@/components/DataTable';
import { Badge } from '@/components/Badge';
import { formatIDR } from '@/lib/format/currency';

export interface OutletRow {
  id: string;
  code: string;
  name: string;
  city: string | null;
  region: string | null;
  outletType: string;
  isActive: boolean;
  totalOrders: number;
  cancelledOrders: number;
  cancelRate: number;
  totalRevenue: number;
}

const outletTypeLabels: Record<string, string> = {
  RETAIL: 'Retail',
  WHOLESALE: 'Wholesale',
  DISTRIBUTOR: 'Distributor',
  SUPERMARKET: 'Supermarket',
  MINIMARKET: 'Minimarket',
};

export function OutletsTableClient({ data }: { data: OutletRow[] }) {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [region, setRegion] = useState<string>('ALL');
  const [type, setType] = useState<string>('ALL');
  const [activeOnly, setActiveOnly] = useState<boolean>(false);
  const [highRiskOnly, setHighRiskOnly] = useState<boolean>(false);
  const [sortKey, setSortKey] = useState<keyof OutletRow>('cancelRate');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');

  const regions = useMemo(() => {
    const set = new Set<string>();
    data.forEach((d) => d.region && set.add(d.region));
    return ['ALL', ...Array.from(set)];
  }, [data]);

  const types = useMemo(() => {
    const set = new Set<string>();
    data.forEach((d) => d.outletType && set.add(d.outletType));
    return ['ALL', ...Array.from(set)];
  }, [data]);

  const toggleSort = (key: keyof OutletRow) => {
    if (sortKey === key) setSortDir(sortDir === 'asc' ? 'desc' : 'asc');
    else { setSortKey(key); setSortDir('asc'); }
  };

  const SortHeader = ({ label, colKey }: { label: string; colKey: keyof OutletRow }) => (
    <button type="button" onClick={() => toggleSort(colKey)} className="flex items-center gap-1 select-none" title="Urutkan">
      <span>{label}</span>
      <span className="text-xs" style={{ color: 'var(--muted)' }}>
        {sortKey === colKey ? (sortDir === 'asc' ? '▲' : '▼') : '↕'}
      </span>
    </button>
  );

  const columns: Column<OutletRow>[] = [
    { key: 'code', header: <SortHeader label="Code" colKey="code" /> },
    {
      key: 'name',
      header: <SortHeader label="Name" colKey="name" />,
      render: (item) => (
        <div>
          <p className="font-medium">{item.name}</p>
          {item.city && <p className="text-xs" style={{ color: 'var(--muted)' }}>{item.city}</p>}
        </div>
      ),
    },
    {
      key: 'outletType',
      header: <SortHeader label="Type" colKey="outletType" />,
      render: (item) => outletTypeLabels[item.outletType] || item.outletType,
    },
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
    {
      key: 'cancelRate',
      header: <SortHeader label="Cancel Rate" colKey="cancelRate" />,
      render: (item) => {
        if (item.totalOrders === 0) return <span style={{ color: 'var(--muted)' }}>-</span>;
        const rate = (item.cancelRate * 100).toFixed(1);
        const variant = item.cancelRate > 0.25 ? 'high' : item.cancelRate > 0.15 ? 'warn' : 'success';
        return <Badge variant={variant}>{rate}%</Badge>;
      },
    },
    {
      key: 'totalRevenue',
      header: <SortHeader label="Revenue" colKey="totalRevenue" />,
      render: (item) => formatIDR(item.totalRevenue),
    },
  ];

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    let rows = data.filter((o) =>
      [o.code, o.name, o.city || "", o.region || "", outletTypeLabels[o.outletType] || o.outletType]
        .join(" ")
        .toLowerCase()
        .includes(q)
    );
    if (region !== 'ALL') rows = rows.filter((o) => o.region === region);
    if (type !== 'ALL') rows = rows.filter((o) => o.outletType === type);
    if (activeOnly) rows = rows.filter((o) => o.isActive);
    if (highRiskOnly) rows = rows.filter((o) => o.cancelRate > 0.25 && o.totalOrders >= 3);
    rows.sort((a, b) => {
      const va = a[sortKey];
      const vb = b[sortKey];
      let cmp = 0;
      if (typeof va === 'number' && typeof vb === 'number') cmp = va - vb;
      else cmp = String(va ?? '').localeCompare(String(vb ?? ''));
      return sortDir === 'asc' ? cmp : -cmp;
    });
    return rows;
  }, [data, query, region, type, activeOnly, highRiskOnly, sortKey, sortDir]);

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <div className="flex items-center gap-2 flex-wrap">
          <div className="input-icon">
            <span className="icon">🔎</span>
            <input
              className="input"
              placeholder="Cari kode/nama/kota/region/tipe..."
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
          </div>
          <select className="input" value={region} onChange={(e) => setRegion(e.target.value)}>
            {regions.map((r) => (
              <option key={r} value={r}>{r}</option>
            ))}
          </select>
          <div className="flex items-center gap-1 flex-wrap">
            {types.map((t) => (
              <button
                key={t}
                className={`chip ${t === type ? 'chip-active' : ''}`}
                onClick={() => setType(t)}
                aria-pressed={t === type}
              >
                {t === 'ALL' ? 'All Types' : (outletTypeLabels[t] || t)}
              </button>
            ))}
          </div>
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
          {(query || region !== 'ALL' || type !== 'ALL' || activeOnly || highRiskOnly) && (
            <button className="btn btn-secondary" onClick={() => { setQuery(''); setRegion('ALL'); setType('ALL'); setActiveOnly(false); setHighRiskOnly(false); }}>Reset</button>
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
        emptyMessage="Tidak ada outlet"
        onRowClick={(item) => router.push(`/orders?outletId=${item.id}`)}
      />
    </div>
  );
}
