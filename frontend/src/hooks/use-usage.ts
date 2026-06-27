import { useQuery } from "@tanstack/react-query";

import { getUsage } from "@/lib/amplify/data-client";

export function useUsage(organizationId: string | undefined) {
  return useQuery({
    queryKey: ["usage", organizationId],
    queryFn: () => {
      if (!organizationId) throw new Error("Organization id is required");
      return getUsage(organizationId);
    },
    enabled: !!organizationId,
    staleTime: 60 * 1000, // 1 minute
  });
}
