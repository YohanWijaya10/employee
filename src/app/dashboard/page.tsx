import { Suspense } from 'react';
import prisma from '@/lib/db/prisma';
import { getOrderMetrics, getSalesRepMetrics } from '@/lib/metrics/computations';
import { KPICard } from '@/components/KPICard';
import { TopSalesRepsTableClient } from '@/components/tables/TopSalesRepsTableClient';
import { Badge } from '@/components/Badge';
import { format, subDays } from 'date-fns';
import Link from 'next/link';

// Default date range: last 30 days
function getDefaultDateRange() {
  const to = new Date();
  const from = subDays(to, 30);
  return {
    from: format(from, 'yyyy-MM-dd'),
    to: format(to, 'yyyy-MM-dd'),
  };
}

async function DashboardKPIs() {
  const { from, to } = getDefaultDateRange();
  const metrics = await getOrderMetrics(from, to);

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
      <KPICard
        title="Total Orders"
        value={metrics.totalOrders.toLocaleString()}
        subtitle={`${from} to ${to}`}
      />
      <KPICard
        title="Delivered"
        value={metrics.deliveredOrders.toLocaleString()}
        subtitle={`${((metrics.deliveredOrders / metrics.totalOrders) * 100 || 0).toFixed(1)}% of total`}
        variant="success"
      />
      <KPICard
        title="Cancelled"
        value={metrics.cancelledOrders.toLocaleString()}
        subtitle={`${(metrics.cancelRate * 100).toFixed(1)}% cancel rate`}
        variant={metrics.cancelRate > 0.15 ? 'danger' : metrics.cancelRate > 0.1 ? 'warning' : 'default'}
      />
      <KPICard
        title="Total Revenue"
        value={`$${metrics.totalRevenue.toLocaleString(undefined, { minimumFractionDigits: 2 })}`}
        subtitle={`Avg: $${metrics.avgOrderValue.toLocaleString(undefined, { minimumFractionDigits: 2 })}`}
      />
    </div>
  );
}

interface SalesRepRow {
  salesRepId: string;
  salesRepCode: string;
  salesRepName: string;
  totalOrders: number;
  cancelledOrders: number;
  cancelRate: number;
  totalRevenue: number;
}

async function TopSalesRepsTable() {
  const { from, to } = getDefaultDateRange();
  const reps = await getSalesRepMetrics(from, to);

  return (
    <div className="card">
      <div className="flex justify-between items-center mb-4">
        <h2 className="text-lg font-semibold">Sales Reps by Cancel Rate</h2>
        <Link href="/sales-reps" className="text-blue-600 hover:underline text-sm">
          View All
        </Link>
      </div>
      <TopSalesRepsTableClient data={reps.slice(0, 5)} />
    </div>
  );
}

async function RecentFlags() {
  const flags = await prisma.auditFlag.findMany({
    orderBy: { createdAt: 'desc' },
    take: 5,
    include: {
      order: {
        select: { orderNumber: true },
      },
    },
  });

  if (flags.length === 0) {
    return (
      <div className="card">
        <h2 className="text-lg font-semibold mb-4">Recent Audit Flags</h2>
        <p className="text-gray-500 text-center py-8">No audit flags generated yet</p>
        <Link
          href="/reports/anti-fraud"
          className="block text-center text-blue-600 hover:underline text-sm mt-4"
        >
          Generate Fraud Report
        </Link>
      </div>
    );
  }

  return (
    <div className="card">
      <div className="flex justify-between items-center mb-4">
        <h2 className="text-lg font-semibold">Recent Audit Flags</h2>
        <Link href="/reports/anti-fraud" className="text-blue-600 hover:underline text-sm">
          View All
        </Link>
      </div>
      <div className="space-y-3">
        {flags.map((flag) => (
          <div
            key={flag.id}
            className="flex items-start gap-3 p-3 bg-gray-50 rounded-md"
          >
            <Badge variant={flag.severity === 'HIGH' ? 'high' : flag.severity === 'WARN' ? 'warn' : 'info'}>
              {flag.severity}
            </Badge>
            <div className="flex-1 min-w-0">
              <p className="text-sm text-gray-900 truncate">{flag.message}</p>
              <p className="text-xs text-gray-500 mt-1">
                {flag.ruleCode} | {format(flag.createdAt, 'MMM d, HH:mm')}
              </p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

async function OrderStatusBreakdown() {
  const { from, to } = getDefaultDateRange();

  const statusCounts = await prisma.order.groupBy({
    by: ['status'],
    where: {
      createdAt: {
        gte: new Date(from),
        lte: new Date(to),
      },
    },
    _count: true,
  });

  const total = statusCounts.reduce((sum, s) => sum + s._count, 0);

  const statusColors: Record<string, string> = {
    CREATED: 'bg-gray-400',
    READY_TO_SHIP: 'bg-blue-500',
    DELIVERED: 'bg-green-500',
    CANCELLED: 'bg-red-500',
  };

  const statusLabels: Record<string, string> = {
    CREATED: 'Created',
    READY_TO_SHIP: 'Ready to Ship',
    DELIVERED: 'Delivered',
    CANCELLED: 'Cancelled',
  };

  return (
    <div className="card">
      <h2 className="text-lg font-semibold mb-4">Order Status Distribution</h2>
      {total === 0 ? (
        <p className="text-gray-500 text-center py-8">No orders in this period</p>
      ) : (
        <>
          <div className="h-4 flex rounded-full overflow-hidden mb-4">
            {statusCounts.map((s) => (
              <div
                key={s.status}
                className={`${statusColors[s.status]}`}
                style={{ width: `${(s._count / total) * 100}%` }}
              />
            ))}
          </div>
          <div className="grid grid-cols-2 gap-2">
            {statusCounts.map((s) => (
              <div key={s.status} className="flex items-center gap-2">
                <div className={`w-3 h-3 rounded-full ${statusColors[s.status]}`} />
                <span className="text-sm text-gray-600">
                  {statusLabels[s.status]}: {s._count} ({((s._count / total) * 100).toFixed(1)}%)
                </span>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

function LoadingCard() {
  return (
    <div className="card animate-pulse">
      <div className="h-4 bg-gray-200 rounded w-1/3 mb-4"></div>
      <div className="h-8 bg-gray-200 rounded w-2/3"></div>
    </div>
  );
}

export default function DashboardPage() {
  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Dashboard</h1>
          <p className="text-gray-500">Sales & Distribution Monitoring Overview</p>
        </div>
        <Link href="/reports/anti-fraud" className="btn btn-primary">
          Anti-Fraud Report
        </Link>
      </div>

      <Suspense fallback={<div className="grid grid-cols-4 gap-4">{[...Array(4)].map((_, i) => <LoadingCard key={i} />)}</div>}>
        <DashboardKPIs />
      </Suspense>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Suspense fallback={<LoadingCard />}>
          <TopSalesRepsTable />
        </Suspense>

        <Suspense fallback={<LoadingCard />}>
          <RecentFlags />
        </Suspense>
      </div>

      <Suspense fallback={<LoadingCard />}>
        <OrderStatusBreakdown />
      </Suspense>
    </div>
  );
}
