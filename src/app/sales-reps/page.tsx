import prisma from '@/lib/db/prisma';
import { getSalesRepMetrics } from '@/lib/metrics/computations';
import { SalesRepsTableClient } from '@/components/tables/SalesRepsTableClient';
import { formatIDR } from '@/lib/format/currency';
import { format, subDays } from 'date-fns';

interface SalesRepWithStats {
  id: string;
  code: string;
  name: string;
  email: string | null;
  phone: string | null;
  region: string | null;
  isActive: boolean;
  totalOrders: number;
  cancelledOrders: number;
  cancelRate: number;
  totalRevenue: number;
  deliveredOrders: number;
}

async function getSalesRepsWithStats(): Promise<SalesRepWithStats[]> {
  const to = format(new Date(), 'yyyy-MM-dd');
  const from = format(subDays(new Date(), 90), 'yyyy-MM-dd');

  const [salesReps, metrics] = await Promise.all([
    prisma.salesRep.findMany({
      orderBy: { name: 'asc' },
    }),
    getSalesRepMetrics(from, to),
  ]);

  const metricsMap = new Map(metrics.map((m) => [m.salesRepId, m]));

  return salesReps.map((rep) => {
    const stats = metricsMap.get(rep.id);
    return {
      id: rep.id,
      code: rep.code,
      name: rep.name,
      email: rep.email,
      phone: rep.phone,
      region: rep.region,
      isActive: rep.isActive,
      totalOrders: stats?.totalOrders || 0,
      cancelledOrders: stats?.cancelledOrders || 0,
      cancelRate: stats?.cancelRate || 0,
      totalRevenue: stats?.totalRevenue || 0,
      deliveredOrders: stats?.deliveredOrders || 0,
    };
  });
}

export default async function SalesRepsPage() {
  const salesReps = await getSalesRepsWithStats();

  // Summary stats
  const totalReps = salesReps.length;
  const activeReps = salesReps.filter((r) => r.isActive).length;
  const highRiskReps = salesReps.filter((r) => r.cancelRate > 0.25 && r.totalOrders >= 5).length;
  const totalRevenue = salesReps.reduce((sum, r) => sum + r.totalRevenue, 0);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Sales Representatives</h1>
        <p className="text-gray-500">Manage and monitor sales rep performance</p>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="card">
          <p className="text-sm text-gray-500">Total Reps</p>
          <p className="text-2xl font-semibold">{totalReps}</p>
        </div>
        <div className="card">
          <p className="text-sm text-gray-500">Active</p>
          <p className="text-2xl font-semibold text-green-600">{activeReps}</p>
        </div>
        <div className="card">
          <p className="text-sm text-gray-500">High Risk (&gt;25% cancel)</p>
          <p className="text-2xl font-semibold text-red-600">{highRiskReps}</p>
        </div>
        <div className="card">
          <p className="text-sm text-gray-500">Total Revenue (90d)</p>
          <p className="text-2xl font-semibold">{formatIDR(totalRevenue)}</p>
        </div>
      </div>

      {/* Data Table */}
      <div className="card">
        <h2 className="text-lg font-semibold mb-4">All Sales Representatives</h2>
        <SalesRepsTableClient data={salesReps} />
      </div>
    </div>
  );
}
