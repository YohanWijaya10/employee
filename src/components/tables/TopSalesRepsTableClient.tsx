"use client";

import { DataTable, Column } from '@/components/DataTable';
import { Badge } from '@/components/Badge';

export interface SalesRepRow {
  salesRepId: string;
  salesRepCode: string;
  salesRepName: string;
  totalOrders: number;
  cancelledOrders: number;
  cancelRate: number;
  totalRevenue: number;
}

export function TopSalesRepsTableClient({ data }: { data: SalesRepRow[] }) {
  const columns: Column<SalesRepRow>[] = [
    { key: 'salesRepCode', header: 'Code' },
    { key: 'salesRepName', header: 'Name' },
    { key: 'totalOrders', header: 'Orders' },
    { key: 'cancelledOrders', header: 'Cancelled' },
    {
      key: 'cancelRate',
      header: 'Cancel Rate',
      render: (item) => {
        const rate = (item.cancelRate * 100).toFixed(1);
        const variant = item.cancelRate > 0.25 ? 'high' : item.cancelRate > 0.15 ? 'warn' : 'info';
        return <Badge variant={variant}>{rate}%</Badge>;
      },
    },
    {
      key: 'totalRevenue',
      header: 'Revenue',
      render: (item) => `$${item.totalRevenue.toLocaleString(undefined, { minimumFractionDigits: 2 })}`,
    },
  ];

  return (
    <DataTable
      columns={columns}
      data={data}
      keyExtractor={(item) => item.salesRepId}
      emptyMessage="No sales rep data available"
    />
  );
}

