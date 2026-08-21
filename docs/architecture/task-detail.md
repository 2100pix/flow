# Task Detail Architecture

## Scope

Task Detail has two presentations:

1. Side Sheet from Task List / Board.
2. Fullscreen Task Detail route.

Both presentations use one shared Task Detail content and the same API.

## Routes

Side Sheet:

`/projects/:projectId/board?task=:taskId`

Fullscreen:

`/projects/:projectId/tasks/:taskId`

Fullscreen view state:

- Overview
- Activity
- Updates

Activity and Updates are presentation placeholders until their domains exist.

## Task identity

Task Code is derived and read-only.

Task title and description are editable with autosave.

Text autosave is debounced and serialized.

Property changes save immediately.

## Properties

Task properties are:

- Status
- Priority
- Lead
- Assignees
- Start Date
- Due Date

Task Lead is optional.

Task Lead must be a Project Member.

Task Lead is independent from Task Assignees.

Task Assignees remain Project Members only.

## Labels

Labels are presentation-only placeholders in this milestone.

No label schema or mutation is introduced.

## Resources

Task Resources are task-owned resources.

Types:

- document_brief
- link

Task Resources reuse the interaction model of Project Resources but do not share Project Resource rows.

## Archive and Delete

Archive is reversible application state:

`POST /api/tasks/:taskId/archive`

Permission:

`tasks.archive`

Permanent Delete physically removes the Task:

`DELETE /api/tasks/:taskId`

Permission:

`tasks.delete`

Task-owned rows cascade on permanent delete.

## Task numbering

Task numbers must never be reused.

Permanent deletion makes `MAX(task_number) + 1` unsafe.

`project_task_sequences` is the authoritative allocator for future Task numbers.

## Project Due Date

Project effective Due Date is:

`MAX(due_date)` across active, non-archived Tasks when at least one Task has a Due Date.

If no active Task has a Due Date, the stored Project Due Date remains the fallback.

Task mutations do not write Project Due Date.

The effective value is resolved when loading Project Detail.

## Autosave

There is no Save Changes button.

Immediate-save fields:

- Status
- Priority
- Lead
- Assignees
- Start Date
- Due Date
- Resources

Debounced-save fields:

- Task title
- Description

Autosave requests must be serialized to prevent older responses from overwriting newer user input.

## Shared presentation

Shared Task Detail logic must not be duplicated between Side Sheet and Fullscreen.

Expected structure:

- TaskDetailContent
- TaskDetailProperties
- TaskDetailResources
- TaskDetailActions
- TaskDetailSideSheet
- TaskDetailFullscreenPage
