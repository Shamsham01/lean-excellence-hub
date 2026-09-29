import { FrameworkStructurePreview } from "@/components/maturity/framework-structure-preview";
import type {
  MaturityAuthoringCriterion,
  MaturityAuthoringPillar,
  MaturityAuthoringQuestion,
} from "@/modules/maturity/framework-authoring";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

type PublishedLevel = {
  id: string;
  level_number: number;
  name: string;
};

type PublishedFrameworkInspectorProps = {
  versionNumber: number;
  levels: PublishedLevel[];
  pillars: MaturityAuthoringPillar[];
  criteria: MaturityAuthoringCriterion[];
  questions: MaturityAuthoringQuestion[];
};

export function PublishedFrameworkInspector({
  versionNumber,
  levels,
  pillars,
  criteria,
  questions,
}: PublishedFrameworkInspectorProps) {
  return (
    <Card data-testid="published-framework-inspector">
      <CardHeader>
        <CardTitle>Published structure (read-only)</CardTitle>
      </CardHeader>
      <CardContent>
        <FrameworkStructurePreview
          mode="published"
          versionNumber={versionNumber}
          levels={levels}
          pillars={pillars}
          criteria={criteria}
          questions={questions}
          testId="published-structure-preview"
        />
      </CardContent>
    </Card>
  );
}
