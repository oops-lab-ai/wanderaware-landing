import { Check } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import type { SubscriptionProduct } from "@/lib/amplify/types";
import { cn } from "@/lib/utils";

interface PlanCardProps {
  product: SubscriptionProduct;
  isCurrentPlan?: boolean;
  onSelect?: () => void;
  isLoading?: boolean;
  actionLabel?: string;
  /** When true, show the "7-day free trial" badge under the price. */
  eligibleForTrial?: boolean;
}

export function PlanCard({
  product,
  isCurrentPlan = false,
  onSelect,
  isLoading = false,
  actionLabel,
  eligibleForTrial = false,
}: PlanCardProps) {
  const features = (product.marketingFeatures ?? []).filter(Boolean) as string[];

  return (
    <Card
      className={cn(
        "relative flex flex-col",
        product.isRecommended && "border-primary shadow-md",
        isCurrentPlan && "border-primary bg-primary/5",
      )}
    >
      {product.isRecommended && !isCurrentPlan && (
        <div className="-top-3 -translate-x-1/2 absolute left-1/2">
          <Badge>Recommended</Badge>
        </div>
      )}
      {isCurrentPlan && (
        <div className="-top-3 -translate-x-1/2 absolute left-1/2">
          <Badge variant="secondary">Current Plan</Badge>
        </div>
      )}

      <CardHeader className="text-center">
        <CardTitle className="text-lg">{product.name ?? "Plan"}</CardTitle>
        <div className="mt-2 flex items-baseline justify-center gap-1">
          <span className="font-bold text-3xl">${product.price ?? 0}</span>
          <span className="text-muted-foreground text-sm">/{product.interval ?? "month"}</span>
        </div>
        {eligibleForTrial && !isCurrentPlan && (
          <p className="mt-2 font-medium text-emerald-600 text-xs dark:text-emerald-500">
            7-day free trial — no charge today
          </p>
        )}
        {/* Tier subtitle only when it's distinct from the marketing name. Without
            this guard, Enterprise renders "Enterprise / Enterprise" — a duplicate
            label that's noise (the other tiers — Individual/Basic, Team/Professional —
            convey the internal id meaningfully). */}
        {product.tier && product.tier.toLowerCase() !== (product.name ?? "").toLowerCase() && (
          <Badge variant="outline" className="mx-auto mt-2 capitalize">
            {product.tier}
          </Badge>
        )}
      </CardHeader>

      <Separator />

      <CardContent className="flex-1 pt-6">
        {product.description && <p className="mb-4 text-center text-muted-foreground text-sm">{product.description}</p>}
        {features.length > 0 && (
          <ul className="space-y-2">
            {features.map((feature) => (
              <li key={feature} className="flex items-start gap-2 text-sm">
                <Check className="mt-0.5 size-4 shrink-0 text-primary" />
                <span>{feature}</span>
              </li>
            ))}
          </ul>
        )}
      </CardContent>

      <CardFooter className="pt-0">
        <Button
          className="w-full"
          variant={isCurrentPlan ? "secondary" : product.isRecommended ? "default" : "outline"}
          disabled={isCurrentPlan || isLoading || !onSelect}
          onClick={onSelect}
        >
          {isLoading ? "Processing..." : isCurrentPlan ? "Current Plan" : (actionLabel ?? "Subscribe")}
        </Button>
      </CardFooter>
    </Card>
  );
}
