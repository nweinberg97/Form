import type { Metadata } from "next";
import { Plus } from "lucide-react";
import { requireClinicianPage } from "@/server/auth/guards";
import { listTemplates } from "@/server/services/clinician";
import { ButtonLink } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/feedback";
import { PageFrame, PageHeader } from "@/components/clinician/shell";
import { TemplateList } from "@/components/clinician/templates/template-list";

export const metadata: Metadata = { title: "Templates" };

export default async function TemplatesPage() {
  const user = await requireClinicianPage();
  const templates = await listTemplates(user.orgId);
  return (
    <PageFrame>
      <PageHeader
        kicker={user.orgName}
        title="Templates"
        description="Starting points for common plans. Use one in the builder, then personalise."
        actions={
          <ButtonLink href="/clinic/templates/new" icon={<Plus aria-hidden className="size-4" />}>
            New template
          </ButtonLink>
        }
      />
      {templates.length ? (
        <TemplateList templates={templates} />
      ) : (
        <EmptyState
          title="No templates yet"
          description="Build one here, or save any program as a template from the builder."
          action={
            <ButtonLink href="/clinic/templates/new" variant="dark" size="sm" icon={<Plus aria-hidden className="size-4" />}>
              New template
            </ButtonLink>
          }
        />
      )}
    </PageFrame>
  );
}
