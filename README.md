# Cutter's Cubing - Architecture & Style Guide

## Overview
Cutter's Cubing is a modern, high-performance speedcubing timer application built with **Vite**, **React**, and **Tailwind CSS**. The design philosophy emphasizes a "No Zoom, No Scroll" main interface for the timer, while specialized pages offer rich data visualization and settings.

## Tech Stack
- **Framework**: React 18+ (with Hooks)
- **Build Tool**: Vite
- **Language**: TypeScript
- **Styling**: Tailwind CSS v4 (configured via `@tailwindcss/vite`)
- **Icons**: `lucide-react`
- **Routing**: `react-router-dom`

## Project Structure

```
src/
├── components/         # Reusable UI components
│   ├── Layout.tsx      # Main application shell (Sidebar + Content + Resizable Panels)
│   ├── Topbar.tsx      # Application header
│   ├── LeftSidebar.tsx # Primary navigation
│   ├── RightSidebar.tsx# Secondary information panel
│   ├── Tabs.tsx        # Reusable Tabs component
│   └── Table.tsx       # Reusable Table component
├── pages/              # Route components
│   ├── Cube.tsx        # Home/Timer page
│   ├── Daily.tsx       # Daily challenges
│   ├── ...             # Other feature pages
├── index.css           # Global styles & CSS Variables
└── App.tsx             # Route definitions
```

## Styling System

We use a semantic CSS variable system integrated with Tailwind. This allows for seamless Light/Dark mode switching and easy theming.

### CSS Variables (`src/index.css`)
We define semantic colors rather than raw colors.
- `--bg-primary`: Main background (e.g., `#0d1117` in dark)
- `--bg-secondary`: Sidebar/Header background (e.g., `#161b22` in dark)
- `--text-primary`: Main text color
- `--text-secondary`: Muted text color
- `--border-color`: Border color for dividers/inputs
- `--accent`: Brand accent color

### Tailwind Integration
These variables are mapped to Tailwind classes in the `@theme` directive (or implicitly supported by Tailwind v4 via `var()`).
Example usage:
```tsx
<div className="bg-bg-primary text-text-primary border border-border">
  Content
</div>
```

### Layout Patterns
- **Full Screen**: The root `Layout` component is fixed height `h-screen` with `overflow-hidden` to prevent body scroll.
- **Scrollable Areas**: Individual panels (features pages) use `overflow-y-auto` to handle their own scrolling.
- **Sidebars**: `LeftSidebar` and `RightSidebar` are resizable flex items.

## Routing
Routing is handled by `react-router-dom`. The `Layout` component serves as the parent route, rendering child pages via `<Outlet />`.

## Adding New Features
1. **Create Page**: Add a new component in `src/pages/`.
2. **Add Route**: Import and add the `<Route>` to `src/App.tsx`.
3. **Add Navigation**: Add the link and icon to the `navItems` array in `src/components/LeftSidebar.tsx`.
