# Operis Admin Dashboard - Implementation Plan

**Created:** 2026-02-04
**Status:** Planning
**Directory:** plans/260204-0942-operis-admin-dashboard

## Overview

Next.js 15 admin dashboard with Ant Design to manage Operis API - token platform for AI chat services.

## Tech Stack

- Next.js 15 (App Router)
- Ant Design 5.x
- TanStack Query v5
- Axios
- Tailwind CSS (utility complement)

## Phases

| Phase | Name | Status | Progress |
|-------|------|--------|----------|
| 01 | Project Setup & Config | Pending | 0% |
| 02 | Core Layout & Auth | Pending | 0% |
| 03 | User Management | Pending | 0% |
| 04 | Deposit Management | Pending | 0% |
| 05 | Dashboard & Polish | Pending | 0% |

## Phase Files

- [Phase 01: Setup](phase-01-project-setup.md)
- [Phase 02: Auth & Layout](phase-02-auth-layout.md)
- [Phase 03: Users](phase-03-user-management.md)
- [Phase 04: Deposits](phase-04-deposit-management.md)
- [Phase 05: Dashboard](phase-05-dashboard-polish.md)

## API Base URL

Backend: `http://localhost:3025/api`

## Key Admin Endpoints

### Auth
- `POST /auth/login` - Login, returns JWT tokens
- `POST /auth/refresh` - Refresh access token
- `GET /auth/me` - Current user info

### Users (Admin only)
- `GET /users` - List users (pagination, search, filters)
- `GET /users/:id` - User detail
- `PATCH /users/:id` - Update user (name, role, isActive)
- `DELETE /users/:id` - Delete user
- `POST /users/:id/topup` - Add tokens to user

### Deposits (Admin)
- `GET /deposits/admin/all` - All deposits (filters: userId, status, date range)
- `POST /deposits/admin/tokens` - Complete/cancel deposit manually

### Tokens (Admin)
- `GET /tokens/admin/all` - All transactions
- `GET /tokens/admin/user/:userId` - User transactions
- `POST /tokens/admin/credit` - Add tokens
- `POST /tokens/admin/debit` - Remove tokens

### Settings (Admin)
- `GET /settings` - Get system config
- `POST /settings` - Update config

## Folder Structure (Target)

```
operis-admin/
├── app/
│   ├── (auth)/login/page.tsx
│   ├── (dashboard)/
│   │   ├── layout.tsx
│   │   ├── page.tsx
│   │   ├── users/
│   │   └── deposits/
├── components/
├── hooks/
├── lib/
├── types/
└── services/
```
