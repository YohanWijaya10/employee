import prisma from '@/lib/db/prisma';
import { getOutletMetrics } from '@/lib/metrics/computations';
import { OutletsTableClient } from '@/components/tables/OutletsTableClient';
import { Badge } from '@/components/Badge';
import { format, subDays } from 'date-fns';

interface OutletWithStats {
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

async function getOutletsWithStats(): Promise<OutletWithStats[]> {
  const to = format(new Date(), 'yyyy-MM-dd');
  const from = format(subDays(new Date(), 90), 'yyyy-MM-dd');

  const [outlets, metrics] = await Promise.all([
    prisma.outlet.findMany({
      orderBy: { name: 'asc' },
    }),
    getOutletMetrics(from, to),
  ]);

  const metricsMap = new Map(metrics.map((m) => [m.outletId, m]));

  return outlets.map((outlet) => {
    const stats = metricsMap.get(outlet.id);
    return {
      id: outlet.id,
      code: outlet.code,
      name: outlet.name,
      city: outlet.city,
      region: outlet.region,
      outletType: outlet.outletType,
      isActive: outlet.isActive,
      totalOrders: stats?.totalOrders || 0,
      cancelledOrders: stats?.cancelledOrders || 0,
      cancelRate: stats?.cancelRate || 0,
      totalRevenue: stats?.totalRevenue || 0,
    };
  });
}

const outletTypeLabels: Record<string, string> = {
  RETAIL: 'Retail',
  WHOLESALE: 'Wholesale',
  DISTRIBUTOR: 'Distributor',
  SUPERMARKET: 'Supermarket',
  MINIMARKET: 'Minimarket',
};

export default async function OutletsPage() {
  const outlets = await getOutletsWithStats();

  // Summary stats
  const totalOutlets = outlets.length;
  const activeOutlets = outlets.filter((o) => o.isActive).length;
  const outletsWithOrders = outlets.filter((o) => o.totalOrders > 0).length;
  const highRiskOutlets = outlets.filter((o) => o.cancelRate > 0.25 && o.totalOrders >= 3).length;

  // By type breakdown
  const byType = outlets.reduce(
    (acc, o) => {
      acc[o.outletType] = (acc[o.outletType] || 0) + 1;
      return acc;
    },
    {} as Record<string, number>
  );

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Outlets</h1>
        <p className="text-gray-500">Manage and monitor outlet performance</p>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="card">
          <p className="text-sm text-gray-500">Total Outlets</p>
          <p className="text-2xl font-semibold">{totalOutlets}</p>
        </div>
        <div className="card">
          <p className="text-sm text-gray-500">Active</p>
          <p className="text-2xl font-semibold text-green-600">{activeOutlets}</p>
        </div>
        <div className="card">
          <p className="text-sm text-gray-500">With Orders (90d)</p>
          <p className="text-2xl font-semibold text-blue-600">{outletsWithOrders}</p>
        </div>
        <div className="card">
          <p className="text-sm text-gray-500">High Risk (&gt;25% cancel)</p>
          <p className="text-2xl font-semibold text-red-600">{highRiskOutlets}</p>
        </div>
      </div>

      {/* Type Breakdown */}
      <div className="card">
        <h2 className="text-lg font-semibold mb-4">Outlets by Type</h2>
        <div className="flex flex-wrap gap-4">
          {Object.entries(byType).map(([type, count]) => (
            <div key={type} className="flex items-center gap-2">
              <Badge variant="default">{outletTypeLabels[type] || type}</Badge>
              <span className="text-sm text-gray-600">{count}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Data Table */}
      <div className="card">
        <h2 className="text-lg font-semibold mb-4">All Outlets</h2>
        <OutletsTableClient data={outlets} />
      </div>
    </div>
  );
}
