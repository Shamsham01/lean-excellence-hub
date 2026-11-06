"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type {
  ProblemSolvingAnalysis,
  ProblemSolvingAnalysisNode,
} from "@/lib/problem-solving/types";

type FiveWhyGuidedChainProps = {
  analyses: ProblemSolvingAnalysis[];
  analysisNodes: ProblemSolvingAnalysisNode[];
};

function fiveWhyAnalysis(
  analyses: ProblemSolvingAnalysis[],
): ProblemSolvingAnalysis | null {
  return (
    analyses.find((item) => item.analysis_type === "five_whys") ??
    analyses[0] ??
    null
  );
}

function orderedChainNodes(
  analysisId: string,
  nodes: ProblemSolvingAnalysisNode[],
): ProblemSolvingAnalysisNode[] {
  const forAnalysis = nodes.filter((node) => node.analysis_id === analysisId);
  const roots = forAnalysis.filter((node) => !node.parent_node_id);
  const chain: ProblemSolvingAnalysisNode[] = [];
  let cursor = roots.sort((a, b) => a.sort_order - b.sort_order)[0];
  const guard = new Set<string>();
  while (cursor && !guard.has(cursor.id)) {
    chain.push(cursor);
    guard.add(cursor.id);
    cursor =
      forAnalysis.find((node) => node.parent_node_id === cursor?.id) ??
      undefined;
  }
  if (chain.length === 0) {
    return forAnalysis.sort((a, b) => a.sort_order - b.sort_order);
  }
  return chain;
}

export function FiveWhyGuidedChain({
  analyses,
  analysisNodes,
}: FiveWhyGuidedChainProps) {
  const analysis = fiveWhyAnalysis(analyses);
  if (!analysis) {
    return (
      <Card data-testid="pps-five-why-empty">
        <CardHeader>
          <CardTitle className="text-base">5 Why chain</CardTitle>
        </CardHeader>
        <CardContent className="text-sm text-muted-foreground">
          No 5 Why analysis yet. Ask Lean AI to draft a chain, or accept a
          five_why_chain proposal from the facilitator panel.
        </CardContent>
      </Card>
    );
  }

  const chain = orderedChainNodes(analysis.id, analysisNodes);

  return (
    <Card data-testid="pps-five-why-chain">
      <CardHeader className="pb-2">
        <CardTitle className="text-base">{analysis.title}</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        {chain.map((node, index) => (
          <div
            key={node.id}
            className="relative border-l-2 border-primary/30 pl-4"
          >
            <p className="text-xs font-medium text-muted-foreground uppercase">
              Why {index + 1}
            </p>
            <p className="text-sm font-medium">{node.label}</p>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}
