# License Server Admin UI - Design Guidelines

## Design Approach
**System-Based Approach** - Modern SaaS admin interface inspired by Linear, Vercel, and Stripe's admin aesthetics. Focus on clarity, efficiency, and data readability for enterprise use.

## Core Design Principles
1. **Data First**: Prioritize information density and scannability
2. **Functional Clarity**: Every element serves a purpose
3. **Professional Restraint**: Clean, minimal, no unnecessary decoration
4. **Spatial Consistency**: Predictable layouts and spacing

---

## Typography System

**Font Families** (via Google Fonts CDN):
- Primary: `Inter` - All UI text, forms, tables
- Monospace: `JetBrains Mono` - License keys, technical data

**Type Scale**:
- Headings: text-2xl (page titles), text-xl (section headers), text-lg (card headers)
- Body: text-base (default), text-sm (table cells, secondary info)
- Small: text-xs (timestamps, metadata, helper text)
- Monospace: text-sm (license keys), text-xs (IDs)

**Weights**:
- Semibold (600): Page titles, primary headings
- Medium (500): Section headers, button labels, table headers
- Regular (400): Body text, form labels, table data

---

## Layout System

**Spacing Primitives**: Use Tailwind units of **4, 6, 8, 12** consistently
- Component padding: p-4, p-6
- Section spacing: space-y-6, space-y-8
- Page margins: p-6, p-8
- Container max-width: max-w-7xl

**Grid System**:
- Login page: Centered card, max-w-md
- Main layout: Sidebar (w-64) + Content area (flex-1)
- Dashboard: Single column with card-based sections
- Forms: Single column, max-w-2xl

---

## Component Library

### Navigation & Structure

**Sidebar Navigation**:
- Fixed left sidebar (w-64)
- Logo/branding at top
- Navigation items with icons (Heroicons - use CDN)
- Active state: subtle background, medium weight text
- Hover state: light background change

**Top Bar**:
- User info and logout button on right
- Page title on left
- Subtle border-bottom separator

### Login Page

**Layout**:
- Centered card on viewport (max-w-md)
- Logo/app name at top of card
- Form fields with proper spacing
- Primary CTA button (full width)
- Subtle background pattern or gradient

**Form Elements**:
- Labels above inputs (text-sm, medium weight)
- Input fields with border, rounded corners
- Focus state: ring effect
- Error states: red border + error message below

### Data Display

**Tables**:
- Full width with horizontal scroll on mobile
- Header row: medium weight, slightly darker text, border-bottom
- Data rows: regular weight, subtle hover background
- Alternating row backgrounds for readability
- Cell padding: px-6 py-4
- Status badges: rounded pill shapes with appropriate semantics
- Action buttons: text/icon buttons aligned right

**Status Badges**:
- ACTIVE: Green background, dark green text
- REVOKED: Red background, dark red text
- EXPIRED: Gray background, dark gray text
- Compact size: px-3 py-1, rounded-full, text-xs, medium weight

**Cards**:
- Border or subtle shadow (choose one, not both)
- Padding: p-6
- Rounded corners: rounded-lg
- Stack vertically with space-y-6

### Forms

**Input Fields**:
- Full width within form container
- Height: h-10 or h-12 for comfortable touch targets
- Border: 1px solid, rounded-md
- Padding: px-4
- Placeholder text: lighter color
- Focus: ring effect (ring-2)

**Checkboxes** (for module selection):
- Grid layout for multiple options (grid-cols-2)
- Each checkbox with label to the right
- Spacing: gap-4

**Date Picker**:
- Native input type="date" with consistent styling
- Or use a lightweight library (react-datepicker)

**Buttons**:
- Primary: Solid background, white text, px-6 py-2, rounded-md
- Secondary: Border + text, transparent bg, px-6 py-2, rounded-md
- Danger: Red variant for revoke actions
- Icon buttons: Square, p-2, icon only

### Detail Views

**License Detail Layout**:
- Two-column grid on desktop (grid-cols-1 lg:grid-cols-3)
- Left column (lg:col-span-2): License information card
- Right column: Quick actions card
- Below: Full-width audit log table

**Information Display**:
- Key-value pairs in dl/dt/dd structure
- Label: text-sm, medium weight, muted
- Value: text-base, regular weight
- License key: Monospace font, word-break, copy button

**Action Panel**:
- Sticky card on desktop
- Status badge at top
- Action buttons stacked vertically
- Clear visual hierarchy

### Audit Log / History

**Event List**:
- Timeline-style list or simple table
- Each event: timestamp, type, actor, message
- Most recent first
- Icon for event type (created, validated, status changed)
- Compact spacing: py-3

---

## Interactions & States

**Hover States**:
- Table rows: Very subtle background change
- Buttons: Slight darkening of background
- Links: Underline appears

**Loading States**:
- Skeleton loaders for tables (simple gray rectangles)
- Spinner for buttons (disable + spinner icon)

**Empty States**:
- Centered content with icon
- Message explaining state
- Primary action button if applicable

**Error States**:
- Form validation: Red border + text below field
- Toast notifications for API errors (top-right position)

---

## Icons

**Library**: Heroicons (via CDN) - outline style
- Navigation: home, document-text, key, chart-bar
- Actions: plus, pencil, trash, clipboard-copy
- Status: check-circle, x-circle, clock, exclamation-triangle
- UI: chevron-down, chevron-right, search, filter

---

## Responsive Behavior

**Breakpoints**:
- Mobile: Single column, hide sidebar (hamburger menu)
- Tablet (md:): Show sidebar, adjust table columns
- Desktop (lg:): Full layout with all features

**Mobile Adaptations**:
- Sidebar becomes overlay/drawer
- Tables scroll horizontally
- Forms remain single column
- Reduce padding: p-4 instead of p-6

---

## Accessibility

- All interactive elements keyboard accessible
- Form labels properly associated
- ARIA labels for icon-only buttons
- Color contrast ratios meet WCAG AA
- Focus indicators visible and clear
- Table headers properly marked up

---

**No Images Required** - This is a functional admin interface. Use icons and typography for visual interest.