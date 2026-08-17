# Flow — Sidebar UI/UX Redesign Specification

## Goal

Redesign sidebar Flow agar hierarchy lebih bersih, scalable, dan lebih cocok untuk workflow project management.

Fokus milestone ini hanya pada:

- sidebar navigation architecture
- workspace header
- full sidebar collapse
- collapsible sections
- project tree navigation
- active navigation states

Tidak termasuk:

- upload workspace logo
- task human-readable ID
- realtime presence
- realtime board sync
- live cursor

---

# 1. Sidebar Global Structure

Struktur sidebar baru:

[Sidebar Toggle] [Workspace Logo] [Workspace Name]

Home

SPACE [+] [Chevron]

Project A [Chevron]
│
├─ Overview
└─ Task List

Project B [Chevron]

DATABASE [Chevron]

Clients
Members

---

# 2. Sidebar Header

## Current

Header sekarang menggunakan:

- logo `F`
- text `INVS Studio`
- collapse button terpisah di kanan sidebar

## New Behavior

Header harus terdiri dari:

1. Sidebar toggle
2. Workspace logo placeholder
3. Workspace name dropdown

### Sidebar Toggle

Posisi:

- pojok kiri atas sidebar
- berada pada area yang sebelumnya digunakan oleh logo `F`

Behavior:

- click → sidebar full hidden
- tidak ada minimized / icon-only sidebar mode

### Workspace Logo

Logo `F` dihapus.

Diganti dengan placeholder workspace logo.

Untuk versi ini belum ada upload workspace logo.

Placeholder dapat menggunakan:

- huruf pertama workspace name
- rounded square container

Contoh:

INVS Studio

→ `I`

Upload logo workspace ditunda ke future feature.

### Workspace Name

`INVS Studio` tidak lagi menjadi text statis.

Harus menjadi clickable dropdown button.

Contoh:

INVS Studio
▼

Menu untuk versi sekarang:

- Settings

Workspace dropdown dapat dikembangkan nanti untuk:

- Workspace Settings
- Members
- Switch Workspace
- Sign Out

Tetapi jangan implementasikan item tambahan tersebut pada milestone ini.

---

# 3. Full Sidebar Collapse

Sidebar tidak menggunakan minimized rail.

Behavior yang diinginkan:

Expanded:

| Sidebar | Main Content |

Collapsed:

| Main Content Full Width |

Ketika sidebar ditutup:

- sidebar hilang sepenuhnya
- tidak ada vertical icon rail
- main content menggunakan area yang sebelumnya ditempati sidebar

## Reopen Trigger

Karena sidebar hilang total, harus tersedia trigger untuk membuka sidebar kembali.

Ketika sidebar hidden:

- tampilkan sidebar/menu trigger di bagian kiri atas application shell/main layout

Trigger tersebut hanya muncul ketika sidebar hidden.

Saat sidebar terbuka, trigger berada di sidebar header.

---

# 4. Home Navigation

`Home` dipindahkan menjadi navigation item pertama.

Urutan:

Workspace Header

Home

Space

Database

Home tidak berada di dalam section apapun.

---

# 5. Section Architecture

Sidebar memiliki dua primary sections:

1. Space
2. Database

## Section Collapse

Kedua section harus collapsible.

Contoh:

SPACE v

DATABASE >

Behavior:

- click section label atau chevron → toggle section
- collapsed → child items hidden
- expanded → child items visible

Initial/default behavior:

- Space → expanded
- Database → expanded

Section state cukup client-side untuk sekarang.

Persistence antar browser session tidak wajib pada milestone ini.

---

# 6. Space Section

`Space` tetap menggunakan nama:

SPACE

Tetapi menggantikan fungsi list `Projects` yang sekarang.

Header:

SPACE [+] [Chevron]

Space memiliki:

- section label
- create project button `+`
- collapse chevron

## Create Project Button

Button `+` berada di sebelah kanan label `Space`.

Behavior:

- menggunakan existing Create Project flow/dialog
- project baru muncul di Space setelah berhasil dibuat

Tidak membuat create-flow baru apabila existing project creation sudah tersedia.

---

# 7. Project Navigation

Semua project workspace tampil sebagai children dari `Space`.

Contoh:

SPACE

Website 2026 Revamp
Workflow Positive Probe
Card Project Test

Setiap project adalah collapsible navigation parent.

## Project Row

Project row memiliki:

- project/folder icon
- project name
- expand/collapse chevron

Contoh:

[folder] Website 2026 Revamp v

Interaction:

- click project name → navigate ke Project Overview
- click chevron → expand/collapse project subtree

Jangan membuat seluruh row hanya berfungsi sebagai toggle karena nama project juga merupakan navigation target.

---

# 8. Project Tree

Ketika project expanded, tampilkan:

- Overview
- Task List

Contoh:

[folder] Website 2026 Revamp v
│
├─ Overview
└─ Task List

Route mapping:

Overview
→ existing project overview route

Task List
→ existing project task/board route

Gunakan existing route architecture.

Jangan membuat duplicate project pages hanya untuk sidebar redesign.

---

# 9. Tree Connector Design

Tree connector mengikuti pola sederhana seperti sidebar tree pada shadcn reference.

Important:

Tree connector hanya mulai dari level project.

Tidak ada connector dari:

SPACE
→ Project

Wrong:

SPACE
├─ Project
│ ├─ Overview
│ └─ Task List

Correct:

SPACE

Project
│
├─ Overview
└─ Task List

Section label bukan bagian dari visual tree.

## Connector Style

Gunakan garis sederhana.

Tidak perlu:

- complex branch animation
- decorative connector
- heavy indentation

Target:

clean
subtle
functional

---

# 10. Project Expand Behavior

Setiap project dapat:

- expanded
- collapsed

Default behavior:

- active/current project → expanded
- project lain → collapsed

Jika user sedang berada pada:

Project A → Task List

maka:

Project A harus otomatis expanded.

Contoh:

SPACE

Project A v
│
├─ Overview
└─ Task List ← active

Project B >
Project C >

User tetap dapat collapse active project secara manual.

Navigasi berikutnya ke child project boleh membuka parent kembali.

---

# 11. Active Navigation State

Active state harus mengikuti current route.

## Home

Route:

/

Active:

Home

## Project Overview

Route milik project overview.

Active:

Project
└─ Overview

## Project Task List

Route milik project task/board.

Active:

Project
└─ Task List

## Clients

Active:

DATABASE
└─ Clients

## Members

Active:

DATABASE
└─ Members

Parent project tidak perlu memakai active background yang sama kuat dengan child.

Child route adalah primary active navigation indicator.

---

# 12. Database Section

Section `Manage` dihapus.

Diganti menjadi:

DATABASE

Contents:

DATABASE

Clients
Members

Perubahan:

Clients:

- sebelumnya berada di section Space
- pindah ke Database

Members:

- sebelumnya berada di Manage
- tetap tersedia tetapi sekarang di Database

Settings:

- dihapus dari navigation section
- dipindahkan ke workspace dropdown menu

---

# 13. Final Information Architecture

Final sidebar hierarchy:

[Sidebar Toggle] [Workspace Logo] [Workspace Name ▼]

Home

SPACE [+] [v]

[Folder] Project A [v]
│
├─ Overview
└─ Task List

[Folder] Project B [>]

[Folder] Project C [>]

DATABASE [v]

Clients
Members

Workspace dropdown:

Workspace Name
└─ Settings

---

# 14. Visual Priorities

Sidebar harus terasa:

- compact
- hierarchical
- readable
- low visual noise
- scalable untuk banyak project

Avoid:

- excessive borders
- excessive cards
- oversized indentation
- heavy connector graphics
- unnecessary animations
- mini-sidebar mode
- duplicated Settings navigation

Use:

- subtle hover
- clear active state
- small chevrons
- consistent icon sizing
- subtle tree line
- consistent vertical rhythm

---

# 15. Responsive Behavior

## Desktop

Sidebar:

- persistent ketika open
- dapat full collapse
- main area expands ketika sidebar hidden

## Smaller Screen / Mobile

Sidebar dapat menggunakan drawer/overlay behavior.

Information architecture tetap sama.

Jangan membuat separate navigation structure khusus mobile.

---

# 16. Out of Scope

Jangan implementasikan pada sidebar redesign milestone ini:

- workspace logo upload
- workspace switching
- multiple workspace management
- realtime online presence
- realtime board synchronization
- live cursor
- task identifier seperti INVS-123
- sidebar state cloud persistence
- complex tree drag-and-drop
- project reorder
- custom sidebar section reorder

---

# 17. Acceptance Criteria

## Header

- [ ] Logo `F` sudah tidak digunakan
- [ ] Workspace logo placeholder tersedia
- [ ] Workspace name menjadi dropdown button
- [ ] Dropdown memiliki `Settings`
- [ ] Sidebar toggle berada di bagian kiri atas

## Sidebar Collapse

- [ ] Sidebar dapat di-hide sepenuhnya
- [ ] Tidak ada minimized/icon-only rail
- [ ] Main content melebar ketika sidebar hidden
- [ ] Ada trigger untuk membuka sidebar kembali

## Main Navigation

- [ ] Home berada di navigation level paling atas
- [ ] Tidak berada di dalam section

## Space

- [ ] Section bernama `Space`
- [ ] Space dapat collapse/expand
- [ ] Ada button `+`
- [ ] Button `+` menggunakan existing create-project behavior
- [ ] Project workspace muncul di dalam Space

## Project

- [ ] Setiap project memiliki project/folder icon
- [ ] Setiap project dapat collapse/expand
- [ ] Project name dapat membuka Overview
- [ ] Chevron project mengontrol expand/collapse
- [ ] Active project otomatis expanded

## Project Tree

- [ ] Expanded project menampilkan `Overview`
- [ ] Expanded project menampilkan `Task List`
- [ ] Overview menggunakan existing route
- [ ] Task List menggunakan existing route
- [ ] Active child navigation memiliki visual state jelas
- [ ] Connector line hanya dimulai dari project subtree
- [ ] Tidak ada connector dari `Space` ke project

## Database

- [ ] Section `Manage` sudah tidak ada
- [ ] Diganti menjadi `Database`
- [ ] Database dapat collapse/expand
- [ ] Clients berada di Database
- [ ] Members berada di Database
- [ ] Settings tidak lagi berada sebagai sidebar navigation item

---

# 18. Implementation Priority

Implement dalam urutan berikut:

Phase 1 — Application Shell

1. Full sidebar hide/show
2. Reopen trigger
3. Header layout

Phase 2 — Workspace Header 4. Workspace logo placeholder 5. Workspace dropdown 6. Move Settings into dropdown

Phase 3 — Navigation Restructure 7. Move Home 8. Create Space section 9. Create Database section 10. Move Clients 11. Move Members

Phase 4 — Project Tree 12. Project collapsible parent 13. Overview child 14. Task List child 15. Tree connector 16. Route-based active state 17. Auto-expand active project

Phase 5 — Polish 18. spacing 19. hover states 20. active states 21. chevron transitions 22. responsive verification

---

# Final Target

Sidebar harus berubah dari flat navigation:

Home
Clients
Projects
Project A
Project B

Members
Settings

menjadi workspace-oriented hierarchical navigation:

Home

SPACE
Project A
│
├─ Overview
└─ Task List

Project B

DATABASE
Clients
Members

Project parent:

- disclosure only
- clicking row toggles expansion
- does not navigate

Project children:

- Overview = navigation
- Task List = navigation

Expansion:

- independent per project
- multiple projects may stay expanded
- navigating to another project does not collapse previous project
- user manually collapses by clicking project row again

Desktop sidebar:

- resizable
- default 240px
- min settled width 208px
- max 360px
- <=184px on resize release collapses sidebar
- saved width restored when reopened
