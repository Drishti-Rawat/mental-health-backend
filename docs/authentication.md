# Backend Authentication & Session Management System Documentation

This document explains the architecture, security models, database schemas, token flows, and API endpoints for the **Mental Health Platform Backend Authentication System**.

---

## 📑 Table of Contents

1. [Architecture Overview](#1-architecture-overview)
2. [Dual-Model Architecture (User vs Admin)](#2-dual-model-architecture-user-vs-admin)
3. [Dual-Token System](#3-dual-token-system)
4. [Database Collections & Schemas](#4-database-collections--schemas)
5. [Authentication & Staff Approval Flows](#5-authentication--staff-approval-flows)
   - [Patient Registration Flow](#patient-registration-flow)
   - [Therapist / Staff Registration & Approval Flow](#therapist--staff-registration--approval-flow)
   - [Admin / Supervisor Application & Approval Flow](#admin--supervisor-application--approval-flow)
   - [Token Refresh & Rotation Flow](#token-refresh--rotation-flow)
   - [Logout & Session Revocation](#logout--session-revocation)
6. [API Endpoint Reference](#6-api-endpoint-reference)
7. [Environment Variables](#7-environment-variables)
8. [Security Practices Summary](#8-security-practices-summary)

---

## 1. Architecture Overview

The backend uses a **Dual-Model Security Architecture**:
- **`User` Model (`users` collection)**: Public users (Patients/Clients & Therapists).
- **`Admin` Model (`admins` collection)**: Administrative Staff (`superadmin`, `admin`, `supervisor`).

```text
       ┌───────────────────────────────┐
       │     Public Client Website     │
       └───────────────┬───────────────┘
                       │
             /api/auth/register /login
                       │
                       ▼
                 User Collection
                 (user, therapist)
                                                       ┌──────────────────────────────┐
                                                       │     Admin Portal Dashboard   │
                                                       └──────────────┬───────────────┘
                                                                      │
                                                           /api/admin/auth/login
                                                                      │
                                                                      ▼
                                                               Admin Collection
                                                       (superadmin, admin, supervisor)
```

---

## 2. Dual-Model Architecture (User vs Admin)

### Why Separate `Admin` and `User` Collections?
1. **Security Isolation**: Administrative credentials, permissions, and audit trails are completely isolated from public patient user data.
2. **Dedicated Approval Workflow**: Public patients (`role: 'user'`) are active immediately upon registration. Staff applicants (Therapists, Supervisors, Admins) default to `status: 'pending_approval'` and cannot log in until approved by a Superadmin/Supervisor.

---

## 3. Dual-Token System

### Access Token
- **Lifetime**: 15 minutes (`JWT_ACCESS_EXPIRES_IN=15m`).
- **Format**: JSON Web Token (JWT).
- **Storage**: Application memory / state.

### Refresh Token
- **Lifetime**: 30 days absolute expiration (`REFRESH_TOKEN_EXPIRES_IN=30d`).
- **Format**: High-entropy cryptographically secure random string (`crypto.randomBytes(40)`).
- **Client Storage**: **HTTP-only, Secure, SameSite=Lax** Cookie (`path=/api/auth`).
- **Database Storage**: SHA-256 Hashed in `AuthSession`.

---

## 4. Database Collections & Schemas

### User Schema (`users` collection)
Stores public client accounts and therapists.

| Field | Type | Required | Description |
| :--- | :--- | :--- | :--- |
| `_id` | ObjectId | Yes | Unique User ID |
| `name` | String | Yes | Full name |
| `email` | String | Yes | Lowercase unique email |
| `passwordHash` | String | Yes | Bcrypt hashed password (12 rounds) |
| `role` | String | Yes | `user` or `therapist` (Default: `user`) |
| `status` | String | Yes | `active`, `pending_approval`, `inactive`, `rejected` |

### Admin Schema (`admins` collection)
Stores administrative and supervisor staff accounts.

| Field | Type | Required | Description |
| :--- | :--- | :--- | :--- |
| `_id` | ObjectId | Yes | Unique Admin ID |
| `name` | String | Yes | Full name |
| `email` | String | Yes | Lowercase unique email |
| `passwordHash` | String | Yes | Bcrypt hashed password (12 rounds) |
| `role` | String | Yes | `superadmin`, `admin`, `supervisor` (Default: `admin`) |
| `status` | String | Yes | `pending_approval`, `active`, `inactive`, `rejected` |
| `permissions` | Array | Yes | Array of permission strings (e.g. `['manage_users', 'approve_staff']`) |
| `approvedBy` | ObjectId | No | Reference to `Admin._id` who approved account |

---

## 5. Authentication & Staff Approval Flows

### Patient Registration Flow
1. Patient calls `POST /api/auth/register` with `{ name, email, password }`.
2. Role is set to `user`, status is set to `active`.
3. Logged in immediately with Access Token + Refresh Cookie.

### Therapist & Admin Registration Flow
1. Applicant calls `POST /api/auth/register` (`role: 'therapist'`) OR `POST /api/admin/auth/register` (`role: 'admin'|'supervisor'`).
2. Account is created with `status: 'pending_approval'`.
3. **No login tokens or cookies are issued**.
4. Superadmin/Supervisor views pending staff applications (`GET /api/admin/staff/pending`).
5. Superadmin approves (`PATCH /api/admin/staff/:id/approve`).
6. Status updates to `active`. Account can now log in!

---

## 6. API Endpoint Reference

### Public Auth Endpoints (`/api/auth`)
- `POST /api/auth/register`: Register Patient (`user`) or apply for `therapist`.
- `POST /api/auth/login`: Login for Patients & Therapists.
- `POST /api/auth/refresh`: Rotate refresh token & issue new Access Token.
- `POST /api/auth/logout`: Single device logout.
- `POST /api/auth/logout-all`: Logout all devices.
- `GET /api/auth/me`: Get current user profile.

### Admin Auth & Approval Endpoints (`/api/admin`)
- `POST /api/admin/auth/register`: Apply for Admin or Supervisor role (`pending_approval`).
- `POST /api/admin/auth/login`: Login for Superadmin, Admin, Supervisor.
- `GET /api/admin/staff/pending`: List all staff applications pending approval (Protected/Admin).
- `PATCH /api/admin/staff/:id/approve`: Approve pending staff/admin account (Protected/Admin).
- `PATCH /api/admin/staff/:id/reject`: Reject pending staff/admin account (Protected/Admin).
