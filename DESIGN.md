# Credentials — Design direction

## Product surface

A personal credential ledger. It records title, issuer, year, state and a local record code; it does not
independently verify credentials.

## System (2026-11-19)

The site uses the shared **App shell** (see `APP-SHELL.md`): `app/app-shell.css` and
`components/app-shell.tsx` are copied byte for byte from the sibling list apps. All colours come from the
shell's `--as-*` tokens (light and dark); state pills use the shell tones (Verified green, In progress amber,
Expired grey) with the state written as text, never colour alone. The only site CSS in `app/globals.css`
lays out the three row actions and adds forced-colours edges.

- Font: Geist via `next/font`, variable on `<html>`.
- Layout: lists by state in the sidebar (a row of pills on phones), the list on the right, the composer opens
  in place from **New record** at the top, so adding a record never needs a long scroll.
- Rows: title, issuer and year, the record code, then Mark verified / Copy / Remove as 44px text buttons.
  Remove is undoable for six seconds (toast with Undo, Escape closes it).
- Empty states differ for "nothing matches" (Clear search), "nothing in this state" (Show all records) and
  "the ledger is empty".
- Floor: text ≥ 12px, controls ≥ 44px, 3px focus ring, 4.5:1 text contrast, forced colours, no horizontal
  scroll at 320px, footer link back to https://bookchaowalit.com/.

## Honesty constraints

"Verified" means the owner's local record state only. No issuer API or external validation is represented.
