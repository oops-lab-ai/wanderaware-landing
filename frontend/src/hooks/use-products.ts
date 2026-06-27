import { useQuery } from "@tanstack/react-query";

import { getProducts } from "@/lib/amplify/data-client";

export function useProducts() {
  return useQuery({
    queryKey: ["products"],
    queryFn: getProducts,
    staleTime: 10 * 60 * 1000, // 10 minutes — products rarely change
  });
}
