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
