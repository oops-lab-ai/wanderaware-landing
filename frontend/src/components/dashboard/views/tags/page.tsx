import { Plus, Tag } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useSessionContext } from "@/contexts/session-context";

const tags = [
  { uid: "RFID-8A92-144C", participant: "M. Rivera", status: "Assigned", lastSeen: "Front entrance, 4 min ago" },
  { uid: "RFID-7721-01AF", participant: "Unassigned", status: "Unassigned", lastSeen: "Never" },
  { uid: "RFID-1F20-A943", participant: "J. Coleman", status: "Assigned", lastSeen: "Activity room, 18 min ago" },
];

export default function TagsPage() {
  const { organization } = useSessionContext();

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="flex items-center gap-2 font-semibold text-2xl tracking-tight">
            <Tag className="size-6" />
            RFID Tags
          </h1>
          <p className="text-muted-foreground text-sm">
            Track shoe, clothing, and wearable UHF tag assignments for {organization.name}.
          </p>
        </div>
        <Button>
          <Plus className="size-4" />
          Register Tag
        </Button>
      </div>
      <Card>
        <CardContent className="pt-6">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Tag UID</TableHead>
                <TableHead>Participant</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Last Seen</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {tags.map((tag) => (
                <TableRow key={tag.uid}>
                  <TableCell className="font-mono text-sm">{tag.uid}</TableCell>
                  <TableCell>{tag.participant}</TableCell>
                  <TableCell>
                    <Badge variant={tag.status === "Assigned" ? "secondary" : "outline"}>{tag.status}</Badge>
                  </TableCell>
                  <TableCell>{tag.lastSeen}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
