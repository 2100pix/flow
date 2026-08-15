# Task Customization Architecture

## Purpose

Flow supports project-level task workflow customization.

Customization changes how task statuses are presented and arranged
inside a project without changing the stable backend semantics used by
tasks, dashboard aggregation, permissions, and API authorization.

Task customization is scoped to a project.

It does not create a separate authorization boundary.

Project ACL remains authoritative.

---

## Status Model

Task statuses have two identities:

1. Status key
2. Status presentation

The status key is an immutable backend semantic identifier.

Supported status keys are:

- backlog
- todo
- in_progress
- review
- done

Status presentation is project-specific and contains:

- label
- position
- enabled

Example:

```text
status key     label             position    enabled

backlog        Inbox             0           true
todo           Ready             1           true
in_progress    Production        2           true
review         Client Review     3           true
done           Delivered         4           true
```

---

## Stable Semantic Keys

Status keys are fixed in v0.1.

Users cannot:

- create new status keys
- delete status keys
- rename the internal status key

Users may:

- rename the display label
- reorder enabled statuses
- enable or disable supported intermediate statuses

This preserves compatibility with:

- task storage
- dashboard aggregation
- permissions
- drag-and-drop
- existing API contracts
- future reporting

---

## Default Workflow

Every project starts with:

```text
backlog       Backlog        0   enabled
todo          To do          1   enabled
in_progress   In progress    2   enabled
review        Review         3   enabled
done          Done           4   enabled
```

Existing projects receive exactly this workflow during migration.

The migration must preserve current application behavior.

---

## Required Statuses

The following statuses are always enabled:

```text
backlog
done
```

They cannot be disabled.

They may still be renamed and repositioned.

The following statuses may be disabled:

```text
todo
in_progress
review
```

A project must always have at least:

```text
backlog
done
```

enabled.

---

## Disable Rules

A status cannot be disabled while it contains any non-archived task.

Attempting to disable an in-use status must fail.

Expected API behavior:

```text
409 STATUS_IN_USE
```

Tasks are never silently migrated to another status.

Tasks are never deleted because a workflow status is disabled.

The caller must move the tasks first.

---

## Labels

Status labels are presentation values.

Rules:

- trimmed
- minimum 1 character
- maximum 40 characters
- labels must be unique within the project, case-insensitively

Examples of invalid duplicate labels:

```text
Review
review
```

Status labels do not alter dashboard semantics.

For example:

```text
done → Delivered
```

still contributes to the backend `done` task count.

---

## Position

Each project workflow has one position for every supported status key.

Position controls UI ordering.

Positions must be unique.

The workflow update API accepts the complete workflow order rather than
independent position mutations.

This prevents duplicate or partial ordering states.

Disabled statuses retain a position so enabling them again has a
deterministic location.

---

## Task Creation

If task creation does not provide a status:

```text
backlog
```

is used.

`backlog` is always enabled.

If task creation explicitly provides a disabled status, the request must
fail.

Expected behavior:

```text
400 TASK_STATUS_DISABLED
```

---

## Task Updates

A task may only be moved to an enabled status.

Attempting to update a task to a disabled status must fail.

Expected behavior:

```text
400 TASK_STATUS_DISABLED
```

Existing task fields remain unchanged:

- title
- description
- status
- priority
- assignee
- due date
- Discord thread URL

---

## Task Reordering

Task reorder operations may reference only enabled project statuses.

The backend must validate the project workflow before applying reorder
operations.

A disabled status cannot become a drag-and-drop destination.

---

## Authorization

Task workflow configuration inherits the project authorization boundary.

Authorization chain:

```text
Session
↓
Workspace membership
↓
Workspace permission
↓
Project visibility / ACL
↓
Task workflow
```

Read workflow:

```text
tasks.view
+
project access
```

Manage workflow:

```text
tasks.edit
+
project access
```

No new workspace permission is introduced for task workflow
customization in v0.1.

Task workflow access must not bypass project privacy.

---

## Private Projects

Private projects use exactly the same workflow model.

For inaccessible private projects:

```text
GET workflow      → PROJECT_NOT_FOUND
PATCH workflow    → PROJECT_NOT_FOUND
```

The workflow endpoint must not disclose whether a private project exists.

---

## Storage

Each project owns exactly one configuration row for every supported
status key.

The intended logical model is:

```text
project_task_statuses

project_id
status_key
label
position
enabled
```

Primary identity:

```text
(project_id, status_key)
```

Project deletion cascades workflow rows.

The database must prevent duplicate positions for the same project.

The database must constrain status keys to the supported semantic set.

---

## Project Creation

Creating a project must also create its default task workflow.

The project and workflow initialization belong to the same logical
operation.

Private project creation therefore initializes:

```text
project
+
creator project membership
+
default task workflow
```

Workspace project creation initializes:

```text
project
+
default task workflow
```

A successfully created project must never exist without a task workflow.

---

## Migration

Existing projects must receive all five default workflow rows.

Existing task status values are not modified.

The migration must preserve all current task and board behavior.

No remote D1 migration is performed during development milestones.

---

## API Shape

The workflow API is project-scoped.

Expected endpoints:

```text
GET   /api/projects/:projectId/task-workflow
PATCH /api/projects/:projectId/task-workflow
```

GET returns all supported statuses including disabled statuses.

PATCH replaces the workflow presentation configuration atomically.

The task APIs remain responsible for task values.

The workflow API remains responsible for workflow configuration.

---

## Frontend

The board must stop defining its own hardcoded status presentation.

Board columns are built from:

```text
enabled workflow statuses
ordered by position
```

Task Detail status selection uses:

```text
enabled workflow statuses
```

The UI displays project labels while task API values continue using the
stable status keys.

Workflow management belongs to project configuration, not individual
task configuration.

---

## Dashboard

Dashboard aggregation continues using semantic status keys:

```text
backlog
todo
in_progress
review
done
```

Custom labels do not change aggregation logic.

Disabled statuses with zero active tasks naturally contribute zero.

Dashboard customization is not part of 8.8.

---

## Failure Policy

A missing or structurally invalid workflow is an application integrity
error.

The backend must not silently invent project configuration at request
time.

Projects are initialized through:

- migration
- project creation

This keeps workflow state deterministic and exposes database corruption
instead of masking it.

---

## Non-Goals — v0.1

Task Customization does not include:

- arbitrary custom fields
- user-created status keys
- custom priority values
- status colors
- per-status permissions
- per-user workflows
- task-level privacy
- workflow automations
- status transition rules
- task templates

These may be added after the stable workflow model is proven.
