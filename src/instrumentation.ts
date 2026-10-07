export async function register() {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;
  if (!process.env.DATABASE_URL) {
    console.warn("[form] DATABASE_URL is not set — skipping database bootstrap.");
    return;
  }
  const { bootstrap } = await import("./server/db/bootstrap");
  await bootstrap();
  console.log("[form] database ready");
}
