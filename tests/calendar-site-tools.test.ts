import { describe, expect, it } from "vitest";
import {
  normalizeStandaloneEvent,
  requestKey,
  standaloneEventBody,
} from "../supabase/functions/google-calendar/request";
import { alice, bob, database } from "./database";

describe("Calendar Site Tool input", () => {
  it("defaults to a 30 minute Asia/Taipei event and creates a stable key", async () => {
    const input = normalizeStandaloneEvent({
      title: " 放行作業 ",
      start_at: "2030-09-29T19:30:00+08:00",
    });
    expect(input).toMatchObject({
      title: "放行作業",
      start_at: "2030-09-29T11:30:00.000Z",
      end_at: "2030-09-29T12:00:00.000Z",
      timezone: "Asia/Taipei",
    });
    const first = await requestKey(alice, input);
    const second = await requestKey(alice, input);
    expect(first).toBe(second);
    expect(first).toHaveLength(64);
    expect(standaloneEventBody(input, first)).toMatchObject({
      start: { dateTime: input.start_at, timeZone: "Asia/Taipei" },
      end: { dateTime: input.end_at, timeZone: "Asia/Taipei" },
      extendedProperties: {
        private: { personalWorkStationRequestKey: first },
      },
    });
  });

  it("rejects offset-free, invalid-zone and reversed date times", () => {
    expect(() =>
      normalizeStandaloneEvent({
        title: "Invalid",
        start_at: "2030-09-29T19:30:00",
      }),
    ).toThrow("UTC offset");
    expect(() =>
      normalizeStandaloneEvent({
        title: "Invalid",
        start_at: "2030-09-29T19:30:00+08:00",
        timezone: "Mars/Taipei",
      }),
    ).toThrow("IANA");
    expect(() =>
      normalizeStandaloneEvent({
        title: "Invalid",
        start_at: "2030-09-29T19:30:00+08:00",
        end_at: "2030-09-29T19:00:00+08:00",
      }),
    ).toThrow("晚於開始時間");
  });
});

describe("Calendar credential and idempotency database boundary", () => {
  it("keeps credentials private, rejects an unapproved user and reuses a completed request", async () => {
    const { db, run } = await database();
    const status = await db.transaction(async (tx) => {
      await tx.query("select set_config('request.jwt.claim.sub',$1,true)", [
        alice,
      ]);
      await tx.exec("set local role authenticated");
      return tx.query<{ value: { available: boolean } }>(
        "select calendar_oauth_status() as value",
      );
    });
    expect(status.rows[0].value.available).toBe(false);

    await expect(
      db.transaction(async (tx) => {
        await tx.query("select set_config('request.jwt.claim.sub',$1,true)", [
          bob,
        ]);
        await tx.exec("set local role authenticated");
        await tx.query("select calendar_oauth_status()");
      }),
    ).rejects.toThrow("尚未獲准");

    await db.transaction(async (tx) => {
      await tx.query("select set_config('request.jwt.claim.role',$1,true)", [
        "service_role",
      ]);
      await tx.exec("set local role service_role");
      await tx.query(
        "select calendar_oauth_store($1,$2,now()+interval '1 hour',$3)",
        [alice, "encrypted-access", "encrypted-refresh"],
      );
    });

    const key = "a".repeat(64);
    const claim = async () =>
      db.transaction(async (tx) => {
        await tx.query("select set_config('request.jwt.claim.role',$1,true)", [
          "service_role",
        ]);
        await tx.exec("set local role service_role");
        return tx.query<{ value: { state: string; result?: unknown } }>(
          "select calendar_site_tool_claim($1,$2,$3::jsonb) as value",
          [alice, key, JSON.stringify({ title: "Release" })],
        );
      });
    expect((await claim()).rows[0].value.state).toBe("claimed");
    expect((await claim()).rows[0].value.state).toBe("pending");
    await db.transaction(async (tx) => {
      await tx.query("select set_config('request.jwt.claim.role',$1,true)", [
        "service_role",
      ]);
      await tx.exec("set local role service_role");
      await tx.query("select calendar_site_tool_complete($1,$2,$3::jsonb)", [
        alice,
        key,
        JSON.stringify({ event_id: "google-event" }),
      ]);
      await tx.query("select calendar_cache_event($1,$2::jsonb)", [
        alice,
        JSON.stringify({
          calendar: {
            id: "primary@test",
            summary: "個人行事曆",
            color: "#7895b2",
            time_zone: "Asia/Taipei",
            is_primary: true,
            selected: true,
          },
          event: {
            calendar_id: "primary@test",
            event_id: "google-event",
            title: "Release",
            start_at: "2030-09-29T11:30:00.000Z",
            end_at: "2030-09-29T12:00:00.000Z",
            start_date: null,
            end_date: null,
            all_day: false,
            html_link: "https://calendar.google.com/event?eid=google-event",
            status: "confirmed",
          },
        }),
      ]);
    });
    expect((await claim()).rows[0].value).toMatchObject({
      state: "succeeded",
      result: { event_id: "google-event" },
    });
    const snapshot = await run("load");
    expect(snapshot.google_events).toHaveLength(1);
    expect(snapshot.google_events[0].event_id).toBe("google-event");

    const tables = await db.query<{ table_name: string }>(
      "select table_name from information_schema.tables where table_schema='public' and table_name like '%oauth%'",
    );
    expect(tables.rows).toEqual([]);
  });
});
