import { requestRefresh } from "../router";

/** In the browser demo, "revalidating" means re-running the current page's loader. */
export function revalidatePath(..._args: unknown[]) {
  requestRefresh();
}
export function revalidateTag(..._args: unknown[]) {
  requestRefresh();
}
