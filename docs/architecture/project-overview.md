# Flow — Project Overview Architecture v2

## 1. Goal

Project Overview adalah primary project landing surface di Flow.

Canonical route:

`/projects/:projectId`

Overview menggunakan read-first interaction model tetapi mendukung
inline editing untuk metadata project yang sering berubah.

Overview harus memungkinkan user memahami dan mengubah context project
tanpa harus terus berpindah ke Project Settings.

Overview bukan full configuration surface.

Project Settings tetap berada di:

`/projects/:projectId/settings`

Task operations tetap berada di:

`/projects/:projectId/board`

Project Overview harus menjawab:

1. project apa yang sedang dilihat
2. apa tujuan singkat project
3. status project
4. siapa Project Leads
5. siapa Members project
6. di mana komunikasi project berlangsung
7. kapan project dimulai dan berakhir
8. client project
9. engagement model project
10. resources penting project

---

# 2. Information Architecture

Project Overview dibagi menjadi empat domain visual.

## Project Identity

- Breadcrumb
- Project Name
- Project Code
- Status
- Description

## Collaboration

- Project Leads
- Members
- Channel Chat
- Project Settings shortcut

## Project Details

- Start Date
- Due Date
- Client Name
- Engagement

## Key Resources

- Document Brief
- Links

Overview tetap menggunakan typography, spacing, dan hierarchy sebagai
primary visual structure.

Overview tidak menggunakan card-per-field dashboard layout.

---

# 3. Canonical Desktop Layout

Desktop:

Project Name / Overview

Project Name [CODE] [Status]

Description Project Leads
[Avatar] Lead One
[Avatar] Lead Two
[Avatar] Lead Three

                                           Members
                                           [A][B][C][D][E][+N]

                                           Channel Chat
                                           Open Discord / Not Connected

Project Details

Start Date Due Date
7 July 2026 15 August 2026 / Ongoing / Not set

Client Name Engagement
ACME Agency Project / Retainer

Key Resources [+]

Resource rows / empty state

Desktop semantics:

- Project Identity berada pada primary left column.
- Collaboration berada pada narrow right rail.
- Hero menggunakan asymmetric two-column layout.
- Project Identity approximately 65–70%.
- Collaboration approximately 30–35%.
- Collaboration rail tidak menempel ke viewport edge.
- Status berada di bagian paling atas Collaboration rail.
- Status, Project Leads, Members, Channel Chat, dan Project Settings shortcut
  menggunakan horizontal origin yang sama.
- Project Details berada di primary left column, tepat di bawah Description,
  sehingga posisinya mengikuti tinggi Description secara natural.
- Key Resources berada setelah Project Details.
- Whitespace bersifat intentional.
- Tidak ada separator jika hierarchy sudah cukup jelas dengan spacing.

---

# 4. Canonical Mobile Layout

Mobile menggunakan single-column layout.

Order:

Project Name / Overview

Project Name
[CODE] [Status]

Description

Project Leads

Members

Channel Chat

Project Settings

Project Details

Start Date

Due Date

Client Name

Engagement

Key Resources
[+]

Mobile tidak mempertahankan desktop collaboration rail.

Tidak boleh terjadi horizontal page overflow.

Project metadata controls harus tetap usable pada viewport kecil.

---

# 5. Breadcrumb

Current breadcrumb:

`Project / Overview`

diganti menjadi:

`{Project Name} / Overview`

Example:

`Normal Base Website / Overview`

Breadcrumb Project Name harus menggunakan project yang sedang dibuka.

Rename Project Name harus menyebabkan breadcrumb ikut berubah setelah
mutation berhasil dan project query cache diperbarui.

Jika nama sangat panjang:

- breadcrumb boleh truncate secara visual
- heading Project Name tidak boleh kehilangan full value
- full breadcrumb name tetap tersedia melalui accessible text/title jika
  dibutuhkan

Breadcrumb tidak menjadi editing control.

---

# 6. Project Name

Project Name tetap merupakan project identity utama.

Project Name:

- editable langsung dari Overview
- membutuhkan `projects.edit`
- user tanpa `projects.edit` melihat read-only heading
- maximum length tetap 160 characters
- tidak boleh kosong

Interaction:

Normal state:

`Normal Base Website`

Click:

borderless inline input

Save:

- Enter
- blur

Cancel:

- Escape

Invalid empty value:

- tidak disimpan
- kembali ke current project name

Project Name mutation menggunakan existing project update API.

Jika Project Code menggunakan automatic mode:

rename Project Name harus menghasilkan derived Project Code baru.

Jika Project Code mempunyai override:

rename tidak mengubah custom Project Code.

---

# 7. Project Code

Project Code adalah human-facing short label.

Project Code bukan:

- database ID
- route ID
- task ID

Automatic Project Code:

- uppercase
- normalized alphanumeric
- maximum 4 derived characters
- fallback `PRJT`

Custom Project Code:

- uppercase
- alphanumeric
- maximum 8 characters
- optional
- tidak diwajibkan unique pada v1

Examples:

`Normal Base Website`
→ `NORM`

`A-WVR`
→ `AWVR`

Custom:

`Normal Base Website`
→ `NBW`

Project Code tetap read-only pada Overview.

Project Code configuration tetap berada di Project Settings.

---

# 8. Project Description

Project Description adalah short project summary.

Maximum length:

`255 characters`
Limit harus berlaku konsisten pada:

- Project creation
- Overview inline editing
- Project Settings
- create project API
- update project API

Description bukan long-form project brief.

Long-form context menggunakan Key Resources → Document Brief.

## Empty Placeholder

Untuk user dengan `projects.edit`, null Description menampilkan:

`What are we building, and what does success look like?`

Placeholder merupakan editing affordance.

Placeholder bukan persisted Description.

User tanpa `projects.edit` dan Description null tidak mendapatkan fake
project description.

## Editing

Click Description:

- masuk inline textarea mode
- borderless
- visual height mengikuti content
- initial height sekitar satu text line
- auto-grow saat content membungkus
- visual height mengikuti seluruh content secara natural
- tidak menggunakan internal vertical scrollbar
- tidak menggunakan fixed textarea tinggi seperti form Settings
- `resize: none`

Save:

- blur
- Ctrl+Enter
- Cmd+Enter

Cancel:

- Escape

Saving empty content:

`description = null`

Description update menggunakan existing project update API.

---

# 9. Project Status

Canonical statuses tetap:

- `planning`
- `active`
- `on_hold`
- `completed`

Labels:

`planning`
→ `Planning`

`active`
→ `Active`

`on_hold`
→ `On hold`

`completed`
→ `Completed`

Status tampil sebagai subtle Badge.

Desktop:

Status berada di bagian atas Collaboration rail.

Status menggunakan left alignment yang sama dengan:

- Project Leads
- Members
- Channel Chat

Mobile:

Status berada dekat Project Code pada Project Identity.

Status tidak diedit melalui Overview pada architecture ini.

Status editing tetap berada di Project Settings.

---

# 10. Project Leads

Single `leadUserId` tidak lagi cukup.

Project sekarang mendukung:

minimum:

`1 Project Lead`

maximum:

`3 Project Leads`

UI label canonical:

`Project Leads`

Project tidak boleh berada pada state tanpa Project Lead.

`Unassigned` bukan lagi valid normal state.

---

# 11. Default Project Lead

Ketika project baru dibuat:

user yang membuat project otomatis:

1. menjadi Project Member
2. menjadi Project Lead pertama

Ini berlaku untuk:

- workspace project
- private project

Current behavior yang hanya menambahkan creator sebagai member untuk
private project harus diganti.

Create Project harus menggunakan satu transactional/batched operation:

1. insert Project
2. insert creator ke `project_members`
3. insert creator ke `project_leads` position `0`
4. insert default task workflow

Jika salah satu operation gagal, project creation tidak boleh menghasilkan
partial project state.

---

# 12. Project Lead Data Model

Canonical source of truth baru:

`project_leads`

Schema concept:

- `project_id`
- `user_id`
- `position`
- `created_at`

Primary key:

`project_id + user_id`

Foreign keys:

`project_id`
→ `projects.id`
→ ON DELETE CASCADE

`user_id`
→ `users.id`
→ ON DELETE CASCADE

Position:

- integer
- range `0..2`

Unique:

`project_id + position`

Application invariant:

- minimum one Lead
- maximum three Leads
- every Lead must be an existing current Project Member
- same member cannot appear twice
- position menentukan vertical order

Existing:

`projects.lead_user_id`

akan dihapus setelah migration ke `project_leads` selesai.

---

# 13. Legacy Lead Migration

Historical projects tidak menyimpan reliable `created_by`.

Karena itu migration tidak boleh mengarang creator untuk existing projects.

Migration procedure:

1. project yang mempunyai existing `lead_user_id`
   memigrasikan user tersebut menjadi `project_leads.position = 0`
2. project tanpa existing Lead harus diperiksa sebelum destructive migration
3. project tanpa Lead harus diberi Project Member + Project Lead secara
   eksplisit sebelum old `lead_user_id` dihapus

Tidak boleh otomatis menyebut workspace Owner sebagai historical creator.

Tidak boleh menghasilkan fake historical ownership.

Pre-migration gate wajib memastikan:

- setiap active project mempunyai minimal satu Project Member
- setiap active project mempunyai minimal satu Project Lead
- setiap Lead merupakan current Project Member

Baru setelah itu `projects.lead_user_id` boleh dihapus.

---

# 14. Project Leads UI

Desktop Collaboration rail:

Project Leads

[Avatar] Lead One
[Avatar] Lead Two
[Avatar] Lead Three

Leads menggunakan vertical column.

Maximum tiga rows.

Jika user mempunyai `projects.edit`:

- section menyediakan small add control saat jumlah Lead < 3
- candidate picker hanya menampilkan current Project Members
- member yang sudah menjadi Lead tidak muncul sebagai candidate

Add Lead:

- tidak otomatis menambahkan Project Member
- selected user harus sudah terdapat pada `project_members`

Remove Lead:

- boleh dilakukan selama masih tersisa minimal satu Lead

Jika hanya mempunyai satu Lead:

remove action tidak boleh membuat project tanpa Lead.

Untuk mengganti satu-satunya Lead:

1. tambahkan Lead baru
2. kemudian remove Lead lama

Backend tetap authoritative.

---

# 15. Project Lead Authorization

Lead management membutuhkan:

`projects.edit`

serta existing project access.

Private project:

mengubah Lead tidak membutuhkan `projects.private.manage`
selama operation tidak mengubah project membership.

Alasannya:

Lead hanya dapat dipilih dari existing Project Members.

Member-management authorization tetap terpisah.

Invalid Lead candidate:

HTTP `409`

Canonical error:

`PROJECT_LEAD_NOT_MEMBER`

Maximum exceeded:

HTTP `409`

Canonical error:

`PROJECT_LEAD_LIMIT_REACHED`

Attempt removing final Lead:

HTTP `409`

Canonical error:

`PROJECT_LEAD_REQUIRED`

---

# 16. Members

Canonical source of truth:

`project_members`

New project selalu mempunyai minimal creator sebagai member karena creator
otomatis menjadi Project Lead.

Members display pada Overview:

1–5 members:

first five Avatar circles

> 5 members:

first five Avatar circles + overflow count circle

Example:

8 members:

`[A][B][C][D][E][+3]`

Overflow menampilkan jumlah member yang tidak terlihat.

Bukan literal `5+`.

---

# 17. Members Interaction

Avatar group merupakan interactive trigger untuk Project Members dialog.

User dapat membuka dialog dari Members area.

Dialog canonical title:

`Project members`

Supporting text:

`Manage the people assigned to this project.`

Dialog menampilkan seluruh Project Members dalam vertical list.

Setiap row:

- Avatar
- Display Name
- Workspace role/custom role jika relevan
- Lead indicator jika user merupakan Project Lead
- Remove action jika caller mempunyai authorization

Jika caller mempunyai member-management permission:

dialog menampilkan action:

`Add members to this project`

Add control membuka searchable/selectable workspace-member picker.

Candidates:

- hanya workspace members
- belum menjadi Project Member
- bukan archived/deleted user

---

# 18. Member Management Authorization

Existing authorization model tetap digunakan.

Workspace project member management:

requires:

`projects.edit`

Private project member management:

requires:

- `projects.edit`
- `projects.private.manage`
- project access

Frontend permission checks hanya menentukan UX.

Backend authoritative.

---

# 19. Member Removal vs Project Leads

Lead selalu harus menjadi Project Member.

Jika member yang di-remove bukan Lead:

remove membership normally.

Jika member merupakan salah satu dari beberapa Leads:

dalam satu atomic batch:

1. remove user dari `project_leads`
2. remove user dari `project_members`

Jika member merupakan satu-satunya Project Lead:

operation ditolak.

HTTP:

`409`

Error:

`PROJECT_LEAD_REQUIRED`

User harus menambahkan Lead lain terlebih dahulu.

Tidak ada implicit automatic Lead reassignment.

---

# 20. Channel Chat

V1 tetap menggunakan:

`discordChannelUrl`

Display:

URL exists:

`Open Discord`

URL missing:

`Not Connected`

Channel Chat tetap read-only pada Overview.

User tidak dapat connect/change Discord Channel dari Overview.

Editing Channel Chat tetap exclusively di:

`/projects/:projectId/settings`

External Discord link:

- opens new tab
- `rel="noopener noreferrer"`

Future Slack/Teams integration bukan bagian architecture ini.

---

# 21. Project Details

Section heading canonical:

`Project Details`

Project Details menggunakan slightly stronger heading daripada individual
metadata labels.

Fields:

- Start Date
- Due Date
- Client Name
- Engagement

Project Details tetap compact.

Desktop:

two-column local grid.

Row 1:

Start Date | Due Date

Row 2:

Client Name | Engagement

Grid tidak memenuhi seluruh page width.

Mobile:

single column pada narrow viewport.

---

# 22. Start Date

Start Date dapat diedit langsung dari Overview.

Requires:

`projects.edit`

Display format:

`Day Month Year`

Example:

`7 July 2026`

Persistence tetap ISO date:

`YYYY-MM-DD`

Example:

`2026-07-07`

UI menggunakan shadcn:

- Calendar
- Popover

Interaction:

click date value
→ open Calendar Popover

Selecting date:
→ update `startDate`

Clear:
→ `startDate = null`

Null display:

`Not set`

Calendar serialization tidak boleh menghasilkan timezone date shift.

Date disimpan sebagai date-only value, bukan timestamp.

---

# 23. Due Date State

Due Date tidak lagi hanya ditentukan oleh nullable `dueDate`.

Overview membutuhkan explicit state karena user dapat memilih:

- actual date
- Ongoing
- Not set

Canonical field baru:

`dueDateMode`

Allowed:

- `unset`
- `date`
- `ongoing`

Database:

`due_date_mode TEXT NOT NULL DEFAULT 'unset'`

Check:

`due_date_mode in ('unset', 'date', 'ongoing')`

State invariant:

## Date

`dueDateMode = 'date'`

requires:

`dueDate != null`

## Ongoing

`dueDateMode = 'ongoing'`

requires:

`dueDate = null`

## Unset

`dueDateMode = 'unset'`

requires:

`dueDate = null`

Application/API harus menolak inconsistent combinations.

---

# 24. Due Date Migration

Existing behavior:

- dueDate exists → formatted date
- retainer + null dueDate → Ongoing
- project + null dueDate → Not set

Migration ke explicit mode mempertahankan current rendered meaning.

Existing row:

dueDate != null

→

`dueDateMode = 'date'`

Existing row:

dueDate = null
AND engagement = `retainer`

→

`dueDateMode = 'ongoing'`

Existing row:

dueDate = null
AND engagement = `project`

→

`dueDateMode = 'unset'`

Setelah migration:

Engagement tidak lagi menentukan Due Date state secara implicit.

---

# 25. Due Date UI

Due Date dapat diedit langsung dari Overview.

Requires:

`projects.edit`

UI menggunakan:

- shadcn Calendar
- shadcn Popover

Display date format:

`Day Month Year`

Example:

`15 August 2026`

Calendar Popover menyediakan:

- normal date selection
- `Ongoing`
- `Clear due date`

Selecting calendar date:

- `dueDateMode = 'date'`
- `dueDate = selected ISO date`

Selecting:

`Ongoing`

sets:

- `dueDateMode = 'ongoing'`
- `dueDate = null`

Selecting:

`Clear due date`

sets:

- `dueDateMode = 'unset'`
- `dueDate = null`

Display:

mode `date`
→ formatted date

mode `ongoing`
→ `Ongoing`

mode `unset`
→ `Not set`

Canonical spelling:

`Ongoing`

not:

`On Going`

---

# 26. Client Name

Client dapat diubah langsung dari Overview.

Requires:

- `projects.edit`
- `clients.view` untuk candidate discovery UX

Candidate source:

existing workspace Clients database.

Selectable clients:

- active Clients
- current Client tetap dapat ditampilkan apabila sudah inactive

New selection harus merupakan Client dari current workspace.

Backend harus memvalidasi Client.

Project tidak dapat menunjuk Client dari workspace lain.

Overview Client selector tidak menyediakan create-client action.

Client creation tetap merupakan Clients feature.

---

# 27. Engagement

Supported values:

- `project`
- `retainer`

Display:

`project`
→ `Project`

`retainer`
→ `Retainer`

Engagement dapat diubah langsung dari Overview.

Requires:

`projects.edit`

Interaction menggunakan compact dropdown/select.

Changing Engagement tidak otomatis mengubah:

- Start Date
- Due Date
- Due Date Mode

Explicit Due Date state selalu menang.

---

# 28. Metadata Mutation Ownership

Overview editable metadata:

- Project Name
- Description
- Project Leads
- Start Date
- Due Date
- Client
- Engagement

Overview read-only metadata:

- Project Code
- Status
- Channel Chat

Project Settings tetap bertanggung jawab atas:

- Project Code override
- Status
- Visibility
- Channel Chat
- Task Workflow
- full configuration fallback
- project deletion/archive

Members menggunakan dedicated Members dialog pada Overview tetapi tetap
mengikuti existing member authorization.

---

# 29. Mutation Notifications

Setiap mutation dari Project Overview harus memberikan user feedback.

Canonical notification system:

shadcn Sonner

Global Toaster:

- mounted satu kali pada application root
- position `bottom-right`

Overview tidak membuat custom per-component toast container.

Success examples:

- `Project name updated`
- `Description updated`
- `Start date updated`
- `Due date updated`
- `Client updated`
- `Engagement updated`
- `Project lead added`
- `Project lead removed`
- `Member added to project`
- `Member removed from project`
- `Document brief created`
- `Link added`
- `Resource updated`
- `Resource removed`

Failure:

- tampilkan meaningful server/API message
- jangan hanya `Something went wrong` apabila API mempunyai error message

No-op mutation:

- tidak menghasilkan success toast

Pending mutation:

- relevant control disabled untuk mencegah duplicate submission

Toast tidak menggantikan backend error handling.

---

# 30. Key Resources

Key Resources menjadi persisted project data.

Section heading row:

Key Resources [+]

`+` hanya terlihat untuk user dengan:

`projects.edit`

Click `+` membuka menu.

Menu v1:

- `Document Brief`
- `Link`

Canonical labels:

`Document Brief`

`Link`

Tidak menggunakan plural `Links` pada menu item karena action membuat satu
resource.

No file upload pada v1.

Tidak ada Google Drive/Figma native integration pada v1.

---

# 31. Key Resources Empty State

Current:

`Add a brief, links, more`

diganti menjadi:

`Bring the brief, references, and important links together here.`

Empty copy merupakan visual guidance.

Untuk user dengan edit permission, primary action tetap `+`.

Empty text sendiri tidak harus clickable.

---

# 32. Project Resources Data Model

Canonical table:

`project_resources`

Fields:

- `id`
- `project_id`
- `type`
- `title`
- `url`
- `content`
- `position`
- `created_by`
- `created_at`
- `updated_at`

Resource Type:

- `document_brief`
- `link`

Foreign keys:

`project_id`
→ `projects.id`
→ ON DELETE CASCADE

`created_by`
→ `users.id`
→ ON DELETE RESTRICT

Index:

- `project_resources_project_id_idx`
- unique `(project_id, position)`

Position:

integer >= 0

Resources render ordered by `position`.

---

# 33. Resource Type — Link

Type:

`link`

Required:

`url`

Optional:

`title`

URL protocols allowed:

- `https`
- `http`

Reject:

- javascript
- data
- file
- unsupported/custom protocols

If title is empty:

UI dapat menampilkan normalized hostname sebagai fallback label.

Example:

URL:

`https://www.figma.com/file/...`

Fallback:

`figma.com`

Link row:

- Link icon
- title/fallback hostname
- external indicator

Open:

new tab

with:

`noopener noreferrer`

Content field untuk Link:

`null`

---

# 34. Resource Type — Document Brief

Type:

`document_brief`

Document Brief adalah internal Flow project resource.

V1 menggunakan simple text document.

Fields:

- title
- content

Default title:

`Project Brief`

URL:

`null`

V1 tidak menggunakan rich-text editor.

V1 content dapat menggunakan multiline plain text.

Rich text / structured editor merupakan future enhancement dan tidak menjadi
dependency Overview v2.

Document Brief interaction:

create:
→ menu `+`
→ `Document Brief`
→ dialog/editor

edit:
→ click Document Brief resource
→ open editor

delete:
→ resource action menu

Document Brief bukan replacement untuk short Project Description.

Description:

short 160-character summary.

Document Brief:

long-form project context.

---

# 35. Resource Authorization

View:

user yang dapat melihat project dapat melihat Project Resources.

Create/update/delete:

requires:

`projects.edit`

dan project access.

Private project ACL tetap berlaku.

Inaccessible private project/resource menggunakan existing not-found semantics.

No separate resource permission key pada v1.

---

# 36. Resource API

Canonical endpoints:

GET

`/api/projects/:projectId/resources`

POST

`/api/projects/:projectId/resources`

PATCH

`/api/projects/:projectId/resources/:resourceId`

DELETE

`/api/projects/:projectId/resources/:resourceId`

Every resource endpoint harus menggunakan existing project access
authorization terlebih dahulu.

Resource yang bukan bagian dari requested project tidak boleh dapat
dimodifikasi melalui cross-project ID.

Invalid/inaccessible resource:

404 semantics.

---

# 37. Project Leads API

Canonical endpoints:

GET Lead state dapat berasal dari Project Members response.

Project Member DTO ditambah metadata:

- `isLead`
- `leadPosition`

Lead update menggunakan atomic list replacement:

PUT

`/api/projects/:projectId/leads`

Request:

{
"userIds": [
"usr_a",
"usr_b"
]
}

Rules:

- array length 1..3
- unique user IDs
- semua user merupakan current Project Members
- order array menentukan Lead position

PUT lebih dipilih daripada sequence add/remove endpoint karena:

- atomic
- ordering jelas
- tidak dapat menghasilkan transient zero-lead state
- mudah menjaga maximum 3
- mudah replace Lead set

Operation tidak mengubah membership.

---

# 38. Project Members Contract

Project Member DTO:

{
"user": {
...
},
"addedAt": "...",
"isLead": true,
"leadPosition": 0
}

Non-Lead:

{
"isLead": false,
"leadPosition": null
}

Overview Project Leads diturunkan dari Project Members data:

1. filter `isLead`
2. sort by `leadPosition`

Tidak infer Lead dari:

- Owner role
- Admin role
- custom role
- workspace role

---

# 39. Project Creation Invariant

New Project creation harus menghasilkan:

Project

- Creator membership
- Creator Lead
- Default Task Workflow

untuk semua visibility.

Workspace Project:

creator tetap masuk `project_members`.

Private Project:

creator tetap masuk `project_members` dan membership juga memberikan private
project access.

Creator menjadi Lead position `0`.

Tidak ada newly-created project dengan zero member atau zero lead.

---

# 40. Status vs Lead Layout

Desktop Collaboration rail order:

1. Status
2. Project Leads
3. Members
4. Channel Chat

All four menggunakan same left axis.

Status tidak berada di far-right edge.

Canonical structure:

[Active]

Project Leads
[A] Ramshal
[B] Another Lead

Members
[A][B][C][D][E][+3]

Channel Chat
Not Connected

---

# 41. Loading State

Project initial loading:

stable Overview skeleton.

Skeleton mengikuti final hierarchy:

- breadcrumb
- identity
- collaboration rail
- Project Details
- Key Resources

Project Members loading:

- Lead area skeleton
- Members avatar skeleton

Resources loading:

- resource rows skeleton

Loading tidak mengganti seluruh page jika hanya secondary query sedang
refetch setelah mutation.

React Query cached data harus tetap terlihat selama background refetch jika
aman.

---

# 42. Error State

Project unavailable:

existing project not-found/error behavior.

Members request failure:

Project Leads:

`Unable to load project leads`

Members:

`Unable to load project members`

Jangan menampilkan `Unassigned`.

Resources request failure:

`Unable to load project resources`

Mutation failure:

- retain current value
- show bottom-right error toast

Optimistic UI hanya digunakan bila rollback semantics jelas.

Tidak diwajibkan untuk Overview v2.

---

# 43. Empty States

Description null + editable:

`What are we building, and what does success look like?`

Description null + read-only:

no fake description.

Project Leads:

normal valid state selalu minimum 1.

Members:

new project minimum 1 member.

Channel Chat null:

`Not Connected`

Start Date null:

`Not set`

Due Date mode unset:

`Not set`

Due Date mode ongoing:

`Ongoing`

Key Resources empty:

`Bring the brief, references, and important links together here.`

---

# 44. Accessibility

Interactive text yang terlihat seperti plain text tetap harus keyboard
accessible.

Inline controls:

- focus-visible state
- semantic button/input/select
- Escape cancellation where relevant

Avatars:

- accessible member name
- title/tooltip where useful

Members group:

- semantic button trigger
- accessible label containing member count

Overflow circle:

Example:

`+3`

accessible label:

`3 more project members`

Calendar:

- keyboard navigable
- selected date announced by shadcn/underlying calendar primitive

External links:

- semantic anchor
- accessible external-link meaning

Icon-only `+`:

requires:

`aria-label="Add key resource"`

Lead add control:

requires:

`aria-label="Add project lead"`

---

# 45. Responsive Rules

Desktop breakpoint:

collaboration rail appears beside Project Identity.

Below desktop:

collaboration stacks under Description.

Project Details:

mobile:
single column

sm+:
two-column compact grid where sufficient width exists

Members dialog:

- desktop centered dialog
- mobile remains within viewport
- internal member list scrolls
- page itself tidak overflow

Resource creation dialogs:

responsive max width.

Calendar popover:

must remain within viewport.

---

# 46. UI Component Policy

Use existing/shadcn primitives where appropriate.

Required candidates:

- Avatar
- Avatar Group
- Badge
- Breadcrumb
- Button
- Calendar
- Dialog
- Dropdown Menu
- Popover
- Select / Command where appropriate
- Skeleton
- Sonner
- Tooltip

Do not install components before implementation phase requires them.

Do not use card-per-field layout.

Do not introduce a second design system.

Phosphor remains canonical application icon family.

---

# 47. Project Settings Boundary

Overview now owns frequently changed operational metadata:

- Name
- Description
- Leads
- Members management
- Start Date
- Due Date
- Client
- Engagement
- Resources

Project Settings remains configuration surface for:

- Project Code override
- Status
- Visibility
- Channel Chat
- Task Workflow
- archive/delete
- fallback metadata administration

Duplicate edit controls may temporarily exist during migration from Settings,
tetapi final ownership harus jelas.

Channel Chat specifically remains Settings-only.

---

# 48. Data Model Changes Required

Overview v2 requires:

## Project Leads

New:

`project_leads`

Old:

`projects.lead_user_id`

Old field removed only after data migration and integrity verification.

## Explicit Due Date Mode

Add:

`projects.due_date_mode`

Allowed:

- unset
- date
- ongoing

## Project Resources

New:

`project_resources`

Types:

- document_brief
- link

No new table required for Members because:

`project_members`

already canonical.

No new Client table required because:

`clients`

already canonical.

---

# 49. Migration Safety

Remote D1 migration must not be applied during source-development phases.

Migration sequence must first be verified locally.

Before removing old `lead_user_id`:

run data integrity queries.

Required invariants:

1. all active projects have >=1 Lead
2. no project has >3 Leads
3. every Lead exists in `project_members`
4. Lead positions unique per project
5. Lead positions between 0 and 2
6. no invalid due-date-mode combinations
7. existing dates preserved
8. existing project/client/member/task data preserved

Remote D1 remains untouched until dedicated production gate.

---

# 50. API Authorization Summary

Project identity mutation:

`projects.edit`

Project Details mutation:

`projects.edit`

Client candidate discovery:

`clients.view`

Lead mutation:

`projects.edit`

Lead candidate:

must already be Project Member

Workspace member management:

`projects.edit`

Private member management:

- `projects.edit`
- `projects.private.manage`
- project access

Resources mutation:

`projects.edit`

Channel Chat mutation:

Settings only, still `projects.edit`

Project Code mutation:

Settings only

Status mutation:

Settings only

Visibility mutation:

Settings only with existing private-project permission semantics

Backend authorization remains authoritative.

---

# 51. Not Included

Overview v2 does not include:

- task statistics
- progress percentage
- activity feed
- comments
- file upload
- invoice
- time tracking
- project analytics
- realtime presence
- Slack
- Microsoft Teams
- Google Drive native integration
- Figma native integration
- rich-text editor
- resource folders
- resource drag/reorder UI
- task identifier changes
- multi-workspace changes

These features tidak menjadi dependency Project Overview v2.

---

# 52. Implementation Order

Implementation harus mengikuti urutan ini.

## 13G — Overview Architecture v2

- replace canonical architecture
- no runtime changes

## 13H — Overview Domain Model v2

Implement:

- `project_leads`
- Lead migration preparation
- `due_date_mode`
- `project_resources`
- contracts/data-model foundations

Local D1 only.

## 13I — Overview API v2

Implement:

- default creator membership
- default creator Lead
- Project Leads API
- Members lead metadata
- member removal Lead invariant
- explicit Due Date mode
- Resources API

No UI rewrite yet.

## 13J — Overview Metadata Editing

Implement:

- Project Name
- Description final placeholder/auto-height
- breadcrumb project name
- Start Date Calendar
- Due Date Calendar + Ongoing
- Client selector
- Engagement selector
- Sonner bottom-right notifications

## 13K — Collaboration Controls

Implement:

- 1–3 Project Leads vertical UI
- Lead add/remove
- 5-avatar Members display
- +N overflow
- Project Members dialog
- add member
- remove member
- Lead protection

## 13L — Key Resources UI

Implement:

- Key Resources `+`
- Dropdown Menu
- Document Brief
- Link
- resource list
- create/edit/delete
- empty state

## 13M — Overview Responsive / State Finalization

Verify:

- desktop
- tablet
- mobile
- loading
- errors
- empty states
- permissions
- accessibility
- no horizontal overflow
- no duplicate controls
- mutation toasts

## Production

Only after 13M verification:

- remote migration gate
- production deploy gate
- production smoke test

---

# 53. Acceptance Criteria

Project Overview v2 dianggap selesai ketika:

## Identity

- breadcrumb uses Project Name
- Project Name inline rename works
- Project Code semantics preserved
- Status alignment correct
- Description max 160
- Description final placeholder implemented
- Description editor compact/auto-height

## Leads

- creator becomes initial Lead
- creator becomes Project Member for every new project
- project always has 1–3 Leads
- Lead must be Project Member
- Lead UI vertical
- final Lead cannot be removed
- no normal Unassigned state

## Members

- maximum five visible avatars
- overflow uses +N
- avatar group opens Members dialog
- complete member list available
- authorized user can add member
- authorized user can remove member
- private-project authorization preserved
- removing final Lead blocked

## Project Details

- Start Date inline editable
- Due Date inline editable
- Calendar uses shadcn
- date display uses Day Month Year
- Due Date supports Ongoing
- Due Date supports Not set
- explicit dueDateMode persisted
- Client selectable from valid Clients
- Engagement editable
- Engagement does not implicitly mutate Due Date

## Channel

- connected channel opens Discord
- missing channel shows Not Connected
- Channel Chat cannot be edited from Overview

## Resources

- Key Resources has `+`
- menu contains Document Brief
- menu contains Link
- resource data persisted
- Document Brief persisted
- Link persisted
- resource empty copy finalized
- unauthorized user cannot mutate resources

## Notifications

- every successful Overview mutation generates bottom-right feedback
- every failed mutation generates meaningful bottom-right error feedback
- duplicate mutation submission prevented

## Security

- existing project ACL preserved
- private project 404 semantics preserved
- backend remains authoritative
- no Lead can bypass membership
- no cross-project resource mutation
- no cross-workspace Client assignment

## Runtime

- lint PASS
- TypeScript PASS
- Vite worker build PASS
- Vite client build PASS
- Wrangler dry-run PASS
- migrations PASS locally
- behavioral API gates PASS
- responsive manual gates PASS
- remote commit scope verified before milestone completion
