import { forwardRef, type AnchorHTMLAttributes, type MouseEvent } from "react";
import { hrefFor, navigate } from "../router";

type Props = Omit<AnchorHTMLAttributes<HTMLAnchorElement>, "href"> & {
  href: string | { pathname?: string; query?: Record<string, string> };
  replace?: boolean;
  scroll?: boolean;
  prefetch?: boolean | null;
};

function toPath(href: Props["href"]) {
  if (typeof href === "string") return href;
  const query = href.query ? `?${new URLSearchParams(href.query)}` : "";
  return `${href.pathname ?? ""}${query}`;
}

const Link = forwardRef<HTMLAnchorElement, Props>(function Link(
  { href, replace, scroll: _scroll, prefetch: _prefetch, onClick, target, ...rest },
  ref,
) {
  const path = toPath(href);
  const external = /^(https?:|mailto:|tel:)/.test(path);
  return (
    <a
      ref={ref}
      href={external ? path : hrefFor(path)}
      target={target}
      onClick={(event: MouseEvent<HTMLAnchorElement>) => {
        onClick?.(event);
        if (event.defaultPrevented || external || target === "_blank") return;
        if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey || event.button !== 0) return;
        event.preventDefault();
        navigate(path, { replace });
      }}
      {...rest}
    />
  );
});

export default Link;
