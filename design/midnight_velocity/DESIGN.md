---
name: Midnight Velocity
colors:
  surface: '#131313'
  surface-dim: '#131313'
  surface-bright: '#3a3939'
  surface-container-lowest: '#0e0e0e'
  surface-container-low: '#1c1b1b'
  surface-container: '#201f1f'
  surface-container-high: '#2a2a2a'
  surface-container-highest: '#353534'
  on-surface: '#e5e2e1'
  on-surface-variant: '#bccbb9'
  inverse-surface: '#e5e2e1'
  inverse-on-surface: '#313030'
  outline: '#869585'
  outline-variant: '#3d4a3d'
  surface-tint: '#4ae176'
  primary: '#4be277'
  on-primary: '#003915'
  primary-container: '#22c55e'
  on-primary-container: '#004b1e'
  inverse-primary: '#006e2f'
  secondary: '#79db8d'
  on-secondary: '#003916'
  secondary-container: '#007635'
  on-secondary-container: '#97faa8'
  tertiary: '#c9c6c6'
  on-tertiary: '#303030'
  tertiary-container: '#adabab'
  on-tertiary-container: '#40403f'
  error: '#ffb4ab'
  on-error: '#690005'
  error-container: '#93000a'
  on-error-container: '#ffdad6'
  primary-fixed: '#6bff8f'
  primary-fixed-dim: '#4ae176'
  on-primary-fixed: '#002109'
  on-primary-fixed-variant: '#005321'
  secondary-fixed: '#95f8a7'
  secondary-fixed-dim: '#79db8d'
  on-secondary-fixed: '#00210a'
  on-secondary-fixed-variant: '#005323'
  tertiary-fixed: '#e4e2e1'
  tertiary-fixed-dim: '#c8c6c5'
  on-tertiary-fixed: '#1b1c1c'
  on-tertiary-fixed-variant: '#474746'
  background: '#131313'
  on-background: '#e5e2e1'
  surface-variant: '#353534'
typography:
  h1:
    fontFamily: Inter
    fontSize: 36px
    fontWeight: '700'
    lineHeight: '1.2'
    letterSpacing: -0.02em
  h2:
    fontFamily: Inter
    fontSize: 24px
    fontWeight: '600'
    lineHeight: '1.3'
    letterSpacing: -0.01em
  h3:
    fontFamily: Inter
    fontSize: 20px
    fontWeight: '600'
    lineHeight: '1.4'
    letterSpacing: 0em
  body-default:
    fontFamily: Inter
    fontSize: 14px
    fontWeight: '400'
    lineHeight: '1.6'
    letterSpacing: 0em
  body-sm:
    fontFamily: Inter
    fontSize: 12px
    fontWeight: '400'
    lineHeight: '1.5'
    letterSpacing: 0.01em
  label-caps:
    fontFamily: Inter
    fontSize: 11px
    fontWeight: '700'
    lineHeight: '1'
    letterSpacing: 0.05em
rounded:
  sm: 0.25rem
  DEFAULT: 0.5rem
  md: 0.75rem
  lg: 1rem
  xl: 1.5rem
  full: 9999px
spacing:
  unit: 4px
  xs: 4px
  sm: 8px
  md: 16px
  lg: 24px
  xl: 40px
  gutter: 20px
  margin: 32px
---

## Brand & Style

The brand personality for this design system is "Elite Precision." It targets high-net-worth individuals and serious investors who value speed, clarity, and an "exclusive club" aesthetic. The UI should evoke a sense of controlled power and financial mastery.

The design style is a hybrid of **Minimalism** and **Tactile Dark Mode**. It utilizes deep blacks to create infinite depth, punctuated by vibrant, high-energy greens that signal growth and action. The interface relies on high contrast and "glowing" interactive states to guide the user's eye, creating a digital environment that feels both expensive and highly functional.

## Colors

This design system utilizes a tiered monochromatic dark palette to establish hierarchy. The **Sport Green** primary color is reserved for high-signal actions and growth indicators. 

The background hierarchy follows a "closer to the user, lighter the shade" logic:
- **Base Layer:** #0a0a0a for the main application canvas.
- **Surface Layer:** #171717 for persistent navigation elements and primary cards.
- **Interactive Layer:** #262626 for input fields and nested UI elements.

Text contrast is strictly maintained with pure white for headings and dimmed greys for secondary metadata to ensure the "expensive" feel isn't compromised by visual clutter.

## Typography

This design system exclusively uses **Inter** to maintain a systematic, utilitarian aesthetic that mirrors modern financial terminals. 

Hierarchy is established through weight and scale rather than color. Large, bold headings (H1) are used for portfolio totals and section headers, while secondary information uses a refined 14px body size. For data-heavy tables, use the `label-caps` style to differentiate column headers from the actual data points.

## Layout & Spacing

The layout follows a **Fixed Grid** philosophy for desktop (12-column, 1200px max-width) and a fluid 4-column structure for mobile. A strict 4px base unit governs all spacing decisions to ensure mathematical harmony.

Cards and containers should utilize `lg` (24px) internal padding to maintain the "premium" sense of space. Elements should be grouped using `sm` (8px) spacing, while distinct sections are separated by `xl` (40px) to allow the design to breathe against the dark background.

## Elevation & Depth

Depth is achieved through **Tonal Layering** and **Luminescent Hover States** rather than traditional drop shadows.

1.  **Resting State:** Elements sit flat on their respective backgrounds (#171717 on #0a0a0a) with a subtle 1px border of #262626 to define edges.
2.  **Hover State:** When a user interacts with a card or button, it triggers a green glow: `box-shadow: 0 0 15px rgba(34, 197, 194, 0.4)`. This creates a "neon-on-glass" effect.
3.  **Active State:** Elements may scale slightly (1.02x) to provide tactile feedback, emphasizing the premium, responsive nature of the interface.

## Shapes

The shape language is sophisticated and modern, utilizing **Rounded** corners to soften the high-contrast dark mode. 

Buttons and input fields use a consistent 8px radius to feel precise. Larger containers like portfolio summaries or asset breakdowns use a more generous 12px or 16px radius. This differentiation helps users distinguish between interactive "tools" (sharper) and informational "containers" (softer).

## Components

### Buttons
Primary buttons use the Sport Green background with black text for maximum contrast. Secondary buttons use a #262626 background with white text. All buttons feature the signature green glow on hover.

### Cards
Cards are the primary organizational unit. They must use the #171717 background. For high-priority data (like a "Total Balance" card), a 1px gradient border from #22c55e to transparent can be applied to signify importance.

### Inputs
Input fields use the #262626 background. The focus state should transition the border color to Sport Green and apply a subtle inner glow.

### Icons
Use thin, line-style icons (1.5px stroke). Icons should be monochromatic (Grey #a3a3a3) in resting states and switch to Sport Green #22c55e when the parent element is active or hovered.

### Investment-Specific Components
- **Trend Sparklines:** Use Sport Green for positive growth and Error Red for loss.
- **Asset Tags:** Small chips with 14px height, using a 10% opacity version of the primary color as a background for a glass-like effect.
- **Portfolio Progress Bars:** 4px height tracks with rounded ends, using Sport Green as the fill color against a #262626 track.