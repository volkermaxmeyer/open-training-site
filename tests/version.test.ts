import { describe, expect, it } from "vitest";
import { addChangelogEntry, formatVersion, hasChangelogEntry, nextVersion, parseVersionFile, versionSteps } from "../scripts/lib/version";

describe("version", () => {
  it("counts in steps of 0.001", () => {
    expect(versionSteps("1.000")).toBe(1000);
    expect(formatVersion(1001)).toBe("1.001");
    expect(formatVersion(2000)).toBe("2.000");
    expect(versionSteps("1.0")).toBeNull();
    expect(versionSteps(1)).toBeNull();
  });

  it("starts at 1.000 and adds one to the live version", () => {
    expect(nextVersion(null, null)).toBe("1.000");
    expect(nextVersion("1.000", null)).toBe("1.000");
    expect(nextVersion("1.000", "1.000")).toBe("1.001");
    expect(nextVersion("1.999", "1.999")).toBe("2.000");
  });

  it("keeps a local version that is already ahead (set by hand or not yet pushed)", () => {
    expect(nextVersion("2.000", "1.004")).toBe("2.000");
    expect(nextVersion("1.005", "1.004")).toBe("1.005");
  });

  it("reads the version file", () => {
    expect(parseVersionFile('{"version":"1.000"}')).toBe("1.000");
    expect(parseVersionFile('{"version":"x"}')).toBeNull();
    expect(parseVersionFile("nope")).toBeNull();
  });

  it("writes one changelog line per version, newest first", () => {
    const base = "# Changelog\n\nIntro.\n\n- 1.000 · 2026-11-04 · First.\n";
    const next = addChangelogEntry(base, "1.001", "Second.", "2026-11-05");
    expect(next).toBe("# Changelog\n\nIntro.\n\n- 1.001 · 2026-11-05 · Second.\n- 1.000 · 2026-11-04 · First.\n");
    expect(addChangelogEntry(next, "1.001", "Again.", "2026-11-06")).toBe(next);
    expect(addChangelogEntry("# Changelog\n", "1.000", "First.", "2026-11-04")).toBe("# Changelog\n\n- 1.000 · 2026-11-04 · First.\n");
    expect(hasChangelogEntry(next, "1.001")).toBe(true);
    expect(hasChangelogEntry(next, "1.00")).toBe(false);
  });
});
