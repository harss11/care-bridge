"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { HospitalForm } from "@/components/admin/hospital-form";
import { CredentialsModal } from "@/components/credentials-modal";
import { PageHeader } from "@/components/ui";
import { api } from "@/lib/api";
import type { Credentials, Hospital } from "@/lib/types";

export default function NewHospitalPage() {
  const router = useRouter();
  const [created, setCreated] = useState<{ hospital: Hospital; credentials: Credentials } | null>(
    null,
  );

  return (
    <>
      <PageHeader title="Add hospital" back={{ href: "/admin/hospitals", label: "Hospitals" }} />
      <HospitalForm
        submitLabel="Create hospital"
        onSubmit={async (body) => {
          setCreated(
            await api.post<{ hospital: Hospital; credentials: Credentials }>(
              "/admin/hospitals",
              body,
            ),
          );
        }}
      />
      <CredentialsModal
        title={created ? `${created.hospital.name} created` : undefined}
        credentials={created?.credentials ?? null}
        onClose={() => router.replace(`/admin/hospitals/${created!.hospital.id}`)}
      />
    </>
  );
}
