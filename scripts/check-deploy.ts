import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { LIVE_URL } from "./publish";

export type PollOptions = { timeoutMs?: number; intervalMs?: number };

// Polls <url>/version.txt until it serves `sha` or the timeout runs out.
export async function checkDeploy(url: string, sha: string, opts: PollOptions = {}): Promise<boolean> {
  const { timeoutMs = 180_000, intervalMs = 5_000 } = opts;
  const target = `${url.replace(/\/+$/, "")}/version.txt`;
  const deadline = Date.now() + timeoutMs;
  while (true) {
    try {
      const res = await fetch(target, { cache: "no-store" });
      if (res.ok && (await res.text()).trim() === sha) return true;
    } catch {
      // not reachable yet: keep polling
    }
    if (Date.now() + intervalMs > deadline) return false;
    await new Promise((r) => setTimeout(r, intervalMs));
  }
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  const url = process.argv[2] ?? LIVE_URL;
  const sha = process.argv[3] ?? execFileSync("git", ["rev-parse", "HEAD"], { encoding: "utf8" }).trim();
  checkDeploy(url, sha).then((ok) => {
    console.log(ok ? "match" : `mismatch: ${url} does not serve ${sha} after 180 s`);
    process.exit(ok ? 0 : 1);
  });
}
