import { ZodError } from "zod";
import { AuthError } from "../auth/guards";

export type ActionResult<T = undefined> = { ok: true; data: T } | { ok: false; error: string };

export class UserFacingError extends Error {}

/**
 * Runs a server action body and converts failures into calm, human messages.
 * Technical details are logged, never shown.
 */
export async function run<T>(fn: () => Promise<T>): Promise<ActionResult<T>> {
  try {
    return { ok: true, data: await fn() };
  } catch (error) {
    if (error instanceof UserFacingError || error instanceof AuthError) {
      return { ok: false, error: error.message };
    }
    if (error instanceof ZodError) {
      return { ok: false, error: error.issues[0]?.message ?? "Please check the form and try again." };
    }
    // Next.js uses thrown errors for redirect()/notFound(); let those through.
    if (error && typeof error === "object" && "digest" in error && String((error as { digest: unknown }).digest).startsWith("NEXT_")) {
      throw error;
    }
    console.error("[action]", error);
    return { ok: false, error: "Something went wrong on our side. Nothing was lost — please try again." };
  }
}
