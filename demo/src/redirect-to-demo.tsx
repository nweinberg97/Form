import { redirect } from "./shims/next-navigation";

/** Sign-in and sign-up live in the full version; the browser demo goes straight to the sample clinic. */
export default function RedirectToDemo(): never {
  redirect("/demo");
}
