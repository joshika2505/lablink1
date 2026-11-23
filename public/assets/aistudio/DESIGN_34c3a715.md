---
name: LabLink
colors:
  surface: '#fef9ee'
  surface-dim: '#dedacf'
  surface-bright: '#fef9ee'
  surface-container-lowest: '#ffffff'
  surface-container-low: '#f8f3e8'
  surface-container: '#f2ede2'
  surface-container-high: '#ede8dd'
  surface-container-highest: '#e7e2d7'
  on-surface: '#1d1c15'
  on-surface-variant: '#3f4945'
  inverse-surface: '#323029'
  inverse-on-surface: '#f5f0e5'
  outline: '#707975'
  outline-variant: '#bfc9c4'
  surface-tint: '#29695a'
  primary: '#29695a'
  on-primary: '#ffffff'
  primary-container: '#a8e8d5'
  on-primary-container: '#2b6a5b'
  inverse-primary: '#94d3c1'
  secondary: '#2f6579'
  on-secondary: '#ffffff'
  secondary-container: '#b0e4fd'
  on-secondary-container: '#32677c'
  tertiary: '#82505d'
  on-tertiary: '#ffffff'
  tertiary-container: '#ffcfd9'
  on-tertiary-container: '#84515e'
  error: '#ba1a1a'
  on-error: '#ffffff'
  error-container: '#ffdad6'
  on-error-container: '#93000a'
  primary-fixed: '#afefdc'
  primary-fixed-dim: '#94d3c1'
  on-primary-fixed: '#002019'
  on-primary-fixed-variant: '#075043'
  secondary-fixed: '#bce9ff'
  secondary-fixed-dim: '#9acee6'
  on-secondary-fixed: '#001f29'
  on-secondary-fixed-variant: '#114d61'
  tertiary-fixed: '#ffd9e0'
  tertiary-fixed-dim: '#f5b5c4'
  on-tertiary-fixed: '#340e1b'
  on-tertiary-fixed-variant: '#673946'
  background: '#fef9ee'
  on-background: '#1d1c15'
  surface-variant: '#e7e2d7'
typography:
  display-lg:
    fontFamily: Plus Jakarta Sans
    fontSize: 40px
    fontWeight: '700'
    lineHeight: 48px
    letterSpacing: -0.02em
  display-lg-mobile:
    fontFamily: Plus Jakarta Sans
    fontSize: 30px
    fontWeight: '700'
    lineHeight: 38px
    letterSpacing: -0.02em
  headline-lg:
    fontFamily: Plus Jakarta Sans
    fontSize: 32px
    fontWeight: '700'
    lineHeight: 40px
    letterSpacing: -0.015em
  headline-lg-mobile:
    fontFamily: Plus Jakarta Sans
    fontSize: 24px
    fontWeight: '700'
    lineHeight: 32px
    letterSpacing: -0.015em
  headline-md:
    fontFamily: Plus Jakarta Sans
    fontSize: 24px
    fontWeight: '600'
    lineHeight: 32px
    letterSpacing: -0.01em
  headline-sm:
    fontFamily: Plus Jakarta Sans
    fontSize: 20px
    fontWeight: '600'
    lineHeight: 28px
    letterSpacing: -0.005em
  title-md:
    fontFamily: Plus Jakarta Sans
    fontSize: 18px
    fontWeight: '600'
    lineHeight: 26px
  body-lg:
    fontFamily: Inter
    fontSize: 16px
    fontWeight: '400'
    lineHeight: 24px
  body-md:
    fontFamily: Inter
    fontSize: 14px
    fontWeight: '400'
    lineHeight: 20px
  body-sm:
    fontFamily: Inter
    fontSize: 12px
    fontWeight: '400'
    lineHeight: 18px
  label-lg:
    fontFamily: Inter
    fontSize: 14px
    fontWeight: '600'
    lineHeight: 20px
    letterSpacing: 0.01em
  label-md:
    fontFamily: Inter
    fontSize: 12px
    fontWeight: '600'
    lineHeight: 16px
    letterSpacing: 0.02em
  label-sm:
    fontFamily: Inter
    fontSize: 11px
    fontWeight: '600'
    lineHeight: 14px
    letterSpacing: 0.03em
rounded:
  sm: 0.5rem
  DEFAULT: 1rem
  md: 1.5rem
  lg: 2rem
  xl: 3rem
  full: 9999px
spacing:
  gutter: 1.5rem
  margin: 2rem
  space-xs: 0.25rem
  space-sm: 0.5rem
  space-md: 1rem
  space-lg: 1.5rem
  space-xl: 2.5rem
---

## Brand & Style

This design system powers LabLink, an AI-powered campus laboratory resource-sharing platform designed for university researchers, lab managers, and students. It bridges the gap between rigorous academic utility and approachable, human-centered software.

- **Brand Personality:** Welcoming, organized, tactile, modern, and trustworthy. It avoids clinical coldness without slipping into childishness, balancing playful pastel accents with crisp, high-contrast typography.
- **Target Audience:** University faculty, graduate researchers, lab technicians, and undergraduate students coordinating shared instruments, reagents, and bench space.
- **Emotional Response:** Calm confidence and effortless clarity. Users should feel that booking a spectrometer or managing shared lab inventory is frictionless, transparent, and pleasant.
- **Design Style:** **Tactile Claymorphism** paired with **Modern Minimalism**. Surfaces are softly extruded from a warm cream canvas using dual-layered outer and inner shadows, creating a "squishy" yet structured physicality. Generous whitespace and disciplined alignment keep the interface professionally organized.

## Colors

The palette pairs a warm, paper-like cream canvas with soft, desaturated pastels and deep slate-navy typography to ensure high contrast and effortless readability.

- **Canvas & Surfaces:**
  - **Warm Cream (`#F7F2E7`):** The primary application background, reducing eye strain compared to stark white.
  - **Pure White (`#FFFFFF`):** Used for elevated claymorphic cards, floating navigation pills, and active input fields.
- **Brand & Accent Pastels:**
  - **Primary Mint (`#A8E8D5`):** Primary actions, active states, confirmed bookings, and AI assistant highlights.
  - **Sky Blue (`#A9DDF5`):** Secondary actions, informational badges, and equipment availability indicators.
  - **Pastel Pink (`#F5B5C4`):** Tertiary accents, urgent alerts, maintenance notices, and high-priority tags.
  - **Butter Yellow (`#F8DE91`):** Pending approvals, caution states, and calendar highlights.
  - **Lavender (`#D9C8F2`):** AI-generated recommendations, smart scheduling tags, and research group labels.
- **Typography & Ink:**
  - **Primary Text (`#263044`):** Deep slate-navy for headlines, body copy, and primary icons, maintaining strong WCAG AA+ contrast against both cream and pastel surfaces.
  - **Secondary Text (`#707783`):** Muted slate for metadata, timestamps, helper text, and inactive labels.

## Typography

The typographic pairing balances geometric warmth with utilitarian precision.

- **Headlines (`Plus Jakarta Sans`):** Used for page titles, section headers, modal titles, and card headings. Its soft, rounded terminals echo the claymorphic surface language while maintaining crisp editorial structure.
- **Body & Labels (`Inter`):** Used for all dense laboratory data, equipment specifications, schedules, form inputs, and navigation labels. Its tall x-height and open counters ensure legibility at small sizes.
- **Responsive Scaling:** Display and large headline styles step down on mobile viewports (`display-lg-mobile`, `headline-lg-mobile`) to prevent awkward wrapping on narrow screens while preserving hierarchy.

## Layout & Spacing

This design system uses a **12-column fluid grid** with generous breathing room so claymorphic shadows never feel cramped or muddy.

- **Grid & Margins:**
  - **Desktop (`>= 1024px`):** 12-column fluid grid with `1.5rem` (24px) gutters and `2rem` (32px) outer canvas margins. Primary content maxes out at `1360px` centered.
  - **Tablet (`768px - 1023px`):** 8-column fluid grid with `1.25rem` (20px) gutters and `1.5rem` (24px) margins. Multi-column equipment grids reflow from 3–4 columns to 2 columns.
  - **Mobile (`< 768px`):** 4-column fluid grid with `1rem` (16px) gutters and `1rem` (16px) margins. Cards stack vertically in a single column, and floating navigation shifts to a bottom pill bar.
- **Spacing Rhythm:** Built on a `0.25rem` (4px) base unit. Card internal padding defaults to `space-lg` (`1.5rem`), while vertical section separation uses `space-xl` (`2.5rem`) to let each raised surface breathe.

## Elevation & Depth

Visual hierarchy is achieved through **soft, layered claymorphic shadows** rather than harsh drop shadows or heavy borders. Every elevated element appears gently inflated from the `#F7F2E7` canvas.

- **Extruded Clay Surfaces (Cards & Floating Pills):** Combine a wide, low-opacity ambient outer shadow (`0 12px 28px -6px rgba(38, 48, 68, 0.08)`) with a subtle crisp highlight (`inset 0 2px 4px rgba(255, 255, 255, 0.85)`) and a soft bottom-edge inner shadow (`inset 0 -4px 8px rgba(38, 48, 68, 0.04)`).
- **Interactive Tactile Press:** When a button or interactive card is pressed, the outer shadow contracts (`0 4px 10px -2px rgba(38, 48, 68, 0.06)`) and the inner shadow deepens slightly, simulating physical compression.
- **Recessed Surfaces (Inputs & Wells):** Search fields and calendar day wells invert the depth model, using subtle inner shadows (`inset 0 2px 6px rgba(38, 48, 68, 0.06)`) against a `#FFFFFF` or `#F7F2E7` surface to feel carved into the canvas.

## Shapes

The shape language is **Pill-shaped (`3`)**, defined by generous, friendly radii that eliminate sharp corners across the entire interface.

- **Base Radius (`1rem` / 16px):** Applied to compact elements such as calendar day cells, small thumbnails, and nested list items.
- **Large Radius (`2rem` / 32px):** Applied to primary claymorphic cards, modal dialogs, and calendar widget containers (`rounded-lg`).
- **Extra-Large / Full Pill (`3rem` / 48px or `9999px`):** Applied to buttons, floating navigation bars, search inputs, and category chips (`rounded-xl`), reinforcing the soft, tactile clay aesthetic.

## Components

All components combine pill-shaped geometry, high-contrast `#263044` typography, and tactile claymorphic depth.

- **Buttons:**
  - *Primary:* Full pill (`9999px`), `#A8E8D5` mint fill, `#263044` `label-lg` text, soft extruded clay shadow, and tactile press compression on `:active`.
  - *Secondary:* Full pill, `#FFFFFF` fill with `#A9DDF5` or `#263044` subtle tint on hover, maintaining the same claymorphic shadow.
  - *Ghost / Icon:* Circular or pill-shaped with transparent resting state and soft `#F7F2E7` / `#FFFFFF` clay hover state.
- **Cards:**
  - Pure `#FFFFFF` surface with `2rem` (`rounded-lg`) corners, `space-lg` (`1.5rem`) internal padding, and full extruded claymorphic shadows. Optional pastel top-accent bars or corner badges indicate equipment status.
- **Floating Navigation Pills:**
  - Detached from screen edges with `space-md` (`1rem`) margin, `#FFFFFF` translucent-feel clay surface, `9999px` pill radius, and `#A8E8D5` active tab indicator pill.
- **Input & Search Fields:**
  - Full pill (`9999px`) with recessed inner shadow, `#FFFFFF` background, `#707783` placeholder text, and `#A8E8D5` soft focus ring.
- **Chips & Category Labels:**
  - Soft pastel pills (`#A8E8D5`, `#A9DDF5`, `#F5B5C4`, `#F8DE91`, `#D9C8F2`) with `#263044` `label-md` text and subtle inner highlight. Used for lab categories (e.g., *Wet Lab*, *Imaging*, *AI Suggested*).
- **Pastel Calendar Widgets:**
  - Contained in a `2rem` rounded `#FFFFFF` clay card. Selected dates use `#A8E8D5` mint pills, range spans use `#A9DDF5` sky blue, and pending reservations use `#F8DE91` butter yellow.
- **Lists, Checkboxes & Radio Buttons:**
  - Lists use generous `space-md` row spacing with subtle `#F7F2E7` hover pills. Checkboxes (`0.5rem` radius) and radio buttons (circular) feature recessed wells when unchecked and `#A8E8D5` extruded clay fills with crisp `#263044` checkmarks when active.