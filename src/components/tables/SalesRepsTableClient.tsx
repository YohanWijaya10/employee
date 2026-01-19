"use client";

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

  return (
    <DataTable
      columns={columns}
      data={data}
      keyExtractor={(item) => item.id}
      emptyMessage="No sales representatives found"
    />
  );
}

