import type { OrganisationUnitNode } from "@/modules/organisation/unit-hierarchy";
import type { FlatOrganisationUnit } from "@/modules/organisation/unit-hierarchy";
import { UnitLifecycleActions } from "@/components/organisation/unit-lifecycle-actions";
import { cn } from "@/lib/utils";

type OrganisationUnitTreeProps = {
  nodes: OrganisationUnitNode[];
  className?: string;
  flatUnits?: FlatOrganisationUnit[];
  canManage?: boolean;
  canCreateRoot?: boolean;
  manageableUnitIds?: string[];
  lifecycleActions?: {
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
  };
};

function TreeNode({
  node,
  depth,
  flatUnits,
  canManage,
  canCreateRoot,
  manageableUnitIds = [],
  lifecycleActions,
}: {
  node: OrganisationUnitNode;
  depth: number;
  flatUnits: FlatOrganisationUnit[];
  canManage: boolean;
  canCreateRoot: boolean;
  manageableUnitIds: string[];
  lifecycleActions?: OrganisationUnitTreeProps["lifecycleActions"];
}) {
  const flatUnit = flatUnits.find((unit) => unit.id === node.id);
  const canManageUnit = manageableUnitIds.includes(node.id);

  return (
    <li>
      <div
        className={cn(
          "flex flex-col gap-3 rounded-md border border-border p-3 text-sm",
          depth > 0 && "border-l-2 border-l-primary/30",
        )}
        style={{ marginLeft: depth > 0 ? `${depth * 1.25}rem` : undefined }}
        data-testid={`org-unit-node-${node.id}`}
      >
        <div className="flex flex-col gap-0.5">
          <p className="font-medium text-foreground">{node.name}</p>
          <p className="text-xs text-muted-foreground">
            {node.unitType}
            {node.code ? ` · ${node.code}` : ""}
          </p>
        </div>
        {canManage && canManageUnit && flatUnit && lifecycleActions ? (
          <UnitLifecycleActions
            unit={flatUnit}
            activeUnits={flatUnits.filter((unit) => unit.status !== "retired")}
            canCreateRoot={canCreateRoot}
            onUpdate={lifecycleActions.onUpdate}
            onMove={lifecycleActions.onMove}
            onRetire={lifecycleActions.onRetire}
            onRestore={lifecycleActions.onRestore}
          />
        ) : null}
      </div>
      {node.children.length > 0 ? (
        <ul className="mt-2 flex flex-col gap-2">
          {node.children.map((child) => (
            <TreeNode
              key={child.id}
              node={child}
              depth={depth + 1}
              flatUnits={flatUnits}
              canManage={canManage}
              canCreateRoot={canCreateRoot}
              manageableUnitIds={manageableUnitIds}
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
  lifecycleActions,
}: OrganisationUnitTreeProps) {
  if (nodes.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        No organisational units yet. Create your first unit to complete core
        setup.
      </p>
    );
  }

  return (
    <ul
      className={cn("flex flex-col gap-2", className)}
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
          lifecycleActions={lifecycleActions}
        />
      ))}
    </ul>
  );
}
