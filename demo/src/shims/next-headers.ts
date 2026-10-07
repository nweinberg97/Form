/** Minimal stand-ins for request headers/cookies in the browser demo. */
export async function headers() {
  const base = location.pathname.replace(/\/(index\.html)?$/, "");
  return new Headers({
    host: location.host,
    // Lets server code build links (e.g. invite URLs) that work under the hash router.
    "x-forwarded-host": `${location.host}${base}/#`,
    "x-forwarded-proto": location.protocol.replace(":", ""),
  });
}

export async function cookies() {
  return {
    get: (_name: string) => undefined,
    has: (_name: string) => false,
    set: (..._args: unknown[]) => {},
    delete: (_name: string) => {},
  };
}
