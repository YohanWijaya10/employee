import Link from 'next/link';
import { notFound } from 'next/navigation';
import prisma from '@/lib/db/prisma';
import { VisitStatusBadge, SeverityBadge } from '@/components/Badge';
import { format } from 'date-fns';
import { VisitPhotoPreview } from '@/components/VisitPhotoPreview';

async function getVisit(id: string) {
  const visit = await prisma.visitLog.findUnique({
    where: { id },
    include: {
      salesRep: true,
      outlet: true,
      auditFlags: {
        orderBy: { createdAt: 'desc' },
      },
    },
  });

  return visit;
}

export default async function VisitDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const visit = await getVisit(id);

  if (!visit) {
    notFound();
  }

  const distanceStatus = visit.distance <= 200 ? 'OK' : 'TOO_FAR';

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <Link href="/visits" className="text-sm text-blue-600 hover:underline mb-2 block">
            &larr; Back to Visits
          </Link>
          <h1 className="text-2xl font-bold text-gray-900">
            Visit at {visit.outlet.name}
          </h1>
          <div className="flex items-center gap-3 mt-2">
            <VisitStatusBadge status={visit.status} />
            <span className="text-gray-500">
              {format(visit.checkInTime, 'MMM d, yyyy HH:mm')}
            </span>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Main Info */}
        <div className="lg:col-span-2 space-y-6">
          {/* Photo Proof */}
          <div className="card">
            <h2 className="text-lg font-semibold mb-4">Photo Proof</h2>
            {visit.photoPath ? (
              <div className="flex flex-col items-center gap-4">
                <VisitPhotoPreview visitId={visit.id} size="full" showModal={true} />
                <p className="text-xs text-gray-500 text-center">
                  Click to enlarge. Photo hash: {visit.photoSha256?.slice(0, 16)}...
                </p>
              </div>
            ) : (
              <div className="bg-gray-100 rounded-lg p-8 text-center">
                <p className="text-gray-500">No photo uploaded yet</p>
                <p className="text-sm text-gray-400 mt-2">
                  Photo proof is required for visit verification
                </p>
              </div>
            )}
          </div>

          {/* Location Info */}
          <div className="card">
            <h2 className="text-lg font-semibold mb-4">Location Details</h2>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <dt className="text-sm text-gray-500">Check-in Location</dt>
                <dd className="font-medium font-mono text-sm">
                  {visit.latitude.toFixed(6)}, {visit.longitude.toFixed(6)}
                </dd>
              </div>
              {visit.outlet.latitude && visit.outlet.longitude && (
                <div>
                  <dt className="text-sm text-gray-500">Outlet Location</dt>
                  <dd className="font-medium font-mono text-sm">
                    {visit.outlet.latitude.toFixed(6)}, {visit.outlet.longitude.toFixed(6)}
                  </dd>
                </div>
              )}
              <div>
                <dt className="text-sm text-gray-500">Distance from Outlet</dt>
                <dd className={`font-medium ${distanceStatus === 'TOO_FAR' ? 'text-red-600' : 'text-green-600'}`}>
                  {visit.distance.toFixed(0)}m
                  {distanceStatus === 'TOO_FAR' && (
                    <span className="text-red-600 ml-2">(threshold: 200m)</span>
                  )}
                </dd>
              </div>
              {visit.accuracy && (
                <div>
                  <dt className="text-sm text-gray-500">GPS Accuracy</dt>
                  <dd className="font-medium">{visit.accuracy.toFixed(0)}m</dd>
                </div>
              )}
            </div>
          </div>

          {/* Audit Flags */}
          {visit.auditFlags.length > 0 && (
            <div className="card border-yellow-200 bg-yellow-50">
              <h2 className="text-lg font-semibold text-yellow-800 mb-4">
                Audit Flags ({visit.auditFlags.length})
              </h2>
              <div className="space-y-3">
                {visit.auditFlags.map((flag) => (
                  <div key={flag.id} className="flex items-start gap-3 p-3 bg-white rounded-md border border-yellow-200">
                    <SeverityBadge severity={flag.severity} />
                    <div>
                      <p className="text-sm font-medium text-gray-900">{flag.message}</p>
                      <p className="text-xs text-gray-500 mt-1">
                        {flag.ruleCode} | {format(flag.createdAt, 'MMM d, HH:mm')}
                        {flag.isResolved && <span className="ml-2 text-green-600">(Resolved)</span>}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Sidebar */}
        <div className="space-y-6">
          {/* Visit Info */}
          <div className="card">
            <h2 className="text-lg font-semibold mb-4">Visit Information</h2>
            <dl className="space-y-3">
              <div>
                <dt className="text-sm text-gray-500">Status</dt>
                <dd className="mt-1"><VisitStatusBadge status={visit.status} /></dd>
              </div>
              <div>
                <dt className="text-sm text-gray-500">Check-in Time</dt>
                <dd className="font-medium">
                  {format(visit.checkInTime, 'MMM d, yyyy HH:mm:ss')}
                </dd>
              </div>
              <div>
                <dt className="text-sm text-gray-500">Server Time</dt>
                <dd className="font-medium">
                  {format(visit.serverTime, 'MMM d, yyyy HH:mm:ss')}
                </dd>
              </div>
              <div>
                <dt className="text-sm text-gray-500">Photo Status</dt>
                <dd className="font-medium">
                  {visit.photoPath ? (
                    <span className="text-green-600">Uploaded</span>
                  ) : (
                    <span className="text-yellow-600">Pending</span>
                  )}
                </dd>
              </div>
              {visit.notes && (
                <div>
                  <dt className="text-sm text-gray-500">Notes</dt>
                  <dd className="font-medium">{visit.notes}</dd>
                </div>
              )}
            </dl>
          </div>

          {/* Sales Rep */}
          <div className="card">
            <h2 className="text-lg font-semibold mb-4">Sales Representative</h2>
            <dl className="space-y-2">
              <div>
                <dt className="text-sm text-gray-500">Code</dt>
                <dd className="font-medium">{visit.salesRep.code}</dd>
              </div>
              <div>
                <dt className="text-sm text-gray-500">Name</dt>
                <dd className="font-medium">{visit.salesRep.name}</dd>
              </div>
              {visit.salesRep.email && (
                <div>
                  <dt className="text-sm text-gray-500">Email</dt>
                  <dd className="font-medium">{visit.salesRep.email}</dd>
                </div>
              )}
              {visit.salesRep.phone && (
                <div>
                  <dt className="text-sm text-gray-500">Phone</dt>
                  <dd className="font-medium">{visit.salesRep.phone}</dd>
                </div>
              )}
              {visit.salesRep.region && (
                <div>
                  <dt className="text-sm text-gray-500">Region</dt>
                  <dd className="font-medium">{visit.salesRep.region}</dd>
                </div>
              )}
            </dl>
          </div>

          {/* Outlet */}
          <div className="card">
            <h2 className="text-lg font-semibold mb-4">Outlet</h2>
            <dl className="space-y-2">
              <div>
                <dt className="text-sm text-gray-500">Code</dt>
                <dd className="font-medium">{visit.outlet.code}</dd>
              </div>
              <div>
                <dt className="text-sm text-gray-500">Name</dt>
                <dd className="font-medium">{visit.outlet.name}</dd>
              </div>
              {visit.outlet.address && (
                <div>
                  <dt className="text-sm text-gray-500">Address</dt>
                  <dd className="font-medium">{visit.outlet.address}</dd>
                </div>
              )}
              {visit.outlet.city && (
                <div>
                  <dt className="text-sm text-gray-500">City</dt>
                  <dd className="font-medium">{visit.outlet.city}</dd>
                </div>
              )}
              <div>
                <dt className="text-sm text-gray-500">Type</dt>
                <dd className="font-medium">{visit.outlet.outletType.replace(/_/g, ' ')}</dd>
              </div>
            </dl>
          </div>
        </div>
      </div>
    </div>
  );
}
