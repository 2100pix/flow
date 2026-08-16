# System Hardening Architecture

## Purpose

This milestone hardens the existing Flow application before production.

It does not introduce new product capabilities.

The target is consistency across:

- authentication,
- authorization,
- private-resource non-disclosure,
- database integrity,
- mutation atomicity,
- frontend permission behavior,
- error semantics,
- runtime failure recovery.

Existing product semantics remain authoritative.

---

## Security Model

Every protected operation follows this order:

```text
Session
↓
Workspace membership
↓
Workspace permission
↓
Resource existence / workspace ownership
↓
Project ACL when project-scoped
↓
Input validation
↓
Business rules
↓
Mutation
```

For private project resources, resource discovery must not occur before project ACL.

Canonical inaccessible-private responses remain:

Project resource
→ 404 PROJECT_NOT_FOUND

Task resource
→ 404 TASK_NOT_FOUND

Malformed input must not provide a different response that reveals private-resource existence.

---

## Authorization Is Backend-Authoritative

Frontend permission checks are presentation controls only.

Frontend may:

hide controls,
disable actions,
avoid unnecessary queries.

Frontend must never be the authorization boundary.

Every mutation remains protected by backend permission and resource access checks.

---

## Validation Ordering

Validation has two classes.

### Transport validation

Validation that can safely occur before resource lookup:

method routing,
authentication,
required workspace-level permission where its result does not disclose resource existence.

### Resource-sensitive validation

Validation that must occur only after canonical resource access is established:

mutation body validation for private project resources,
task update payload validation,
workflow mutation validation,
project-scoped child-resource validation.

Example:

private project inaccessible

- malformed task body

correct:
404 PROJECT_NOT_FOUND

incorrect:
400 VALIDATION_ERROR

Task-by-ID equivalent:

private task inaccessible

- malformed update body

correct:
404 TASK_NOT_FOUND

---

## Permission Integrity

Permission keys have one canonical domain:

shared permissionKeySchema

Permission values originating from the database are untrusted until validated.

Database permission rows must never be blindly cast into application permission types.

Invalid stored permission keys must fail closed.

They must never accidentally grant access.

---

## Custom Role Semantics

Built-in roles remain defined in shared code.

Custom roles:

belong to exactly one workspace,
are valid only for workspace members with role member,
replace built-in Member permissions,
may only contain supported permission keys,
may not grant permissions the acting user cannot grant,
must remain internally consistent during mutation.

Role API representation and auth middleware must interpret permission rows identically.

---

## Mutation Atomicity

A logical mutation that writes multiple related rows must be atomic.

Examples:

create custom role
→ role row
→ permission rows
update custom role
→ role metadata
→ replace permission rows
create private project
→ project
→ creator project membership
→ task workflow

A successful API response must never expose a partially-created logical entity.

When D1 supports the operation as a batch, related writes must use an atomic batch.

---

## Database Integrity

Application validation is not sufficient for structural invariants.

Database-level constraints should protect invariants that remain stable regardless of UI or API implementation.

Candidates include:

supported permission keys,
role/member relationship consistency,
foreign-key consistency,
project workflow completeness,
workflow unique positions,
known enum domains,
unique relationships.

A migration is required only when a stable invariant cannot already be guaranteed by existing schema.

No production migration occurs during 8.10.

All migration validation is local only.

---

## Session Integrity

Sessions remain opaque random tokens in the browser.

Stored session identifiers remain hashed.

Session cookies remain:

HttpOnly
SameSite
Secure in HTTPS environments
path=/
finite expiry

Invalid or expired sessions must:

fail with 401,
remove unusable local session state,
never fall through into partially-authenticated behavior.

Logout must invalidate the server-side session when present.

---

## Error Semantics

Errors are part of the security boundary.

Canonical categories:

401
authentication/session invalid

403
authenticated but workspace permission denied

404
resource absent or intentionally non-discoverable

400
input invalid after resource access is established

409
valid request conflicts with current state

500
internal integrity invariant failed

Private ACL must not be distinguishable from resource absence.

Raw database or stack errors must never be sent to clients.

---

## Frontend Query Discipline

A component must not fetch data solely because it is mounted.

Queries must reflect capability.

Example:

read-only project viewer
without clients.view

must not request the client collection merely to render a disabled client selector.

Frontend query rules:

fetch only data needed for visible capability,
use query enabled conditions where appropriate,
preserve already-loaded resource data needed for read-only rendering,
do not create expected 403 network noise.

---

## Read-Only UI

Read-only users should receive a coherent view rather than an editable UI filled with disabled controls that require unrelated data.

Where practical:

can edit
→ editor control

cannot edit
→ presentation value

At minimum, inaccessible auxiliary queries must not execute.

---

## Resource Non-Disclosure Matrix

### Project-scoped collection

GET /projects/:projectId/tasks
GET /projects/:projectId/task-workflow
PATCH /projects/:projectId/tasks/reorder
POST /projects/:projectId/tasks

Inaccessible private project:

404 PROJECT_NOT_FOUND

regardless of malformed request body.

### Task-by-ID

GET /tasks/:taskId
PATCH /tasks/:taskId
DELETE /tasks/:taskId

Inaccessible private task:

404 TASK_NOT_FOUND

Body validation must not run before this decision when body validation could change the observable status.

---

## Database-Originated Data

Database enum-like text is not automatically trusted merely because TypeScript types describe it.

Runtime parsing is required where corruption or legacy data could cross an authorization boundary.

Critical examples:

permission keys,
role identifiers where appropriate,
workflow integrity.

Corruption must fail closed.

---

## Existing Integrity Failure Policy

Task workflow remains fail-closed.

Invalid workflow:

WORKFLOW_INTEGRITY_ERROR

The backend must not synthesize missing workflow rows.

The frontend must not create fallback hardcoded workflow columns.

---

## Hardening Audit Scope

The audit covers:

Auth/session
Workspace membership
Roles/permissions
Members
Teams
Clients
Projects
Project privacy
Project members
Task workflow
Tasks
Dashboard
Frontend permission-driven queries
Frontend mutation/error behavior

Every endpoint is classified by:

authentication
permission
resource ownership
project ACL
validation ordering
mutation atomicity
error semantics

---

## Implementation Sequence

### 8.10B — Private Resource Non-Disclosure Ordering

Audit project-scoped and task-by-ID mutations.

Move resource/ACL establishment ahead of resource-sensitive payload validation.

Preserve canonical private 404 behavior for malformed requests.

### 8.10C — Role + Permission Integrity

Remove unsafe database permission casts.

Use one runtime permission parser across auth and role APIs.

Fail closed on invalid permission storage.

### 8.10D — Mutation Atomicity

Make logical multi-table role writes atomic.

Audit other multi-write mutations for partial-success states.

### 8.10E — Permission-Aware UI Fetching

Remove unnecessary auxiliary queries from read-only or unauthorized UI paths.

Project detail client fetching is a known audit target.

### 8.10F — Session + Auth Failure Hardening

Validate session expiry, logout, invalid memberships, invalid custom roles, cookie behavior, and frontend 401 handling.

### 8.10G — Database Integrity Hardening

Add only stable DB constraints that materially strengthen runtime invariants.

Validate every migration locally.

### 8.10H — Full Auth/DB/UI Runtime Matrix

Run the final security and integrity matrix across:

unauthenticated user,
Owner,
Admin,
built-in Member,
custom read-only role,
custom restricted role,
workspace project,
private project member,
private project non-member,
malformed requests,
corrupted local integrity probes.
