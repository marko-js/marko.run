# Routes View Spec

## Overview

Replace the plain-text route rendering in `page.marko` with two new Marko 6 components that display routes from `buildRoutes` as an interactive accordion with flow chart visualizations.

## Components

### `<routes-view>`

**Location:** `src/routes/repl/tags/routes-view/`
**Input:** `{ routes: Route[], errors: ParseError[] }`

- Renders parse errors as a `<ul>` at the top (styled red)
- Iterates `routes`, rendering a `<details>/<summary>` per route
- `<summary>` displays `route.path.key` (e.g. `/$name`)
- When expanded, renders `<route-flow route=route />`

### `<route-flow>`

**Location:** `src/routes/repl/tags/route-flow/`
**Input:** `{ route: Route }`

Renders a flow chart of the route's request pipeline in two sections:

#### Sequential Section (middlewares → handler)

- Each `route.middlewares[i]` rendered as a box with class `.middleware`
- If `route.handler` exists, rendered as a box with class `.handler` after the last middleware
- SVG arrow connectors between each sequential box
- **Responsive:** horizontal (`flex-direction: row`) by default; vertical (`flex-direction: column`) below 600px via `@media` query

#### Nesting Section (layouts wrapping page)

- Only rendered when `route.page` exists (layouts are always empty without a page)
- If there's a sequential section AND a page, an SVG arrow connects the two sections
- Layouts rendered as nested bordered boxes: `route.layouts[0]` is outermost, wrapping `route.layouts[1]`, etc.
- `route.page` (`.page` class) is the innermost leaf
- Each layout box has a label showing `file.filePath`
- Recursive nesting handled by `<layout-nest>` component

### `<layout-nest>`

**Location:** `src/routes/repl/tags/layout-nest/`
**Input:** `{ layouts: RouteFile[], depth: number, page: RouteFile }`

Recursive component that renders layout wrapping:
- If `depth < layouts.length`: renders a `.layoutWrap` box with the layout's `filePath` as label, then recurses with `depth + 1`
- Otherwise: renders the page box

## Visual Design

### Box Styling

Each box in the flow chart:
- Bordered, rounded (`border-radius: 6px`)
- Monospace font (`Ubuntu Mono`)
- Displays the `file.filePath`
- Colored by `match.type`:

| Type | Border Color | Background |
|---|---|---|
| `middleware` | `--color-blue` (#0073d8) | 10% blue |
| `handler` | `--color-yellow` (#fc5c00) | 10% yellow |
| `layout` | `--color-green` (#00b068) | 5% green |
| `page` | `--color-red` (#cc0067) | 10% red |

### SVG Arrow Connectors

- Inline `<svg>` elements between boxes
- Horizontal: 30×20px, right-pointing arrow (line + triangle)
- Vertical: 20×30px, down-pointing arrow (line + triangle)
- Uses `currentColor` for stroke/fill to inherit text color
- Horizontal arrows hidden on mobile; vertical mobile arrows shown instead

### Accordion

- `<details>` elements with `<summary>` showing `path.key`
- Bottom border separating items
- Hover highlight on summary
- Open state adds a subtle border below summary

### Responsive Behavior

- **≥601px:** Horizontal flow (left-to-right arrows)
- **≤600px:** Vertical flow (top-to-bottom arrows), sequential items stack vertically

## File Structure

```
src/routes/repl/tags/
  route-flow/
    route-flow.marko
    route-flow.styles.module.scss
    route-flow.styles.module.scss.d.ts
  routes-view/
    routes-view.marko
    routes-view.styles.module.scss
    routes-view.styles.module.scss.d.ts
  layout-nest/
    layout-nest.marko
```

## Modified Files

- `src/routes/repl/page.marko` — replaced the `for|route|` rendering block (lines 63–89) with `<routes-view routes=routes errors=errors />`

## Data Flow

```
page.marko
  └─ buildRoutes(fileTree.dir) → { routes, errors }
     └─ <routes-view routes errors>
        ├─ errors → <ul> list
        └─ for each route → <details>
           ├─ <summary> → route.path.key
           └─ <route-flow route>
              ├─ Sequential: middlewares[] → handler?  (SVG arrows)
              └─ Nesting: layouts[] wrapping page      (<layout-nest>)
```

## Decisions

- **Nested boxes** for layout wrapping visualization
- **SVG connectors** for arrows between flow chart items
- **Responsive:** horizontal by default, vertical below 600px
- **Metas and partials:** shown in labeled sections below the request flow
- **Two components:** `<routes-view>` (list) + `<route-flow>` (per-route chart)
- **CSS Modules** (`.module.scss`) for styling, matching codebase convention
