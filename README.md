# ♟ ProChess

> **Real-money chess platform** — play free or paid matches online with real-time gameplay, ELO-based matchmaking, multi-currency wallet, and live chat.

[![CI](https://github.com/Avic0405/prochess/actions/workflows/ci.yml/badge.svg)](https://github.com/Avic0405/prochess/actions/workflows/ci.yml)
[![License](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)
[![Node](https://img.shields.io/badge/node-%3E%3D20-brightgreen.svg)](https://nodejs.org)

---

## Table of Contents

- [Overview](#overview)
- [Features](#features)
- [Architecture](#architecture)
- [Tech Stack](#tech-stack)
- [Folder Structure](#folder-structure)
- [Installation](#installation)
- [Environment Setup](#environment-setup)
- [Local Development](#local-development)
- [Build](#build)
- [Deployment](#deployment)
- [Roadmap](#roadmap)
- [Screenshots](#screenshots)
- [License](#license)

---

## Overview

ProChess is a full-stack, real-time chess platform where players can compete in free or stake-based games. It features ELO-based rating, an in-app wallet with Stripe (USD) and Razorpay (INR) payment support, Google/Facebook OAuth, live in-game chat, game review with PGN export, a leaderboard, and a full admin dashboard.

---

## Features

| Category | Feature |
|---|---|
| **Auth** | Email/password · JWT access + refresh tokens · Google OAuth · Facebook OAuth · Email verification · Password reset |
| **Matchmaking** | ELO-based queue · Free & paid game types · Friend invitations · Rematch system |
| **Gameplay** | Real-time moves via Socket.IO · chess.js move validation · In-game timers · Check / checkmate / draw detection · Resignation · Draw offers |
| **Game Review** | Move-by-move board replay · PGN download · Keyboard navigation |
| **Wallet** | USD (Stripe) & INR (Razorpay) deposits · Withdrawal requests · Commission escrow |
| **Social** | Friends system · Friend requests · Online/offline status · User profiles · Avatar upload |
| **Notifications** | Real-time push via Socket.IO · Mark as read |
| **Leaderboard** | Global ELO rankings · Win rate |
| **Admin** | User management · Ban/unban · Game oversight · Payment audit · Dispute resolution |
| **Mobile** | Fully responsive — optimized for all screen sizes |

---

## Architecture

```
┌──────────────────────────────────────────────────────────┐
│                     Turborepo Monorepo                   │
│                                                          │
│  ┌─────────────────────┐   ┌──────────────────────────┐  │
│  │   Next.js Frontend  │   │    NestJS Backend API    │  │
│  │   (App Router)      │◄──►   (REST + Socket.IO)    │  │
│  │   Port 3000         │   │   Port 4000              │  │
│  └─────────────────────┘   └──────────┬───────────────┘  │
│                                       │                  │
│                            ┌──────────▼───────────────┐  │
│                            │   SQLite (dev)            │  │
│                            │   PostgreSQL (production) │  │
│                            │   via Prisma ORM          │  │
│                            └──────────────────────────┘  │
└──────────────────────────────────────────────────────────┘

Socket.IO Namespaces
  /game          — Real-time move exchange, resign, draw, chat
  /matchmaking   — Queue, invite, match events
  /notifications — Real-time push notifications
```

---

## Tech Stack

### Backend (`apps/backend`)

| Layer | Technology |
|---|---|
| Framework | NestJS 10 |
| Language | TypeScript 5 |
| ORM | Prisma 6 |
| Database | SQLite (dev) · PostgreSQL (prod) |
| Auth | Passport.js · JWT · Google OAuth2 · Facebook OAuth |
| Real-time | Socket.IO 4 |
| Payments | Stripe · Razorpay |
| Email | Nodemailer · Ethereal (dev) |
| Caching | In-memory Redis (dev) · Redis (prod) |
| Chess Logic | chess.js |
| Docs | Swagger / OpenAPI |

### Frontend (`apps/frontend`)

| Layer | Technology |
|---|---|
| Framework | Next.js 14 (App Router) |
| Language | TypeScript 5 |
| Styling | Tailwind CSS 3 |
| State | Zustand |
| Data Fetching | TanStack Query v5 |
| Forms | React Hook Form + Zod |
| Charts | Recharts |
| Real-time | socket.io-client 4 |
| Payments | @stripe/stripe-js · Razorpay JS SDK |

### Tooling

| Tool | Purpose |
|---|---|
| Turborepo | Monorepo build orchestration |
| Docker Compose | Local PostgreSQL + Redis (optional) |
| ESLint + Prettier | Code quality |
| GitHub Actions | CI/CD pipeline |

---

## Folder Structure

```
prochess/
├── apps/
│   ├── backend/                  # NestJS API
│   │   ├── prisma/
│   │   │   ├── schema.prisma     # Database schema
│   │   │   └── migrations/       # Migration history
│   │   └── src/
│   │       ├── auth/             # JWT, OAuth, guards
│   │       ├── users/            # Profiles, friends, leaderboard
│   │       ├── games/            # Game logic, gateway, history
│   │       ├── matchmaking/      # Queue, invites
│   │       ├── wallet/           # Balance, transactions
│   │       ├── payments/         # Stripe, Razorpay
│   │       ├── notifications/    # Real-time push
│   │       ├── admin/            # Admin endpoints
│   │       ├── mail/             # Email service
│   │       └── redis/            # Redis module
│   └── frontend/                 # Next.js App
│       └── src/
│           ├── app/              # App Router pages
│           │   ├── (auth)/       # Login, register, reset
│           │   ├── (dashboard)/  # Dashboard, profile, history…
│           │   └── (game)/       # Lobby, game, review, payment
│           ├── components/       # Shared UI components
│           ├── store/            # Zustand stores
│           ├── hooks/            # Custom React hooks
│           └── lib/              # API client, utils
├── packages/
│   └── shared/                   # Shared types & utilities
├── docker/                       # Dockerfile templates
├── .github/
│   ├── workflows/ci.yml          # GitHub Actions CI/CD
│   ├── ISSUE_TEMPLATE/           # Bug & feature templates
│   └── PULL_REQUEST_TEMPLATE.md
├── docker-compose.yml            # Dev services
├── docker-compose.prod.yml       # Production compose
├── turbo.json                    # Turborepo config
└── package.json                  # Root workspace
```

---

## Installation

### Prerequisites

- **Node.js** ≥ 20
- **npm** ≥ 10
- **Git**
- _(Optional)_ Docker Desktop — for local PostgreSQL + Redis

### Clone & Install

```bash
git clone https://github.com/Avic0405/prochess.git
cd prochess
npm install
```

---

## Environment Setup

### Backend — `apps/backend/.env`

```env
# Database
DATABASE_URL="file:./dev.db"          # SQLite for local dev
# DATABASE_URL="postgresql://..."     # PostgreSQL for production

# JWT
JWT_ACCESS_SECRET=your_32_char_access_secret_here
JWT_REFRESH_SECRET=your_32_char_refresh_secret_here
JWT_ACCESS_EXPIRY=15m
JWT_REFRESH_EXPIRY=7d

# OAuth (optional for local dev)
GOOGLE_CLIENT_ID=your_google_client_id
GOOGLE_CLIENT_SECRET=your_google_client_secret
GOOGLE_CALLBACK_URL=http://localhost:4000/api/v1/auth/google/callback
FACEBOOK_APP_ID=your_facebook_app_id
FACEBOOK_APP_SECRET=your_facebook_app_secret
FACEBOOK_CALLBACK_URL=http://localhost:4000/api/v1/auth/facebook/callback

# SMTP (Ethereal auto-created in dev if set to placeholder)
SMTP_HOST=smtp.ethereal.email
SMTP_PORT=587
SMTP_USER=placeholder
SMTP_PASS=placeholder
SMTP_FROM="ProChess <no-reply@prochess.app>"

# Redis
REDIS_HOST=localhost
REDIS_PORT=6379

# Payments (shows warning UI when set to placeholder)
STRIPE_SECRET_KEY=sk_test_placeholder
STRIPE_WEBHOOK_SECRET=whsec_placeholder
RAZORPAY_KEY_ID=rzp_test_placeholder
RAZORPAY_KEY_SECRET=rzp_secret_placeholder

# App
NODE_ENV=development
PORT=4000
APP_URL=http://localhost:3000
PLATFORM_COMMISSION_PERCENT=10
```

### Frontend — `apps/frontend/.env.local`

```env
NEXT_PUBLIC_API_URL=http://localhost:4000/api/v1
NEXT_PUBLIC_WS_URL=http://localhost:4000
NEXT_PUBLIC_APP_URL=http://localhost:3000
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_test_placeholder
NEXT_PUBLIC_RAZORPAY_KEY_ID=rzp_test_placeholder
```

> **Tip:** Payment providers display a clear "not configured" warning card when placeholder keys are used — the app never crashes.

---

## Local Development

### 1 — Prepare the database

```bash
cd apps/backend
npx prisma migrate dev --name init
npx prisma generate
```

### 2 — Start both apps (from repo root)

```bash
npm run dev
```

| App | URL |
|---|---|
| Frontend | http://localhost:3000 |
| Backend API | http://localhost:4000 |
| Swagger docs | http://localhost:4000/api/docs |

### 3 — (Optional) Docker services

```bash
docker compose up -d
```

Then update `DATABASE_URL` to the PostgreSQL connection string.

---

## Build

```bash
# Build everything via Turborepo
npm run build

# Build individually
cd apps/backend  && npm run build
cd apps/frontend && npm run build
```

---

## Deployment

### Backend

1. Provision a PostgreSQL database.
2. Set all env vars in your hosting provider (Railway, Render, AWS, etc.).
3. Run `npx prisma migrate deploy`.
4. Start with `node dist/main`.

### Frontend

1. Connect the repo to [Vercel](https://vercel.com).
2. Add `NEXT_PUBLIC_*` variables.
3. Vercel auto-deploys on push to `main`.

---

## Roadmap

| Priority | Feature | Status |
|---|---|---|
| P0 | Real-money chess (free & paid) | ✅ Done |
| P0 | ELO matchmaking | ✅ Done |
| P0 | Real-time gameplay (Socket.IO) | ✅ Done |
| P0 | Wallet — Stripe & Razorpay | ✅ Done |
| P0 | JWT + OAuth authentication | ✅ Done |
| P1 | Mobile-responsive UI | ✅ Done |
| P1 | Game review & PGN export | ✅ Done |
| P1 | Admin dashboard | ✅ Done |
| P2 | Tournaments | 🔲 Planned |
| P2 | Stockfish AI opponent | 🔲 Planned |
| P2 | Puzzle of the day | 🔲 Planned |
| P2 | Spectator mode | 🔲 Planned |
| P3 | Native mobile app (React Native) | 🔲 Planned |
| P3 | Live streaming integration | 🔲 Planned |

---

## Screenshots

> _Screenshots will be added after the first production deployment._

| Page | Description |
|---|---|
| Homepage | Marketing landing page |
| Dashboard | Player overview with quick actions |
| Lobby | Time control & game type selection |
| Game | Live chess board with timers & chat |
| Game Review | Move-by-move replay + PGN export |
| Leaderboard | Global ELO rankings |
| Wallet | Balance, deposit, transaction history |
| Profile | Player stats & rating history chart |
| Admin | User management & payment audit |

---

## License

This project is licensed under the **MIT License** — see [LICENSE](LICENSE) for details.

---

<p align="center">Built with ♟ by <a href="https://github.com/Avic0405">Avic0405</a></p>
