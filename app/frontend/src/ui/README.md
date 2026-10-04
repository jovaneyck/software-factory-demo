# DogTrainr UI kit

Everything a page needs to look finished. **Compose pages from these primitives; don't hand-roll styled `div`s.**
Live preview of every primitive: run the app and open `/design-system` ([DesignSystem.tsx](../DesignSystem.tsx)).

```tsx
import { PageHeader, Card, Button, ButtonLink, Field, Input } from './ui';
import { Plus } from 'lucide-react'; // icons: lucide-react only
```

## Rules

1. **Tokens only.** Use semantic colors from `tailwind.config.js`; raw palettes (`bg-blue-600`, `text-slate-500`, `bg-white`, …) fail `npm run lint`.
   | Token                                               | Use for                                            |
   | --------------------------------------------------- | -------------------------------------------------- |
   | `brand-50…900`                                      | primary actions, selection, links, accents         |
   | `ink` / `ink-muted` / `ink-subtle` / `ink-inverted` | primary / secondary / tertiary text, text on brand |
   | `canvas`                                            | page background (set globally)                     |
   | `surface` / `surface-muted` / `surface-sunken`      | cards / hover + tracks / placeholders              |
   | `line` / `line-strong`                              | dividers / control borders                         |
   | `success` `warning` `danger` (+ `-soft`)            | status foreground (+ tinted background)            |
   Shadows: `shadow-card`, `shadow-raised`, `shadow-overlay`, `shadow-brand`. Motion: `animate-fade-in`, `animate-rise-in`, `animate-pop-in`.
2. **Page skeleton.** Every route renders `<div className="space-y-6">` → `PageHeader` → content (`Card`, `ListGroup`, `Section`). The app shell adds max-width, padding, nav and page-enter animation.
3. **Every async view has three states:** `LoadingState`, `ErrorState`, `EmptyState` (with an icon and a CTA).
4. **Icons** come from `lucide-react`, sized by the parent primitive. Decorative icons get `aria-hidden="true"`; icon-only controls use `IconButton`/`IconButtonLink` (they require `label`).
5. **Selection state is exposed via ARIA** (`aria-pressed`, `aria-current`, native `checked`). Tests assert on those, never on color classes.
6. Override styles with `className` — it is merged with `cn()` (tailwind-merge), so later classes win.
7. New primitive? Add it under `src/ui/`, export it from `index.ts`, add it to `/design-system`, and list it below.

## Catalog

| Primitive                                    | Purpose                                               | Key props                                                                               |
| -------------------------------------------- | ----------------------------------------------------- | --------------------------------------------------------------------------------------- |
| `PageHeader`                                 | `h1` title, description, back link, actions           | `title`, `description`, `back={{to,label}}`, `actions`                                  |
| `BackLink`                                   | chevron + text link                                   | `to`                                                                                    |
| `Section`                                    | uppercase `h2` label above a block                    | `title`, `action`                                                                       |
| `Card`                                       | white rounded surface                                 | `padding: none·sm·md·lg`                                                                |
| `ListGroup` + `ListItem`                     | grouped rows with dividers and `›` chevron            | `to` _or_ `onClick`, `title`, `description`, `leading`, `trailing`                      |
| `ListItemIcon`                               | tinted square icon for `ListItem.leading`             | children: lucide icon                                                                   |
| `Avatar`                                     | round photo, initial fallback (not an `img`)          | `name`, `src`, `size: sm·md·lg·xl`                                                      |
| `Button`                                     | action                                                | `variant: primary·secondary·ghost·danger`, `size: sm·md·lg`, `block`, `icon`, `loading` |
| `ButtonLink`                                 | router link styled as button                          | same as `Button` + `to`                                                                 |
| `IconButton` / `IconButtonLink`              | icon-only control                                     | `label` (required), `icon`, `variant`, `size`                                           |
| `buttonStyles()`                             | button classes for other elements                     | `{ variant, size, block, className }`                                                   |
| `Badge`                                      | status/score pill                                     | `tone: neutral·brand·success·warning·danger`                                            |
| `Field`                                      | label + control + hint/error                          | `label`, `htmlFor`, `hint`, `error`                                                     |
| `Input` / `Textarea` / `Select`              | form controls                                         | native props                                                                            |
| `ImagePicker`                                | photo drop target with preview                        | `id`, `onFileChange`                                                                    |
| `ChoiceChip`                                 | checkbox/radio as a pill (native input kept)          | `type: checkbox·radio`, native input props                                              |
| `SegmentedControl`                           | exclusive toggle group (`aria-pressed`)               | `label`, `options`, `value`, `onChange`                                                 |
| `Modal`                                      | centered dialog; Escape/backdrop/close button dismiss | `open`, `onClose`, `title`, `description`, `footer`                                     |
| `Markdown` / `MarkdownEditor`                | sanitized render / editor for user markdown           | `source` / `value`, `onChange`                                                          |
| `EmptyState` / `ErrorState` / `LoadingState` | async states                                          | `icon`, `title`, `description`, `action` / `message` / `label`                          |
| `Spinner`                                    | inline progress                                       | `className`                                                                             |
| `cn()`                                       | class merge helper                                    | —                                                                                       |

## Recipes

```tsx
// List page
<div className="space-y-6">
  <PageHeader title="Trainings" actions={<IconButtonLink to="/trainings/new" label="Add training" icon={<Plus />} />} />
  <ListGroup>
    {items.map((t) => <ListItem key={t.id} to={`/trainings/${t.id}`} title={t.name} leading={<ListItemIcon><Target /></ListItemIcon>} />)}
  </ListGroup>
</div>

// Form page
<div className="space-y-6">
  <PageHeader title="Create Plan" back={{ to: '/plans', label: 'Back to plans' }} />
  <Card padding="lg">
    <form className="space-y-5" onSubmit={submit}>
      <Field label="Name" htmlFor="name"><Input id="name" required /></Field>
      <Button type="submit" size="lg" block loading={saving}>Save</Button>
    </form>
  </Card>
</div>
```
