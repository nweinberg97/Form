import { navigate, useLocation, useRouteParams, requestRefresh } from "../router";

type RedirectError = Error & { digest: string };

export function redirect(url: string): never {
  const error = new Error("NEXT_REDIRECT") as RedirectError;
  error.digest = `NEXT_REDIRECT;replace;${url};307;`;
  throw error;
}
export const permanentRedirect = redirect;

export function notFound(): never {
  const error = new Error("NEXT_HTTP_ERROR_FALLBACK;404") as RedirectError;
  error.digest = "NEXT_HTTP_ERROR_FALLBACK;404";
  throw error;
}

export function useRouter() {
  return {
    push: (href: string) => navigate(href),
    replace: (href: string) => navigate(href, { replace: true }),
    refresh: () => requestRefresh(),
    back: () => history.back(),
    forward: () => history.forward(),
    prefetch: (_href: string) => {},
  };
}

export function usePathname() {
  return useLocation().pathname;
}

export function useSearchParams() {
  return useLocation().searchParams;
}

export function useParams<T extends Record<string, string>>() {
  return useRouteParams() as T;
}
