import { PrismaClient, OrderStatus, CancellationReason, OutletType } from '@prisma/client';
import { subDays, addDays, format, differenceInHours, startOfMonth, endOfMonth, isWithinInterval } from 'date-fns';

const prisma = new PrismaClient();

// ============================================
// CONFIGURATION
// ============================================

const SEED_CONFIG = {
  salesReps: 6,
  outlets: 40,
  products: 30,
  orders: 800,
  daysBack: 90,

  // Fraud patterns
  highCancelSalesReps: ['SR002', 'SR005'], // These will have high cancel rates
  highCancelRate: 0.35, // 35% cancel rate for flagged reps
  normalCancelRate: 0.08, // 8% normal cancel rate

  endOfMonthSpikeMultiplier: 2.5, // Orders in last 5 days of month
  preShipCancelHours: 24, // Cancel within X hours of ship date
  abnormalOrderMultiplier: 4, // Orders > 4x median are flagged
};

// ============================================
// HELPER FUNCTIONS
// ============================================

function randomInt(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function randomFloat(min: number, max: number, decimals: number = 2): number {
  return parseFloat((Math.random() * (max - min) + min).toFixed(decimals));
}

function randomElement<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

function randomDate(daysBack: number): Date {
  const now = new Date();
  const daysAgo = randomInt(0, daysBack);
  return subDays(now, daysAgo);
}

function isEndOfMonth(date: Date): boolean {
  const end = endOfMonth(date);
  const daysFromEnd = Math.ceil((end.getTime() - date.getTime()) / (1000 * 60 * 60 * 24));
  return daysFromEnd <= 5;
}

// ============================================
// SEED DATA GENERATORS
// ============================================

const salesRepData = [
  { code: 'SR001', name: 'John Smith', email: 'john.smith@company.com', region: 'North', phone: '+1-555-0101' },
  { code: 'SR002', name: 'Sarah Johnson', email: 'sarah.johnson@company.com', region: 'South', phone: '+1-555-0102' }, // HIGH CANCEL
  { code: 'SR003', name: 'Michael Brown', email: 'michael.brown@company.com', region: 'East', phone: '+1-555-0103' },
  { code: 'SR004', name: 'Emily Davis', email: 'emily.davis@company.com', region: 'West', phone: '+1-555-0104' },
  { code: 'SR005', name: 'David Wilson', email: 'david.wilson@company.com', region: 'Central', phone: '+1-555-0105' }, // HIGH CANCEL
  { code: 'SR006', name: 'Lisa Anderson', email: 'lisa.anderson@company.com', region: 'North', phone: '+1-555-0106' },
];

const outletTypes: OutletType[] = ['RETAIL', 'WHOLESALE', 'DISTRIBUTOR', 'SUPERMARKET', 'MINIMARKET'];
const cities = ['New York', 'Los Angeles', 'Chicago', 'Houston', 'Phoenix', 'Philadelphia', 'San Antonio', 'San Diego'];
const regions = ['North', 'South', 'East', 'West', 'Central'];

function generateOutlets(count: number) {
  const outlets = [];
  for (let i = 1; i <= count; i++) {
    outlets.push({
      code: `OUT${String(i).padStart(3, '0')}`,
      name: `${randomElement(['Metro', 'City', 'Central', 'Prime', 'Golden', 'Star', 'Royal', 'Elite'])} ${randomElement(['Mart', 'Store', 'Shop', 'Market', 'Outlet', 'Center'])} ${i}`,
      address: `${randomInt(100, 9999)} ${randomElement(['Main', 'Oak', 'Pine', 'Maple', 'Cedar', 'Elm'])} ${randomElement(['St', 'Ave', 'Blvd', 'Rd'])}`,
      city: randomElement(cities),
      region: randomElement(regions),
      outletType: randomElement(outletTypes),
    });
  }
  return outlets;
}

const productCategories = ['Beverages', 'Snacks', 'Dairy', 'Personal Care', 'Household', 'Frozen'];
const productNames = {
  Beverages: ['Cola', 'Juice', 'Water', 'Tea', 'Coffee', 'Energy Drink'],
  Snacks: ['Chips', 'Crackers', 'Cookies', 'Nuts', 'Candy Bar'],
  Dairy: ['Milk', 'Yogurt', 'Cheese', 'Butter', 'Cream'],
  'Personal Care': ['Shampoo', 'Soap', 'Toothpaste', 'Lotion', 'Deodorant'],
  Household: ['Detergent', 'Cleaner', 'Tissues', 'Paper Towels'],
  Frozen: ['Ice Cream', 'Frozen Pizza', 'Frozen Vegetables', 'Frozen Meat'],
};

function generateProducts(count: number) {
  const products = [];
  for (let i = 1; i <= count; i++) {
    const category = randomElement(productCategories);
    const baseName = randomElement(productNames[category as keyof typeof productNames]);
    products.push({
      sku: `SKU${String(i).padStart(3, '0')}`,
      name: `${randomElement(['Premium', 'Classic', 'Value', 'Organic', 'Natural'])} ${baseName} ${randomElement(['500ml', '1L', '250g', '500g', '100ct', ''])}`.trim(),
      category,
      unitPrice: randomFloat(1.5, 50, 2),
      unit: randomElement(['pcs', 'pack', 'bottle', 'box', 'kg']),
    });
  }
  return products;
}

// ============================================
// ORDER GENERATION WITH FRAUD PATTERNS
// ============================================

interface OrderGenContext {
  salesReps: { id: string; code: string }[];
  outlets: { id: string; code: string }[];
  products: { id: string; unitPrice: number }[];
  outletOrderCounts: Map<string, number[]>; // Track order amounts per outlet for median calculation
}

function shouldCreateEndOfMonthOrder(date: Date): boolean {
  if (!isEndOfMonth(date)) return false;
  return Math.random() < 0.7; // 70% chance for extra end-of-month orders
}

function generateOrder(
  ctx: OrderGenContext,
  orderNumber: number,
  targetDate: Date
) {
  const salesRep = randomElement(ctx.salesReps);
  const outlet = randomElement(ctx.outlets);
  const isHighCancelRep = SEED_CONFIG.highCancelSalesReps.includes(salesRep.code);

  // Determine number of items
  const numItems = randomInt(1, 5);
  const items: { productId: string; quantity: number; unitPrice: number; subtotal: number }[] = [];

  let totalAmount = 0;
  const usedProducts = new Set<string>();

  // Check if this should be an abnormal order (1 in 40 orders)
  const isAbnormalOrder = Math.random() < 0.025;

  for (let i = 0; i < numItems; i++) {
    let product: { id: string; unitPrice: number };
    do {
      product = randomElement(ctx.products);
    } while (usedProducts.has(product.id));
    usedProducts.add(product.id);

    // Normal quantity vs abnormal
    let quantity = randomInt(5, 50);
    if (isAbnormalOrder && i === 0) {
      // Make first item abnormally large
      quantity = randomInt(200, 500);
    }

    const subtotal = parseFloat((quantity * product.unitPrice).toFixed(2));
    totalAmount += subtotal;

    items.push({
      productId: product.id,
      quantity,
      unitPrice: product.unitPrice,
      subtotal,
    });
  }

  totalAmount = parseFloat(totalAmount.toFixed(2));

  // Track for outlet median calculation
  if (!ctx.outletOrderCounts.has(outlet.id)) {
    ctx.outletOrderCounts.set(outlet.id, []);
  }
  ctx.outletOrderCounts.get(outlet.id)!.push(totalAmount);

  // Determine status and potential cancellation
  const cancelRate = isHighCancelRep ? SEED_CONFIG.highCancelRate : SEED_CONFIG.normalCancelRate;
  const shouldCancel = Math.random() < cancelRate;

  let status: OrderStatus = 'CREATED';
  let deliveredAt: Date | null = null;
  const plannedShipDate = addDays(targetDate, randomInt(1, 5));

  // Cancellation details
  let cancellation: {
    reason: CancellationReason;
    notes: string | null;
    cancelledAt: Date;
    hoursBeforeShipDate: number | null;
    cancelledBySalesRepId: string;
  } | null = null;

  if (shouldCancel) {
    status = 'CANCELLED';

    // Some cancellations happen very close to ship date (suspicious)
    const isPreShipCancel = isHighCancelRep && Math.random() < 0.4;
    let cancelledAt: Date;
    let hoursBeforeShipDate: number | null = null;

    if (isPreShipCancel) {
      // Cancel within 24 hours of planned ship date
      const hoursBeforeShip = randomInt(1, SEED_CONFIG.preShipCancelHours);
      cancelledAt = new Date(plannedShipDate.getTime() - hoursBeforeShip * 60 * 60 * 1000);
      hoursBeforeShipDate = hoursBeforeShip;
    } else {
      // Cancel sometime after creation
      const hoursAfterCreation = randomInt(1, 48);
      cancelledAt = new Date(targetDate.getTime() + hoursAfterCreation * 60 * 60 * 1000);
      hoursBeforeShipDate = differenceInHours(plannedShipDate, cancelledAt);
    }

    const reasons: CancellationReason[] = [
      'CUSTOMER_REQUEST',
      'OUT_OF_STOCK',
      'PAYMENT_ISSUE',
      'DUPLICATE_ORDER',
      'SALES_REP_ERROR',
      'OTHER',
    ];

    cancellation = {
      reason: randomElement(reasons),
      notes: Math.random() < 0.3 ? `Cancellation note for order ${orderNumber}` : null,
      cancelledAt,
      hoursBeforeShipDate,
      cancelledBySalesRepId: salesRep.id,
    };
  } else {
    // Order progresses normally
    const rand = Math.random();
    if (rand < 0.15) {
      status = 'CREATED';
    } else if (rand < 0.30) {
      status = 'READY_TO_SHIP';
    } else {
      status = 'DELIVERED';
      deliveredAt = addDays(plannedShipDate, randomInt(0, 2));
    }
  }

  return {
    orderNumber: `ORD-${format(targetDate, 'yyyyMMdd')}-${String(orderNumber).padStart(4, '0')}`,
    status,
    totalAmount,
    totalItems: items.reduce((sum, item) => sum + item.quantity, 0),
    notes: Math.random() < 0.1 ? 'Special handling required' : null,
    createdAt: targetDate,
    plannedShipDate,
    deliveredAt,
    salesRepId: salesRep.id,
    outletId: outlet.id,
    items,
    cancellation,
    isAbnormalOrder,
  };
}

// ============================================
// MAIN SEED FUNCTION
// ============================================

async function main() {
  console.log('🌱 Starting database seed...');

  // Clear existing data
  console.log('🗑️  Clearing existing data...');
  await prisma.auditFlag.deleteMany();
  await prisma.cancellationLog.deleteMany();
  await prisma.orderItem.deleteMany();
  await prisma.order.deleteMany();
  await prisma.product.deleteMany();
  await prisma.outlet.deleteMany();
  await prisma.salesRep.deleteMany();

  // Create Sales Reps
  console.log('👤 Creating sales reps...');
  const salesReps = await Promise.all(
    salesRepData.map((rep) =>
      prisma.salesRep.create({
        data: rep,
      })
    )
  );
  console.log(`   Created ${salesReps.length} sales reps`);

  // Create Outlets
  console.log('🏪 Creating outlets...');
  const outletData = generateOutlets(SEED_CONFIG.outlets);
  const outlets = await Promise.all(
    outletData.map((outlet) =>
      prisma.outlet.create({
        data: outlet,
      })
    )
  );
  console.log(`   Created ${outlets.length} outlets`);

  // Create Products
  console.log('📦 Creating products...');
  const productData = generateProducts(SEED_CONFIG.products);
  const products = await Promise.all(
    productData.map((product) =>
      prisma.product.create({
        data: product,
      })
    )
  );
  console.log(`   Created ${products.length} products`);

  // Generate Orders
  console.log('📝 Creating orders with fraud patterns...');
  const ctx: OrderGenContext = {
    salesReps: salesReps.map((r) => ({ id: r.id, code: r.code })),
    outlets: outlets.map((o) => ({ id: o.id, code: o.code })),
    products: products.map((p) => ({ id: p.id, unitPrice: p.unitPrice })),
    outletOrderCounts: new Map(),
  };

  // Generate dates with end-of-month bias
  const orderDates: Date[] = [];
  const now = new Date();

  for (let i = 0; i < SEED_CONFIG.orders; i++) {
    let date = randomDate(SEED_CONFIG.daysBack);

    // Add extra orders at end of month
    if (shouldCreateEndOfMonthOrder(date)) {
      // Shift to end of month
      const monthEnd = endOfMonth(date);
      date = subDays(monthEnd, randomInt(0, 4));
    }

    orderDates.push(date);
  }

  // Sort dates for realistic order numbers
  orderDates.sort((a, b) => a.getTime() - b.getTime());

  let orderCount = 0;
  let cancelledCount = 0;
  let abnormalCount = 0;

  for (let i = 0; i < orderDates.length; i++) {
    const orderData = generateOrder(ctx, i + 1, orderDates[i]);

    // Create order with items
    const order = await prisma.order.create({
      data: {
        orderNumber: orderData.orderNumber,
        status: orderData.status,
        totalAmount: orderData.totalAmount,
        totalItems: orderData.totalItems,
        notes: orderData.notes,
        createdAt: orderData.createdAt,
        plannedShipDate: orderData.plannedShipDate,
        deliveredAt: orderData.deliveredAt,
        salesRepId: orderData.salesRepId,
        outletId: orderData.outletId,
        orderItems: {
          create: orderData.items.map((item) => ({
            productId: item.productId,
            quantity: item.quantity,
            unitPrice: item.unitPrice,
            subtotal: item.subtotal,
          })),
        },
      },
    });

    // Create cancellation log if cancelled
    if (orderData.cancellation) {
      await prisma.cancellationLog.create({
        data: {
          orderId: order.id,
          reason: orderData.cancellation.reason,
          notes: orderData.cancellation.notes,
          cancelledAt: orderData.cancellation.cancelledAt,
          hoursBeforeShipDate: orderData.cancellation.hoursBeforeShipDate,
          cancelledBySalesRepId: orderData.cancellation.cancelledBySalesRepId,
        },
      });
      cancelledCount++;
    }

    if (orderData.isAbnormalOrder) {
      abnormalCount++;
    }

    orderCount++;

    if (orderCount % 100 === 0) {
      console.log(`   Created ${orderCount} orders...`);
    }
  }

  console.log(`   Created ${orderCount} orders total`);
  console.log(`   - Cancelled: ${cancelledCount}`);
  console.log(`   - Abnormal size: ${abnormalCount}`);

  // Print summary stats
  console.log('\n📊 Seed Summary:');
  console.log(`   Sales Reps: ${salesReps.length}`);
  console.log(`   Outlets: ${outlets.length}`);
  console.log(`   Products: ${products.length}`);
  console.log(`   Orders: ${orderCount}`);
  console.log(`   Cancel Rate: ${((cancelledCount / orderCount) * 100).toFixed(1)}%`);

  // Count end-of-month orders
  const endOfMonthOrders = orderDates.filter(isEndOfMonth).length;
  console.log(`   End-of-month orders: ${endOfMonthOrders} (${((endOfMonthOrders / orderCount) * 100).toFixed(1)}%)`);

  console.log('\n✅ Seed completed successfully!');
}

main()
  .catch((e) => {
    console.error('❌ Seed failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
