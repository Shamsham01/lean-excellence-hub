"use client";

import { useRouter } from "next/navigation";

import { useState } from "react";

import {
  createSuggestionCategory,
  createSuggestionProgrammeDraft,
  createSuggestionProgrammeSuccessor,
  publishSuggestionProgrammeVersion,
  updateSuggestionProgrammeVersion,
} from "@/app/(platform)/platform/suggestions/actions";

import { Button } from "@/components/ui/button";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

import { Input } from "@/components/ui/input";

import { Label } from "@/components/ui/label";

import { Textarea } from "@/components/ui/textarea";

type ProgrammeVersion = {
  id: string;

  programme_id: string;

  version_number: number;

  lifecycle: string;

  review_target_days: number | null;

  submission_guidance: string | null;

  template_version_id: string | null;
};

type Programme = {
  id: string;

  name: string;

  code: string;

  description: string | null;

  status: string;
};

type Category = {
  id: string;

  name: string;

  code: string;

  status: string;
};

type TemplateVersion = {
  id: string;

  version_number: number;

  template_id: string;

  templates: { display_name: string } | { display_name: string }[] | null;
};

type ProgrammeManagementProps = {
  programmes: Programme[];

  versions: ProgrammeVersion[];

  categories: Category[];

  templateVersions: TemplateVersion[];
};

function actionErrorMessage(error: unknown): string {
  if (error instanceof Error) return error.message;

  if (error && typeof error === "object" && "message" in error) {
    return String((error as { message: string }).message);
  }

  return "Action failed";
}

export function ProgrammeManagement({
  programmes,

  versions,

  categories,

  templateVersions,
}: ProgrammeManagementProps) {
  const router = useRouter();

  const [message, setMessage] = useState<string | null>(null);

  const [error, setError] = useState<string | null>(null);

  const [loading, setLoading] = useState(false);

  const [programmeName, setProgrammeName] = useState("");

  const [programmeCode, setProgrammeCode] = useState("");

  const [programmeDescription, setProgrammeDescription] = useState("");

  const [categoryName, setCategoryName] = useState("");

  const [categoryCode, setCategoryCode] = useState("");

  const versionsByProgramme = programmes.reduce<
    Record<string, ProgrammeVersion[]>
  >(
    (acc, programme) => {
      acc[programme.id] = versions

        .filter((version) => version.programme_id === programme.id)

        .sort((a, b) => b.version_number - a.version_number);

      return acc;
    },

    {},
  );

  async function runAction(
    action: () => Promise<{ error?: string; ok?: true }>,
  ) {
    setLoading(true);

    setError(null);

    setMessage(null);

    try {
      const result = await action();

      if (result.error) throw new Error(result.error);

      setMessage("Saved");

      router.refresh();
    } catch (err) {
      setError(actionErrorMessage(err));
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex flex-col gap-8" data-testid="programme-management">
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Create programme draft</CardTitle>
        </CardHeader>

        <CardContent>
          <form
            className="flex flex-col gap-3"

            onSubmit={(event) => {
              event.preventDefault();

              runAction(() =>
                createSuggestionProgrammeDraft({
                  name: programmeName,

                  code: programmeCode,

                  ...(programmeDescription
                    ? { description: programmeDescription }
                    : {}),
                }),
              );
            }}
          >
            <label className="flex flex-col gap-1 text-sm">
              <Label htmlFor="programme-name">Name</Label>

              <Input
                id="programme-name"

                required

                value={programmeName}

                onChange={(event) => setProgrammeName(event.target.value)}
              />
            </label>

            <label className="flex flex-col gap-1 text-sm">
              <Label htmlFor="programme-code">Code</Label>

              <Input
                id="programme-code"

                required

                value={programmeCode}

                onChange={(event) => setProgrammeCode(event.target.value)}
              />
            </label>

            <label className="flex flex-col gap-1 text-sm">
              <Label htmlFor="programme-description">Description</Label>

              <Textarea
                id="programme-description"

                rows={2}

                value={programmeDescription}

                onChange={(event) =>
                  setProgrammeDescription(event.target.value)
                }
              />
            </label>

            <Button
              type="submit"
              size="sm"
              disabled={loading}
              className="self-start"
            >
              Create draft
            </Button>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Create category</CardTitle>
        </CardHeader>

        <CardContent>
          <form
            className="flex flex-col gap-3"

            onSubmit={(event) => {
              event.preventDefault();

              runAction(() =>
                createSuggestionCategory({
                  name: categoryName,

                  code: categoryCode,
                }),
              );
            }}
          >
            <label className="flex flex-col gap-1 text-sm">
              <Label htmlFor="category-name">Name</Label>

              <Input
                id="category-name"

                required

                value={categoryName}

                onChange={(event) => setCategoryName(event.target.value)}
              />
            </label>

            <label className="flex flex-col gap-1 text-sm">
              <Label htmlFor="category-code">Code</Label>

              <Input
                id="category-code"

                required

                value={categoryCode}

                onChange={(event) => setCategoryCode(event.target.value)}
              />
            </label>

            <Button
              type="submit"
              size="sm"
              disabled={loading}
              className="self-start"
            >
              Create category
            </Button>
          </form>
        </CardContent>
      </Card>

      <div className="grid gap-4">
        {programmes.map((programme) => {
          const programmeVersions = versionsByProgramme[programme.id] ?? [];

          const draftVersion = programmeVersions.find(
            (version) => version.lifecycle === "draft",
          );

          const publishedVersion = programmeVersions.find(
            (version) => version.lifecycle === "published",
          );

          const archivedVersions = programmeVersions.filter(
            (version) => version.lifecycle === "archived",
          );

          return (
            <Card key={programme.id}>
              <CardHeader>
                <CardTitle className="text-base">{programme.name}</CardTitle>
              </CardHeader>

              <CardContent className="flex flex-col gap-4 text-sm text-muted-foreground">
                <p>{programme.code}</p>

                {programme.description ? <p>{programme.description}</p> : null}

                {draftVersion ? (
                  <DraftVersionEditor
                    version={draftVersion}

                    templateVersions={templateVersions}

                    disabled={loading}

                    onSave={(input) =>
                      runAction(() => updateSuggestionProgrammeVersion(input))
                    }

                    onPublish={() =>
                      runAction(() =>
                        publishSuggestionProgrammeVersion(draftVersion.id),
                      )
                    }
                  />
                ) : publishedVersion ? (
                  <div className="flex flex-col gap-2">
                    <p>
                      Published version {publishedVersion.version_number}
                      {publishedVersion.review_target_days
                        ? ` · ${publishedVersion.review_target_days} day review SLA`
                        : ""}
                    </p>

                    <Button
                      size="sm"

                      variant="outline"

                      className="self-start"

                      disabled={loading}

                      onClick={() =>
                        runAction(() =>
                          createSuggestionProgrammeSuccessor(programme.id),
                        )
                      }
                    >
                      Create successor draft
                    </Button>
                  </div>
                ) : null}

                {archivedVersions.length > 0 ? (
                  <div>
                    <p className="font-medium text-foreground">
                      Archived versions
                    </p>

                    <ul className="mt-1 flex flex-col gap-1">
                      {archivedVersions.map((version) => (
                        <li key={version.id}>
                          Version {version.version_number}
                        </li>
                      ))}
                    </ul>
                  </div>
                ) : null}
              </CardContent>
            </Card>
          );
        })}
      </div>

      {categories.length > 0 ? (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Categories</CardTitle>
          </CardHeader>

          <CardContent className="flex flex-col gap-2 text-sm">
            {categories.map((category) => (
              <div key={category.id} className="flex justify-between gap-4">
                <span>{category.name}</span>

                <span className="text-muted-foreground capitalize">
                  {category.status}
                </span>
              </div>
            ))}
          </CardContent>
        </Card>
      ) : null}

      {message ? (
        <p className="text-sm text-muted-foreground">{message}</p>
      ) : null}

      {error ? <p className="text-sm text-destructive">{error}</p> : null}
    </div>
  );
}

function DraftVersionEditor({
  version,

  templateVersions,

  disabled,

  onSave,

  onPublish,
}: {
  version: ProgrammeVersion;

  templateVersions: TemplateVersion[];

  disabled: boolean;

  onSave: (input: {
    versionId: string;

    reviewTargetDays?: number | null;

    templateVersionId?: string | null;

    submissionGuidance?: string | null;
  }) => void;

  onPublish: () => void;
}) {
  const [reviewTargetDays, setReviewTargetDays] = useState(
    version.review_target_days?.toString() ?? "",
  );

  const [templateVersionId, setTemplateVersionId] = useState(
    version.template_version_id ?? "",
  );

  const [submissionGuidance, setSubmissionGuidance] = useState(
    version.submission_guidance ?? "",
  );

  return (
    <div className="rounded-md border border-border p-4">
      <p className="mb-3 font-medium text-foreground">
        Draft version {version.version_number}
      </p>

      <div className="flex flex-col gap-3">
        <label className="flex flex-col gap-1">
          <Label htmlFor={`review-target-${version.id}`}>
            Review SLA (days)
          </Label>

          <Input
            id={`review-target-${version.id}`}

            type="number"

            min={1}

            value={reviewTargetDays}

            onChange={(event) => setReviewTargetDays(event.target.value)}
          />
        </label>

        <label className="flex flex-col gap-1">
          <Label htmlFor={`template-version-${version.id}`}>
            Template version
          </Label>

          <select
            id={`template-version-${version.id}`}

            className="border-input rounded-md border bg-background px-3 py-2"

            value={templateVersionId}

            onChange={(event) => setTemplateVersionId(event.target.value)}
          >
            <option value="">None</option>

            {templateVersions.map((templateVersion) => {
              const template = Array.isArray(templateVersion.templates)
                ? templateVersion.templates[0]
                : templateVersion.templates;

              return (
                <option key={templateVersion.id} value={templateVersion.id}>
                  {template?.display_name ?? "Template"} v
                  {templateVersion.version_number}
                </option>
              );
            })}
          </select>
        </label>

        <label className="flex flex-col gap-1">
          <Label htmlFor={`submission-guidance-${version.id}`}>
            Submission guidance
          </Label>

          <Textarea
            id={`submission-guidance-${version.id}`}

            rows={2}

            value={submissionGuidance}

            onChange={(event) => setSubmissionGuidance(event.target.value)}
          />
        </label>

        <div className="flex flex-wrap gap-2">
          <Button
            size="sm"

            variant="outline"

            disabled={disabled}

            onClick={() =>
              onSave({
                versionId: version.id,

                reviewTargetDays: reviewTargetDays
                  ? Number(reviewTargetDays)
                  : null,

                templateVersionId: templateVersionId || null,

                submissionGuidance: submissionGuidance || null,
              })
            }
          >
            Save draft
          </Button>

          <Button size="sm" disabled={disabled} onClick={onPublish}>
            Publish
          </Button>
        </div>
      </div>
    </div>
  );
}
