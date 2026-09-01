# Architecture decisions — Phase 1

## Classrooms

No dedicated `classrooms` table. Room values are stored as nullable text on schedule rows and exceptions.

## IDs

All domain entities use UUID text primary keys generated via `expo-crypto`.

## Week cycle

`cycle_anchor_date` defines week index 0. `getCycleWeekForDate()` computes parity from whole weeks since the anchor Monday, not ISO week numbers.

## Ads / analytics

Not integrated in Phase 1. Navigation and data layers remain independent from ad containers.
