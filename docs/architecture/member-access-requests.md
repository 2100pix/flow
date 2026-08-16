# Member Access Request Architecture

## Purpose

Flow allows a Discord user who is not yet a workspace member to request access to the configured workspace.

Access requests are onboarding data only.

An access request must never grant workspace access by itself.

---

## Authentication behavior

Discord OAuth verifies the user's identity.

After Discord identity is persisted, Flow checks whether the user already has workspace membership.

If membership exists:

- create the normal Flow session
- redirect to the application

If membership does not exist:

- create a pending workspace access request
- do not create a Flow session
- redirect to `/access-pending`

A pending user is not an authenticated workspace member.

---

## Access request storage

Pending requests are stored in:

`workspace_access_requests`

Required fields:

- `workspace_id`
- `user_id`
- `requested_at`

The primary key is:

`workspace_id + user_id`

This prevents duplicate pending requests for the same user and workspace.

There is no request status field in the initial implementation.

The existence of the row means the request is pending.

---

## Request creation

When a Discord user without workspace membership completes OAuth:

1. persist or update the Discord user
2. check workspace membership
3. if membership does not exist, insert the access request
4. duplicate requests must not create duplicate rows
5. redirect to `/access-pending`

Repeated login attempts while the request is pending must remain idempotent.

---

## Pending access UI

`/access-pending` is a public application route.

It displays a generic message that the account is waiting for workspace approval.

The page must not expose workspace data.

The page does not require a Flow session.

The user must sign in again after approval.

---

## Member management

Users with `members.manage` may view pending access requests.

Pending requests are displayed separately from active workspace members.

A pending request includes only the identity information required for an administrator to recognize the requester:

- Flow user ID
- display name
- avatar

Discord access tokens must never be stored or exposed.

---

## Approval

Approval requires:

`members.manage`

Approval must:

1. verify that the request belongs to the current workspace
2. create `workspace_members` membership
3. assign the built-in `member` role
4. set `custom_role_id` to null
5. remove the pending access request

The membership creation and request removal must behave atomically.

Approval must never assign:

- `owner`
- `admin`
- a custom role

Role changes happen separately through the existing member role management system.

---

## Rejection

Rejection requires:

`members.manage`

Rejecting a request removes the pending request.

It does not delete the Flow user identity.

If the user completes Discord login again later, a new access request may be created.

---

## Authorization

Pending access does not grant any workspace permission.

A pending user must not be able to access:

- dashboard
- clients
- projects
- tasks
- members
- teams
- roles
- settings

Existing backend authorization remains authoritative.

---

## API shape

Pending requests are managed under the existing Members API.

Expected endpoints:

`GET /api/members/access-requests`

Requires:

`members.manage`

Returns pending requests for the current workspace only.

`POST /api/members/access-requests/:userId/approve`

Requires:

`members.manage`

Creates normal workspace membership with role `member`.

`DELETE /api/members/access-requests/:userId`

Requires:

`members.manage`

Rejects the request by removing it.

---

## Information boundaries

Access requests are workspace-scoped.

A workspace administrator must never see access requests belonging to another workspace.

The requester cannot enumerate pending requests.

The requester cannot infer workspace member data before approval.

---

## Non-goals

The initial access request system does not include:

- invite links
- invite codes
- email invitations
- Discord invitations
- approval notifications
- request history
- rejection history
- requester status APIs
- multi-workspace selection

These may be added separately later.

---

## Security invariants

1. Discord authentication alone never grants workspace access.
2. Pending access never creates workspace membership.
3. Pending access never grants workspace permissions.
4. Only `members.manage` can approve or reject requests.
5. Approval always creates the lowest built-in role: `member`.
6. Duplicate pending requests are prevented by the database.
7. Access requests are always scoped to a workspace.
8. Active-member authorization continues to use the existing backend permission system.
9. Non-members never receive a normal Flow session.
10. Invite-link functionality remains independent from this system.
