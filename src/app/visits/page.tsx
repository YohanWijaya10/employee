import Link from 'next/link';
import prisma from '@/lib/db/prisma';
import { VisitsTableClient, VisitListItem } from '@/components/tables/VisitsTableClient';
import { Prisma } from '@prisma/client';

interface SearchParams {
  status?: string;
  page?: string;
}

async function getVisits(searchParams: SearchParams) {
  const page = parseInt(searchParams.page || '1');
  const limit = 20;
  const status = searchParams.status;

  const where: Prisma.VisitLogWhereInput = {};
  if (status && ['PENDING', 'VERIFIED', 'FLAGGED', 'REJECTED'].includes(status)) {
    where.status = status as 'PENDING' | 'VERIFIED' | 'FLAGGED' | 'REJECTED';
  }

  const [visits, total] = await Promise.all([
    prisma.visitLog.findMany({
      where,
      include: {
        salesRep: { select: { id: true, code: true, name: true } },
        outlet: { select: { id: true, code: true, name: true } },
        auditFlags: {
          select: { id: true, ruleCode: true, severity: true, message: true },
        },
      },
      orderBy: { checkInTime: 'desc' },
      skip: (page - 1) * limit,
      take: limit,
    }),
    prisma.visitLog.count({ where }),
  ]);

  return {
    visits,
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
    },
  };
}

export default async function VisitsPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const params = await searchParams;
  const { visits, pagination } = await getVisits(params);
  const currentStatus = params.status || 'all';

  const statusFilters = [
    { key: 'all', label: 'All' },
    { key: 'PENDING', label: 'Pending' },
    { key: 'VERIFIED', label: 'Verified' },
    { key: 'FLAGGED', label: 'Flagged' },
    { key: 'REJECTED', label: 'Rejected' },
  ];

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-start">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Visits</h1>
          <p className="text-gray-500">Geo check-in and photo proof records</p>
        </div>
        <Link
          href="/visits/new"
          className="btn btn-primary"
        >
          + New Check-In
        </Link>
      </div>

      {/* Status Filter */}
      <div className="card">
        <div className="flex flex-wrap gap-2">
          {statusFilters.map((filter) => (
            <Link
              key={filter.key}
              href={filter.key === 'all' ? '/visits' : `/visits?status=${filter.key}`}
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

      {/* Visits Table */}
      <div className="card">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-lg font-semibold">
            {currentStatus === 'all' ? 'All Visits' : `${currentStatus} Visits`}
          </h2>
          <p className="text-sm text-gray-500">{pagination.total} total visits</p>
        </div>

        <VisitsTableClient data={visits as unknown as VisitListItem[]} />

        {/* Pagination */}
        {pagination.totalPages > 1 && (
          <div className="flex justify-center gap-2 mt-6">
            {Array.from({ length: pagination.totalPages }, (_, i) => i + 1)
              .slice(Math.max(0, pagination.page - 3), pagination.page + 2)
              .map((page) => (
                <Link
                  key={page}
                  href={`/visits?page=${page}${currentStatus !== 'all' ? `&status=${currentStatus}` : ''}`}
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
