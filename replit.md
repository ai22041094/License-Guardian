# License-Guardian

## Overview

License-Guardian is an enterprise software license management server that generates, validates, and manages software licenses. It provides a modern admin interface for creating signed license keys, tracking license status, and maintaining an audit trail of all license-related events. The system supports multi-tenant licensing with configurable modules (CUSTOM_PORTAL, ASSET_MANAGEMENT, SERVICE_DESK, EPM).

## User Preferences

Preferred communication style: Simple, everyday language.

## System Architecture

### Frontend Architecture
- **Framework**: React 18 with TypeScript, built using Vite
- **Routing**: Wouter (lightweight React router)
- **State Management**: TanStack React Query for server state, React Context for auth/theme
- **UI Components**: shadcn/ui component library built on Radix UI primitives
- **Styling**: Tailwind CSS with custom design system (Inter font for UI, JetBrains Mono for license keys)
- **Form Handling**: React Hook Form with Zod validation

### Backend Architecture
- **Runtime**: Node.js with Express.js
- **Language**: TypeScript throughout
- **API Style**: RESTful JSON APIs under `/api` prefix
- **Session Management**: Express sessions with PostgreSQL session store (connect-pg-simple)

### Authentication
- **Method**: JWT token-based authentication (switched from sessions due to Replit iframe cookie restrictions)
- **Token Storage**: Client stores JWT in localStorage
- **Token Lifetime**: 24 hours
- **Password Hashing**: bcryptjs
- **Default Admin**: System initializes with a default admin user on startup (admin / P@ssw0rd@123)

### License Key Security
- **Signing Method**: JWT (HS256) using jsonwebtoken library
- **Secret**: Configurable via `LICENSE_SIGNING_SECRET` environment variable
- **Payload Structure**: Contains tenantId, modules array, and expiry date
- **Validation**: Checks signature validity and expiration status

### Data Layer
- **ORM**: Drizzle ORM with PostgreSQL dialect
- **Schema Location**: `shared/schema.ts` (shared between client and server)
- **Migrations**: Drizzle Kit with output to `./migrations` directory

### Key Data Models
- **Users**: Admin users with username/password authentication
- **Licenses**: Core license records with tenantId, modules, expiry, status (ACTIVE/REVOKED/EXPIRED)
- **LicenseEvents**: Audit log tracking CREATED, STATUS_CHANGED, VALIDATED events

### Project Structure
```
├── client/           # React frontend (Vite)
│   └── src/
│       ├── components/   # UI components including shadcn/ui
│       ├── pages/        # Route pages (login, licenses, etc.)
│       ├── lib/          # Utilities, auth context, query client
│       └── hooks/        # Custom React hooks
├── server/           # Express backend
│   ├── routes.ts     # API route definitions
│   ├── storage.ts    # Database operations
│   ├── license-service.ts  # License key generation/verification
│   └── db.ts         # Database connection
├── shared/           # Shared TypeScript types and schemas
│   └── schema.ts     # Drizzle schema definitions
└── migrations/       # Database migrations
```

## External Dependencies

### Database
- **PostgreSQL**: Primary database for all data storage
- **Connection**: Via `DATABASE_URL` environment variable
- **Session Table**: Auto-created `session` table for express sessions

### Environment Variables Required
- `DATABASE_URL`: PostgreSQL connection string
- `LICENSE_SIGNING_SECRET`: Secret key for JWT license signing (has fallback default)
- `SESSION_SECRET`: Express session secret (has fallback default)

### Key NPM Packages
- `drizzle-orm` / `drizzle-kit`: Database ORM and migration tooling
- `jsonwebtoken`: License key signing and verification
- `bcryptjs`: Password hashing
- `express-session` / `connect-pg-simple`: Session management
- `@tanstack/react-query`: Frontend data fetching
- `zod`: Schema validation (shared client/server)
- Radix UI primitives: Accessible UI components