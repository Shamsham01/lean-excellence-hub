import Link from "next/link";

import type { QuickAction } from "@/modules/organisation-setup/types";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export function QuickActions({ actions }: { actions: QuickAction[] }) {
  if (actions.length === 0) {
    return null;
  }

  return (
    <Card data-testid="quick-actions">
      <CardHeader>
        <CardTitle className="text-base">Quick actions</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-wrap gap-2">
        {actions.map((action) => (
          <Button key={action.href} variant="outline" size="sm" asChild>
            <Link href={action.href} title={action.description}>
              {action.label}
            </Link>
          </Button>
        ))}
      </CardContent>
    </Card>
  );
}
