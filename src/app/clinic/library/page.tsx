import type { Metadata } from "next";
import { requireClinicianPage } from "@/server/auth/guards";
import { getLibrary } from "@/server/services/clinician";
import { PageFrame, PageHeader } from "@/components/clinician/shell";
import { LibraryBrowser } from "@/components/clinician/library/library-browser";

export const metadata: Metadata = { title: "Library" };

export default async function LibraryPage() {
  const user = await requireClinicianPage();
  const library = await getLibrary(user.orgId);
  return (
    <PageFrame wide>
      <PageHeader
        kicker={`${library.length} approved exercises`}
        title="Exercise library"
        description="Every exercise has a movement guide, instructions and form cues. Choose your clinic's own video where you prefer it."
      />
      <LibraryBrowser library={library} />
    </PageFrame>
  );
}
