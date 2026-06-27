import { Bell, CheckCircle2 } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

const alerts = [
  {
    participant: "M. Rivera",
    location: "Garden exit",
    severity: "High",
    status: "Open",
    triggeredAt: "Today, 10:42 AM",
  },
  {
    participant: "J. Coleman",
    location: "Front entrance",
    severity: "Medium",
    status: "Acknowledged",
    triggeredAt: "Today, 9:18 AM",
  },
];

export default function AlertsPage() {
  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="flex items-center gap-2 font-semibold text-2xl tracking-tight">
          <Bell className="size-6" />
          Alerts
        </h1>
        <p className="text-muted-foreground text-sm">Review wandering and doorway proximity events.</p>
      </div>
      <Card>
        <CardContent className="pt-6">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Participant</TableHead>
                <TableHead>Location</TableHead>
                <TableHead>Severity</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Triggered</TableHead>
                <TableHead className="text-right">Action</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {alerts.map((alert) => (
                <TableRow key={`${alert.participant}-${alert.triggeredAt}`}>
                  <TableCell className="font-medium">{alert.participant}</TableCell>
                  <TableCell>{alert.location}</TableCell>
                  <TableCell>
                    <Badge variant={alert.severity === "High" ? "destructive" : "outline"}>{alert.severity}</Badge>
                  </TableCell>
                  <TableCell>{alert.status}</TableCell>
                  <TableCell>{alert.triggeredAt}</TableCell>
                  <TableCell className="text-right">
                    <Button variant="outline" size="sm">
                      <CheckCircle2 className="size-4" />
                      Acknowledge
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
