# Project Privacy Architecture

## Visibility modes

Flow projects have two visibility modes:

- `workspace`
- `private`

`workspace` means the project is discoverable by workspace
members who have the required workspace-level permission.

`private` means the project is discoverable only by explicitly
authorized users.

Project visibility never replaces workspace permissions.

---

## Authorization order

Project-scoped authorization must follow this order:

1. authenticated session
2. workspace membership
3. workspace permission
4. project visibility / ACL
5. requested resource

A user must pass every applicable layer.

---

## Workspace projects

A workspace project is visible when the user has:

`projects.view`

Project membership does not control visibility for workspace
projects.

Project membership is organizational/staffing information only.

---

## Private projects

A private project is visible only when the user has:

`projects.view`

and one of:

- the user is a project member
- the user has `projects.private.view_all`

`projects.private.view_all` does not replace `projects.view`.

---

## Creating private projects

Creating a workspace project requires:

`projects.create`

Creating a private project requires:

- `projects.create`
- `projects.private.create`

The creator of a private project must automatically become a
project member during creation.

This prevents a creator from creating a project that they cannot
access afterward.

Any Workspace Member selected as a Project Lead during project
creation must also automatically become a Project Member in the
same atomic creation operation.

The creator remains a Project Member even when the creator is not
one of the selected Project Leads.

Project creation must preserve the invariant:

`Project Lead ⊆ Project Members`

---

## Changing visibility

Changing project visibility requires:

- access to the project
- `projects.edit`
- `projects.private.manage`

This applies to both:

- `workspace` → `private`
- `private` → `workspace`

Visibility changes are authorization changes, not ordinary
metadata edits.

---

## Project membership

The existing `project_members` relation is the source of truth
for explicit project membership.

No separate private-project ACL table is required.

For workspace projects, project membership is staffing data.

For private projects, project membership is both:

- staffing data
- authorization data

Managing members of a workspace project requires:

`projects.edit`

Managing members of a private project requires:

- `projects.edit`
- `projects.private.manage`

The caller must also already have access to the private project.

---

## Teams

Teams are organizational only.

Team membership must never grant private-project access
implicitly.

Adding a user to a Team does not add that user to a private
project.

Removing a user from a Team does not automatically remove that
user from a private project.

Project membership remains explicit.

---

## Child resources

Project ACL applies transitively to all project-scoped resources.

Examples:

- tasks
- project members
- task board
- project detail

A workspace permission such as `tasks.view` is not sufficient
when the parent private project is inaccessible.

Example:

`tasks.view = true`

but private project access = false

result:

task access = false

---

## Information disclosure

Unauthorized private projects must behave as nonexistent
resources.

List endpoints must filter inaccessible private projects.

Direct project requests must return a not-found response when the
workspace permission exists but project ACL fails.

Task requests must not reveal tasks that belong to inaccessible
private projects.

The API must not expose enough information to confirm the
existence of a private project to an unauthorized user.

---

## Frontend

Frontend permission and visibility checks are UX only.

They may hide navigation, controls, projects, and actions.

Backend authorization remains authoritative.

Direct URLs and manually constructed API requests must still be
protected by the Worker.

---

## Dashboard

Dashboard project and task data must obey project ACL.

Counts, recent projects, and task summaries must exclude private
projects that the current user cannot access.

A private project must not leak through aggregate counts or
recent-item lists.

---

## Default migration behavior

Existing projects must remain accessible after the privacy schema
is introduced.

Therefore existing projects will migrate to:

`visibility = workspace`

No existing project becomes private implicitly.

---

## Security invariants

These rules must always remain true:

1. `projects.private.view_all` never bypasses `projects.view`.
2. `projects.private.create` never bypasses `projects.create`.
3. `projects.private.manage` never bypasses `projects.edit`.
4. Teams never grant project access.
5. Private-project membership is explicit.
6. Private child resources inherit project visibility.
7. Unauthorized private projects do not leak through list,
   detail, task, or dashboard APIs.
8. Backend checks remain authoritative.
