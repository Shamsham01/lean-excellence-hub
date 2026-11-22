import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

export function ProjectsPortfolioSkeleton() {
  return (
    <div
      className="flex flex-col gap-6"
      data-testid="projects-portfolio-skeleton"
    >
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
        {Array.from({ length: 6 }).map((_, index) => (
          <Card key={index} className="bg-surface">
            <CardContent className="space-y-2 p-4">
              <Skeleton className="h-3 w-24" />
              <Skeleton className="h-8 w-12" />
            </CardContent>
          </Card>
        ))}
      </div>
      <Card>
        <CardHeader className="flex flex-col gap-4 border-b border-border pb-4 sm:flex-row sm:items-end sm:justify-between">
          <div className="space-y-2">
            <Skeleton className="h-5 w-40" />
            <Skeleton className="h-4 w-24" />
          </div>
          <div className="flex w-full flex-col gap-3 sm:w-auto sm:flex-row sm:items-end">
            <Skeleton className="h-11 min-w-[200px] flex-1" />
            <Skeleton className="h-11 w-40" />
            <Skeleton className="h-11 w-20" />
          </div>
        </CardHeader>
        <CardContent className="flex flex-col gap-2 pt-4">
          {Array.from({ length: 5 }).map((_, index) => (
            <Skeleton key={index} className="h-[4.5rem] w-full rounded-lg" />
          ))}
        </CardContent>
      </Card>
    </div>
  );
}
