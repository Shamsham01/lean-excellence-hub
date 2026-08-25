import { createMaturityAction } from "@/app/(platform)/platform/maturity/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

export function AssessmentActionForm({
  assessmentId,
  pillarId,
  criterionId,
  questionId,
}: {
  assessmentId: string;
  pillarId: string;
  criterionId: string;
  questionId?: string;
}) {
  async function action(formData: FormData) {
    "use server";
    await createMaturityAction(formData);
  }

  return (
    <form action={action} className="flex flex-col gap-3">
      <input type="hidden" name="assessmentId" value={assessmentId} />
      <input type="hidden" name="pillarId" value={pillarId} />
      <input type="hidden" name="criterionId" value={criterionId} />
      {questionId ? <input type="hidden" name="questionId" value={questionId} /> : null}
      <div className="flex flex-col gap-2">
        <Label htmlFor="action-title">Create action</Label>
        <Input id="action-title" name="title" required placeholder="Improvement action" />
      </div>
      <Textarea name="description" rows={2} placeholder="Finding context" />
      <Button type="submit" size="sm" variant="outline">Create action</Button>
    </form>
  );
}
