# Project Settings Architecture

## Status

This document is the canonical architecture for Project Settings.

It defines:

- Project Settings information architecture
- page layout
- editable project metadata
- Project Code behavior
- Client behavior
- Project Status
- Project Access
- Team Member management
- Project Lead management
- Update Project behavior
- Archive Project
- permanent Delete Project
- permissions
- responsive states
- accessibility
- mutation boundaries

The approved Figma Project Settings design is the visual source of truth for this architecture.

---

# 1. Product Role

Project Settings is the explicit configuration surface for a project.

Project Overview remains optimized for reading and quick operational edits.

Project Settings is optimized for deliberate configuration and team administration.

Selected metadata may therefore be editable from both surfaces.

This is intentional.

There is one backend source of truth.

Overview and Settings must stay synchronized through shared API/query invalidation.

---

# 2. Route

Canonical route:

`/projects/:projectId/settings`

Project Settings is a page.

It is not a modal.

The route remains project-scoped and therefore inherits project access control.

---

# 3. Visual Structure

Approved layout:

<Project Name> / Overview / Project Settings

Project Settings

Project name Project code
[ Project name ] [ PRJT ]

Description Project
[ Add a description ]

Client Project status Project access
[ Select client ▾ ] [ Select a status ▾ ] [ Select access ▾ ]

Lead Project

lead rows

Team members

non-Lead member rows / empty state

                                         Update project

Dangerzone

Archive project Archive

Delete project Delete

The main settings content remains centered and constrained.

The page must not become a collection of unrelated cards.

---

# 4. Breadcrumb

Breadcrumb hierarchy:

<Project Name>
/
Overview
/
Project Settings

Behavior:

<Project Name>
→ identifies the current project and matches Project Overview breadcrumb semantics

Overview
→ `/projects/:projectId`

Project Settings
→ current page

The current location is not clickable.

Breadcrumb visual treatment should remain compact and secondary to the page heading.

---

# 5. Page Heading

Heading:

`Project Settings`

No marketing description is required below the heading.

The form begins directly after appropriate vertical spacing.

---

# 6. Main Metadata Form

The primary settings form contains:

- Project Name
- Project Code
- Description
- Client
- Project Status
- Project Access

These fields are saved using the single:

`Update project`

button shown in the design.

Team Member operations are not part of this batch update.

Danger Zone operations are not part of this batch update.

---

# 7. Project Name

Required.

Rules:

- trim
- minimum 1
- maximum 160

Project Name may also be changed from Project Overview.

Both surfaces write to the same field.

Changing Project Name must update:

- Overview heading
- breadcrumb
- automatically-derived Project Code when no override exists
- project lists
- sidebar project labels where applicable

---

# 8. Project Code

Project Code is shown as a compact field beside Project Name.

Canonical domain model:

# resolved Project Code

custom override when present
otherwise automatic code derived from Project Name

Custom override rules:

- 1–4 characters
- alphanumeric only
- uppercase normalization

Empty Project Code input means:

remove `projectCodeOverride`
→ return to automatic mode

The field must not create a second Project Code source of truth.

---

# 9. Description

Description occupies the full row beneath Project Name and Project Code.

Rules:

- optional
- maximum 255 characters
- empty/whitespace-only → null

The textarea should not use an unnecessary internal scrollbar for normal content.

Description may also be edited from Project Overview.

Settings provides the explicit form-based editing surface.

---

# 10. Client

Client is optional.

Canonical state:

client:
Client | null

Settings label:

`Client`

No Client:

`Select client`

Dropdown candidates:

- active Clients
- current inactive Client when an existing project still references one

The user may:

- assign Client
- change Client
- clear Client

The system must not require a Client simply because the project already exists.

Changing Client requires normal project-edit authorization plus Client visibility where required by existing permission architecture.

---

# 11. Project Status

Project Status uses a select/dropdown.

Canonical values:

`planning`
→ Planning

`active`
→ Active

`on_hold`
→ On hold

`completed`
→ Complete

UI wording may use `Complete`.

The database/API enum remains `completed`.

No additional status is introduced by the visual design.

---

# 12. Project Access

UI label:

`Project access`

Domain field:

`visibility`

Supported values:

- Workspace
- Private

Canonical mapping:

Workspace
→ `workspace`

Private
→ `private`

The control should use the same dropdown visual system as Create Project.

Changing Project Access is an authorization change.

It is not treated as ordinary cosmetic metadata.

---

# 13. Project Access Permissions

Changing Project Access requires:

- access to the project
- `projects.edit`
- `projects.private.manage`

This applies to both:

Workspace → Private

and:

Private → Workspace

Frontend hiding/disabling is UX only.

Worker authorization remains authoritative.

---

# 14. Select Components

Client, Project Status, and Project Access follow the approved shadcn-style Select treatment.

Expected behavior:

- compact trigger
- subtle border
- dark surface
- animated menu
- selected item indication
- keyboard navigation
- no heavy focus stroke
- visible focus state without changing layout
- no native browser select UI

Project Access must visually match the Create Project Access control.

---

# 15. Dirty State

The metadata form tracks a normalized dirty state.

`Update project` is disabled when:

- no field changed
- Project Name is invalid
- mutation is pending

Whitespace-only differences do not count as meaningful changes after normalization.

---

# 16. Update Project Mutation

Clicking:

`Update project`

sends only changed fields.

Example:

{
name,
projectCodeOverride,
description,
clientId,
status,
visibility
}

Fields that did not change should not be sent unnecessarily.

Client must support:

`clientId: string | null`

Description must support:

`description: string | null`

Project Code must support:

`projectCodeOverride: string | null`

---

# 17. Update Success Behavior

Successful update:

- invalidate project query
- invalidate project collection
- refresh all dependent project UI
- retain current route
- show one bottom-right toast

Toast:

`Project updated.`

One request produces one notification.

---

# 18. Update No-Op Behavior

No change:

0 mutation requests
0 toast

The Update Project button remains disabled.

---

# 19. Project Team Structure

Project staffing is visually separated into two dedicated sections:

1. Lead Project
2. Team members

Both sections are backed by the same Project Member / Project Lead domain model.

The separation is presentational and interaction-focused.

Project Lead remains a subset of Project Members at the domain level.

Lead Project contains only current Project Leads.

Team members contains only Project Members who are not currently Leads.

Member and Lead mutations occur immediately and are not part of the Update Project metadata transaction.

Promoting a Team Member to Lead:

Team members
→ Set as Lead
→ add to `project_leads`
→ refreshed UI moves the person into Lead Project

Removing Lead status:

Lead Project
→ Remove Lead
→ remove from `project_leads`
→ refreshed UI moves the person back into Team members

The system must never duplicate the same person visually in both sections.

---

# 20. Team Members Empty State

When only the minimum project staffing exists or when the section has no additional members to present, the visual treatment follows the approved empty state.

Structure:

decorative avatar group

Invite your team to
collaborate on this project.

[ + Invite Members ]

The button opens member selection.

The empty state must remain compact and not become a large bordered card.

---

# 21. Team Member Populated State

Each Team Member row contains:

- avatar
- display name
- secondary identity metadata
- Set as Lead action when permitted
- remove member action when permitted

Current Project Leads are not rendered in Team members.

Rows use subtle separators.

Do not wrap each member in an individual card.

---

# 22. Secondary Member Metadata

The Figma example displays email addresses.

Flow's current identity model does not require adding an email field solely to reproduce placeholder Figma content.

Until email becomes a real authenticated user-domain field, the secondary line should use existing meaningful data such as:

- custom workspace role
- Owner
- Admin
- Member

or be omitted when no useful secondary metadata exists.

Do not fabricate email addresses.

---

# 23. Member Ordering

Project Member ordering remains deterministic.

Primary ordering:

`addedAt ASC`

Tie-breaker:

`user.id ASC`

The earliest assigned member appears first.

The most recently added member appears last.

This ordering must match the Project Overview member group semantics.

---

# 24. Member Expansion

The populated design may initially show a compact subset of members.

When additional members exist:

`View more`

expands the remaining members in place.

The exact visible-count threshold may be implementation-tuned for the final layout.

Expansion must not navigate away from Project Settings.

---

# 25. Add Member

The populated Team Members section includes a compact `+` add action.

The empty state uses:

`+ Invite Members`

Both actions open the same member-selection flow.

Candidate source:

Workspace Members not already assigned to the project.

Adding a member creates:

`project_members`

It does not automatically make the user a Lead.

---

# 26. Lead Project

Project Leads are displayed in the dedicated:

`Lead Project`

section.

Each Lead row contains:

- avatar
- display name
- secondary identity metadata
- visible `Lead` badge
- remove Lead action when permitted

Lead state is derived from:

`project_leads`

not from legacy `lead_user_id`.

Project Leads remain ordered by explicit Lead position.

A Lead must not simultaneously appear in Team members.

---

# 27. Set As Lead

A non-Lead Project Member may expose the Set Lead action shown in the Figma.

Behavior:

member row
→ Set as Lead
→ member added to `project_leads`

The member already exists in `project_members`.

Maximum Lead count remains:

3

When three Leads already exist, Set Lead is unavailable for additional members.

---

# 28. Lead Invariants

The following remain mandatory:

minimum Lead count:
1

maximum Lead count:
3

Project Lead:
must be Project Member

Lead positions:
unique

valid positions:
0–2

The system must never allow Project Settings to create a zero-Lead project.

---

# 29. Removing Members

Removing a normal Project Member:

delete membership

Removing a member who is also a Lead:

if multiple Leads exist:
remove Lead relation
then remove membership atomically

if the member is the sole Lead:
reject

Canonical error:

`PROJECT_LEAD_REQUIRED`

Project Settings must not rely only on disabled frontend controls.

Backend protection remains mandatory.

---

# 30. Team Mutation Notifications

Member added:

`Project member added.`

Member removed:

`Project member removed.`

Lead added:

`Project lead added.`

Lead removed:

`Project lead removed.`

Each successful action produces one toast.

No-op produces none.

---

# 31. Team Permissions

Workspace project member management:

requires:
`projects.edit`

Private project member management:

requires:

- project access
- `projects.edit`
- `projects.private.manage`

Lead changes:

requires:

- project access
- `projects.edit`

Lead changes do not require `projects.private.manage` when project membership itself is unchanged.

---

# 32. Update Button Position

`Update project` is positioned on the right after the Team Members section.

It belongs only to the metadata form.

It must not imply that Team Member changes are waiting to be saved.

Member actions persist immediately.

---

# 33. Danger Zone

Danger Zone appears after substantial vertical separation from the normal configuration area.

Label:

`Dangerzone`

Container contains two distinct actions:

1. Archive project
2. Delete project

These actions must never share the same backend semantics.

---

# 34. Archive Project

Archive is reversible.

Domain result:

`archived_at = timestamp`

Archived projects are removed from normal active project navigation and listings.

Project data remains stored.

Child data remains stored.

The project may be restored later.

Archive must not permanently delete:

- Members
- Leads
- Resources
- Tasks
- Workflow
- project metadata

Permission:

`projects.archive`

---

# 35. Archive UX

Row:

Archive project

Archiving a project will unlist your project from normal
navigation while retaining its data.

[ Archive ]

Clicking Archive opens a shadcn Alert Dialog.

The browser-native `window.confirm()` must not be used in the final settings implementation.

Confirmation must explicitly name the project.

Successful archive:

- archive project
- invalidate project collections
- navigate away from active project route
- show success notification

---

# 36. Archive API Semantics

Target architecture should make archive semantics explicit.

Preferred target:

`POST /api/projects/:id/archive`

rather than using HTTP DELETE to perform an archive.

Existing archive behavior may require transition work.

Archive and permanent deletion must not share the same endpoint semantics in the final architecture.

---

# 37. Restore

Archive is reversible by definition.

Target API:

`POST /api/projects/:id/restore`

Restore UI is outside the Project Settings page because an archived project is no longer part of normal active navigation.

A future Archived Projects surface may own restore interaction.

Project Settings must not claim archive is permanent.

---

# 38. Permanent Delete Project

Delete Project is irreversible.

It is not the same action as Archive.

Row:

Delete project

When deleting a project, all project-owned data and resources
are permanently removed and cannot be recovered.

[ Delete ]

Permanent Delete requires a dedicated confirmation flow.

---

# 39. Permanent Delete Confirmation

Delete uses shadcn Alert Dialog / confirmation dialog.

Confirmation must clearly communicate:

- project name
- permanent nature
- affected project-owned data
- no restore

For stronger destructive protection, confirmation should require typing the Project Name before the final Delete action becomes enabled.

No browser-native confirm dialog.

---

# 40. Permanent Delete Permission

Permanent deletion requires a dedicated permission:

`projects.delete`

This permission does not currently exist in the legacy project authorization model and must be introduced explicitly before permanent delete is implemented.

`projects.archive` must not implicitly grant permanent deletion.

Owner/Admin defaults and custom-role permission behavior must be defined when the new permission is introduced.

---

# 41. Permanent Delete API

Target:

`DELETE /api/projects/:id`

Semantics:

hard-delete project

Project-owned relations must be removed consistently through database foreign-key behavior and/or explicit transaction logic.

The operation must not delete:

- workspace
- Client
- workspace users

It removes only project-owned state.

---

# 42. Delete Result

Successful permanent delete:

- invalidate project collections
- remove project from cache
- navigate to a safe project-list route
- show success notification

Example:

`Project deleted.`

No project route should remain usable after deletion.

---

# 43. Metadata Permission Matrix

Read Project Settings:

requires project visibility/access rules.

Edit Project Name:
`projects.edit`

Edit Project Code:
`projects.edit`

Edit Description:
`projects.edit`

Edit Client:
`projects.edit`
plus relevant Client visibility constraints

Edit Project Status:
`projects.edit`

Edit Project Access:
`projects.edit`

- `projects.private.manage`

Manage workspace-project Members:
`projects.edit`

Manage private-project Members:
`projects.edit`

- `projects.private.manage`
- project access

Change Leads:
`projects.edit`

- project access

Archive:
`projects.archive`

Permanent Delete:
`projects.delete`

Backend remains authoritative for every operation.

---

# 44. Read-Only State

Users who can view the project but cannot edit must not receive misleading mutation affordances.

Depending on permission:

- inputs become read-only/disabled
- update button is hidden or disabled
- team mutation controls disappear
- archive button disappears
- delete button disappears

The existing values remain readable where project access permits.

---

# 45. Shared Domain State with Overview

Project Overview and Project Settings may both edit:

- Project Name
- Description
- Client

Lead and Member state may also be managed from both surfaces.

This duplication is intentional.

The two surfaces serve different workflows:

Overview:
quick operational editing

Settings:
explicit administration

There must never be separate state stores.

Both surfaces use the same API and canonical database fields.

Successful mutation must invalidate all relevant queries.

---

# 46. Project Code Ownership

Project Code editing exists only in Project Settings.

Overview displays the resolved Project Code.

Overview does not expose Project Code configuration.

---

# 47. Project Status Ownership

Project Settings is the primary explicit Project Status configuration surface.

Overview displays status prominently.

If Overview later exposes status editing, it must still use the same canonical status field.

---

# 48. Project Access Ownership

Create Project:

initial access selection

Project Settings:

post-creation access management

Overview:

display/access-aware behavior

Project Access terminology should remain consistent across Create and Settings.

Do not alternate between:

Visibility
Privacy
Access

in user-facing labels.

Canonical UX label:

`Project Access`

Canonical domain field:

`visibility`

---

# 49. Client Ownership

Create Project:

no Client field

Project Overview:

quick assign/change/clear Client

Project Settings:

explicit assign/change/clear Client

Client therefore becomes optional throughout the project domain.

---

# 50. Project Settings Loading

Initial project loading must show a settings skeleton rather than briefly rendering empty default form values.

The user must never see:

Select client
Select status
Select access

as temporary incorrect values while the project query is still loading.

---

# 51. Error State

Project load failure:

show a project settings error state

Do not render a partially editable empty form.

Individual mutation errors should remain local to the relevant operation and may also produce an error toast when consistent with Flow notification behavior.

---

# 52. Responsive Layout

Desktop:

Project Name + compact Project Code row

Description:
full width

Client + Status + Access:
three columns

Team Members:
full width

Update Project:
right aligned

Danger Zone:
full width

Tablet:

metadata columns may reduce as space requires

Mobile:

single column

Project Code moves below Project Name

Client / Status / Access stack vertically

Team Member rows remain readable

Danger Zone actions remain inside viewport

No horizontal page overflow.

---

# 53. Team Member Mobile Layout

On narrow screens:

avatar + identity
→ flexible main column

badges/actions
→ shrink-safe trailing controls

If necessary, member action icons may remain compact rather than converting the entire member row into a large menu.

Interactive targets must remain touch accessible.

---

# 54. Accessibility

Required:

- labels associated with form fields
- selected states exposed by dropdown primitives
- icon-only buttons have accessible names
- Lead action has accessible name
- Remove Member action has accessible name
- Danger Zone confirmations have proper dialog title/description
- visible keyboard focus
- Escape closes nested menu/dialog
- no keyboard trap
- destructive confirmation receives deliberate focus handling

Tooltips are supplemental.

Tooltips are never the sole accessible label.

---

# 55. Notification Rules

Metadata update:

`Project updated.`

Member add:

`Project member added.`

Member remove:

`Project member removed.`

Lead add:

`Project lead added.`

Lead remove:

`Project lead removed.`

Archive:

`Project archived.`

Permanent delete:

`Project deleted.`

Rules:

one successful mutation
→ one toast

no-op
→ no request
→ no toast

---

# 56. API Target

Metadata:

`PATCH /api/projects/:id`

Supports:

- `name`
- `projectCodeOverride`
- `description`
- `clientId`
- `status`
- `visibility`

Required contract adjustment:

`clientId: string | null`

Members:

existing project member endpoints remain canonical.

Leads:

existing Project Leads endpoint remains canonical.

Archive:

target explicit archive endpoint.

Delete:

target hard-delete endpoint.

---

# 57. Task Workflow

Task Workflow is not part of the approved Project Settings Figma surface.

Existing Task Workflow domain behavior must not be deleted silently.

Its final UI placement will be handled by a dedicated Task List / Workflow architecture decision.

Project Settings v2 must not introduce an undocumented workflow section that conflicts with the approved design.

---

# 58. Channel Chat

Channel Chat configuration is not shown in the approved Project Settings design.

It is therefore outside this Project Settings redesign scope.

Existing Channel data must remain intact.

A dedicated Channel configuration interaction can be designed separately.

Project Settings redesign must not remove persisted Channel values.

---

# 59. Non-Goals

This Project Settings redesign does not define:

- Task Board redesign
- Task Workflow redesign
- Channel Chat redesign
- Client management
- workspace settings
- role editor redesign
- restore-project listing UI
- project export

---

# 60. Implementation Boundaries

Project Settings redesign may require:

Frontend:

- complete rewrite of legacy `ProjectDetailPage`
- shadcn Select/Dropdown usage
- shadcn Alert Dialog
- team member UI
- reusable Project Access control
- reusable Lead/member controls

Shared contracts:

- nullable Client
- permanent delete response
- any new delete permission

Worker:

- nullable Client update support
- explicit archive semantics
- permanent delete
- permission enforcement

Database:

- nullable `projects.client_id`
- new permission-key migration if `projects.delete` is introduced

The Project Settings redesign must not mutate remote D1 until local architecture, migrations, API behavior, UI behavior, and integrity gates pass.

---

# 61. Final Settings Invariants

The following must always remain true:

1. Project Settings uses the approved Figma hierarchy.
2. Metadata form and Team mutations have separate save semantics.
3. Update Project never saves pending Team actions.
4. Project Access uses canonical visibility rules.
5. Client may be null.
6. Project Code override remains optional.
7. Lead count remains between one and three.
8. Every Lead is a Project Member.
9. Sole Lead cannot be removed.
10. Archive is reversible.
11. Delete is permanent.
12. Archive and Delete never share semantics.
13. Permanent delete requires dedicated authorization.
14. Overview and Settings use the same project source of truth.
15. Backend authorization remains authoritative.
