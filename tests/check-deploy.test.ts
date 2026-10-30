import { afterEach, describe, expect, it, vi } from "vitest";
import { checkDeploy } from "../scripts/check-deploy";

const SHA = "a675f49caafa3d67d4d7014a9fba0c298a160e09";
const fast = { timeoutMs: 50, intervalMs: 5 };

function stubFetch(...bodies: string[]) {
  const fetch = vi.fn(async () => new Response(bodies.length > 1 ? bodies.shift()! : bodies[0]));
  vi.stubGlobal("fetch", fetch);
  return fetch;
}

afterEach(() => vi.unstubAllGlobals());

describe("checkDeploy", () => {
  it("returns true on match", async () => {
    const fetch = stubFetch(`${SHA}\n`);
    expect(await checkDeploy("https://example.invalid/", SHA, fast)).toBe(true);
    expect(fetch).toHaveBeenCalledWith("https://example.invalid/version.txt", expect.anything());
  });

  it("returns false on mismatch", async () => {
    stubFetch("0000000000000000000000000000000000000000");
    expect(await checkDeploy("https://example.invalid", SHA, fast)).toBe(false);
  });

  it("keeps polling until the new version is live", async () => {
    const fetch = stubFetch("old", "old", SHA);
    expect(await checkDeploy("https://example.invalid", SHA, fast)).toBe(true);
    expect(fetch).toHaveBeenCalledTimes(3);
  });

  it("treats network errors as not yet live", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => { throw new Error("offline"); }));
    expect(await checkDeploy("https://example.invalid", SHA, fast)).toBe(false);
  });
});
