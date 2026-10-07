import {
  Component,
  createContext,
  useContext,
  useEffect,
  useRef,
  useState,
  useSyncExternalStore,
  type ComponentType,
  type ReactNode,
} from "react";

/**
 * A small hash router that runs FORM's real App Router pages in the browser.
 * Each route lists its layouts and page modules from src/app; async server
 * components are awaited and their output rendered, exactly as Next would.
 */

type Mod<P = never> = { default: ComponentType<P> | ((props: P) => unknown) };
type Loader<P = never> = () => Promise<Mod<P>>;

export type RouteDef = {
  pattern: string;
  page: Loader<never>;
  layouts?: Loader<never>[];
  loading?: Loader<never>;
  error?: Loader<never>;
  notFound?: Loader<never>;
};

/* ------------------------------------------------------------------ */
/* Location store                                                      */
/* ------------------------------------------------------------------ */

type Loc = { pathname: string; search: string; searchParams: URLSearchParams; key: number };

function readLocation(key: number): Loc {
  const raw = location.hash.replace(/^#/, "") || "/";
  const url = new URL(raw, "https://form.local");
  return { pathname: url.pathname.replace(/\/+$/, "") || "/", search: url.search, searchParams: url.searchParams, key };
}

let navKey = 0;
let current = readLocation(navKey);
let refreshVersion = 0;
const listeners = new Set<() => void>();
const emit = () => listeners.forEach((l) => l());

window.addEventListener("hashchange", () => {
  current = readLocation(++navKey);
  emit();
});

export function hrefFor(path: string) {
  return `#${path.startsWith("/") ? path : `/${path}`}`;
}

export function navigate(path: string, opts: { replace?: boolean } = {}) {
  const target = hrefFor(path);
  if (opts.replace) history.replaceState(null, "", target);
  else history.pushState(null, "", target);
  current = readLocation(++navKey);
  window.scrollTo(0, 0);
  emit();
}

let refreshQueued = false;
/** Re-run the current page's loaders (the browser equivalent of revalidatePath / router.refresh). */
export function requestRefresh() {
  if (refreshQueued) return;
  refreshQueued = true;
  queueMicrotask(() => {
    refreshQueued = false;
    refreshVersion++;
    emit();
  });
}

const subscribe = (l: () => void) => {
  listeners.add(l);
  return () => listeners.delete(l);
};

export function useLocation() {
  return useSyncExternalStore(subscribe, () => current);
}

const ParamsContext = createContext<Record<string, string>>({});
export const useRouteParams = () => useContext(ParamsContext);

/* ------------------------------------------------------------------ */
/* Matching                                                            */
/* ------------------------------------------------------------------ */

function match(routes: RouteDef[], pathname: string) {
  for (const route of routes) {
    const names: string[] = [];
    const re = new RegExp(
      "^" +
        route.pattern.replace(/\/:([a-zA-Z]+)/g, (_m, name: string) => {
          names.push(name);
          return "/([^/]+)";
        }) +
        "/?$",
    );
    const m = pathname.match(re);
    if (m) return { route, params: Object.fromEntries(names.map((n, i) => [n, decodeURIComponent(m[i + 1])])) };
  }
  return null;
}

const digestOf = (error: unknown) =>
  error && typeof error === "object" && "digest" in error ? String((error as { digest: unknown }).digest) : "";

async function renderRoute(route: RouteDef, params: Record<string, string>, loc: Loc): Promise<ReactNode> {
  const props = { params: Promise.resolve(params), searchParams: Promise.resolve(Object.fromEntries(loc.searchParams)) };
  const page = (await route.page()).default as (p: unknown) => unknown;
  let element = (await page(props)) as ReactNode;
  for (const loadLayout of [...(route.layouts ?? [])].reverse()) {
    const layout = (await loadLayout()).default as (p: unknown) => unknown;
    element = (await layout({ children: element, params: props.params })) as ReactNode;
  }
  return element;
}

/* ------------------------------------------------------------------ */
/* Router component                                                    */
/* ------------------------------------------------------------------ */

type State =
  | { kind: "loading"; fallback: ReactNode }
  | { kind: "ready"; element: ReactNode; params: Record<string, string>; route: RouteDef }
  | { kind: "notFound"; element: ReactNode }
  | { kind: "error"; error: Error; route: RouteDef | null };

export function Router({ routes, notFound, error: rootError }: { routes: RouteDef[]; notFound: Loader<never>; error: Loader<never> }) {
  const loc = useLocation();
  const [state, setState] = useState<State>({ kind: "loading", fallback: null });
  const seen = useRef<{ key: number; version: number }>({ key: -1, version: -1 });
  const version = useSyncExternalStore(subscribe, () => refreshVersion);

  useEffect(() => {
    let cancelled = false;
    const isNavigation = seen.current.key !== loc.key;
    seen.current = { key: loc.key, version };
    const found = match(routes, loc.pathname);

    (async () => {
      if (!found) {
        const NotFound = (await notFound()).default as ComponentType;
        if (!cancelled) setState({ kind: "notFound", element: <NotFound /> });
        return;
      }
      if (isNavigation && found.route.loading) {
        const Loading = (await found.route.loading()).default as ComponentType;
        if (!cancelled) setState((s) => (s.kind === "ready" && s.route === found.route ? s : { kind: "loading", fallback: <Loading /> }));
      }
      try {
        const element = await renderRoute(found.route, found.params, loc);
        if (!cancelled) setState({ kind: "ready", element, params: found.params, route: found.route });
      } catch (error) {
        if (cancelled) return;
        const digest = digestOf(error);
        if (digest.startsWith("NEXT_REDIRECT")) {
          navigate(digest.split(";")[2], { replace: true });
          return;
        }
        if (digest.startsWith("NEXT_HTTP_ERROR_FALLBACK")) {
          const NotFound = (await (found.route.notFound ?? notFound)()).default as ComponentType;
          setState({ kind: "notFound", element: <NotFound /> });
          return;
        }
        console.error(error);
        setState({ kind: "error", error: error as Error, route: found.route });
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [loc, version, routes, notFound]);

  if (state.kind === "loading") return <>{state.fallback}</>;
  if (state.kind === "notFound") return <>{state.element}</>;
  if (state.kind === "error") {
    return <ErrorView loader={state.route?.error ?? rootError} error={state.error} onReset={requestRefresh} />;
  }
  return (
    <ParamsContext.Provider value={state.params}>
      <Boundary key={loc.pathname} loader={state.route.error ?? rootError}>
        {state.element}
      </Boundary>
    </ParamsContext.Provider>
  );
}

function ErrorView({ loader, error, onReset }: { loader: Loader<never>; error: Error; onReset: () => void }) {
  const [View, setView] = useState<ComponentType<{ error: Error; reset: () => void }> | null>(null);
  useEffect(() => {
    loader().then((m) => setView(() => m.default as ComponentType<{ error: Error; reset: () => void }>));
  }, [loader]);
  return View ? <View error={error} reset={onReset} /> : null;
}

class Boundary extends Component<{ loader: Loader<never>; children: ReactNode }, { error: Error | null }> {
  state = { error: null as Error | null };
  static getDerivedStateFromError(error: Error) {
    return { error };
  }
  componentDidCatch(error: Error) {
    console.error(error);
  }
  render() {
    if (this.state.error) {
      return <ErrorView loader={this.props.loader} error={this.state.error} onReset={() => this.setState({ error: null })} />;
    }
    return this.props.children;
  }
}
