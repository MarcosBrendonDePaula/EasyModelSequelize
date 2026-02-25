# Routing (React Router v7)

FluxStack uses **React Router v7** via the `react-router` package for web routing.

## Where It Lives

- Router provider: `app/client/src/main.tsx`
- Routes and pages: `app/client/src/App.tsx`
- Pages: `app/client/src/pages/*`
- Shared layout: `app/client/src/components/AppLayout.tsx`

## Why `react-router` (not `react-router-dom`)

In v7, the React Router team recommends using the core `react-router` package
directly for web apps. The `react-router-dom` package remains as a compatibility
re-export for older apps, but new projects should import from `react-router`.

## Example: Adding a New Route

1. Create a page in `app/client/src/pages/MyPage.tsx`
2. Add a route in `app/client/src/App.tsx`:

```tsx
import { MyPage } from './pages/MyPage'

<Route path="/my-page" element={<MyPage />} />
```

3. Add a nav link in `app/client/src/components/AppLayout.tsx`

## Current Demo Routes

- `/` Home
- `/counter` Live Counter
- `/form` Live Form
- `/upload` Live Upload
- `/chat` Live Chat
- `/api-test` Eden Treaty API Test

