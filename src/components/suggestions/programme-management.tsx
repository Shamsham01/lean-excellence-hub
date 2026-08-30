"use client";

import { useRouter } from "next/navigation";

import { useState } from "react";

import {
  createSuggestionCategory,
  createSuggestionProgrammeDraft,
  createSuggestionProgrammeSuccessor,
  deactivateSuggestionCategory,
  deactivateSuggestionProgramme,
  deleteSuggestionCategory,
  deleteSuggestionProgrammeDraft,
  publishSuggestionProgrammeVersion,
  reactivateSuggestionCategory,
  reactivateSuggestionProgramme,
  updateSuggestionCategory,
  updateSuggestionProgramme,
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

  description: string | null;

  status: string;

  display_order: number;
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

function formatProgrammeStatus(status: string) {
  return status === "deactivated" ? "Deactivated" : "Active";
}

function formatVersionStatus(lifecycle: string) {
  switch (lifecycle) {
    case "draft":
      return "Draft";
    case "published":
      return "Published";
    case "archived":
      return "Archived";
    default:
      return lifecycle;
  }
}

function formatCategoryStatus(status: string) {
  return status === "deactivated" ? "Deactivated" : "Active";
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

          const hasPublishedHistory = programmeVersions.some(
            (version) => version.lifecycle !== "draft",
          );

          return (
            <Card key={programme.id}>
              <CardHeader>
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <CardTitle className="text-base">
                      {programme.name}
                    </CardTitle>
                    <p className="mt-1 text-sm text-muted-foreground">
                      {programme.code}
                    </p>
                  </div>
                  <span
                    className="rounded-full border border-border px-2 py-0.5 text-xs font-medium"
                    data-testid={`programme-status-${programme.id}`}
                  >
                    {formatProgrammeStatus(programme.status)}
                  </span>
                </div>
              </CardHeader>

              <CardContent className="flex flex-col gap-4 text-sm text-muted-foreground">
                {programme.description ? <p>{programme.description}</p> : null}

                <ProgrammeDetailsEditor
                  programme={programme}
                  disabled={loading}
                  onSave={(input) =>
                    runAction(() => updateSuggestionProgramme(input))
                  }
                />

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
                      <span className="font-medium text-foreground">
                        {formatVersionStatus(publishedVersion.lifecycle)}
                      </span>
                      {" · "}
                      Version {publishedVersion.version_number}
                      {publishedVersion.review_target_days
                        ? ` · ${publishedVersion.review_target_days} day review SLA`
                        : ""}
                    </p>

                    <div className="flex flex-wrap gap-2">
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
                        Create successor version
                      </Button>

                      {programme.status === "active" ? (
                        <Button
                          size="sm"
                          variant="outline"
                          disabled={loading}
                          onClick={() => {
                            if (
                              !window.confirm(
                                `Deactivate "${programme.name}"? New submissions will no longer use this programme.`,
                              )
                            ) {
                              return;
                            }

                            runAction(() =>
                              deactivateSuggestionProgramme(programme.id),
                            );
                          }}
                        >
                          Deactivate programme
                        </Button>
                      ) : (
                        <Button
                          size="sm"
                          variant="outline"
                          disabled={loading}
                          onClick={() =>
                            runAction(() =>
                              reactivateSuggestionProgramme(programme.id),
                            )
                          }
                        >
                          Reactivate programme
                        </Button>
                      )}
                    </div>
                  </div>
                ) : null}

                {archivedVersions.length > 0 ? (
                  <div>
                    <p className="font-medium text-foreground">
                      Previous versions
                    </p>

                    <ul className="mt-1 flex flex-col gap-1">
                      {archivedVersions.map((version) => (
                        <li key={version.id}>
                          {formatVersionStatus(version.lifecycle)} · Version{" "}
                          {version.version_number}
                        </li>
                      ))}
                    </ul>
                  </div>
                ) : null}

                {!hasPublishedHistory ? (
                  <Button
                    size="sm"
                    variant="destructive"
                    disabled={loading}
                    className="self-start"
                    onClick={() => {
                      if (
                        !window.confirm(
                          `Delete draft programme "${programme.name}"? This cannot be undone.`,
                        )
                      ) {
                        return;
                      }

                      runAction(() =>
                        deleteSuggestionProgrammeDraft(programme.id),
                      );
                    }}
                  >
                    Delete draft programme
                  </Button>
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

          <CardContent className="flex flex-col gap-4 text-sm">
            {categories.map((category) => (
              <CategoryEditor
                key={category.id}
                category={category}
                disabled={loading}
                onSave={(input) =>
                  runAction(() => updateSuggestionCategory(input))
                }
                onDeactivate={() => {
                  if (
                    !window.confirm(
                      `Deactivate category "${category.name}"? It will no longer appear for new submissions.`,
                    )
                  ) {
                    return;
                  }

                  runAction(() => deactivateSuggestionCategory(category.id));
                }}
                onReactivate={() =>
                  runAction(() => reactivateSuggestionCategory(category.id))
                }
                onDelete={() => {
                  if (
                    !window.confirm(
                      `Delete category "${category.name}"? This is only allowed when no suggestions reference it.`,
                    )
                  ) {
                    return;
                  }

                  runAction(() => deleteSuggestionCategory(category.id));
                }}
              />
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

function ProgrammeDetailsEditor({
  programme,
  disabled,
  onSave,
}: {
  programme: Programme;
  disabled: boolean;
  onSave: (input: {
    programmeId: string;
    name: string;
    description?: string | null;
  }) => void;
}) {
  const [name, setName] = useState(programme.name);
  const [description, setDescription] = useState(programme.description ?? "");
  const [expanded, setExpanded] = useState(false);

  if (!expanded) {
    return (
      <Button
        size="sm"
        variant="outline"
        className="self-start"
        disabled={disabled}
        onClick={() => setExpanded(true)}
      >
        Edit programme details
      </Button>
    );
  }

  return (
    <div className="rounded-md border border-border p-4">
      <p className="mb-3 font-medium text-foreground">Programme details</p>
      <div className="flex flex-col gap-3">
        <label className="flex flex-col gap-1">
          <Label htmlFor={`programme-edit-name-${programme.id}`}>Name</Label>
          <Input
            id={`programme-edit-name-${programme.id}`}
            value={name}
            onChange={(event) => setName(event.target.value)}
          />
        </label>
        <label className="flex flex-col gap-1">
          <Label htmlFor={`programme-edit-description-${programme.id}`}>
            Description
          </Label>
          <Textarea
            id={`programme-edit-description-${programme.id}`}
            rows={2}
            value={description}
            onChange={(event) => setDescription(event.target.value)}
          />
        </label>
        <div className="flex flex-wrap gap-2">
          <Button
            size="sm"
            disabled={disabled}
            onClick={() =>
              onSave({
                programmeId: programme.id,
                name,
                description: description || null,
              })
            }
          >
            Save programme details
          </Button>
          <Button
            size="sm"
            variant="ghost"
            disabled={disabled}
            onClick={() => {
              setName(programme.name);
              setDescription(programme.description ?? "");
              setExpanded(false);
            }}
          >
            Cancel
          </Button>
        </div>
      </div>
    </div>
  );
}

function CategoryEditor({
  category,
  disabled,
  onSave,
  onDeactivate,
  onReactivate,
  onDelete,
}: {
  category: Category;
  disabled: boolean;
  onSave: (input: {
    categoryId: string;
    name?: string;
    description?: string | null;
    displayOrder?: number;
  }) => void;
  onDeactivate: () => void;
  onReactivate: () => void;
  onDelete: () => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const [name, setName] = useState(category.name);
  const [description, setDescription] = useState(category.description ?? "");
  const [displayOrder, setDisplayOrder] = useState(
    category.display_order.toString(),
  );

  return (
    <div
      className="rounded-md border border-border p-4"
      data-testid={`category-row-${category.id}`}
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="font-medium text-foreground">{category.name}</p>
          <p className="text-muted-foreground">{category.code}</p>
        </div>
        <span className="rounded-full border border-border px-2 py-0.5 text-xs font-medium">
          {formatCategoryStatus(category.status)}
        </span>
      </div>

      {expanded ? (
        <div className="mt-3 flex flex-col gap-3">
          <label className="flex flex-col gap-1">
            <Label htmlFor={`category-name-${category.id}`}>Name</Label>
            <Input
              id={`category-name-${category.id}`}
              value={name}
              onChange={(event) => setName(event.target.value)}
            />
          </label>
          <label className="flex flex-col gap-1">
            <Label htmlFor={`category-description-${category.id}`}>
              Description
            </Label>
            <Textarea
              id={`category-description-${category.id}`}
              rows={2}
              value={description}
              onChange={(event) => setDescription(event.target.value)}
            />
          </label>
          <label className="flex flex-col gap-1">
            <Label htmlFor={`category-order-${category.id}`}>
              Display order
            </Label>
            <Input
              id={`category-order-${category.id}`}
              type="number"
              value={displayOrder}
              onChange={(event) => setDisplayOrder(event.target.value)}
            />
          </label>
          <div className="flex flex-wrap gap-2">
            <Button
              size="sm"
              disabled={disabled}
              onClick={() =>
                onSave({
                  categoryId: category.id,
                  name,
                  description: description || null,
                  displayOrder: Number(displayOrder),
                })
              }
            >
              Save category
            </Button>
            <Button
              size="sm"
              variant="ghost"
              disabled={disabled}
              onClick={() => {
                setName(category.name);
                setDescription(category.description ?? "");
                setDisplayOrder(category.display_order.toString());
                setExpanded(false);
              }}
            >
              Cancel
            </Button>
          </div>
        </div>
      ) : (
        <div className="mt-3 flex flex-wrap gap-2">
          <Button
            size="sm"
            variant="outline"
            disabled={disabled}
            onClick={() => setExpanded(true)}
          >
            Edit
          </Button>
          {category.status === "active" ? (
            <Button
              size="sm"
              variant="outline"
              disabled={disabled}
              onClick={onDeactivate}
            >
              Deactivate
            </Button>
          ) : (
            <Button
              size="sm"
              variant="outline"
              disabled={disabled}
              onClick={onReactivate}
            >
              Reactivate
            </Button>
          )}
          <Button
            size="sm"
            variant="destructive"
            disabled={disabled}
            onClick={onDelete}
          >
            Delete
          </Button>
        </div>
      )}
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
        {formatVersionStatus(version.lifecycle)} version{" "}
        {version.version_number}
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
