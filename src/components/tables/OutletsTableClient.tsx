"use client";

import { DataTable, Column } from '@/components/DataTable';
import { Badge } from '@/components/Badge';

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
  const columns: Column<OutletRow>[] = [
    { key: 'code', header: 'Code' },
    {
      key: 'name',
      header: 'Name',
      render: (item) => (
        <div>
          <p className="font-medium">{item.name}</p>
          {item.city && <p className="text-xs text-gray-500">{item.city}</p>}
        </div>
      ),
    },
    {
      key: 'outletType',
      header: 'Type',
      render: (item) => outletTypeLabels[item.outletType] || item.outletType,
    },
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
    {
      key: 'cancelRate',
      header: 'Cancel Rate',
      render: (item) => {
        if (item.totalOrders === 0) return <span className="text-gray-400">-</span>;
        const rate = (item.cancelRate * 100).toFixed(1);
        const variant = item.cancelRate > 0.25 ? 'high' : item.cancelRate > 0.15 ? 'warn' : 'success';
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
      keyExtractor={(item) => item.id}
      emptyMessage="No outlets found"
    />
  );
}

