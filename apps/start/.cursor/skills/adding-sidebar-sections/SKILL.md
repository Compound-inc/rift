---
name: adding-sidebar-sections
description: Add a new sidebar section (e.g. DMs, threads). Use when creating a new area in the app sidebar, adding a section with static or dynamic nav items, or when the user asks how to add a section like chat or DMs.
---

# Adding a New Sidebar Section

This skill documents how to add a new section to the app sidebar (e.g. Chat, DMs) so it works with the existing layout, keeps one source of truth for static content, and stays consistent with best practices.

## Layout convention

Organize by **layer**, then by **section** inside that layer:

| Layer | Purpose |
|-------|--------|
| **components/{section}/** | All UI for that section: sidebar config, content component, pages, etc. |
| **hooks/use-{section}-*.ts** | Section-specific hooks (e.g. `use-chat-params.ts`) if needed. |
| **lib/{section}/** | Shared logic/schemas for that section (e.g. `lib/chat/`). |

Example: Chat lives in `components/chat/` (chat-sidebar.tsx, chat-context.tsx, chat-input.tsx, …). A new "DMs" section would live in `components/dms/`.

## Sidebar structure (how it works)

- **NAV_AREAS** in `components/layout/sidebar/app-sidebar-nav.config.tsx` maps an area key to a function `(data) => SidebarNavAreaConfig`.
- Each config has: **title**, **href**, **icon**, **description**, **content** (array of sections), and optionally **ContentComponent**.
- **Static-only areas** (e.g. Writer, Settings): no `ContentComponent`; the panel renders `content` via `SidebarAreaLayout`.
- **Dynamic areas** (e.g. Chat): provide **ContentComponent**. The panel renders that component instead of `content`; the component uses `SidebarAreaLayout` and builds sections from static data + dynamic data (e.g. Zero `useQuery`).

A **section** is `{ name?: string, items: NavItemType[] }`. Each **item** is `{ name, href, icon, exact?, isActive? }`. Icons come from `lucide-react`.

## When to use which pattern

| Need | Use |
|------|-----|
| Fixed list of links (no data from API/Zero) | Static-only: define `content` in your nav function, do **not** set `ContentComponent`. |
| List that comes from Zero/API (e.g. threads, DMs) | Dynamic: set `ContentComponent` to a client component that calls `useQuery`, maps to `NavItemType[]`, and renders `SidebarAreaLayout` with static sections + one dynamic section. |

## Step-by-step: Add a new section (e.g. DMs)

### 1. Create the section folder and sidebar file

Create **components/{section}/** and a sidebar file, e.g. **components/dms/dms-sidebar.tsx**.

**Static-only** (no dynamic list):

```tsx
import { isAreaPath } from '@/utils/nav-utils'
import { MessageCircle, Plus } from 'lucide-react'

export const DMS_HREF = '/dms'
export const DMS_AREA_KEY = 'dms' as const

export const isDmsPath = (pathname: string) => isAreaPath(pathname, DMS_HREF)

export function dmsNavArea() {
  return {
    title: 'Direct Messages',
    href: DMS_HREF,
    description: 'Conversations with your team.',
    icon: MessageCircle,
    content: [
      {
        items: [
          { name: 'New conversation', href: `${DMS_HREF}/new`, icon: Plus },
          // ... more static items
        ],
      },
    ],
  }
}
```

**Dynamic** (list from Zero/API): same constants and path helper, plus a single source of truth for static content and a ContentComponent that appends a dynamic section. See `components/chat/chat-sidebar.tsx` as the reference:

- Define **HREF**, **AREA_KEY**, **isXPath**.
- Define **staticSections** (array of `NavSection`) and optional **sidebar title** as constants.
- Export **xNavStaticConfig()** returning `{ title, href, icon, description, content: staticSections }`.
- Export **XSidebarContent({ pathname })** (client component): run `useQuery` (or fetch), map to `NavItemType[]`, build one dynamic section (e.g. "Conversations"), then `sections = [...staticSections, dynamicSection]`. Render `<SidebarAreaLayout title={...} sections={sections} pathname={pathname} />`. Treat query results as immutable.
- Export **xNavArea()** returning `{ ...xNavStaticConfig(), content: staticSections, ContentComponent: XSidebarContent }`.

### 2. Export from the section index

In **components/{section}/index.ts**, export the area key, path helper, and nav area (and any other public API):

```ts
export { DMS_AREA_KEY, DMS_HREF, dmsNavArea, isDmsPath } from './dms-sidebar'
```

### 3. Register the area

In **components/layout/sidebar/app-sidebar-nav.config.tsx**:

1. Import: `import { DMS_AREA_KEY, dmsNavArea, isDmsPath } from '@/components/dms'`
2. Add to **NAV_AREAS**: `[DMS_AREA_KEY]: dmsNavArea`
3. Add to **getCurrentArea**: `if (isDmsPath(pathname)) return DMS_AREA_KEY` (order matches your preference).

### 4. Add routes (if the section has list + detail)

So sidebar links resolve (e.g. `/dms`, `/dms/$conversationId`):

- **routes/(app)/_layout/{section}/route.tsx** – layout that renders `<Outlet />`.
- **routes/(app)/_layout/{section}/index.tsx** – default page (e.g. empty state or list).
- **routes/(app)/_layout/{section}/$param/route.tsx** – detail page (e.g. one thread or conversation).

Use the same param name in the route and in sidebar item hrefs (e.g. `threadId`, `conversationId`).

## Checklist for a new section

- [ ] **components/{section}/** exists with a sidebar file (e.g. `{section}-sidebar.tsx`).
- [ ] Exports: **AREA_KEY**, **HREF**, **isXPath**, **xNavArea** (and **xNavStaticConfig** + **XSidebarContent** if dynamic).
- [ ] **components/{section}/index.ts** re-exports the public API.
- [ ] **app-sidebar-nav.config.tsx**: area in NAV_AREAS and in getCurrentArea.
- [ ] If dynamic: ContentComponent uses **SidebarAreaLayout**, same **staticSections** as source of truth, and one dynamic section; Zero results not mutated.
- [ ] If list/detail: layout route + index route + `$param` route under **routes/(app)/_layout/{section}/**.

## Reference files

- **Static area**: `routes/(app)/_layout/writer/-writer-nav.ts`
- **Dynamic area (Zero)**: `components/chat/chat-sidebar.tsx`
- **Nav config and types**: `components/layout/sidebar/app-sidebar-nav.config.tsx`
- **Shared layout**: `components/layout/sidebar/sidebar-area-layout.tsx`
- **Path helper**: `utils/nav-utils.ts` (`isAreaPath`)

Do not add new styles for sidebar list items; reuse **SidebarAreaLayout** and **SidebarNavItem** so all sections look consistent.
