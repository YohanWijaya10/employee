"use client";

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

  return (
    <DataTable
      columns={columns}
      data={data}
      keyExtractor={(item) => item.id}
      emptyMessage="No orders found"
    />
  );
}

