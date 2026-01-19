"use client";

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { DataTable, Column } from '@/components/DataTable';
import { StatusBadge } from '@/components/Badge';
import { format } from 'date-fns';
import { formatIDR } from '@/lib/format/currency';

export interface OrderListItem {
  id: string;
  orderNumber: string;
  status: 'CREATED' | 'READY_TO_SHIP' | 'DELIVERED' | 'CANCELLED';
  totalAmount: number;
  totalItems: number;
  createdAt: Date | string;
  salesRep: { code: string; name: string };
  outlet: { code: string; name: string };
  cancellation: { reason: string } | null;
}

type SortableKey = 'orderNumber' | 'status' | 'totalAmount' | 'totalItems' | 'createdAt' | 'salesRepCode' | 'outletCode';

export function OrdersTableClient({ data }: { data: OrderListItem[] }) {
  const [query, setQuery] = useState("");
  const [rep, setRep] = useState<string>('ALL');
  const [dateFrom, setDateFrom] = useState<string>('');
  const [dateTo, setDateTo] = useState<string>('');
  const [sortKey, setSortKey] = useState<SortableKey>('createdAt');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');

  const repOptions = useMemo(() => {
    const map = new Map<string, string>();
    data.forEach((o) => {
      const key = `${o.salesRep.code}—${o.salesRep.name}`;
      if (!map.has(key)) map.set(key, key);
    });
    return ['ALL', ...Array.from(map.keys())];
  }, [data]);
  const toggleSort = (key: SortableKey) => {
    if (sortKey === key) setSortDir(sortDir === 'asc' ? 'desc' : 'asc');
    else { setSortKey(key); setSortDir('asc'); }
  };

  const SortHeader = ({ label, colKey }: { label: string; colKey: SortableKey }) => (
    <button type="button" onClick={() => toggleSort(colKey)} className="flex items-center gap-1 select-none" title="Urutkan">
      <span>{label}</span>
      <span className="text-xs" style={{ color: 'var(--muted)' }}>
        {sortKey === colKey ? (sortDir === 'asc' ? '▲' : '▼') : '↕'}
      </span>
    </button>
  );

  const columns: Column<OrderListItem>[] = [
    {
      key: 'orderNumber',
      header: <SortHeader label="Order #" colKey="orderNumber" />,
      render: (item) => (
        <Link href={`/orders/${item.id}`} className="text-blue-600 hover:underline font-medium">
          {item.orderNumber}
        </Link>
      ),
    },
    {
      key: 'status',
      header: <SortHeader label="Status" colKey="status" />,
      render: (item) => <StatusBadge status={item.status} />,
    },
    {
      key: 'salesRep',
      header: <SortHeader label="Sales Rep" colKey="salesRepCode" />,
      render: (item) => (
        <div>
          <p className="font-medium">{item.salesRep.code}</p>
          <p className="text-xs" style={{ color: 'var(--muted)' }}>{item.salesRep.name}</p>
        </div>
      ),
    },
    {
      key: 'outlet',
      header: <SortHeader label="Outlet" colKey="outletCode" />,
      render: (item) => (
        <div>
          <p className="font-medium">{item.outlet.code}</p>
          <p className="text-xs" style={{ color: 'var(--muted)' }}>{item.outlet.name}</p>
        </div>
      ),
    },
    {
      key: 'totalAmount',
      header: <SortHeader label="Amount" colKey="totalAmount" />,
      render: (item) => formatIDR(item.totalAmount),
    },
    { key: 'totalItems', header: <SortHeader label="Items" colKey="totalItems" /> },
    {
      key: 'createdAt',
      header: <SortHeader label="Created" colKey="createdAt" />,
      render: (item) => format(new Date(item.createdAt), 'MMM d, yyyy HH:mm'),
    },
    {
      key: 'cancellation',
      header: 'Cancel Reason',
      render: (item) => item.cancellation?.reason.replace(/_/g, ' ') || '-',
    },
  ];

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    let rows = data.filter((o) =>
      [
        o.orderNumber,
        o.status,
        o.salesRep.code,
        o.salesRep.name,
        o.outlet.code,
        o.outlet.name,
        o.cancellation?.reason || "",
        new Date(o.createdAt).toISOString(),
      ]
        .join(" ")
        .toLowerCase()
        .includes(q)
    );
    if (rep !== 'ALL') {
      const [code, name] = rep.split('—');
      rows = rows.filter((o) => o.salesRep.code === code && o.salesRep.name === name);
    }
    if (dateFrom) {
      const fromTs = new Date(dateFrom + 'T00:00:00').getTime();
      rows = rows.filter((o) => new Date(o.createdAt).getTime() >= fromTs);
    }
    if (dateTo) {
      const toTs = new Date(dateTo + 'T23:59:59').getTime();
      rows = rows.filter((o) => new Date(o.createdAt).getTime() <= toTs);
    }
    rows.sort((a, b) => {
      let va: any;
      let vb: any;
      switch (sortKey) {
        case 'salesRepCode':
          va = a.salesRep.code; vb = b.salesRep.code; break;
        case 'outletCode':
          va = a.outlet.code; vb = b.outlet.code; break;
        case 'createdAt':
          va = new Date(a.createdAt).getTime(); vb = new Date(b.createdAt).getTime(); break;
        default:
          va = (a as any)[sortKey]; vb = (b as any)[sortKey];
      }
      let cmp = 0;
      if (typeof va === 'number' && typeof vb === 'number') cmp = va - vb;
      else cmp = String(va ?? '').localeCompare(String(vb ?? ''));
      return sortDir === 'asc' ? cmp : -cmp;
    });
    return rows;
  }, [data, query, rep, dateFrom, dateTo, sortKey, sortDir]);

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <div className="flex items-center gap-2 flex-wrap">
          <div className="input-icon">
            <span className="icon">🔎</span>
            <input
              className="input"
              placeholder="Cari nomor order, rep, outlet, alasan..."
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
          </div>
          <select className="input" value={rep} onChange={(e) => setRep(e.target.value)}>
            {repOptions.map((r) => (
              <option key={r} value={r}>{r === 'ALL' ? 'All Sales Reps' : r}</option>
            ))}
          </select>
          <input
            type="date"
            className="input"
            value={dateFrom}
            onChange={(e) => setDateFrom(e.target.value)}
            placeholder="From"
          />
          <input
            type="date"
            className="input"
            value={dateTo}
            onChange={(e) => setDateTo(e.target.value)}
            placeholder="To"
          />
          {(query || rep !== 'ALL' || dateFrom || dateTo) && (
            <button className="btn btn-secondary" onClick={() => { setQuery(''); setRep('ALL'); setDateFrom(''); setDateTo(''); }}>Reset</button>
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
        emptyMessage="Tidak ada order"
      />
    </div>
  );
}
