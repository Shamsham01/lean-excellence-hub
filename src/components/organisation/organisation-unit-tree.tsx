"use client";

import { ChevronDown, ChevronRight, Plus } from "lucide-react";
import { useState } from "react";

import { UnitLifecycleActions } from "@/components/organisation/unit-lifecycle-actions";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type {
  FlatOrganisationUnit,
  OrganisationUnitNode,
} from "@/modules/organisation/unit-hierarchy";
import { formatUnitTypeLabel } from "@/modules/organisation/unit-types";

type OrganisationUnitTreeProps = {
  nodes: OrganisationUnitNode[];
  className?: string;
  flatUnits?: FlatOrganisationUnit[];
  canManage?: boolean;
  canCreateRoot?: boolean;
  manageableUnitIds?: string[];
  onAddChild?: ((parentUnitId: string) => void) | undefined;
  emptyAction?:
    | {
        label: string;
        onClick: () => void;
      }
    | undefined;
  onAskLeanAi?: (() => void) | undefined;
  lifecycleActions?:
    | {
        onUpdate: (input: {
          unitId: string;
          name: string;
          unitType: string;
        }) => Promise<{ error?: string; ok?: true }>;
        onMove: (input: {
          unitId: string;
          parentUnitId: string | null;
        }) => Promise<{ error?: string; ok?: true }>;
        onRetire: (input: {
          unitId: string;
          reason: string;
        }) => Promise<{ error?: string; ok?: true }>;
        onRestore: (input: {
          unitId: string;
        }) => Promise<{ error?: string; ok?: true }>;
      }
    | undefined;
};

function TreeNode({
  node,
  depth,
  flatUnits,
  canManage,
  canCreateRoot,
  manageableUnitIds,
  collapsedIds,
  onToggle,
  onAddChild,
  lifecycleActions,
}: {
  node: OrganisationUnitNode;
  depth: number;
  flatUnits: FlatOrganisationUnit[];
  canManage: boolean;
  canCreateRoot: boolean;
  manageableUnitIds: string[];
  collapsedIds: Set<string>;
  onToggle: (unitId: string) => void;
  onAddChild?: ((parentUnitId: string) => void) | undefined;
  lifecycleActions?: OrganisationUnitTreeProps["lifecycleActions"];
}) {
  const flatUnit = flatUnits.find((unit) => unit.id === node.id);
  const canManageUnit = manageableUnitIds.includes(node.id);
  const hasChildren = node.children.length > 0;
  const expanded = hasChildren && !collapsedIds.has(node.id);
  const childCount = node.children.length;

  return (
    <li>
      <div
        className={cn(
          "group flex items-start gap-1 rounded-md px-1 py-1.5 hover:bg-muted/60",
          "sm:gap-2 sm:px-2",
        )}
        data-testid={`org-unit-node-${node.id}`}
        data-depth={depth}
      >
        {hasChildren ? (
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="mt-0.5 size-8 min-h-8 shrink-0 text-muted-foreground"
            aria-expanded={expanded}
            aria-label={
              expanded ? `Collapse ${node.name}` : `Expand ${node.name}`
            }
            onClick={() => onToggle(node.id)}
            data-testid={`org-unit-toggle-${node.id}`}
          >
            {expanded ? (
              <ChevronDown className="size-4" />
            ) : (
              <ChevronRight className="size-4" />
            )}
          </Button>
        ) : (
          <span
            className="mt-0.5 size-8 shrink-0"
            aria-hidden
            data-testid={`org-unit-leaf-${node.id}`}
          />
        )}
        <div className="min-w-0 flex-1">
          <div className="flex flex-col gap-1 sm:flex-row sm:items-start sm:justify-between sm:gap-3">
            <div className="min-w-0">
              <p className="truncate font-medium text-foreground">
                {node.name}
              </p>
              <p className="text-xs text-muted-foreground">
                <Badge
                  variant="secondary"
                  className="mr-1.5 align-middle font-normal"
                >
                  {formatUnitTypeLabel(node.unitType)}
                </Badge>
                {node.code ? (
                  <span className="font-mono">{node.code}</span>
                ) : null}
                {childCount > 0 ? (
                  <span>
                    {node.code ? " · " : ""}
                    {childCount} {childCount === 1 ? "child" : "children"}
                  </span>
                ) : null}
              </p>
            </div>
            {canManage && canManageUnit && flatUnit && lifecycleActions ? (
              <div className="flex shrink-0 flex-wrap items-center justify-end gap-1">
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => onAddChild?.(node.id)}
                  aria-label={`Add child under ${node.name}`}
                  data-testid={`org-unit-add-child-${node.id}`}
                >
                  <Plus className="size-3.5" />
                  Child
                </Button>
                <UnitLifecycleActions
                  unit={flatUnit}
                  activeUnits={flatUnits.filter(
                    (unit) => unit.status !== "retired",
                  )}
                  canCreateRoot={canCreateRoot}
                  layout="compact"
                  onUpdate={lifecycleActions.onUpdate}
                  onMove={lifecycleActions.onMove}
                  onRetire={lifecycleActions.onRetire}
                  onRestore={lifecycleActions.onRestore}
                />
              </div>
            ) : null}
          </div>
        </div>
      </div>
      {hasChildren && expanded ? (
        <ul className="ml-3 border-l border-border/70 sm:ml-5">
          {node.children.map((child) => (
            <TreeNode
              key={child.id}
              node={child}
              depth={depth + 1}
              flatUnits={flatUnits}
              canManage={canManage}
              canCreateRoot={canCreateRoot}
              manageableUnitIds={manageableUnitIds}
              collapsedIds={collapsedIds}
              onToggle={onToggle}
              onAddChild={onAddChild}
              lifecycleActions={lifecycleActions}
            />
          ))}
        </ul>
      ) : null}
    </li>
  );
}

export function OrganisationUnitTree({
  nodes,
  className,
  flatUnits = [],
  canManage = false,
  canCreateRoot = false,
  manageableUnitIds = [],
  onAddChild,
  emptyAction,
  onAskLeanAi,
  lifecycleActions,
}: OrganisationUnitTreeProps) {
  const [collapsedIds, setCollapsedIds] = useState<Set<string>>(
    () => new Set(),
  );

  function toggle(unitId: string) {
    setCollapsedIds((current) => {
      const next = new Set(current);
      if (next.has(unitId)) {
        next.delete(unitId);
      } else {
        next.add(unitId);
      }
      return next;
    });
  }

  if (nodes.length === 0) {
    return (
      <div
        className="flex flex-col items-start gap-3 rounded-lg border border-dashed border-border bg-surface px-4 py-8"
        data-testid="structure-empty-state"
      >
        <div className="max-w-lg">
          <h3 className="text-sm font-semibold text-foreground">
            Build your organisation structure
          </h3>
          <p className="mt-1 text-sm text-muted-foreground">
            Add the units that reflect how work is organised, such as
            departments, areas or teams.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {emptyAction ? (
            <Button
              type="button"
              onClick={emptyAction.onClick}
              data-testid="structure-empty-add"
            >
              {emptyAction.label}
            </Button>
          ) : null}
          {onAskLeanAi ? (
            <Button
              type="button"
              variant="outline"
              onClick={onAskLeanAi}
              data-testid="structure-empty-leanai"
            >
              Ask LeanAI to recommend a structure
            </Button>
          ) : null}
        </div>
      </div>
    );
  }

  return (
    <ul
      className={cn("flex flex-col", className)}
      data-testid="organisation-unit-tree"
    >
      {nodes.map((node) => (
        <TreeNode
          key={node.id}
          node={node}
          depth={0}
          flatUnits={flatUnits}
          canManage={canManage}
          canCreateRoot={canCreateRoot}
          manageableUnitIds={manageableUnitIds}
          collapsedIds={collapsedIds}
          onToggle={toggle}
          onAddChild={onAddChild}
          lifecycleActions={lifecycleActions}
        />
      ))}
    </ul>
  );
}
