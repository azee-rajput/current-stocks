// Runs once when the Next.js server starts. The import must sit inside this
// exact check so it is left out of the edge-runtime bundle (it uses node:fs).
export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    const { startBackfill } = await import("./lib/psxDaily");
    startBackfill();
  }
}
