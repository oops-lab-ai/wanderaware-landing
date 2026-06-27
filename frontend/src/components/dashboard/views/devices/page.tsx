import { AlertTriangle, Plus, RadioTower } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useSessionContext } from "@/contexts/session-context";
import { useUsage } from "@/hooks/use-usage";

const readers = [
  {
    name: "Front Lobby UHF Reader",
    location: "Front entrance",
    status: "Online",
    lastSeen: "2 minutes ago",
    firmware: "1.4.2",
  },
  {
    name: "Garden Door Reader",
    location: "Garden exit",
    status: "Needs attention",
    lastSeen: "32 minutes ago",
    firmware: "1.4.0",
  },
  {
    name: "Van Bay Reader",
    location: "Transportation door",
    status: "Offline",
    lastSeen: "Yesterday",
    firmware: "1.3.9",
  },
];

export default function DevicesPage() {
  const { organization } = useSessionContext();
  const { data: usage } = useUsage(organization.id);
  const used = readers.length;
  const max = usage?.maxDevices ?? organization.maxDevices ?? 5;
  const percent = max > 0 ? Math.min(100, (used / max) * 100) : 0;

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="flex items-center gap-2 font-semibold text-2xl tracking-tight">
            <RadioTower className="size-6" />
            Door Readers
          </h1>
          <p className="text-muted-foreground text-sm">
            Track UHF RFID readers for {organization.name} by doorway and status.
          </p>
        </div>
        <Button>
          <Plus className="size-4" />
          Add Reader
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Device Capacity</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          <div className="flex items-baseline gap-1">
            <span className="font-bold text-2xl">{used}</span>
            <span className="text-muted-foreground text-sm">of {max} reader slots in use</span>
          </div>
          <Progress value={percent} className="h-2" />
        </CardContent>
      </Card>

      <Card>
        <CardContent className="pt-6">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Reader</TableHead>
                <TableHead>Building</TableHead>
                <TableHead>Location</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Last Seen</TableHead>
                <TableHead>Firmware</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {readers.map((reader) => (
                <TableRow key={reader.name}>
                  <TableCell className="font-medium">{reader.name}</TableCell>
                  <TableCell>{organization.name}</TableCell>
                  <TableCell>{reader.location}</TableCell>
                  <TableCell>
                    <Badge variant={reader.status === "Online" ? "secondary" : "outline"}>
                      {reader.status !== "Online" && <AlertTriangle className="mr-1 size-3" />}
                      {reader.status}
                    </Badge>
                  </TableCell>
                  <TableCell>{reader.lastSeen}</TableCell>
                  <TableCell>{reader.firmware}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
