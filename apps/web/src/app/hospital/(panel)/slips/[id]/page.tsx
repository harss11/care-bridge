"use client";

import { useParams } from "next/navigation";
import { SlipEditor } from "@/components/slips/slip-editor";
import { Alert, LoadingBlock, PageHeader } from "@/components/ui";
import type { SlipTemplate } from "@/lib/types";
import { useApi } from "@/lib/use-api";

export default function SlipEditorPage() {
  const { id } = useParams<{ id: string }>();
  const { data, error } = useApi<SlipTemplate>("/hospital/slip-templates/" + id);
  return (
    <>
      <PageHeader
        title={data ? data.name : "Slip template"}
        subtitle="Place each detail where your pre-printed slip needs it."
        back={{ href: "/hospital/slips", label: "All slip templates" }}
      />
      {error && <Alert>{error}</Alert>}
      {!data && !error && <LoadingBlock />}
      {data && <SlipEditor key={data.id} initial={data} />}
    </>
  );
}
