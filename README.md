# Sales & Distribution Monitoring with Anti-Fraud Detection

A Next.js 14+ application for monitoring sales and distribution operations with built-in fraud detection and AI-powered analysis using DeepSeek.

## Features

- **Dashboard**: Real-time KPIs, order status breakdown, and recent audit flags
- **Sales Rep Management**: Track performance metrics and cancel rates per sales representative
- **Outlet Management**: Monitor outlet performance and identify high-risk locations
- **Order Management**: Full order lifecycle tracking (Created → Ready to Ship → Delivered/Cancelled)
- **Visit Tracking (Geo Check-In + Photo Proof)**:
  - GPS-based check-in with distance validation
  - Photo proof upload with automatic watermarking
  - Supabase Storage integration for secure image storage
  - Signed URLs for private photo access
  - Duplicate photo detection
- **Anti-Fraud Detection**: Rule-based detection for:
  - High cancel rates (per sales rep / outlet)
  - End-of-month order spikes
  - Pre-ship cancellations
  - Abnormal order sizes
  - Distance violations (check-in too far from outlet)
  - Duplicate photos (same image reused)
- **AI-Powered Analysis**: DeepSeek integration for narrative summaries and investigation checklists

## Tech Stack

- **Framework**: Next.js 14+ (App Router)
- **Language**: TypeScript
- **Database**: Neon Postgres (Serverless)
- **ORM**: Prisma
- **File Storage**: Supabase Storage (for visit proof photos)
- **AI**: DeepSeek (OpenAI-compatible API)
- **Styling**: Tailwind CSS
- **Validation**: Zod

## Prerequisites

- Node.js 18+
- npm or yarn
- Neon Postgres account (or any PostgreSQL database)
- Supabase account (for photo storage)
- DeepSeek API key (optional, for AI features)

## Setup Instructions

### 1. Clone and Install

```bash
cd sales-monitoring
npm install
```

### 2. Environment Configuration

Copy the example environment file and configure your settings:

```bash
cp .env.example .env
```

Edit `.env` with your actual values:

```env
# Database (Neon Postgres)
DATABASE_URL="postgresql://user:password@ep-xxx.region.aws.neon.tech/dbname?sslmode=require"
DIRECT_URL="postgresql://user:password@ep-xxx.region.aws.neon.tech/dbname?sslmode=require"

# Auth (placeholder - change in production)
INTERNAL_API_KEY="your-secure-api-key-here"

# Supabase Storage (for visit proof photos)
SUPABASE_URL="https://your-project.supabase.co"
SUPABASE_SERVICE_ROLE_KEY="your-service-role-key"
SUPABASE_BUCKET="visit-proofs"

# Client-side API key (for browser requests)
NEXT_PUBLIC_API_KEY="your-secure-api-key-here"

# DeepSeek AI (optional)
DEEPSEEK_BASE_URL="https://api.deepseek.com"
DEEPSEEK_API_KEY="your-deepseek-api-key"
DEEPSEEK_MODEL="deepseek-chat"
```

### 3. Database Setup

Generate Prisma client and push schema to database:

```bash
npm run db:generate
npm run db:push
```

### 3b. Supabase Storage Setup (for Visit Photo Proof)

1. Create a Supabase project at [supabase.com](https://supabase.com)

2. Create a storage bucket:
   - Go to Storage in Supabase Dashboard
   - Click "New Bucket"
   - Name: `visit-proofs`
   - **Privacy**: Private (this is important for security)
   - Click "Create bucket"

3. Get your credentials:
   - Go to Project Settings > API
   - Copy the **Project URL** → `SUPABASE_URL`
   - Copy the **service_role key** (secret) → `SUPABASE_SERVICE_ROLE_KEY`
   - **Important**: Never expose the service_role key to the browser!

4. Configure CORS (if needed):
   - Go to Storage > Policies
   - Add CORS configuration for your domain if making direct uploads from browser

**Security Notes:**
- The service_role key has full access - only use it server-side
- Photos are stored in a private bucket
- The app generates signed URLs (1-hour TTL) for viewing photos
- Signed URLs are fetched via API, never exposing service credentials to browser

### 4. Seed Database (Development)

Populate the database with realistic test data including fraud patterns:

```bash
npm run db:seed
```

This creates:
- 6 sales representatives (2 with high cancel rates)
- 40 outlets
- 30 products
- 800 orders over 90 days
- Fraud patterns: end-of-month spikes, pre-ship cancellations, abnormal order sizes

### 5. Run Development Server

```bash
npm run dev
```

Visit `http://localhost:3000` to access the application.

## Project Structure

```
sales-monitoring/
├── prisma/
│   ├── schema.prisma      # Database schema
│   └── seed.ts            # Seed script with fraud patterns
├── src/
│   ├── app/
│   │   ├── api/           # API routes
│   │   │   ├── ai/        # AI summary endpoint
│   │   │   ├── flags/     # Audit flags CRUD
│   │   │   ├── metrics/   # Metrics computation
│   │   │   ├── orders/    # Order management
│   │   │   ├── outlets/   # Outlet CRUD
│   │   │   ├── sales-reps/# Sales rep CRUD
│   │   │   └── visits/    # Visit check-in & photo upload
│   │   ├── dashboard/     # Main dashboard
│   │   ├── orders/        # Order list and detail
│   │   ├── outlets/       # Outlet management
│   │   ├── reports/       # Anti-fraud reports
│   │   ├── sales-reps/    # Sales rep management
│   │   └── visits/        # Visit list, detail, new check-in
│   ├── components/        # Reusable UI components
│   └── lib/
│       ├── ai/            # DeepSeek integration
│       ├── auth/          # Auth middleware
│       ├── db/            # Prisma client
│       ├── fraud/         # Fraud detection rules
│       ├── metrics/       # Metrics computation
│       ├── storage/       # Supabase Storage helper
│       ├── supabase/      # Supabase server client
│       └── validation/    # Zod schemas
```

## API Endpoints

### Metrics
- `GET /api/metrics?from=YYYY-MM-DD&to=YYYY-MM-DD` - Get aggregated metrics

### Flags
- `GET /api/flags?from=&to=&severity=` - List audit flags
- `POST /api/flags` - Run fraud detection and generate flags

### Orders
- `GET /api/orders?status=&page=&limit=` - List orders
- `GET /api/orders/[id]` - Get order details
- `POST /api/orders` - Create order
- `PATCH /api/orders/[id]` - Update order status
- `POST /api/orders/[id]/cancel` - Cancel order

### Visits (Geo Check-In + Photo Proof)
- `GET /api/visits?from=&to=&salesRepId=&outletId=&status=` - List visits
- `GET /api/visits/[id]` - Get visit details
- `POST /api/visits/check-in` - Create new check-in (geo location)
- `POST /api/visits/[id]/photo` - Upload photo proof (max 5MB, JPEG/PNG)
- `GET /api/visits/[id]/photo-url` - Get signed URL for viewing photo (1-hour TTL)

### AI Summary
- `POST /api/ai/anti-fraud-summary` - Generate AI-powered fraud analysis

### Authentication

API routes are protected by a simple API key check. Include the header:
```
X-API-KEY: your-configured-api-key
```

In development without `INTERNAL_API_KEY` set, authentication is bypassed.

## Fraud Detection Rules

| Rule Code | Description | Severity Thresholds |
|-----------|-------------|---------------------|
| `HIGH_CANCEL_RATE` | Cancel rate per entity | WARN: >15%, HIGH: >25% |
| `END_OF_MONTH_SPIKE` | Orders in last 5 days vs rest | WARN: 1.5x, HIGH: 2x expected |
| `PRE_SHIP_CANCEL` | Cancellations within 24h of ship | WARN: >10%, HIGH: >20% |
| `ABNORMAL_ORDER_SIZE` | Order amount vs outlet median | WARN: >3x, HIGH: >5x |
| `DISTANCE_TOO_FAR` | Check-in distance from outlet | WARN: >200m |
| `DUPLICATE_PHOTO` | Same photo hash used before | HIGH: any duplicate |

## AI Integration

The AI summary feature uses DeepSeek to:
1. Analyze aggregated metrics
2. Identify risk patterns
3. Generate human-readable summaries
4. Provide investigation checklists

**Important**: The AI never invents numbers. All data comes from the database, and the AI only summarizes and explains patterns. If data is missing, it reports limitations.

## Development

### Available Scripts

```bash
npm run dev          # Start development server
npm run build        # Build for production
npm run start        # Start production server
npm run lint         # Run ESLint
npm run db:generate  # Generate Prisma client
npm run db:push      # Push schema to database
npm run db:migrate   # Create migration
npm run db:seed      # Seed database
npm run db:studio    # Open Prisma Studio
```

### Database Migrations

For production, use migrations instead of `db push`:

```bash
npx prisma migrate dev --name your_migration_name
```

## Production Deployment

1. Set all environment variables
2. Run database migrations
3. Build and deploy:

```bash
npm run build
npm run start
```

### Recommended: Vercel + Neon

This app is optimized for serverless deployment:
- Vercel for Next.js hosting
- Neon for serverless Postgres

## Security Considerations

- Replace the placeholder auth with proper authentication (JWT, sessions, etc.)
- Never expose `INTERNAL_API_KEY` in client-side code
- Never expose `SUPABASE_SERVICE_ROLE_KEY` in client-side code - it has full admin access
- Photo signed URLs are generated server-side with short TTL (1 hour)
- File uploads are validated server-side: type (JPEG/PNG only) and size (max 5MB)
- Validate all inputs with Zod schemas
- The AI never confirms fraud - only identifies "risk indicators"
- All AI outputs are validated with Zod before display

## License

MIT
# employee
