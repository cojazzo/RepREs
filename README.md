# RepREs — Clinical Trial Management System

A full-stack web application for managing a **double-blind randomized clinical trial** comparing **Dapagliflozin 10mg vs Placebo** over 6 months.

## Features

- **Role-Based Access**: Admin, Investigator, Data Entry, Monitor, Pharmacy (unblinded), Read-Only
- **Screening & Enrollment**: Inclusion/exclusion checklist, informed consent, auto-generated Study IDs
- **Block Randomization**: 1:1 allocation with configurable block sizes, double-blind
- **Longitudinal CRF**: Vitals (auto-BMI), clinical assessment, adherence tracking per visit
- **Laboratory Module**: Auto-calculated eGFR (CKD-EPI 2021) and ACR, flexible analyte catalog
- **Adverse Events**: Severity/relation tracking, SAE alerts
- **Pharmacy**: Dispensation tracking, lot numbers, pill-count adherence (unblinded view)
- **Dashboard**: Recruitment progress, visit completion charts, AE/SAE counts, group trends
- **Reports & Export**: CSV export for participants, visits, labs, AEs
- **Audit Trail**: Complete change logging with user/timestamp
- **Data Queries**: Monitor query workflow (Open → Responded → Resolved)

## Tech Stack

| Layer | Technology |
|-------|------------|
| Frontend | Next.js 14, TypeScript, Tailwind CSS |
| Charts | Recharts |
| Backend | Next.js API Routes |
| Database | PostgreSQL 15 |
| ORM | Prisma |
| Auth | NextAuth.js (Credentials) |
| Containerization | Docker & Docker Compose |

## Quick Start (Docker)

```bash
# 1. Clone and navigate to the project
cd RepREs

# 2. Start all services (PostgreSQL + App)
docker-compose up --build -d

# 3. Run migrations and seed demo data
docker-compose run --rm migrate

# 4. Open in browser
# http://localhost:3000
```

## Manual Development Setup

```bash
# 1. Install dependencies
npm install

# 2. Start PostgreSQL (or use Docker for just the database)
docker-compose up db -d

# 3. Set environment variables
cp .env.example .env
# Edit .env with your database URL if needed

# 4. Run migrations
npx prisma migrate dev --name init

# 5. Seed demo data
npx prisma db seed

# 6. Start dev server
npm run dev

# Open http://localhost:3000
```

## Demo Credentials

| Email | Password | Role |
|-------|----------|------|
| `admin@demo.com` | `Admin123!` | Administrator (full access) |
| `pharmacy@demo.com` | `Admin123!` | Pharmacy (unblinded view) |
| `data@demo.com` | `Admin123!` | Data Entry |
| `investigator@demo.com` | `Admin123!` | Investigator |
| `monitor@demo.com` | `Admin123!` | Monitor |

## Study Design

- **Arms**: Dapagliflozin 10mg (Group A) vs Placebo (Group B)
- **Duration**: 6 months
- **Visits**: Baseline, Month 2, Month 4, Month 6
- **Randomization**: 1:1 block randomization (block sizes 4, 6)
- **Target**: 100 participants per arm (configurable)
- **Blinding**: Double-blind — only Pharmacy/Admin see actual treatment

## Project Structure

```
RepREs/
├── docker-compose.yml          # Docker orchestration
├── Dockerfile                  # Multi-stage Next.js build
├── prisma/
│   ├── schema.prisma           # Database schema (17 models)
│   └── seed.ts                 # Demo data seeder
├── src/
│   ├── middleware.ts            # Auth route protection
│   ├── app/
│   │   ├── layout.tsx           # Root layout
│   │   ├── login/               # Login page
│   │   ├── dashboard/           # Global dashboard with charts
│   │   ├── participants/        # CRUD + enrollment + CRF
│   │   ├── adverse-events/      # AE listing with SAE alerts
│   │   ├── labs/                # Lab results viewer
│   │   ├── pharmacy/            # Dispensation tracking
│   │   ├── queries/             # Data query workflow
│   │   ├── audit-log/           # Audit trail viewer
│   │   ├── reports/             # CSV export
│   │   ├── admin/users/         # User management
│   │   └── api/                 # API route handlers
│   ├── components/              # Sidebar, layout components
│   └── lib/                     # Prisma, auth, calculations
└── README.md
```

## Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `DATABASE_URL` | PostgreSQL connection string | `postgresql://repres:repres_secret@db:5432/repres_db` |
| `NEXTAUTH_SECRET` | JWT signing secret | (auto-generated for demo) |
| `NEXTAUTH_URL` | App base URL | `http://localhost:3000` |

## License

This project is for demonstration and educational purposes.
