import { createHash } from "node:crypto";
import { mkdirSync, mkdtempSync, readFileSync, readdirSync, writeFileSync, existsSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { beforeEach, describe, expect, it } from "vitest";
import { execFileSync } from "node:child_process";
import { commitContent, publish } from "../scripts/publish";

const vaultDir = join(__dirname, "fixtures/vault");
let root: string;
let outDir: string;
const opts = (extra = {}) => ({ vaultDir, outDir, repoRoot: root, dryRun: false, ...extra });
const manifest = () => JSON.parse(readFileSync(join(outDir, ".manifest.json"), "utf8"));

beforeEach(() => {
  root = mkdtempSync(join(tmpdir(), "pub-"));
  outDir = join(root, "src/content");
});

describe("publish", () => {
  it("writes one JSON per publish:true session", async () => {
    const r = await publish(opts());
    expect(r.written).toEqual(["src/content/sessions/published-session.json"]);
    expect(readdirSync(join(outDir, "sessions"))).toEqual(["published-session.json"]);
  });

  it("removes JSON of unpublished session", async () => {
    mkdirSync(join(outDir, "sessions"), { recursive: true });
    writeFileSync(join(outDir, "sessions/old.json"), "{}\n");
    const h = createHash("sha256").update("{}\n").digest("hex");
    writeFileSync(
      join(outDir, ".manifest.json"),
      JSON.stringify({ files: { "src/content/sessions/old.json": h }, slugsEverPublished: ["old"] }),
    );
    writeFileSync(join(outDir, "sessions/untracked.json"), "{}\n");
    const r = await publish(opts());
    expect(r.removed).toEqual(["src/content/sessions/old.json"]);
    expect(existsSync(join(outDir, "sessions/old.json"))).toBe(false);
    expect(existsSync(join(outDir, "sessions/untracked.json"))).toBe(true);
  });

  it("warns when a previously published slug disappears", async () => {
    mkdirSync(outDir, { recursive: true });
    writeFileSync(join(outDir, ".manifest.json"), JSON.stringify({ files: {}, slugsEverPublished: ["gone-slug"] }));
    const r = await publish(opts());
    expect(r.warnings.some((w) => w.includes("gone-slug"))).toBe(true);
    expect(manifest().slugsEverPublished).toEqual(["gone-slug", "published-session"]);
  });

  it("manifest hashes match written files", async () => {
    await publish(opts());
    const m = manifest();
    const key = "src/content/sessions/published-session.json";
    const bytes = readFileSync(join(root, key));
    expect(m.files[key]).toBe(createHash("sha256").update(bytes).digest("hex"));
    expect(Object.keys(m.files)).toEqual([key]);
  });

  it("aborts when validate fails", async () => {
    await expect(publish(opts({ validateCmd: ["false"] }))).rejects.toThrow(/validat/i);
    expect(existsSync(outDir)).toBe(false);
  });

  it("dry run touches nothing", async () => {
    const r = await publish(opts({ dryRun: true }));
    expect(r.written).toHaveLength(1);
    expect(existsSync(outDir)).toBe(false);
  });
});

describe("commitContent", () => {
  it("commits only src/content, leaving other staged files staged", () => {
    const g = (...a: string[]) => execFileSync("git", a, { cwd: root, encoding: "utf8" });
    g("init", "-q");
    g("config", "user.email", "t@example.test");
    g("config", "user.name", "t");
    mkdirSync(join(root, "src/content"), { recursive: true });
    writeFileSync(join(root, "src/content/a.json"), "{}\n");
    writeFileSync(join(root, "other.txt"), "x\n");
    g("add", "other.txt");
    expect(commitContent(root, "content: test")).toBe(true);
    expect(g("show", "--name-only", "--format=", "HEAD").trim()).toBe("src/content/a.json");
    expect(g("diff", "--cached", "--name-only").trim()).toBe("other.txt");
    expect(commitContent(root, "again")).toBe(false);
  });
});
