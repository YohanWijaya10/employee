import prisma from '@/lib/db/prisma';
import { NewVisitForm } from '@/components/NewVisitForm';

async function getSalesRepsAndOutlets() {
  const [salesReps, outlets] = await Promise.all([
    prisma.salesRep.findMany({
      where: { isActive: true },
      select: { id: true, code: true, name: true },
      orderBy: { code: 'asc' },
    }),
    prisma.outlet.findMany({
      where: { isActive: true },
      select: {
        id: true,
        code: true,
        name: true,
        address: true,
        latitude: true,
        longitude: true,
      },
      orderBy: { code: 'asc' },
    }),
  ]);

  return { salesReps, outlets };
}

export default async function NewVisitPage() {
  const { salesReps, outlets } = await getSalesRepsAndOutlets();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">New Visit Check-In</h1>
        <p className="text-gray-500">Record a new visit with geo check-in and photo proof</p>
      </div>

      <NewVisitForm salesReps={salesReps} outlets={outlets} />
    </div>
  );
}
