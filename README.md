# ShiftSync — Sprint 03

A local-first Next.js / TypeScript planner for people working beyond the 9–5. Sprint 02's dashboard, navigation, Day / 3 Days / Week calendar, responsive editor and light/dark themes are preserved.

## Run

```bash
pnpm install --frozen-lockfile
pnpm test
pnpm typecheck
pnpm build
pnpm start
```

Open http://localhost:3000. `pnpm dev` is also available; environments with limited file watchers should use the production build.

## Recurring shifts

The editor offers Does not repeat, Every day, and Every week on selected weekdays. Repeat until is inclusive in the rule's IANA timezone; leave it blank for no end date. Times entered in the editor use the displayed rule timezone. The calendar displays actual events in the browser's local timezone.

A series stores a template, timezone, weekdays and optional end date. Actual UTC occurrences have deterministic `seriesId@YYYY-MM-DD` identifiers. They are expanded for the requested calendar interval, never persisted as hundreds of independent shifts. Overnight starts from the previous day and commutes at interval edges are included.

The Temporal polyfill is the only new runtime dependency (plus its transitive JSBI dependency), used for IANA and DST arithmetic. DST policy is explicit: nonexistent local times move forward; repeated times use the earlier offset. If a spring gap collapses a short interval, its nominal duration is preserved after the shifted start. Actual elapsed paid hours can vary with DST.

## Editing and deleting

Recurring occurrences offer three scopes:

- **This shift only**: a date-keyed UTC override or deletion exception. Moving a shift keeps its original recurrence identity.
- **This and following shifts**: close the original rule the day before the selected recurrence date and start a new series. Earlier occurrences and exceptions stay intact. A following edit cannot begin before that cut date. Later explicit overrides retain their dates/times; the selected override is replaced by the new template.
- **All shifts in the series**: change the template from the original series start, including history. The selected override is replaced; other explicit overrides/deletions remain unless excluded by a new end date. Use This shift only to move one date. Choosing Does not repeat with an all/following scope replaces that scope with one non-recurring shift.

Deletion requires confirmation. Scopes are based on the original recurrence date, even for a moved exception. A finished or fully cancelled finite series retains an editable rule entry in Shifts & series.

## Commutes

Before and after durations are independent whole minutes, 0–720 each. Teal dashed blocks with a car icon represent unpaid travel. They derive from the linked occurrence's current UTC start/end, can cross midnight and open that shift's editor when selected. Work/work, work/travel and travel/travel conflicts are checked; a shift's own travel is excluded from self-conflicts. Dashboard paid hours count only work.

## Data and backups

Schema v2 uses `shiftsync:v2:schedule` with separate `singles`, `series` and `exceptions` collections. The existing `shiftsync:v1:shifts` data and theme preference are retained.

On the first v2 load:

1. Validate the entire legacy payload and prospective v2 model.
2. Copy the **exact original JSON** into `shiftsync:backup:v1` (or a unique additional backup key), then verify that copy.
3. Write v2 only after backup verification. Never remove or rewrite v1.

This is an additive migration; there is no destructive migration. A backup/quota failure stops migration. Corrupt or unknown-version v2 data never falls back silently to stale v1. Invalid data is preserved; saving is disabled for the session and an explicit warning appears.

**Export JSON backup** downloads all ShiftSync storage entries, including raw invalid JSON and migration backups, plus the current in-memory schedule. Export before manual repair or any future destructive migration. This sprint provides export, not an import/recovery wizard. Keep the file private if it contains personal planning data.

A cross-tab storage change stops saving and asks for a reload; automatic multi-tab merging is not implemented. All data is browser/origin-specific. No backend or account has been added.

## Architecture

`src/lib/shifts.ts` retains the original interval validator and overlap predicate.

| Module under `src/lib/schedule/` | Responsibility |
| --- | --- |
| `types.ts` | Persisted records, rules, exceptions, calculated occurrences and calendar events |
| `time.ts` | IANA/local/UTC conversions |
| `recurrence.ts` | Rules, matching dates and template-to-occurrence calculation |
| `occurrences.ts` | Expansion for a requested period and next-occurrence lookup |
| `exceptions.ts` | Exception indexing, replacement and moved overrides |
| `mutations.ts` | Save/delete scopes and series splitting |
| `commute.ts` | Derived before/after events |
| `conflicts.ts` | Work and commute conflict detection |
| `persistence.ts` | Version validation, additive migration and backup export |
| `summary.ts` | Recurrence-aware dashboard and bounded list projection |

`useSchedule` manages persistence; `ShiftEditor` and `WeeklyCalendar` consume the business modules. Existing tests remain, with storage assertions adapted to v2.

## Practical limits

- Supported rules are daily and selected weekdays, not a general RRULE implementation.
- Shifts & series shows all single shifts, current-week recurring occurrences and each series' next occurrence; it does not render an infinite list.
- Next day off searches the next 366 local days and states explicitly when none is found. Commutes do not turn an otherwise work-free day into a paid workday.
- Live editor conflict warnings inspect the selected occurrence. Displayed occurrences are checked individually; there is no infinite-future conflict audit.
- Explicit overrides preserve their independent times when another occurrence changes the series. Series-wide edits include history by explicit choice.
- The grid still represents 24 wall-clock hours; repeated DST hours are not visually separated. Very short blocks expose full times and linked shift details in their tooltip/accessible label/editor.
- Planned hours sum work intervals independently; overlaps can count twice. Countdown is informational, not an alarm. Analytics and Settings remain placeholders.
