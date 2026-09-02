# Architecture decisions — Phase 1

## Classrooms

No dedicated `classrooms` table. Room values are stored as nullable text on schedule rows and exceptions.

## IDs

All domain entities use UUID text primary keys generated via `expo-crypto`.

## Week cycle

`cycle_anchor_date` defines week index 0. `getCycleWeekForDate()` computes parity from whole weeks since the anchor Monday, not ISO week numbers.
The stored anchor may be any date in the academic anchor week; the engine normalizes it to Monday. `first_day_of_week` is presentation-only and must not affect academic cycle parity.

## Assignment photos

Photo imports must be copied into managed app storage before persisting `local_uri`. External content URIs are not durable and must not be relied on for ZIP backups.

## Ads / analytics

Not integrated in Phase 1. Navigation and data layers remain independent from ad containers.
