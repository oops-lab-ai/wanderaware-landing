import { useQuery } from "@tanstack/react-query";

import { listOrgMembers } from "@/lib/amplify/data-client";

export function useOrgMembers(organizationId: string | undefined) {
  return useQuery({
    queryKey: ["orgMembers", organizationId],
    queryFn: () => {
      if (!organizationId) throw new Error("Organization id is required");
      return listOrgMembers(organizationId);
    },
    enabled: !!organizationId,
    staleTime: 60 * 1000,
  });
}
