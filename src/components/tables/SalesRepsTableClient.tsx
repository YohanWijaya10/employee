"use client";

import { useMemo, useState } from 'react';
import { DataTable, Column } from '@/components/DataTable';
import { Badge } from '@/components/Badge';

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
  const [query, setQuery] = useState("");

  const columns: Column<SalesRepRow>[] = [
    { key: 'code', header: 'Code' },
    { key: 'name', header: 'Name' },
    { key: 'region', header: 'Region', render: (item) => item.region || '-' },
    {
      key: 'isActive',
      header: 'Status',
      render: (item) => (
        <Badge variant={item.isActive ? 'success' : 'default'}>
          {item.isActive ? 'Active' : 'Inactive'}
        </Badge>
      ),
    },
    { key: 'totalOrders', header: 'Orders (90d)' },
    { key: 'deliveredOrders', header: 'Delivered' },
    {
      key: 'cancelRate',
      header: 'Cancel Rate',
      render: (item) => {
        const rate = (item.cancelRate * 100).toFixed(1);
        const variant = item.cancelRate > 0.25 ? 'high' : item.cancelRate > 0.15 ? 'warn' : item.totalOrders > 0 ? 'success' : 'default';
        return <Badge variant={variant}>{rate}%</Badge>;
      },
    },
    {
      key: 'totalRevenue',
      header: 'Revenue (90d)',
      render: (item) => `$${item.totalRevenue.toLocaleString(undefined, { minimumFractionDigits: 2 })}`,
    },
  ];

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return data;
    return data.filter((r) =>
      [r.code, r.name, r.region || ""]
        .join(" ")
        .toLowerCase()
        .includes(q)
    );
  }, [data, query]);

  return (
    <div>
      <div className="flex items-center justify-between gap-2 mb-3 flex-wrap">
        <div className="flex items-center gap-2">
          <input
            className="input"
            placeholder="Cari kode/nama/region..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
          {query && (
            <button className="btn btn-secondary" onClick={() => setQuery("")}>Bersihkan</button>
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
      />
    </div>
  );
}
