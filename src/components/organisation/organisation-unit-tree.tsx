import type { OrganisationUnitNode } from "@/modules/organisation/unit-hierarchy";
import { cn } from "@/lib/utils";

type OrganisationUnitTreeProps = {
  nodes: OrganisationUnitNode[];
  className?: string;
};

function TreeNode({
  node,
  depth,
}: {
  node: OrganisationUnitNode;
  depth: number;
}) {
  return (
    <li>
      <div
        className={cn(
          "flex flex-col gap-0.5 rounded-md border border-border p-3 text-sm",
          depth > 0 && "border-l-2 border-l-primary/30",
        )}
        style={{ marginLeft: depth > 0 ? `${depth * 1.25}rem` : undefined }}
        data-testid={`org-unit-node-${node.id}`}
      >
        <p className="font-medium text-foreground">{node.name}</p>
        <p className="text-xs text-muted-foreground">
          {node.unitType}
          {node.code ? ` · ${node.code}` : ""}
        </p>
      </div>
      {node.children.length > 0 ? (
        <ul className="mt-2 flex flex-col gap-2">
          {node.children.map((child) => (
            <TreeNode key={child.id} node={child} depth={depth + 1} />
          ))}
        </ul>
      ) : null}
    </li>
  );
}

export function OrganisationUnitTree({
  nodes,
  className,
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
        <TreeNode key={node.id} node={node} depth={0} />
      ))}
    </ul>
  );
}
