import { Skeleton } from "@/components/ui/skeleton";

export default function ProblemSolvingCaseDetailLoading() {
  return (
    <div
      className="flex flex-col gap-6"
      data-testid="problem-solving-detail-loading"
    >
      <div className="flex flex-col gap-4 border-b border-border pb-6">
        <Skeleton className="h-4 w-32" />
        <Skeleton className="h-8 w-2/3 max-w-xl" />
        <div className="flex flex-wrap gap-2">
          <Skeleton className="h-6 w-16" />
          <Skeleton className="h-6 w-20" />
          <Skeleton className="h-6 w-20" />
        </div>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <Skeleton className="h-12" />
          <Skeleton className="h-12" />
          <Skeleton className="h-12" />
        </div>
      </div>
      <div className="flex flex-wrap gap-2">
        {Array.from({ length: 8 }).map((_, index) => (
          <Skeleton key={index} className="h-9 w-28" />
        ))}
      </div>
      <Skeleton className="h-64 w-full" />
    </div>
  );
}
