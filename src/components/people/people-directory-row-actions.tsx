"use client";

import { MoreHorizontal } from "lucide-react";

import { AppLink } from "@/components/ui/app-link";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

type PeopleDirectoryRowActionsProps = {
  membershipId: string;
  displayName: string;
  canManage: boolean;
};

export function PeopleDirectoryRowActions({
  membershipId,
  displayName,
  canManage,
}: PeopleDirectoryRowActionsProps) {
  return (
    <DropdownMenu modal={false}>
      <DropdownMenuTrigger asChild>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="min-h-11 min-w-11 px-2"
          aria-label={`Actions for ${displayName}`}
          data-testid={`people-directory-actions-${membershipId}`}
        >
          <MoreHorizontal className="size-4" aria-hidden />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent
        align="end"
        data-testid={`people-directory-actions-menu-${membershipId}`}
      >
        <DropdownMenuItem asChild>
          <AppLink
            href={`/platform/people/${membershipId}`}
            data-testid={`people-directory-profile-action-${membershipId}`}
          >
            View capability profile
          </AppLink>
        </DropdownMenuItem>
        {canManage ? (
          <DropdownMenuItem asChild>
            <AppLink
              href={`/platform/people/${membershipId}/admin`}
              data-testid={`people-directory-manage-action-${membershipId}`}
            >
              Manage
            </AppLink>
          </DropdownMenuItem>
        ) : null}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
