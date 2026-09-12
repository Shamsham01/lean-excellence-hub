import type { ReactNode } from "react";

import { PageHeader } from "@/components/platform/page-header";

type PublishedExecutionHeaderProps = {
  title: string;
  description: string;
  managementActions?: ReactNode;
  managementTestId: string;
  executionActions?: ReactNode;
  executionTestId: string;
};

export function PublishedExecutionHeader({
  title,
  description,
  managementActions,
  managementTestId,
  executionActions,
  executionTestId,
}: PublishedExecutionHeaderProps) {
  return (
    <div className="flex flex-col gap-4 border-b border-border pb-6">
      <PageHeader
        className="border-b-0 pb-0"
        title={title}
        description={description}
        actions={
          managementActions ? (
            <div
              className="flex max-w-full flex-wrap items-center gap-2"
              data-testid={managementTestId}
            >
              {managementActions}
            </div>
          ) : undefined
        }
      />
      {executionActions ? (
        <div
          className="flex max-w-full min-w-0 flex-wrap items-end gap-3"
          data-testid={executionTestId}
        >
          {executionActions}
        </div>
      ) : null}
    </div>
  );
}
