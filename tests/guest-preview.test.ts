import { describe, expect, it } from "vitest";
import { createGuestWorkspace } from "../src/guestPreview";

function memoryStorage() {
  const values = new Map<string, string>();
  return {
    getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, value: string) => void values.set(key, value),
  };
}

describe("Guest Preview isolation", () => {
  it("uses isolated session storage and never shares state between guests", async () => {
    const firstStorage = memoryStorage();
    const secondStorage = memoryStorage();
    const first = createGuestWorkspace(firstStorage);
    const second = createGuestWorkspace(secondStorage);

    await first.execute("create_task", { title: "guest-only task" });
    expect(
      (await first.execute("load")).tasks.some(
        (task) => task.title === "guest-only task",
      ),
    ).toBe(true);
    expect(
      (await second.execute("load")).tasks.some(
        (task) => task.title === "guest-only task",
      ),
    ).toBe(false);

    const restored = createGuestWorkspace(firstStorage);
    expect(
      (await restored.execute("load")).tasks.some(
        (task) => task.title === "guest-only task",
      ),
    ).toBe(true);
  });

  it("requires the supplied sign-in handoff for Google connections", async () => {
    let calls = 0;
    const guest = createGuestWorkspace(memoryStorage(), async () => {
      calls += 1;
    });
    expect(guest.calendar.tokenAvailable).toBe(false);
    await guest.calendar.connect();
    expect(calls).toBe(1);
    await expect(
      guest.calendar.create(
        (await guest.execute("load")).tasks[0],
        "guest-calendar",
      ),
    ).rejects.toThrow(/核准/);
  });
});
