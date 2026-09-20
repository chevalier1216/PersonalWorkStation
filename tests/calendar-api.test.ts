import { describe, expect, it } from "vitest";
import { normalizeGoogleEvent, taskEventBody } from "../src/api";
import type { Task } from "../src/domain";

const task = (patch: Partial<Task> = {}): Task => ({
  id: "00000000-0000-4000-8000-000000000099",
  column_id: "00000000-0000-4000-8000-000000000098",
  title: "Calendar task",
  description: "Keep the task when Google fails",
  priority: "Regular",
  due_at: null,
  start_date: null,
  estimated_minutes: null,
  deliverable_type: null,
  deliverable_value: null,
  recurrence_type: null,
  recurrence_interval: null,
  recurrence_unit: null,
  recurrence_source_id: null,
  position: 0,
  completed_at: null,
  created_at: "2026-09-20T00:00:00Z",
  ...patch,
});

describe("Google Calendar mapping", () => {
  it("creates timed events from due_at and respects the estimate", () => {
    const body = taskEventBody(
      task({ due_at: "2026-09-21T02:00:00.000Z", estimated_minutes: 45 }),
    );
    expect(body).toMatchObject({
      start: { dateTime: "2026-09-21T02:00:00.000Z" },
      end: { dateTime: "2026-09-21T02:45:00.000Z" },
      extendedProperties: {
        private: { personalWorkStationTaskId: "00000000-0000-4000-8000-000000000099" },
      },
    });
  });

  it("creates all-day events from start_date with an exclusive end date", () => {
    expect(taskEventBody(task({ start_date: "2026-09-21" }))).toMatchObject({
      start: { date: "2026-09-21" },
      end: { date: "2026-09-22" },
    });
  });

  it("normalizes timed and all-day Google events", () => {
    expect(
      normalizeGoogleEvent("primary", {
        id: "timed",
        summary: "Review",
        start: { dateTime: "2026-09-21T02:00:00Z" },
        end: { dateTime: "2026-09-21T02:30:00Z" },
      }),
    ).toMatchObject({ event_id: "timed", all_day: false, start_date: null });
    expect(
      normalizeGoogleEvent("primary", {
        id: "all-day",
        start: { date: "2026-09-22" },
        end: { date: "2026-09-23" },
      }),
    ).toMatchObject({ event_id: "all-day", all_day: true, title: "(無標題)" });
  });
});
