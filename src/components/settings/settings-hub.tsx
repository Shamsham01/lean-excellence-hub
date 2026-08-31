import Link from "next/link";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export type SettingsHubCard = {
  title: string;
  description: string;
  href: string;
  available: boolean;
  unavailableMessage?: string;
};

export function SettingsHub({ cards }: { cards: SettingsHubCard[] }) {
  return (
    <div
      className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3"
      data-testid="settings-hub"
    >
      {cards.map((card) => (
        <Card
          key={card.href}
          data-testid={`settings-hub-card${card.href.replaceAll("/", "-")}`}
          className={card.available ? "" : "opacity-80"}
        >
          <CardHeader>
            <CardTitle className="text-base">{card.title}</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-3">
            <p className="text-sm text-muted-foreground">{card.description}</p>
            {card.available ? (
              <Link
                href={card.href}
                className="text-sm font-medium text-primary underline-offset-4 hover:underline"
              >
                Open
              </Link>
            ) : (
              <p className="text-xs text-muted-foreground">
                {card.unavailableMessage ??
                  "Ask an Organisation Administrator for access."}
              </p>
            )}
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
