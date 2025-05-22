# Apartment Matcher Application

## Overview

This is a full-stack apartment matching application built with Express.js backend and React frontend. The system allows people to submit their apartment preferences and bid amounts, then uses a sophisticated matching algorithm to assign apartments to applicants based on compatibility and bid values. The application includes roommate matching capabilities and encrypted data handling for privacy.

## User Preferences

Preferred communication style: Simple, everyday language.

## System Architecture

### Frontend Architecture
- **Framework**: React with TypeScript
- **Build Tool**: Vite for fast development and optimized builds
- **Styling**: Tailwind CSS with shadcn/ui component library
- **State Management**: TanStack Query (React Query) for server state
- **Routing**: Wouter for lightweight client-side routing
- **Forms**: React Hook Form with Zod validation

### Backend Architecture
- **Framework**: Express.js with TypeScript
- **Runtime**: Node.js with ES modules
- **Development**: tsx for TypeScript execution in development
- **Production Build**: esbuild for server bundling

### Database & ORM
- **Database**: PostgreSQL (configured via Drizzle)
- **ORM**: Drizzle ORM with Zod integration
- **Connection**: Neon Database serverless driver
- **Migrations**: Drizzle Kit for schema management

## Key Components

### Data Models
- **Apartments**: Physical properties with attributes like size, windows, amenities
- **People**: User submissions with encrypted preference data
- **Matching Results**: Algorithm outputs showing apartment assignments

### Core Services

#### CSV Data Handler
- Loads apartment data from CSV files
- Manages data persistence and parsing
- Handles both apartment listings and people data

#### Encryption System
- Server-side elliptic curve key pair generation
- Client-side encryption of sensitive preference data
- Ensures privacy of user preferences during matching

#### Matching Engine
- Sophisticated algorithm considering multiple factors:
  - Apartment preferences and their importance weights
  - Bid amounts and financial capacity
  - Roommate compatibility scoring
  - Group formation for shared apartments

#### Storage Layer
- In-memory storage with Map-based data structures
- Abstracted interface for potential database migration
- Separate handling of apartments, people, and matching results

## Data Flow

1. **Data Initialization**: Server loads apartment data from CSV files on startup
2. **User Submission**: Users fill out preference forms with apartment criteria and roommate preferences
3. **Encryption**: Sensitive preference data is encrypted client-side before transmission
4. **Storage**: User data is stored with encrypted preferences
5. **Matching**: Admin triggers matching algorithm that:
   - Decrypts user preferences
   - Calculates apartment compatibility scores
   - Forms roommate groups based on compatibility
   - Assigns apartments using bid-weighted scoring
6. **Results**: Matching results are stored and displayed in admin dashboard

## External Dependencies

### UI Components
- Radix UI primitives for accessible components
- Lucide React for icons
- Class Variance Authority for component variants

### Development Tools
- Replit-specific plugins for runtime error handling and development features
- PostCSS for Tailwind processing
- TypeScript for type safety

### Encryption & Security
- Node.js crypto module for server-side key generation
- Web Crypto API for client-side encryption
- Base64 encoding for data transmission

## Deployment Strategy

### Development
- **Port**: 5000 (configured in .replit workflows)
- **Command**: `npm run dev` using tsx for TypeScript execution
- **Hot Reload**: Vite HMR for frontend, tsx watch mode for backend

### Production
- **Build Process**: 
  - Frontend: Vite build to `dist/public`
  - Backend: esbuild bundle to `dist/index.js`
- **Start Command**: `npm run start` running the bundled server
- **Static Assets**: Express serves built frontend from dist/public

### Database
- PostgreSQL 16 module enabled in Replit environment
- Connection via DATABASE_URL environment variable
- Schema management through Drizzle migrations

The application is designed as a single-deployment unit with both frontend and backend served from the same Express server, making it suitable for platforms like Replit with integrated database support.