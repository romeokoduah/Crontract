# API Reference

All endpoints require authentication via NextAuth.js session cookie unless noted. All mutation endpoints create audit log entries. All queries filter by the user's current workspace.

## Auth

| Method | Path | Auth | Description |
|---|---|---|---|
| GET | `/api/auth/providers` | No | List available auth providers |
| POST | `/api/auth/callback/credentials` | No | Login with email/password |
| POST | `/api/auth/signup` | No | Create account + workspace |
| GET | `/api/auth/session` | Yes | Get current session |
| POST | `/api/auth/signout` | Yes | Sign out |

### POST /api/auth/signup
```json
// Request
{ "name": "string", "email": "string", "password": "string", "companyName": "string" }
// Response 201
{ "user": { "id": "uuid", "email": "string", "name": "string" }, "workspace": { "id": "uuid", "slug": "string" } }
```

## Onboarding

| Method | Path | Auth | Description |
|---|---|---|---|
| POST | `/api/onboarding/complete` | Yes | Complete onboarding wizard |

### POST /api/onboarding/complete
```json
// Request
{
  "businessType": "MINING_CONTRACTOR|NGO|STARTUP",
  "legalName": "string",
  "tradingName": "string",
  "country": "string",
  "currency": "string",
  "fiscalYearStart": 1-12,
  "modules": ["string"],
  "invites": [{ "email": "string", "role": "string" }]
}
```

## People

| Method | Path | Auth | Description |
|---|---|---|---|
| GET | `/api/people` | Yes | List employees (filter: status, departmentId) |
| POST | `/api/people` | Yes | Create employee |

### POST /api/people
```json
{
  "firstName": "string", "lastName": "string", "email": "string",
  "phone": "string?", "employeeNumber": "string", "jobTitle": "string?",
  "departmentId": "uuid?", "managerId": "uuid?",
  "employmentType": "FULL_TIME|PART_TIME|CONTRACT|INTERN|VOLUNTEER",
  "startDate": "ISO date", "salary": "number?"
}
```

## Projects

| Method | Path | Auth | Description |
|---|---|---|---|
| GET | `/api/projects` | Yes | List projects |
| POST | `/api/projects` | Yes | Create project |
| GET | `/api/projects/:id` | Yes | Get project detail |
| PATCH | `/api/projects/:id` | Yes | Update project |
| DELETE | `/api/projects/:id` | Yes | Soft delete project |

## Tasks

| Method | Path | Auth | Description |
|---|---|---|---|
| GET | `/api/tasks?projectId=` | Yes | List tasks for project |
| POST | `/api/tasks` | Yes | Create task |
| PATCH | `/api/tasks/:id` | Yes | Update task (status, assignee, etc.) |
| DELETE | `/api/tasks/:id` | Yes | Soft delete task |
| GET | `/api/tasks/:id/comments` | Yes | List comments on task |
| POST | `/api/tasks/:id/comments` | Yes | Add comment to task |

### PATCH /api/tasks/:id
```json
{ "status": "TODO|IN_PROGRESS|IN_REVIEW|DONE", "assigneeId": "uuid?", "priority": "LOW|MEDIUM|HIGH|URGENT", "dueDate": "ISO date?", "labels": ["string"], "position": "number" }
```

## Meetings

| Method | Path | Auth | Description |
|---|---|---|---|
| GET | `/api/meetings` | Yes | List meetings |
| POST | `/api/meetings` | Yes | Create meeting |
| GET | `/api/meetings/:id` | Yes | Get meeting detail |
| PATCH | `/api/meetings/:id` | Yes | Update meeting (minutes, status) |

## Documents

| Method | Path | Auth | Description |
|---|---|---|---|
| GET | `/api/documents` | Yes | List documents (filter: folderId, docType) |
| POST | `/api/documents` | Yes | Create document or folder |
| GET | `/api/documents/:id` | Yes | Get document detail |
| PATCH | `/api/documents/:id` | Yes | Update document |

## Approvals

| Method | Path | Auth | Description |
|---|---|---|---|
| GET | `/api/approvals?view=mine` | Yes | List approvals (mine = pending for current user) |
| PATCH | `/api/approvals/:id` | Yes | Approve or reject |

### PATCH /api/approvals/:id
```json
{ "decision": "APPROVED|REJECTED", "comment": "string?" }
```

## Notifications

| Method | Path | Auth | Description |
|---|---|---|---|
| GET | `/api/notifications` | Yes | List notifications |
| PATCH | `/api/notifications` | Yes | Mark as read |

### PATCH /api/notifications
```json
{ "id": "uuid?" }  // If no id, marks all as read
```

## Finance

| Method | Path | Auth | Description |
|---|---|---|---|
| GET | `/api/finance/invoices` | Yes | List invoices |
| POST | `/api/finance/invoices` | Yes | Create invoice |
| GET | `/api/finance/bills` | Yes | List bills |
| POST | `/api/finance/bills` | Yes | Create bill |
| GET | `/api/finance/expenses` | Yes | List expenses |
| POST | `/api/finance/expenses` | Yes | Create expense |
| GET | `/api/finance/accounts` | Yes | List chart of accounts |
| POST | `/api/finance/accounts` | Yes | Create GL account |

### POST /api/finance/invoices
```json
{
  "customerName": "string", "issueDate": "ISO date", "dueDate": "ISO date",
  "currency": "GHS", "notes": "string?",
  "lines": [{ "description": "string", "quantity": "number", "unitPrice": "number" }],
  "tax": "number"
}
```

## Budget

| Method | Path | Auth | Description |
|---|---|---|---|
| GET | `/api/budget` | Yes | List budgets |
| POST | `/api/budget` | Yes | Create budget |
| GET | `/api/budget/:id` | Yes | Get budget detail |
| PATCH | `/api/budget/:id` | Yes | Update budget |

## Procurement

| Method | Path | Auth | Description |
|---|---|---|---|
| GET | `/api/procurement/orders` | Yes | List purchase orders |
| POST | `/api/procurement/orders` | Yes | Create PO |
| GET | `/api/procurement/orders/:id` | Yes | Get PO detail (with receipts, bills) |
| PATCH | `/api/procurement/orders/:id` | Yes | Update PO status (submit/approve/send/receive/cancel) |
| GET | `/api/procurement/requisitions` | Yes | List requisitions |
| POST | `/api/procurement/requisitions` | Yes | Create requisition |
| GET | `/api/procurement/vendors` | Yes | List vendors |
| POST | `/api/procurement/vendors` | Yes | Create vendor |

### PATCH /api/procurement/orders/:id
```json
{ "action": "submit|approve|send|receive|cancel", "lines": [{ "description": "string", "quantityReceived": "number" }] }
```

## Assets

| Method | Path | Auth | Description |
|---|---|---|---|
| GET | `/api/assets` | Yes | List assets (with stats) |
| POST | `/api/assets` | Yes | Create asset |

## HSE

| Method | Path | Auth | Description |
|---|---|---|---|
| GET | `/api/hse/incidents` | Yes | List incidents |
| POST | `/api/hse/incidents` | Yes | Report incident |
| GET | `/api/hse/incidents/:id` | Yes | Get incident detail |
| PATCH | `/api/hse/incidents/:id` | Yes | Update incident (investigate, close, corrective actions) |
| GET | `/api/hse/permits` | Yes | List permits |
| POST | `/api/hse/permits` | Yes | Create permit |
| PATCH | `/api/hse/permits/:id` | Yes | Update permit status |
| GET | `/api/hse/risks` | Yes | List risk assessments |
| POST | `/api/hse/risks` | Yes | Create risk assessment |
| GET | `/api/hse/toolbox-talks` | Yes | List toolbox talks |
| POST | `/api/hse/toolbox-talks` | Yes | Record toolbox talk |
| GET | `/api/hse/training` | Yes | List safety trainings |
| POST | `/api/hse/training` | Yes | Record training |

## Admin

| Method | Path | Auth | Description |
|---|---|---|---|
| GET | `/api/admin/members` | Yes | List workspace members |
| POST | `/api/admin/members` | Yes | Invite member |
| PATCH | `/api/admin/members/:id` | Yes | Change member role |
| DELETE | `/api/admin/members/:id` | Yes | Remove member |
| GET | `/api/admin/roles` | Yes | List roles with permissions |
| PUT | `/api/admin/roles/:id/permissions` | Yes | Update role permissions |
| GET | `/api/admin/workspace` | Yes | Get workspace settings |
| PATCH | `/api/admin/workspace` | Yes | Update workspace settings |
| GET | `/api/admin/audit` | Yes | Query audit logs (paginated, filterable) |

### GET /api/admin/audit
Query params: `page`, `pageSize`, `userId`, `entityType`, `action`, `dateFrom`, `dateTo`

## Common Response Patterns

### Success
```json
{ "id": "uuid", ...fields }
```

### Error
```json
{ "error": "Human-readable error message" }
```

### Status Codes
- `200` — Success
- `201` — Created
- `400` — Validation error
- `401` — Not authenticated
- `403` — Not authorized
- `404` — Not found
- `409` — Conflict (duplicate)
- `500` — Server error
