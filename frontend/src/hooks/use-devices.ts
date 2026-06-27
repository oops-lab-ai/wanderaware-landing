import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { listOrgDevices, releaseDevice } from "@/lib/amplify/data-client";

export function useDevices(organizationId: string | undefined) {
  return useQuery({
    queryKey: ["devices", organizationId],
    queryFn: () => {
      if (!organizationId) throw new Error("Organization id is required");
      return listOrgDevices(organizationId);
    },
    enabled: !!organizationId,
    staleTime: 30 * 1000, // 30 seconds — devices change rarely but online status drifts
  });
}

export function useRevokeDevice() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ deviceId, targetUserId }: { deviceId: string; targetUserId?: string }) =>
      releaseDevice(deviceId, targetUserId),
    onSuccess: () => {
      // Refetch the device list AND the usage stat (devices used count drops by 1)
      queryClient.invalidateQueries({ queryKey: ["devices"] });
      queryClient.invalidateQueries({ queryKey: ["usage"] });
    },
  });
}
