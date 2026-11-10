import { AppLink } from "@/components/ui/app-link";
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
          className={card.available ? "transition hover:border-primary/40" : "opacity-80"}
        >
          {card.available ? (
            <AppLink
              href={card.href}
              className="block h-full rounded-xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              data-testid={`settings-hub-open${card.href.replaceAll("/", "-")}`}
            >
              <CardHeader className="pb-2">
                <CardTitle className="text-base">{card.title}</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground line-clamp-2">
                  {card.description}
                </p>
              </CardContent>
            </AppLink>
          ) : (
            <>
              <CardHeader className="pb-2">
                <CardTitle className="text-base">{card.title}</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground line-clamp-2">
                  {card.description}
                </p>
                <p className="mt-2 text-xs text-muted-foreground">
                  {card.unavailableMessage ??
                    "Ask an Organisation Administrator for access."}
                </p>
              </CardContent>
            </>
          )}
        </Card>
      ))}
    </div>
  );
}
