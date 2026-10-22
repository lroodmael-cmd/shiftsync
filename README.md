# ShiftSync — Sprint 04

A local-first Next.js / TypeScript planner for people working beyond the 9–5. The dashboard, Day / 3 Days / Week calendar, responsive editor, light/dark themes and Sprint 03 recurrence engine are preserved. Sprint 04 adds workplaces, locations and reusable commute defaults without adding dependencies.

## Run

```bash
pnpm install --frozen-lockfile
pnpm test
pnpm typecheck
pnpm build
pnpm start
```

Open http://localhost:3000. `pnpm dev` is also available; environments with limited file watchers should use the production build.

## Workplaces and locations

Open **Workplaces** in the navigation to create jobs with a name, color and icon. A single optional primary workplace prefills new shifts; it never changes an existing unassigned shift. Each workplace supports multiple locations with an optional address, IANA timezone, independent outbound/return minutes, inherited or custom color, and one active default location when available.

Select a workplace and location in the shift editor to copy their settings. The selected location's timezone governs the entered wall-clock times, while the calendar uses the browser timezone. A shift can also have no workplace or no location. Manual commute edits are marked custom. Selecting another location requires an explicit choice between its defaults and the custom values, including zero-minute custom values. Closing that choice cancels the location change.

Shift records and recurring templates reference stable IDs and retain a historical assignment snapshot (names, icon, workplace color, location timezone/address and copied defaults). The actual shift color and commute minutes are stored independently. Renaming, recoloring, editing travel settings or archiving a workplace/location does not rewrite saved shifts or templates. Updated defaults apply to new selections; existing future series also retain their original settings until explicitly edited using the existing scopes.

Referenced records can be archived and restored, but cannot be permanently deleted through the UI. The business layer also converts deletion of referenced records to archiving. An unused workplace can be deleted with its unused locations after confirmation. Archiving a default location selects another active location, or clears the default if none remain. Archived assignments stay readable on saved shifts and unavailable for new selection.

Workplace details show locations, default travel, associated shifts and a filtered-calendar shortcut. Calendar filters support All workplaces, No workplace and archived workplaces. They affect only the calendar display, never stored data, conflict checks or global dashboard statistics. Travel blocks retain their distinct color and linked shift behavior.

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

Schema v3 uses `shiftsync:v3:schedule` with separate `singles`, `series`, `exceptions`, `workplaces` and `locations` collections. Legacy `shiftsync:v2:schedule`, `shiftsync:v1:shifts` and theme preferences are retained.

On the first v3 load:

1. Validate the entire existing v2 (or v1) payload and prospective v3 model, including references and snapshots.
2. Copy the **exact original JSON** to `shiftsync:backup:v2` (or `shiftsync:backup:v1` for direct v1 upgrades). A different existing backup gets a unique additional key instead of being replaced.
3. Verify backup bytes, then write and verify v3. Never remove or rewrite the original key.

The additive v2 → v3 migration preserves singles, rules, exception dates/IDs and custom commutes unchanged; workplaces/locations start empty. Titles are never used to infer assignments. Backup, quota or verification failures stop migration. Corrupt or unknown-version v3 data never falls back silently to stale v2/v1. Invalid data remains available for export and saving is disabled for the session with an explicit warning.

**Export JSON backup** downloads all ShiftSync storage entries, including raw invalid JSON and migration backups, plus the current in-memory schedule. Export before manual repair or any future destructive migration. This sprint provides export, not an import/recovery wizard. Keep the file private if it contains personal planning data.

Changes to any schedule schema in another tab stop saving and ask for a reload. Each write also compares the current v3 bytes with the last observed value. Automatic multi-tab merging and atomic locking are not implemented; localStorage has no transactional compare-and-set. All data is browser/origin-specific. No backend or account has been added.

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

`src/lib/workplaces/types.ts` defines Workplace, WorkLocation, CommuteSettings, assignment snapshots and the v3 workspace. `operations.ts` owns validation, default selection, copied settings and archive/delete guards; `persistence.ts` owns v3 validation and additive migration. `src/components/workplaces/` contains visual forms and views, using shared contextual and confirmation panels. `useSchedule` manages persistence; `ShiftEditor` and `WeeklyCalendar` consume the business modules. Existing tests remain, with page storage assertions adapted to v3.

## Validation

Sprint 04: 93 passing tests across 9 files (the original 57 plus 36 additional cases), TypeScript and production build pass. No dependency or lockfile change. New cases cover workplaces/default locations, snapshots and custom zero-minute travel, referenced deletion/archiving, recurrence reassignment and future edits, travel conflicts, v2/v1 migrations, corrupt data, failed backup/write verification, UI filters and cross-tab protection. Browser checks and screenshots are documented in the accompanying Sprint 04 delivery report.

## Practical limits

- Data remains local to one browser/origin. There is no map lookup, route estimation, backend, account sync or financial functionality. JSON export exists; import/recovery is still manual.
- Supported rules are daily and selected weekdays, not a general RRULE implementation.
- Shifts & series shows all single shifts, current-week recurring occurrences and each series' next occurrence; it does not render an infinite list.
- Next day off searches the next 366 local days and states explicitly when none is found. Commutes do not turn an otherwise work-free day into a paid workday.
- Live editor conflict warnings inspect the selected occurrence. Displayed occurrences are checked individually; there is no infinite-future conflict audit.
- Explicit overrides preserve their independent times when another occurrence changes the series. Series-wide edits include history by explicit choice.
- The grid still represents 24 wall-clock hours; repeated DST hours are not visually separated. Very short blocks expose full times and linked shift details in their tooltip/accessible label/editor.
- Planned hours sum work intervals independently; overlaps can count twice. Countdown is informational, not an alarm. Analytics and Settings remain placeholders.
