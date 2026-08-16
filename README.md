# Cutter's Cubing - Architecture & Style Guide

## Overview
Cutter's Cubing is a modern, high-performance speedcubing timer application built with **Vite**, **React**, and **Tailwind CSS**. The design philosophy emphasizes a "No Zoom, No Scroll" main interface for the timer, while specialized pages offer rich data visualization, multiplayer features, and settings.

## Tech Stack
- **Framework**: React 19 (with Hooks)
- **Build Tool**: Vite
- **Language**: TypeScript
- **Styling**: Tailwind CSS v4 (configured via `@tailwindcss/vite`)
- **Backend / Database**: Firebase (Auth, Firestore, Realtime Database)
- **Hosting / Deployment**: Vercel
- **Icons**: `lucide-react`
- **Routing**: `react-router-dom`

## Project Structure

```
src/
├── assets/             # Static binary assets and design files
├── components/         # Modular UI components
│   ├── layout/         # Shell layout, navigation, and resizable sidebars (Layout, Topbar, LeftSidebar, RightSidebar, DataSidebar, FriendSidebar)
│   ├── ui/             # Reusable UI primitives (Tabs, Table, Toast, UserCard, ThemeProvider)
│   ├── account/        # Account & social tabs (CubingFriendsTab, ProfileStatsTab, SocialsTab)
│   └── index.ts        # Central component barrel export
├── contexts/           # React context providers (Auth, Session, Solves, Settings, Confirmation)
├── lib/                # External services & client configs (firebase.ts)
├── pages/              # Route views (Cube, Daily, Data, Account, About, Keybinds)
├── types/              # Central TypeScript domain interfaces (solve, auth, session, settings, liveTypes)
├── utils/              # Calculation, time formatting, and analysis helpers
├── index.css           # Global styles & CSS variable theme tokens
├── App.tsx             # Route declarations and context composition
└── main.tsx            # Application entry point
```

## Deployment with Vercel

The application is hosted on **Vercel** with Vite SPA rewrites configured in [`vercel.json`](file:///Users/christiancutter/Developer/cube-online/vercel.json).

### Build Configuration
- **Build Command**: `npm run build` (`tsc -b && vite build`)
- **Output Directory**: `dist`
- **Install Command**: `npm install`

### Environment Variables
Configure the following Firebase environment variables in your Vercel Project Settings:
- `VITE_FIREBASE_API_KEY`
- `VITE_FIREBASE_AUTH_DOMAIN`
- `VITE_FIREBASE_PROJECT_ID`
- `VITE_FIREBASE_STORAGE_BUCKET`
- `VITE_FIREBASE_MESSAGING_SENDER_ID`
- `VITE_FIREBASE_APP_ID`

Firebase rules and indexes continue to be maintained via `firestore.rules`, `firestore.indexes.json`, and `database.rules.json`.

## Styling System

We use a semantic CSS variable system integrated with Tailwind. This allows for seamless Light/Dark mode switching and easy theming.

### CSS Variables (`src/index.css`)
Semantic color tokens:
- `--bg-primary`: Main background
- `--bg-secondary`: Sidebar/Header background
- `--text-primary`: Main text color
- `--text-secondary`: Muted text color
- `--border-color`: Border color for dividers/inputs
- `--accent`: Brand accent color

### Layout Patterns
- **Full Screen**: The root `Layout` component is fixed height `h-screen` with `overflow-hidden` to prevent body scroll.
- **Scrollable Areas**: Individual panels (features pages) use `overflow-y-auto` to handle their own scrolling.
- **Sidebars**: `LeftSidebar` and `RightSidebar` are resizable flex items with persistent state.

## Routing
Routing is handled by `react-router-dom`. The `Layout` component serves as the parent route, rendering child pages via `<Outlet />`.
