/** Loads Geist from the `geist` package (bundled locally — no font CDN). */
const files = import.meta.glob("../../node_modules/geist/dist/fonts/**/*.woff2", {
  query: "?url",
  import: "default",
  eager: true,
}) as Record<string, string>;

export function loadFonts() {
  const pick = (re: RegExp) => Object.entries(files).find(([path]) => re.test(path))?.[1];
  const sans = pick(/Geist-Variable\.woff2$/) ?? pick(/geist-sans\/.*\.woff2$/);
  const mono = pick(/GeistMono-Variable\.woff2$/) ?? pick(/geist-mono\/.*\.woff2$/);
  const css: string[] = [];
  if (sans) css.push(`@font-face{font-family:"Geist";src:url("${sans}") format("woff2");font-weight:100 900;font-display:swap}`);
  if (mono) css.push(`@font-face{font-family:"Geist Mono";src:url("${mono}") format("woff2");font-weight:100 900;font-display:swap}`);
  css.push(`:root{--font-geist-sans:"Geist";--font-geist-mono:"Geist Mono"}`);
  const style = document.createElement("style");
  style.textContent = css.join("\n");
  document.head.appendChild(style);
}
