import { notFound } from "next/navigation";
import type { Metadata } from "next";
import EffectLab from "@/components/EffectLab";

/**
 * A bench for the two signature effects, in isolation.
 *
 * Exists so the branching of a bolt and the colour mix of a shatter can be
 * judged and tuned on their own, rather than glimpsed for 200ms in the middle
 * of a page revalidating. Fire them as often as you like here.
 *
 * **Development only.** `notFound()` in any other environment keeps it out of
 * the built app entirely rather than merely unlinked, and nothing navigates to
 * it — it is a tool, like `qa/`, not a screen.
 */
export const metadata: Metadata = { title: "Effect lab · Rendred" };

export default function LabPage() {
  if (process.env.NODE_ENV !== "development") notFound();
  return <EffectLab />;
}
