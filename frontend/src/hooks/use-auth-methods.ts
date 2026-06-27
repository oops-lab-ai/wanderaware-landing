import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { disconnectProvider, getAuthMethods } from "@/lib/amplify/data-client";

export function useAuthMethods() {
  return useQuery({
    queryKey: ["authMethods"],
    queryFn: getAuthMethods,
    staleTime: 60 * 1000,
  });
}

export function useDisconnectProvider() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: disconnectProvider,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["authMethods"] });
    },
  });
}
