import { describe, expect, it } from "vitest";
import { formatVersion, nextVersion, parseVersionFile, versionSteps } from "../scripts/lib/version";

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
});
