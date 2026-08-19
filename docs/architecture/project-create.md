# Project Creation Architecture

## Status

This document is the canonical architecture for creating a project in Flow.

It defines:

- Create Project entry point
- Create Project dialog structure
- project creation fields
- Project Access behavior
- Project Lead selection
- creator membership guarantees
- creation permissions
- atomic creation behavior
- Client optionality
- API contract
- validation
- success/error behavior
- responsive and accessibility requirements

This document supersedes the legacy Create Project form behavior.

---

# 1. Product Principle

Creating a project must be fast.

The Create Project dialog exists only to collect the minimum information required to establish a valid project.

Advanced configuration belongs after creation.

Create Project therefore contains only:

1. Project Name
2. Description
3. Project Access
4. Project Lead

The following are intentionally not part of project creation:

- Client
- Project Code
- Project Status
- Engagement
- Start Date
- Due Date
- Channel Chat
- Members beyond selected Leads
- Key Resources
- Task Workflow customization

These values use deterministic defaults or are configured later.

---

# 2. Entry Point

Create Project is opened from the `+` action in the Space / Project area of the sidebar.

Interaction:

Space
→ +
→ Create Project Dialog

Creating a project does not navigate to a separate creation page.

The interaction remains modal.

---

# 3. Dialog Design

The canonical dialog follows the approved Figma structure.

Visual hierarchy:

Create a new project ×

Project name

Description

[ Project Access ] [ Lead ] Cancel Create project

The dialog uses the existing Flow dark surface treatment.

Expected characteristics:

- centered modal
- compact width
- rounded surface
- subtle border
- no heavy card nesting
- no unnecessary separators
- strong spacing between identity fields and footer controls
- close icon in top-right
- primary action in bottom-right
- secondary controls in bottom-left

The dialog should feel lightweight rather than like a full settings form.

---

# 4. UI Primitives

Use existing shadcn/Base UI primitives where applicable.

Preferred primitives:

- `Dialog`
- `DialogContent`
- `DialogHeader`
- `DialogTitle`
- `DialogClose`
- `Button`
- `Popover`
- `DropdownMenu`
- `Tooltip`
- `Avatar`

Project Access and Project Lead controls must visually match the interaction language already established in Project Overview.

Do not implement custom floating-menu infrastructure when an existing primitive already provides the behavior.

---

# 5. Project Name

Project Name is required.

Domain rules:

- trim whitespace
- minimum 1 character
- maximum 160 characters

The create action is disabled while Project Name is empty after trimming.

The field should receive initial focus when the dialog opens.

Project Code is not entered here.

Project Code is generated automatically from Project Name.

---

# 6. Description

Description is optional.

Maximum length:

`255 characters`

Storage behavior:

empty or whitespace-only
→ `null`

non-empty
→ trimmed string

Description should remain visually lightweight.

The Create Dialog does not provide rich text or Document Brief functionality.

Long-form project documentation belongs in Key Resources.

---

# 7. Project Access

UI terminology:

`Project Access`

Domain terminology:

`visibility`

Supported values:

- `workspace`
- `private`

UI labels:

- Workspace
- Private

Default:

`workspace`

The trigger is a compact pill/button in the dialog footer area.

Example:

[ Workspace ]

Opening the trigger displays:

Project access

Workspace
Private

The selected item must be visually identifiable.

The menu should use the same animation, radius, shadow, and interaction treatment used by other Flow dropdown/popover surfaces.

---

# 8. Project Access Semantics

## Workspace

Workspace projects are discoverable by workspace members who satisfy project-level workspace permissions.

Creation requires:

`projects.create`

## Private

Private projects require explicit project authorization.

Creation requires:

- `projects.create`
- `projects.private.create`

The backend remains authoritative.

Frontend permission checks are UX only.

If the current user cannot create private projects, the Private option must not result in a request that the backend would reject.

---

# 9. Project Lead

Every project must have at least one Project Lead.

Supported Lead count:

minimum: 1
maximum: 3

Default:

current authenticated user

The Lead trigger occupies the second compact control in the dialog footer.

Example:

[ Ramshal ]

or, when multiple Leads are selected:

[ Ramshal +2 ]

The trigger opens a Lead picker using the same visual interaction model as Project Overview.

---

# 10. Create Lead Candidate Source

Project Overview and Create Project use different candidate sources.

Project Overview:

candidate source
= existing Project Members

Create Project:

candidate source
= Workspace Members

This distinction is required because Project Members do not exist before the project has been created.

Only valid Workspace Members may be selected as Project Leads.

---

# 11. Lead Ordering

Lead ordering is explicit.

The order selected during project creation becomes:

first selected
→ position 0

second selected
→ position 1

third selected
→ position 2

Lead IDs must be:

- unique
- between 1 and 3 entries
- valid Workspace Members

---

# 12. Creator Membership Invariant

The project creator must always become a Project Member.

This rule applies regardless of selected Leads.

Example:

Creator:
Ramshal

Selected Leads:
Alice
Bob

Result:

project_members

- Ramshal
- Alice
- Bob

project_leads

- Alice position 0
- Bob position 1

The creator therefore remains a Project Member even when the creator is not selected as a Lead.

This is mandatory for Private projects so the creator cannot accidentally create a private resource with no project membership.

---

# 13. Lead Membership Invariant

The canonical invariant remains:

Project Lead ⊆ Project Members

Every selected Lead must automatically become a Project Member during creation.

There must never be a Project Lead row without the corresponding Project Member row.

---

# 14. Client During Project Creation

Client is not part of the Create Project dialog.

A project may therefore exist without a Client.

Canonical project relation becomes:

`clientId: string | null`

New project default:

`clientId = null`

This replaces the legacy rule that required an active Client before a project could be created.

The system must never:

- silently select the first Client
- create a placeholder Client
- use a hidden Client field
- require a Client that the user cannot see
- assign arbitrary Client data

A Client can be selected later from:

- Project Overview
- Project Settings

---

# 15. Client Display After Creation

When no Client has been assigned:

Project Overview:

Client Name
Not set

Project Settings:

Client
Select client

Project lists and other project consumers must support the nullable Client state.

Existing projects keep their existing Client relationship.

---

# 16. Other Creation Defaults

Fields not present in the dialog receive deterministic defaults.

Project Code:
automatic from Project Name

Project Status:
Planning

Engagement:
Project

Start Date:
unset

Due Date:
unset

Due Date Mode:
unset

Client:
null

Channel Chat:
not connected

Key Resources:
none

Project Access:
Workspace

Project Lead:
creator unless changed

Task Workflow:
default Flow workflow

---

# 17. Target Create API

Canonical endpoint:

`POST /api/projects`

Canonical request:

{
name: string,
description?: string,
visibility: "workspace" | "private",
leadUserIds: string[]
}

`description` may be omitted.

`visibility` may default to `workspace`.

`leadUserIds` may default to the authenticated user's ID if omitted internally, but the frontend should send its explicit selected state.

Client is not required.

Project Code is not accepted as a Create Dialog field.

Engagement is not accepted as a Create Dialog field.

---

# 18. Atomic Creation

Project creation is one logical atomic operation.

Required sequence:

authenticated session
→ validate workspace membership
→ validate `projects.create`
→ validate requested Project Access
→ validate selected Lead IDs
→ create project
→ create creator Project Member
→ create selected Lead Project Members
→ create Project Leads
→ create default Task Workflow
→ return created project

Partial creation is invalid.

The following state must never occur:

project created
but selected Leads failed

or:

project created
but default workflow failed

or:

Lead created
without Project Member

---

# 19. Duplicate Membership Handling

Creator and selected Leads may overlap.

Example:

creator = A

leadUserIds:
A
B
C

Project Member inserts must resolve to:

A
B
C

not:

A
A
B
C

Membership creation must deduplicate IDs before persistence.

Lead ordering remains based on `leadUserIds`.

---

# 20. Create Permissions

Workspace Project:

requires:
`projects.create`

Private Project:

requires:
`projects.create`
`projects.private.create`

Selecting another workspace member as Lead additionally requires that the selected user is a valid member of the same workspace.

If member discovery is unavailable to the current user, the UI must fall back to the authenticated user as the only available Lead instead of exposing inaccessible workspace-member data.

---

# 21. Validation Errors

Canonical create errors:

`VALIDATION_ERROR`

Invalid:

- Project Name
- Description
- Project Access
- Lead collection

`FORBIDDEN`

User lacks creation permission.

`PROJECT_LEAD_REQUIRED`

No Lead supplied.

HTTP:

409

`PROJECT_LEAD_LIMIT_REACHED`

More than three Leads supplied.

HTTP:

409

`PROJECT_LEAD_NOT_WORKSPACE_MEMBER`

One or more selected Lead IDs are not valid Workspace Members.

HTTP:

409

The API must not silently remove invalid Leads from the request.

---

# 22. Submit Behavior

Create Project button is disabled when:

- Project Name is empty
- no Lead exists
- mutation is pending

While pending:

`Create project`
→ `Creating…`

Submission must be single-flight.

Repeated clicking must not create duplicate projects.

---

# 23. Success Behavior

Successful creation:

POST project
→ invalidate project collections
→ close dialog
→ clear temporary create state
→ navigate to `/projects/:projectId`
→ show bottom-right success notification

Notification:

`Project created.`

The new Project Overview becomes the next working surface.

---

# 24. Cancel Behavior

Cancel closes the dialog without mutation.

Closing using:

- Cancel
- close icon
- Escape

must discard unsaved create state.

Reopening the dialog starts from defaults:

Project Name:
empty

Description:
empty

Project Access:
Workspace

Lead:
current user

---

# 25. Keyboard Behavior

Required:

Tab
→ normal focus progression

Shift+Tab
→ reverse progression

Enter
→ submit when appropriate

Escape
→ close active picker first
→ then close dialog when no nested surface remains

Project Access and Lead picker must support keyboard navigation.

Focus must remain trapped inside the Create Dialog while open.

Closing the dialog returns focus to the original `+` trigger.

---

# 26. Responsive Behavior

Desktop:

centered compact dialog

Mobile:

dialog remains inside viewport
single-column content
footer controls may wrap when required
no horizontal overflow

The dialog must never require horizontal scrolling.

---

# 27. Loading State

Workspace Member loading must not block Project Name or Description editing.

Lead picker may display loading state independently.

Submission remains disabled if the Lead invariant cannot yet be satisfied.

---

# 28. Accessibility

Required:

- dialog title is programmatically associated
- Project Name has accessible label
- Description has accessible label
- Project Access trigger has accessible name
- Lead trigger has accessible name
- close button has accessible name
- menu selections expose selected state
- visible focus indicators
- no keyboard trap outside the intended Dialog focus trap

Tooltip text must not be the only accessible name for icon controls.

---

# 29. Data Model Impact

Project creation redesign requires:

`projects.client_id`

to change from:

NOT NULL

to:

nullable

Project DTO changes:

client:
{
id: string
name: string
}

becomes:

client:
{
id: string
name: string
} | null

Queries that currently require an INNER JOIN to Clients must be audited and changed to nullable-safe joins where necessary.

Create Project no longer validates the existence of a Client.

Project updates must support assigning or clearing Client.

---

# 30. Migration Rule

The Client nullable schema change requires a local migration before runtime implementation is considered complete.

Existing Client IDs remain untouched.

No existing project is automatically changed to null.

Remote D1 migration remains blocked until the entire Create/Settings milestone has passed local verification.

---

# 31. Relationship with Project Overview

Project Overview remains the operational working surface.

Creation may require a small compatibility update so Overview can represent:

Client Name
Not set

This compatibility patch does not reopen the Project Overview visual design.

---

# 32. Non-Goals

Create Project does not manage:

- Project Code
- Project Status
- Client
- Engagement
- dates
- Channel Chat
- arbitrary Members
- Resources
- workflow customization
- archive
- permanent deletion

These belong to later project surfaces.

---

# 33. Final Invariants

The following must always remain true:

1. Every project has at least one Lead.
2. A project has at most three Leads.
3. Every Lead is a Project Member.
4. The creator is always a Project Member.
5. Private creation obeys private-project permissions.
6. Project creation is atomic.
7. Client is optional.
8. No hidden Client assignment occurs.
9. Default workflow is created atomically.
10. Backend authorization remains authoritative.
