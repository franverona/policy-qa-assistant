// Runs once when the Next.js server starts: fail fast on bad config instead of on the first request.
export async function register() {
  const { getConfig } = await import("./config");
  getConfig();
}
