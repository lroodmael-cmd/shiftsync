# ShiftSync — Sprint 01

A local-first Next.js starter for managing shifts across midnight.

## Run

```bash
npm install
npm run dev
```

Open http://localhost:3000. Run tests with `npm test`.

## Features
- Responsive light/dark UI
- Create, edit, delete shifts
- Shifts crossing midnight
- Overlap warnings
- Browser localStorage persistence
- UTC timestamps for storage and local time for display

## Next steps
1. Add weekly/day timeline and shift duration summaries.
2. Add recurring shift templates and exceptions.
3. Introduce Supabase authentication, migrations, and row-level security.

**Note:** localStorage is browser-specific and not a secure multi-device sync solution. The prototype uses browser-local datetime inputs; when multi-timezone scheduling is added, store each employment's IANA timezone explicitly. The demo uses local times for display and UTC instants for calculations.
