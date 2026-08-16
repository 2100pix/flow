# Seamless Pending Approval Architecture

## Purpose

A user waiting on `/access-pending` should automatically continue into Flow after a workspace administrator approves the access request.

The user must not be required to complete Discord OAuth a second time after approval.

This convenience must not weaken the existing workspace authorization boundary.

---

## Core rule

A pending user must never receive a normal Flow session.

Pending authentication and workspace authentication are separate credentials.

The system distinguishes:

- Discord identity verification
- pending onboarding continuity
- workspace membership
- normal Flow session

Only workspace membership permits creation of a normal Flow session.

---

## Authentication flow

After Discord OAuth succeeds:

1. persist or update the Flow user identity
2. check membership in the configured workspace
3. if membership exists, create the normal Flow session
4. if membership does not exist:
   - create or preserve the workspace access request
   - create a temporary pending session
   - set the pending-session cookie
   - redirect to `/access-pending`

The pending session does not satisfy `requireAuth`.

---

## Pending session storage

Pending sessions are stored separately from normal Flow sessions in:

`workspace_access_request_sessions`

Required fields:

- `id`
- `workspace_id`
- `user_id`
- `expires_at`
- `created_at`

`id` stores only the hash of the pending-session token.

The raw token exists only in the browser cookie.

The table must have:

- primary key on `id`
- unique constraint on `workspace_id + user_id`
- index on `expires_at`

Only one active pending session is retained for a user in a workspace.

A new Discord login replaces the previous pending session for that user and workspace.

---

## Pending-session token

The pending session uses a cryptographically random token.

The token must have the same entropy standard as the normal Flow session token.

The raw token must never be stored in D1.

The database stores only its SHA-256 hash.

Pending sessions use a substantially shorter TTL than normal Flow sessions.

Initial TTL:

`60 minutes`

---

## Pending-session cookie

Cookie name:

`flow_pending_session`

Required properties:

- `HttpOnly`
- `SameSite=Lax`
- `Secure` when using HTTPS
- finite `Max-Age`
- `Path=/api/auth/pending`

The cookie must not be treated as a normal application session.

It is only sent to pending-auth endpoints.

---

## Pending status endpoint

Endpoint:

`GET /api/auth/pending/status`

This endpoint does not use normal `requireAuth`.

It authenticates only the pending-session cookie.

The endpoint:

1. hashes the pending token
2. loads the pending session
3. rejects missing or expired sessions
4. checks workspace membership
5. checks whether the access request still exists

Possible authenticated states:

### Pending

Access request exists and workspace membership does not exist.

Response:

`pending`

### Approved

Workspace membership exists.

Response:

`approved`

### Rejected

Workspace membership does not exist and the access request no longer exists.

Response:

`rejected`

The endpoint must not return:

- workspace name
- workspace members
- workspace permissions
- workspace roles
- clients
- projects
- tasks
- internal workspace data

---

## Session completion endpoint

Endpoint:

`POST /api/auth/pending/complete`

This endpoint does not use normal `requireAuth`.

It authenticates the pending-session cookie.

Before creating a normal Flow session it must independently verify that workspace membership currently exists.

It must never trust a previous `approved` status response.

If membership exists:

1. create a normal Flow session
2. remove the pending session
3. clear the pending-session cookie
4. set the normal Flow session cookie
5. return success

The browser then navigates to `/`.

If membership does not exist:

- existing access request → access is still pending
- missing access request → access was rejected

No normal Flow session is created.

---

## Pending page behavior

`/access-pending` remains public.

It does not use `/api/me`.

While a valid pending session exists, the page polls:

`GET /api/auth/pending/status`

Initial polling interval:

`5 seconds`

When status is:

### pending

Continue waiting.

### approved

Call:

`POST /api/auth/pending/complete`

After success, perform a full navigation to:

`/`

### rejected

Stop polling and inform the user that access was not approved.

The user may sign in again later to create a new access request.

### invalid or expired pending session

Stop polling.

The user must complete Discord login again.

---

## Approval behavior

The existing approval flow remains authoritative.

Approval continues to:

1. verify the workspace-scoped request
2. create `workspace_members`
3. assign built-in role `member`
4. set `custom_role_id` to null
5. remove the access request

Approval does not create a normal session directly.

Approval does not need access to the requester's browser or pending token.

The waiting browser discovers the new membership through the pending status endpoint.

---

## Rejection behavior

Rejecting an access request continues to delete only the access request.

The pending session may remain until it expires.

Because no membership exists, that pending session cannot be exchanged for a normal Flow session.

The status endpoint derives the rejected state from:

- no workspace membership
- no access request

No request status/history column is required.

---

## Repeated login behavior

If a pending user completes Discord OAuth again before approval:

- the access request remains idempotent
- the previous pending session is replaced
- a new pending token is issued
- the user returns to `/access-pending`

There is still only one access request and one active pending session for that user and workspace.

---

## Existing-member login

If the user already has workspace membership, Discord OAuth continues to create a normal Flow session directly.

Any stale pending session for that user and workspace may be removed.

The user is redirected to `/`.

---

## Security boundaries

A pending-session credential may only:

- inspect its own onboarding state
- exchange itself for a normal Flow session after membership exists

A pending-session credential may not:

- satisfy `requireAuth`
- access `/api/me`
- access workspace routes
- read permissions
- read workspace data
- create membership
- approve itself
- select a role
- alter an access request

---

## Security invariants

1. Discord authentication alone does not grant workspace access.
2. A pending session is not a Flow workspace session.
3. A pending access request does not grant membership.
4. A normal Flow session is created only after current membership is verified.
5. Status polling cannot create membership.
6. Client-side `approved` state is never trusted for session creation.
7. Pending tokens are random and stored only as hashes in D1.
8. Pending tokens have a short finite lifetime.
9. Pending endpoints expose no workspace data.
10. Approval always creates the built-in `member` role.
11. Rejection cannot be exchanged for a normal Flow session.
12. Existing `requireAuth` behavior remains unchanged.
13. The existing `sessions` table remains reserved for real workspace sessions.
14. The existing pending-only access-request model remains unchanged.

---

## Non-goals

This milestone does not add:

- invitation links
- invitation codes
- email notifications
- Discord notifications
- approval history
- rejection history
- multi-workspace selection
- WebSockets
- Server-Sent Events
- long-lived pending credentials

Polling is sufficient for the initial implementation.
