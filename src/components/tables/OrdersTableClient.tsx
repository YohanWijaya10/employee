"use client";

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { DataTable, Column } from '@/components/DataTable';
import { StatusBadge } from '@/components/Badge';
import { format } from 'date-fns';

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

export function OrdersTableClient({ data }: { data: OrderListItem[] }) {
  const [query, setQuery] = useState("");
  const columns: Column<OrderListItem>[] = [
    {
      key: 'orderNumber',
      header: 'Order #',
      render: (item) => (
        <Link href={`/orders/${item.id}`} className="text-blue-600 hover:underline font-medium">
          {item.orderNumber}
        </Link>
      ),
    },
    {
      key: 'status',
      header: 'Status',
      render: (item) => <StatusBadge status={item.status} />,
    },
    {
      key: 'salesRep',
      header: 'Sales Rep',
      render: (item) => (
        <div>
          <p className="font-medium">{item.salesRep.code}</p>
          <p className="text-xs text-gray-500">{item.salesRep.name}</p>
        </div>
      ),
    },
    {
      key: 'outlet',
      header: 'Outlet',
      render: (item) => (
        <div>
          <p className="font-medium">{item.outlet.code}</p>
          <p className="text-xs text-gray-500 truncate max-w-[150px]">{item.outlet.name}</p>
        </div>
      ),
    },
    {
      key: 'totalAmount',
      header: 'Amount',
      render: (item) => `$${item.totalAmount.toLocaleString(undefined, { minimumFractionDigits: 2 })}`,
    },
    { key: 'totalItems', header: 'Items' },
    {
      key: 'createdAt',
      header: 'Created',
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
    if (!q) return data;
    return data.filter((o) =>
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
  }, [data, query]);

  return (
    <div>
      <div className="flex items-center justify-between gap-2 mb-3 flex-wrap">
        <div className="flex items-center gap-2">
          <input
            className="input"
            placeholder="Cari nomor order, rep, outlet, alasan..."
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
        emptyMessage="Tidak ada order"
      />
    </div>
  );
}
