# Flow — Project Overview Architecture

## Goal

Project Overview adalah read-first landing page untuk satu project.

Overview mendukung limited inline editing untuk project identity:

- Project Name
- Description

Overview bukan full configuration surface.

Metadata dan configuration lain tetap dikelola melalui:

`/projects/:projectId/settings`

Route canonical:

`/projects/:projectId`

Overview harus memungkinkan user memahami secara cepat:

1. project apa yang sedang dilihat
2. status dan context project
3. siapa yang menjalankan project
4. di mana komunikasi project berlangsung
5. Project Details dan engagement project
6. resources penting yang terkait dengan project

Overview bukan configuration surface.

Project editing tetap berada di:

`/projects/:projectId/settings`

Task operations tetap berada di:

`/projects/:projectId/board`

---

# 1. Scope

Project Overview v1 mencakup:

Project Identity:

- breadcrumb
- project name
- project code
- description
- status

Collaboration:

- Lead Project
- Members
- Channel Chat

Project Context:

- Project Details
- Client
- Engagement

Resources:

- Key Resources section shell

Tidak termasuk:

- task statistics
- progress calculation
- project activity feed
- comments
- files
- invoice
- time tracking
- realtime presence
- project analytics
- key-resource persistence

Inline Identity Editing:

- Project Name
- Description

---

# 2. Canonical Layout

Desktop:

Project / Overview

Project Name [CODE] [Status]

Description Lead Project
Lead avatar + name

                                  Members
                                  Avatar group

                                  Channel Chat
                                  Open Discord

Project Details

Start date Due date
Date Date / Ongoing / Not set

Client Engagement
Client Name Project / Retainer

Key resources

Empty state / future resources

Layout semantics:

- left/top area = project identity
- right hero rail = people and collaboration
- lower left area = project context
- bottom area = resources

Lead Project, Members, dan Channel Chat harus berada
di sisi kanan Project Name/Description pada desktop.

Mereka tidak dipindahkan ke Project Context.

---

# 3. Responsive Layout

Desktop:

- Project Hero menggunakan asymmetric two-column layout
- identity menjadi primary column
- collaboration menjadi narrow right rail
- Status berada di kanan atas
- Project Details dan project context berada di bawah hero

Mobile:

- single column
- Project Name / Code / Status
- Description
- Lead Project
- Members
- Channel Chat
- Project Details
- Client / Engagement
- Key Resources

Mobile tidak mempertahankan desktop two-column rail.

---

# 4. Project Code

Project Code adalah human-facing short project label.

Project Code bukan:

- database identifier
- route identifier
- task identifier

Rules:

- uppercase
- alphanumeric
- maximum 8 characters
- custom value optional
- jika tidak mempunyai custom value, code diturunkan dari project name
- automatic code menggunakan maksimal 4 normalized characters
- jika normalized name kosong, fallback `PRJT`

Example:

`Normal Base Website`
→ `NORM`

`A-WVR`
→ `AWVR`

Custom:

`Normal Base Website`
→ `NBW`

Project Code v1 tidak diwajibkan unique.

Project Code tidak digunakan untuk task IDs.

Human-readable task ID merupakan architecture terpisah.

Persistence:

`projects.project_code_override`

- nullable
- null berarti menggunakan automatic derived code
- non-null berarti menggunakan custom Project Code
- resolved display code tidak disimpan di database
- rename project otomatis mengubah derived code hanya ketika override null

---

# 5. Engagement

Supported engagement types v1:

- `project`
- `retainer`

Default:

`project`

Existing projects migrate/default menjadi:

`project`

`internal` belum didukung karena current project model
mewajibkan Client.

---

# 6. Project Details

Current project dates tetap:

- `startDate`
- `dueDate`

Keduanya nullable.

Display rules:

Start date null:
`Not set`

Due date exists:
formatted due date

Due date null + engagement `retainer`:
`Ongoing`

Due date null + engagement `project`:
`Not set`

`dueDate = null` tidak otomatis berarti Ongoing.

Project Details display:

Start date Due date
Jul 7, 2026 Ongoing

Project Details harus menggunakan local compact grid.
Start dan Due tidak dipisahkan menggunakan full page width.

---

# 7. Client

Client menggunakan existing project-client relation.

Overview hanya read-only.

Client editing tetap berada di Project Settings.

---

# 8. Lead Project

Project mempunyai optional:

`leadUserId`

Lead Project harus merupakan current member dari project tersebut.

Invalid state:

`leadUserId` menunjuk user yang bukan project member.

State tersebut tidak boleh dibuat oleh application.

Setting Lead tidak otomatis menambah user ke project.

User harus ditambahkan sebagai project member terlebih dahulu.

Jika current Lead di-remove dari project:

1. clear `leadUserId`
2. remove project membership

Operation harus menjaga relational integrity.

Lead Project tidak berasal dari workspace Owner/Admin role.

Jika tidak ada Lead:

`Unassigned`

---

# 9. Members

Source of truth:

`project_members`

Overview menggunakan current project members.

Display:

0:
`No members`

1–4:
avatar group

> 4:
> first four avatars + count

Member avatar mempunyai accessible name/tooltip.

Lead boleh tetap muncul dalam Members avatar group.

Overview tidak menyediakan member-management action.

Member management tetap berada di Project Settings.

---

# 10. Channel Chat

V1 menggunakan existing:

`discordChannelUrl`

Display:

URL exists:
`Open Discord`

URL missing:
`Not connected`

Overview tidak mengedit Channel Chat.

Editing tetap berada di Project Settings.

Future communication integrations seperti Slack/Teams
memerlukan architecture terpisah.

---

# 11. Status

Existing project statuses tetap canonical:

- planning
- active
- on_hold
- completed

Display:

planning → Planning
active → Active
on_hold → On hold
completed → Completed

Status ditampilkan sebagai subtle badge pada Project Hero.

Overview tidak mengubah status.

---

# 12. Key Resources

Key Resources tetap ada dalam information architecture.

V1 belum mempunyai persistence model.

Empty state:

`No key resources yet`

Jangan membuat fake resource data.

Future resource architecture dapat mendukung:

- Project Brief
- Figma
- Google Drive
- generic URLs
- project references

Future resource model tidak menjadi dependency
untuk Project Overview v1.

---

# 13. Access Control

Overview membutuhkan:

`projects.view`

Project ACL tetap berlaku.

Workspace project:

- workspace project access rules berlaku

Private project:

- existing private-project ACL berlaku

Unauthorized private project tetap menghasilkan not-found
semantics.

Frontend checks hanya UX.

Backend authorization tetap authoritative.

Project member data pada Overview harus tunduk pada
project access yang sama.

---

# 14. Mutation Ownership

Project Overview menggunakan read-first interaction model.

Limited inline mutation pada Overview:

- Project Name
- Description

Keduanya membutuhkan:

`projects.edit`

User tanpa `projects.edit` melihat value sebagai read-only.

Project Settings tetap menjadi configuration surface untuk:

- Client
- Project Code override
- Engagement
- Lead Project
- Status
- Visibility
- Start date
- Due date
- Channel Chat
- Members
- Task workflow

Inline Overview editing tidak menggantikan Project Settings.

Name mutation menggunakan existing project update endpoint.

Description mutation menggunakan existing project update endpoint.

Empty description untuk user yang dapat edit menampilkan:

`Add a description`

Key Resources belum memiliki persistence model dan tetap non-interactive
pada milestone ini.

Empty Key Resources menampilkan:

`Add a brief, links, more`

---

# 15. Data Model Additions

Project Overview domain model menggunakan tiga field baru
pada `projects`.

## Project Code Override

Database:

`project_code_override TEXT NULL`

Semantics:

- `null` = Project Code diturunkan otomatis dari project name
- non-null = custom Project Code
- resolved automatic code tidak disimpan
- Project Code bukan database identifier
- Project Code tidak diwajibkan unique pada v1

Normalization dan fallback calculation dilakukan pada
application/domain layer.

## Engagement Type

Database:

`engagement_type TEXT NOT NULL DEFAULT 'project'`

Allowed values:

- `project`
- `retainer`

Existing project otomatis memperoleh:

`project`

melalui database default/migration.

## Lead Project

Database:

`lead_user_id TEXT NULL`

Foreign key:

`users.id`

Delete behavior:

`ON DELETE SET NULL`

Database foreign key hanya memastikan referenced user exists.

Application invariant tetap:

- Lead harus current project member
- setting Lead tidak otomatis menambah project member
- removing current Lead dari project harus clear Lead
- user yang bukan project member tidak boleh menjadi Lead

Invariant membership tersebut ditegakkan pada application/API
layer.

## Deferred

Tidak ada data model untuk Key Resources pada milestone ini.

Tidak ada perubahan pada task identifier architecture.

---

# 16. UI Component Policy

Overview menggunakan layout dan typography sebagai primary
information hierarchy.

Hindari card-per-field dashboard layout.

shadcn primitives yang sesuai:

- Breadcrumb
- Badge
- Avatar / Avatar Group
- Tooltip
- Skeleton

Separator hanya digunakan jika hierarchy tidak dapat
dicapai dengan whitespace.

Overview harus tetap mengikuti visual direction Figma:
minimal, editorial, dan banyak controlled whitespace.

---

# 17. Loading / Error / Empty States

Project loading:

- stable Overview skeleton

Project unavailable:

- existing project error/not-found semantics

Description null + projects.edit:

- `Add a description`

Description null + read-only:

- tidak perlu menampilkan fake description

Lead null:

- `Unassigned`

Members empty:

- `No members`

Channel Chat null:

- `Not connected`

Start date null:

- `Not set`

Project due date null:

- `Not set`

Retainer due date null:

- `Ongoing`

Key Resources empty:

- `Add a brief, links, more`

Placeholder tersebut presentation-only sampai resource persistence
diimplementasikan.

---

# 18. Acceptance Criteria

Architecture selesai ketika:

- canonical Overview hierarchy terdokumentasi
- desktop/mobile behavior terdokumentasi
- Project Code semantics jelas
- Engagement semantics jelas
- Retainer/Ongoing semantics jelas
- Lead Project invariant jelas
- Members source of truth jelas
- Channel Chat source jelas
- Key Resources deferred boundary jelas
- access-control boundary jelas
- Overview vs Settings ownership jelas
