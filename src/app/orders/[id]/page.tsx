import Link from 'next/link';
import { notFound } from 'next/navigation';
import prisma from '@/lib/db/prisma';
import { StatusBadge, SeverityBadge, Badge } from '@/components/Badge';
import { format } from 'date-fns';

async function getOrder(id: string) {
  const order = await prisma.order.findUnique({
    where: { id },
    include: {
      salesRep: true,
      outlet: true,
      orderItems: {
        include: {
          product: true,
        },
      },
      cancellation: {
        include: {
          cancelledBySalesRep: { select: { code: true, name: true } },
        },
      },
      auditFlags: true,
    },
  });

  return order;
}

export default async function OrderDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const order = await getOrder(id);

  if (!order) {
    notFound();
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <Link href="/orders" className="text-sm text-blue-600 hover:underline mb-2 block">
            &larr; Back to Orders
          </Link>
          <h1 className="text-2xl font-bold text-gray-900">{order.orderNumber}</h1>
          <div className="flex items-center gap-3 mt-2">
            <StatusBadge status={order.status} />
            <span className="text-gray-500">
              Created {format(order.createdAt, 'MMM d, yyyy HH:mm')}
            </span>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Main Info */}
        <div className="lg:col-span-2 space-y-6">
          {/* Order Items */}
          <div className="card">
            <h2 className="text-lg font-semibold mb-4">Order Items</h2>
            <table className="min-w-full">
              <thead>
                <tr>
                  <th className="text-left">Product</th>
                  <th className="text-right">Qty</th>
                  <th className="text-right">Unit Price</th>
                  <th className="text-right">Subtotal</th>
                </tr>
              </thead>
              <tbody>
                {order.orderItems.map((item) => (
                  <tr key={item.id}>
                    <td>
                      <p className="font-medium">{item.product.name}</p>
                      <p className="text-xs text-gray-500">{item.product.sku}</p>
                    </td>
                    <td className="text-right">{item.quantity} {item.product.unit}</td>
                    <td className="text-right">${item.unitPrice.toFixed(2)}</td>
                    <td className="text-right font-medium">${item.subtotal.toFixed(2)}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="border-t-2">
                  <td colSpan={3} className="text-right font-semibold py-3">Total</td>
                  <td className="text-right font-bold text-lg py-3">
                    ${order.totalAmount.toFixed(2)}
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>

          {/* Cancellation Info */}
          {order.cancellation && (
            <div className="card border-red-200 bg-red-50">
              <h2 className="text-lg font-semibold text-red-800 mb-4">Cancellation Details</h2>
              <dl className="grid grid-cols-2 gap-4">
                <div>
                  <dt className="text-sm text-red-600">Reason</dt>
                  <dd className="font-medium text-red-900">
                    {order.cancellation.reason.replace(/_/g, ' ')}
                  </dd>
                </div>
                <div>
                  <dt className="text-sm text-red-600">Cancelled At</dt>
                  <dd className="font-medium text-red-900">
                    {format(order.cancellation.cancelledAt, 'MMM d, yyyy HH:mm')}
                  </dd>
                </div>
                {order.cancellation.cancelledBySalesRep && (
                  <div>
                    <dt className="text-sm text-red-600">Cancelled By</dt>
                    <dd className="font-medium text-red-900">
                      {order.cancellation.cancelledBySalesRep.code} - {order.cancellation.cancelledBySalesRep.name}
                    </dd>
                  </div>
                )}
                {order.cancellation.hoursBeforeShipDate !== null && (
                  <div>
                    <dt className="text-sm text-red-600">Hours Before Ship Date</dt>
                    <dd className="font-medium text-red-900">
                      {order.cancellation.hoursBeforeShipDate.toFixed(1)} hours
                      {order.cancellation.hoursBeforeShipDate <= 24 && order.cancellation.hoursBeforeShipDate >= 0 && (
                        <Badge variant="high" className="ml-2">Pre-Ship Cancel</Badge>
                      )}
                    </dd>
                  </div>
                )}
                {order.cancellation.notes && (
                  <div className="col-span-2">
                    <dt className="text-sm text-red-600">Notes</dt>
                    <dd className="font-medium text-red-900">{order.cancellation.notes}</dd>
                  </div>
                )}
              </dl>
            </div>
          )}

          {/* Audit Flags */}
          {order.auditFlags.length > 0 && (
            <div className="card border-yellow-200 bg-yellow-50">
              <h2 className="text-lg font-semibold text-yellow-800 mb-4">
                Audit Flags ({order.auditFlags.length})
              </h2>
              <div className="space-y-3">
                {order.auditFlags.map((flag) => (
                  <div key={flag.id} className="flex items-start gap-3 p-3 bg-white rounded-md border border-yellow-200">
                    <SeverityBadge severity={flag.severity} />
                    <div>
                      <p className="text-sm font-medium text-gray-900">{flag.message}</p>
                      <p className="text-xs text-gray-500 mt-1">
                        {flag.ruleCode} | {format(flag.createdAt, 'MMM d, HH:mm')}
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
          {/* Order Info */}
          <div className="card">
            <h2 className="text-lg font-semibold mb-4">Order Information</h2>
            <dl className="space-y-3">
              <div>
                <dt className="text-sm text-gray-500">Status</dt>
                <dd className="mt-1"><StatusBadge status={order.status} /></dd>
              </div>
              <div>
                <dt className="text-sm text-gray-500">Total Amount</dt>
                <dd className="text-xl font-bold">${order.totalAmount.toFixed(2)}</dd>
              </div>
              <div>
                <dt className="text-sm text-gray-500">Total Items</dt>
                <dd className="font-medium">{order.totalItems}</dd>
              </div>
              {order.plannedShipDate && (
                <div>
                  <dt className="text-sm text-gray-500">Planned Ship Date</dt>
                  <dd className="font-medium">{format(order.plannedShipDate, 'MMM d, yyyy')}</dd>
                </div>
              )}
              {order.deliveredAt && (
                <div>
                  <dt className="text-sm text-gray-500">Delivered At</dt>
                  <dd className="font-medium">{format(order.deliveredAt, 'MMM d, yyyy HH:mm')}</dd>
                </div>
              )}
              {order.notes && (
                <div>
                  <dt className="text-sm text-gray-500">Notes</dt>
                  <dd className="font-medium">{order.notes}</dd>
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
                <dd className="font-medium">{order.salesRep.code}</dd>
              </div>
              <div>
                <dt className="text-sm text-gray-500">Name</dt>
                <dd className="font-medium">{order.salesRep.name}</dd>
              </div>
              {order.salesRep.email && (
                <div>
                  <dt className="text-sm text-gray-500">Email</dt>
                  <dd className="font-medium">{order.salesRep.email}</dd>
                </div>
              )}
              {order.salesRep.region && (
                <div>
                  <dt className="text-sm text-gray-500">Region</dt>
                  <dd className="font-medium">{order.salesRep.region}</dd>
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
                <dd className="font-medium">{order.outlet.code}</dd>
              </div>
              <div>
                <dt className="text-sm text-gray-500">Name</dt>
                <dd className="font-medium">{order.outlet.name}</dd>
              </div>
              {order.outlet.address && (
                <div>
                  <dt className="text-sm text-gray-500">Address</dt>
                  <dd className="font-medium">{order.outlet.address}</dd>
                </div>
              )}
              {order.outlet.city && (
                <div>
                  <dt className="text-sm text-gray-500">City</dt>
                  <dd className="font-medium">{order.outlet.city}</dd>
                </div>
              )}
              <div>
                <dt className="text-sm text-gray-500">Type</dt>
                <dd className="font-medium">{order.outlet.outletType.replace(/_/g, ' ')}</dd>
              </div>
            </dl>
          </div>
        </div>
      </div>
    </div>
  );
}
