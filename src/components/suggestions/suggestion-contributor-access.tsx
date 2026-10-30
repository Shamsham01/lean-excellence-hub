import { PageHeader } from "@/components/platform/page-header";
import { WorkplaceRecordList } from "@/components/workplace/workplace-record-list";
import { AppLink } from "@/components/ui/app-link";
import { Button } from "@/components/ui/button";
import { loadOwnSuggestions } from "@/lib/suggestions/load-own-suggestions";

export async function SuggestionContributorAccess({
  canSubmit,
  canViewWorkplace,
}: {
  canSubmit: boolean;
  canViewWorkplace: boolean;
}) {
  const own = canSubmit ? await loadOwnSuggestions() : null;

  return (
    <div
      className="flex min-w-0 flex-col gap-8"
      data-testid="suggestion-contributor-access"
    >
      <PageHeader
        title="Suggestions"
        description={
          canViewWorkplace
            ? "Submit a suggestion in your work area, and view shared suggestions in your site. Review and programme administration need a separate role."
            : "Submit a suggestion in your work area and return to the suggestions you created. The review portfolio needs a separate role."
        }
        actions={
          canSubmit ? (
            <Button size="sm" asChild>
              <AppLink
                href="/platform/suggestions/new"
                data-testid="suggestions-new-link"
              >
                New suggestion
              </AppLink>
            </Button>
          ) : (
            <p className="text-sm text-muted-foreground">
              Creating a suggestion needs submission access.
            </p>
          )
        }
      />

      {canViewWorkplace ? (
        <section className="flex min-w-0 flex-col gap-3">
          <h2 className="text-base font-medium text-foreground">
            Shared suggestions
          </h2>
          <WorkplaceRecordList
            module="suggestions"
            emptyLabel="No shared suggestions are in your viewing scope yet."
          />
        </section>
      ) : null}

      {canSubmit ? (
        <section
          className="flex min-w-0 flex-col gap-3"
          data-testid="own-suggestions"
        >
          <h2 className="text-base font-medium text-foreground">
            Your suggestions
          </h2>
          {own?.status === "error" || own?.status === "unavailable" ? (
            <p className="text-sm text-destructive" role="alert">
              {own.status === "error"
                ? own.message
                : "Your suggestions could not be loaded."}
            </p>
          ) : own?.suggestions.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              You have not created a suggestion yet.
            </p>
          ) : (
            <ul className="flex min-w-0 flex-col gap-2">
              {own?.suggestions.map((suggestion) => (
                <li
                  key={suggestion.id}
                  className="min-w-0 border-t border-border py-3"
                >
                  <AppLink
                    href={`/platform/suggestions/${suggestion.id}`}
                    className="font-medium break-words text-foreground"
                  >
                    {suggestion.title}
                  </AppLink>
                  <p className="text-sm text-muted-foreground">
                    {[suggestion.suggestionNumber, suggestion.status]
                      .filter(Boolean)
                      .join(" · ")}
                  </p>
                </li>
              ))}
            </ul>
          )}
          {own?.status === "ready" && own.hasMore ? (
            <p className="text-sm text-muted-foreground">
              Showing your latest 25 suggestions.
            </p>
          ) : null}
        </section>
      ) : null}
    </div>
  );
}
