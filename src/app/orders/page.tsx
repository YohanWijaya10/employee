import Link from 'next/link';
import prisma from '@/lib/db/prisma';
import { OrdersTableClient } from '@/components/tables/OrdersTableClient';

interface OrderListItem {
  id: string;
  orderNumber: string;
  status: 'CREATED' | 'READY_TO_SHIP' | 'DELIVERED' | 'CANCELLED';
  totalAmount: number;
  totalItems: number;
  createdAt: Date;
  salesRep: { code: string; name: string };
  outlet: { code: string; name: string };
  cancellation: { reason: string } | null;
}

interface SearchParams {
  status?: string;
  page?: string;
}

async function getOrders(searchParams: SearchParams) {
  const page = parseInt(searchParams.page || '1');
  const limit = 20;
  const status = searchParams.status;

  const where: Parameters<typeof prisma.order.findMany>[0]['where'] = {};
  if (status && ['CREATED', 'READY_TO_SHIP', 'DELIVERED', 'CANCELLED'].includes(status)) {
    where.status = status as 'CREATED' | 'READY_TO_SHIP' | 'DELIVERED' | 'CANCELLED';
  }

  const [orders, total] = await Promise.all([
    prisma.order.findMany({
      where,
      include: {
        salesRep: { select: { code: true, name: true } },
        outlet: { select: { code: true, name: true } },
        cancellation: { select: { reason: true } },
      },
      orderBy: { createdAt: 'desc' },
      skip: (page - 1) * limit,
      take: limit,
    }),
    prisma.order.count({ where }),
  ]);

  return {
    orders,
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
    },
  };
}

export default async function OrdersPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const params = await searchParams;
  const { orders, pagination } = await getOrders(params);
  const currentStatus = params.status || 'all';


  const statusFilters = [
    { key: 'all', label: 'All' },
    { key: 'CREATED', label: 'Created' },
    { key: 'READY_TO_SHIP', label: 'Ready to Ship' },
    { key: 'DELIVERED', label: 'Delivered' },
    { key: 'CANCELLED', label: 'Cancelled' },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Orders</h1>
        <p className="text-gray-500">View and manage all orders</p>
      </div>

      {/* Status Filter */}
      <div className="card">
        <div className="flex flex-wrap gap-2">
          {statusFilters.map((filter) => (
            <Link
              key={filter.key}
              href={filter.key === 'all' ? '/orders' : `/orders?status=${filter.key}`}
              className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
                currentStatus === filter.key
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              {filter.label}
            </Link>
          ))}
        </div>
      </div>

      {/* Orders Table */}
      <div className="card">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-lg font-semibold">
            {currentStatus === 'all' ? 'All Orders' : `${currentStatus.replace(/_/g, ' ')} Orders`}
          </h2>
          <p className="text-sm text-gray-500">{pagination.total} total orders</p>
        </div>

        <OrdersTableClient data={orders as OrderListItem[]} />

        {/* Pagination */}
        {pagination.totalPages > 1 && (
          <div className="flex justify-center gap-2 mt-6">
            {Array.from({ length: pagination.totalPages }, (_, i) => i + 1)
              .slice(Math.max(0, pagination.page - 3), pagination.page + 2)
              .map((page) => (
                <Link
                  key={page}
                  href={`/orders?page=${page}${currentStatus !== 'all' ? `&status=${currentStatus}` : ''}`}
                  className={`px-3 py-1 rounded ${
                    page === pagination.page
                      ? 'bg-blue-600 text-white'
                      : 'bg-gray-100 hover:bg-gray-200'
                  }`}
                >
                  {page}
                </Link>
              ))}
          </div>
        )}
      </div>
    </div>
  );
}
