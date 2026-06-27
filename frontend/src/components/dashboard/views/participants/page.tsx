import { Plus, UsersRound } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

const participants = [
  { name: "M. Rivera", building: "Main Day Center", externalId: "ADC-1042", risk: "High", status: "Active" },
  { name: "J. Coleman", building: "Main Day Center", externalId: "ADC-1098", risk: "Medium", status: "Active" },
  { name: "S. Patel", building: "Memory Care Annex", externalId: "ADC-1120", risk: "Low", status: "Inactive" },
];

export default function ParticipantsPage() {
  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="flex items-center gap-2 font-semibold text-2xl tracking-tight">
            <UsersRound className="size-6" />
            Participants
          </h1>
          <p className="text-muted-foreground text-sm">
            Operational profiles only. Medical diagnosis details are intentionally out of scope.
          </p>
        </div>
        <Button>
          <Plus className="size-4" />
          Add Participant
        </Button>
      </div>
      <Card>
        <CardContent className="pt-6">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Building</TableHead>
                <TableHead>External ID</TableHead>
                <TableHead>Wander Risk</TableHead>
                <TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {participants.map((participant) => (
                <TableRow key={participant.externalId}>
                  <TableCell className="font-medium">{participant.name}</TableCell>
                  <TableCell>{participant.building}</TableCell>
                  <TableCell>{participant.externalId}</TableCell>
                  <TableCell>
                    <Badge variant={participant.risk === "High" ? "destructive" : "outline"}>{participant.risk}</Badge>
                  </TableCell>
                  <TableCell>{participant.status}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
