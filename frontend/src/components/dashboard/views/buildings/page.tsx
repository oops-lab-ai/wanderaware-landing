import { Building2, MapPin, Plus } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

const buildings = [
  {
    name: "Main Day Center",
    address: "118 Harbor Ave, Suite 200",
    timezone: "America/New_York",
    status: "Active",
    readers: 4,
  },
  {
    name: "Memory Care Annex",
    address: "22 Garden Walk",
    timezone: "America/New_York",
    status: "Planning",
    readers: 0,
  },
];

export default function BuildingsPage() {
  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="flex items-center gap-2 font-semibold text-2xl tracking-tight">
            <Building2 className="size-6" />
            Buildings
          </h1>
          <p className="text-muted-foreground text-sm">Manage facilities, entrances, and operating time zones.</p>
        </div>
        <Button>
          <Plus className="size-4" />
          Add Building
        </Button>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        {buildings.map((building) => (
          <Card key={building.name}>
            <CardHeader className="flex flex-row items-start justify-between gap-3">
              <div>
                <CardTitle className="text-base">{building.name}</CardTitle>
                <p className="mt-1 flex items-center gap-1 text-muted-foreground text-sm">
                  <MapPin className="size-3.5" />
                  {building.address}
                </p>
              </div>
              <Badge variant={building.status === "Active" ? "secondary" : "outline"}>{building.status}</Badge>
            </CardHeader>
            <CardContent className="grid grid-cols-2 gap-3 text-sm">
              <div>
                <p className="text-muted-foreground">Door readers</p>
                <p className="font-semibold text-xl">{building.readers}</p>
              </div>
              <div>
                <p className="text-muted-foreground">Timezone</p>
                <p className="font-medium">{building.timezone}</p>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
