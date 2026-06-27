import { useQuery } from "@tanstack/react-query";

import { getOrganization } from "@/lib/amplify/data-client";

export function useOrganization(organizationId: string) {
  return useQuery({
    queryKey: ["organization", organizationId],
    queryFn: () => getOrganization(organizationId),
    enabled: !!organizationId,
    staleTime: 60 * 1000,
  });
}
