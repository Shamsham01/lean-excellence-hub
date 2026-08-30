"use client";

import { useRouter } from "next/navigation";

import { useMemo, useState } from "react";

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

import { Card, CardContent } from "@/components/ui/card";

import { Input } from "@/components/ui/input";

import { Label } from "@/components/ui/label";

import { Textarea } from "@/components/ui/textarea";

import {
  type CatalogueStatusFilter,
  categoryEmptyStateMessage,
  filterCatalogueBySearch,
  filterCatalogueByStatus,
  formatCategoryDisplayStatus,
  formatProgrammeDisplayStatus,
  getProgrammeDisplayStatus,
  programmeEmptyStateMessage,
  programmeHasPublishedHistory,
} from "@/modules/suggestions/catalog-admin";

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

function StatusFilterSelect({
  id,
  label,
  value,
  onChange,
}: {
  id: string;
  label: string;
  value: CatalogueStatusFilter;
  onChange: (value: CatalogueStatusFilter) => void;
}) {
  return (
    <div className="flex min-w-0 flex-col gap-1 text-sm">
      <Label htmlFor={id}>{label}</Label>
      <select
        id={id}
        className="border-input rounded-md border bg-background px-3 py-2"
        value={value}
        onChange={(event) =>
          onChange(event.target.value as CatalogueStatusFilter)
        }
      >
        <option value="active">Active</option>
        <option value="deactivated">Deactivated</option>
        <option value="all">All</option>
      </select>
    </div>
  );
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

  const [programmeStatusFilter, setProgrammeStatusFilter] =
    useState<CatalogueStatusFilter>("active");
  const [programmeSearch, setProgrammeSearch] = useState("");
  const [categoryStatusFilter, setCategoryStatusFilter] =
    useState<CatalogueStatusFilter>("active");
  const [categorySearch, setCategorySearch] = useState("");

  const [showProgrammeCreate, setShowProgrammeCreate] = useState(false);
  const [showCategoryCreate, setShowCategoryCreate] = useState(false);

  const [programmeName, setProgrammeName] = useState("");
  const [programmeCode, setProgrammeCode] = useState("");
  const [programmeDescription, setProgrammeDescription] = useState("");

  const [categoryName, setCategoryName] = useState("");
  const [categoryCode, setCategoryCode] = useState("");

  const versionsByProgramme = useMemo(
    () =>
      programmes.reduce<Record<string, ProgrammeVersion[]>>(
        (acc, programme) => {
          acc[programme.id] = versions
            .filter((version) => version.programme_id === programme.id)
            .sort((a, b) => b.version_number - a.version_number);

          return acc;
        },
        {},
      ),
    [programmes, versions],
  );

  const filteredProgrammes = useMemo(() => {
    const byStatus = filterCatalogueByStatus(programmes, programmeStatusFilter);
    return filterCatalogueBySearch(byStatus, programmeSearch);
  }, [programmes, programmeSearch, programmeStatusFilter]);

  const filteredCategories = useMemo(() => {
    const byStatus = filterCatalogueByStatus(categories, categoryStatusFilter);
    return filterCatalogueBySearch(byStatus, categorySearch);
  }, [categories, categorySearch, categoryStatusFilter]);

  async function runAction(
    action: () => Promise<{ error?: string; ok?: true }>,
    options?: { successMessage?: string; onSuccess?: () => void },
  ) {
    setLoading(true);
    setError(null);
    setMessage(null);

    try {
      const result = await action();

      if (result.error) throw new Error(result.error);

      setMessage(options?.successMessage ?? "Saved");
      options?.onSuccess?.();
      router.refresh();
    } catch (err) {
      setError(actionErrorMessage(err));
    } finally {
      setLoading(false);
    }
  }

  function resetProgrammeCreateForm() {
    setProgrammeName("");
    setProgrammeCode("");
    setProgrammeDescription("");
    setShowProgrammeCreate(false);
  }

  function resetCategoryCreateForm() {
    setCategoryName("");
    setCategoryCode("");
    setShowCategoryCreate(false);
  }

  return (
    <div data-testid="programme-management">
      <div
        className="grid gap-8 lg:grid-cols-2"
        data-testid="programme-management-columns"
      >
        <section
          aria-labelledby="programmes-section-heading"
          className="flex flex-col gap-4"
          data-testid="programmes-section"
        >
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h2
              id="programmes-section-heading"
              className="text-base font-semibold"
            >
              Programmes
            </h2>
            <Button
              type="button"
              size="sm"
              variant="outline"
              disabled={loading}
              onClick={() => setShowProgrammeCreate((current) => !current)}
              data-testid="new-programme-button"
            >
              {showProgrammeCreate ? "Cancel" : "+ New programme"}
            </Button>
          </div>

          {showProgrammeCreate ? (
            <Card data-testid="programme-create-panel">
              <CardContent className="pt-6">
                <form
                  className="flex flex-col gap-3"
                  onSubmit={(event) => {
                    event.preventDefault();

                    runAction(
                      () =>
                        createSuggestionProgrammeDraft({
                          name: programmeName,
                          code: programmeCode,
                          ...(programmeDescription
                            ? { description: programmeDescription }
                            : {}),
                        }),
                      {
                        successMessage: "Programme draft created.",
                        onSuccess: resetProgrammeCreateForm,
                      },
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
          ) : null}

          <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
            <StatusFilterSelect
              id="programme-status-filter"
              label="Status"
              value={programmeStatusFilter}
              onChange={setProgrammeStatusFilter}
            />
            <label className="flex min-w-0 flex-1 flex-col gap-1 text-sm">
              <span className="text-muted-foreground">Search programmes</span>
              <Input
                id="programme-search"
                type="search"
                placeholder="Search programmes..."
                value={programmeSearch}
                onChange={(event) => setProgrammeSearch(event.target.value)}
              />
            </label>
          </div>

          <div className="flex flex-col gap-3">
            {filteredProgrammes.length === 0 ? (
              <div
                className="rounded-md border border-dashed border-border p-4 text-sm text-muted-foreground"
                data-testid="programme-empty-state"
              >
                <p>
                  {programmeEmptyStateMessage(
                    programmeStatusFilter,
                    programmeSearch,
                  )}
                </p>
                {programmeStatusFilter === "active" &&
                !programmeSearch.trim() ? (
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    className="mt-3"
                    disabled={loading}
                    onClick={() => setShowProgrammeCreate(true)}
                  >
                    + New programme
                  </Button>
                ) : null}
              </div>
            ) : (
              filteredProgrammes.map((programme) => (
                <ProgrammeCard
                  key={programme.id}
                  programme={programme}
                  programmeVersions={versionsByProgramme[programme.id] ?? []}
                  templateVersions={templateVersions}
                  disabled={loading}
                  onSaveDetails={(input) =>
                    runAction(() => updateSuggestionProgramme(input))
                  }
                  onSaveDraft={(input) =>
                    runAction(() => updateSuggestionProgrammeVersion(input))
                  }
                  onPublish={(versionId) =>
                    runAction(() =>
                      publishSuggestionProgrammeVersion(versionId),
                    )
                  }
                  onCreateSuccessor={() =>
                    runAction(() =>
                      createSuggestionProgrammeSuccessor(programme.id),
                    )
                  }
                  onDeactivate={() => {
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
                  onReactivate={() =>
                    runAction(() => reactivateSuggestionProgramme(programme.id))
                  }
                  onDeleteDraft={() => {
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
                />
              ))
            )}
          </div>
        </section>

        <section
          aria-labelledby="categories-section-heading"
          className="flex flex-col gap-4"
          data-testid="categories-section"
        >
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h2
              id="categories-section-heading"
              className="text-base font-semibold"
            >
              Categories
            </h2>
            <Button
              type="button"
              size="sm"
              variant="outline"
              disabled={loading}
              onClick={() => setShowCategoryCreate((current) => !current)}
              data-testid="new-category-button"
            >
              {showCategoryCreate ? "Cancel" : "+ New category"}
            </Button>
          </div>

          {showCategoryCreate ? (
            <Card data-testid="category-create-panel">
              <CardContent className="pt-6">
                <form
                  className="flex flex-col gap-3"
                  onSubmit={(event) => {
                    event.preventDefault();

                    runAction(
                      () =>
                        createSuggestionCategory({
                          name: categoryName,
                          code: categoryCode,
                        }),
                      {
                        successMessage: "Category created.",
                        onSuccess: resetCategoryCreateForm,
                      },
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
          ) : null}

          <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
            <StatusFilterSelect
              id="category-status-filter"
              label="Status"
              value={categoryStatusFilter}
              onChange={setCategoryStatusFilter}
            />
            <label className="flex min-w-0 flex-1 flex-col gap-1 text-sm">
              <span className="text-muted-foreground">Search categories</span>
              <Input
                id="category-search"
                type="search"
                placeholder="Search categories..."
                value={categorySearch}
                onChange={(event) => setCategorySearch(event.target.value)}
              />
            </label>
          </div>

          <div className="flex flex-col gap-2">
            {filteredCategories.length === 0 ? (
              <div
                className="rounded-md border border-dashed border-border p-4 text-sm text-muted-foreground"
                data-testid="category-empty-state"
              >
                <p>
                  {categoryEmptyStateMessage(
                    categoryStatusFilter,
                    categorySearch,
                  )}
                </p>
                {categoryStatusFilter === "active" && !categorySearch.trim() ? (
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    className="mt-3"
                    disabled={loading}
                    onClick={() => setShowCategoryCreate(true)}
                  >
                    + New category
                  </Button>
                ) : null}
              </div>
            ) : (
              filteredCategories.map((category) => (
                <CategoryRow
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
              ))
            )}
          </div>
        </section>
      </div>

      {message ? (
        <p className="mt-6 text-sm text-muted-foreground" role="status">
          {message}
        </p>
      ) : null}

      {error ? (
        <p className="mt-6 text-sm text-destructive" role="alert">
          {error}
        </p>
      ) : null}
    </div>
  );
}

function ProgrammeCard({
  programme,
  programmeVersions,
  templateVersions,
  disabled,
  onSaveDetails,
  onSaveDraft,
  onPublish,
  onCreateSuccessor,
  onDeactivate,
  onReactivate,
  onDeleteDraft,
}: {
  programme: Programme;
  programmeVersions: ProgrammeVersion[];
  templateVersions: TemplateVersion[];
  disabled: boolean;
  onSaveDetails: (input: {
    programmeId: string;
    name: string;
    description?: string | null;
  }) => void;
  onSaveDraft: (input: {
    versionId: string;
    reviewTargetDays?: number | null;
    templateVersionId?: string | null;
    submissionGuidance?: string | null;
  }) => void;
  onPublish: (versionId: string) => void;
  onCreateSuccessor: () => void;
  onDeactivate: () => void;
  onReactivate: () => void;
  onDeleteDraft: () => void;
}) {
  const draftVersion = programmeVersions.find(
    (version) => version.lifecycle === "draft",
  );
  const publishedVersion = programmeVersions.find(
    (version) => version.lifecycle === "published",
  );
  const archivedVersions = programmeVersions.filter(
    (version) => version.lifecycle === "archived",
  );
  const displayStatus = getProgrammeDisplayStatus(programme, programmeVersions);
  const isDraftProgramme = displayStatus === "draft";

  return (
    <Card data-testid={`programme-card-${programme.id}`}>
      <CardContent className="flex flex-col gap-3 pt-6 text-sm">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="font-medium text-foreground">{programme.name}</p>
            <p className="text-muted-foreground">{programme.code}</p>
          </div>
          <span
            className="rounded-full border border-border px-2 py-0.5 text-xs font-medium uppercase"
            data-testid={`programme-status-${programme.id}`}
          >
            {formatProgrammeDisplayStatus(displayStatus)}
          </span>
        </div>

        {programme.description ? (
          <p className="text-muted-foreground">{programme.description}</p>
        ) : null}

        {isDraftProgramme && draftVersion ? (
          <p className="text-muted-foreground">
            <span className="font-medium text-foreground">
              {formatVersionStatus(draftVersion.lifecycle)}
            </span>
            {" · "}
            Version {draftVersion.version_number}
          </p>
        ) : publishedVersion ? (
          <p className="text-muted-foreground">
            <span className="font-medium text-foreground">
              {formatVersionStatus(publishedVersion.lifecycle)}
            </span>
            {" · "}
            Version {publishedVersion.version_number}
            {publishedVersion.review_target_days
              ? ` · ${publishedVersion.review_target_days} day review SLA`
              : ""}
          </p>
        ) : null}

        {isDraftProgramme && draftVersion ? (
          <DraftProgrammeActions
            programme={programme}
            version={draftVersion}
            templateVersions={templateVersions}
            disabled={disabled}
            onSaveDetails={onSaveDetails}
            onSaveDraft={onSaveDraft}
            onPublish={() => onPublish(draftVersion.id)}
            onDeleteDraft={onDeleteDraft}
          />
        ) : (
          <PublishedProgrammeActions
            programme={programme}
            {...(draftVersion ? { draftVersion } : {})}
            {...(publishedVersion ? { publishedVersion } : {})}
            templateVersions={templateVersions}
            disabled={disabled}
            onSaveDetails={onSaveDetails}
            onSaveDraft={onSaveDraft}
            onPublish={(versionId) => onPublish(versionId)}
            onCreateSuccessor={onCreateSuccessor}
            onDeactivate={onDeactivate}
            onReactivate={onReactivate}
          />
        )}

        {archivedVersions.length > 0 ? (
          <details data-testid={`programme-archived-versions-${programme.id}`}>
            <summary className="cursor-pointer font-medium text-foreground">
              Previous versions ({archivedVersions.length})
            </summary>
            <ul className="mt-2 flex flex-col gap-1 text-muted-foreground">
              {archivedVersions.map((version) => (
                <li key={version.id}>
                  {formatVersionStatus(version.lifecycle)} · Version{" "}
                  {version.version_number}
                </li>
              ))}
            </ul>
          </details>
        ) : null}
      </CardContent>
    </Card>
  );
}

function PublishedProgrammeActions({
  programme,
  draftVersion,
  publishedVersion,
  templateVersions,
  disabled,
  onSaveDetails,
  onSaveDraft,
  onPublish,
  onCreateSuccessor,
  onDeactivate,
  onReactivate,
}: {
  programme: Programme;
  draftVersion?: ProgrammeVersion;
  publishedVersion?: ProgrammeVersion;
  templateVersions: TemplateVersion[];
  disabled: boolean;
  onSaveDetails: (input: {
    programmeId: string;
    name: string;
    description?: string | null;
  }) => void;
  onSaveDraft: (input: {
    versionId: string;
    reviewTargetDays?: number | null;
    templateVersionId?: string | null;
    submissionGuidance?: string | null;
  }) => void;
  onPublish: (versionId: string) => void;
  onCreateSuccessor: () => void;
  onDeactivate: () => void;
  onReactivate: () => void;
}) {
  const [editingDetails, setEditingDetails] = useState(false);
  const [editingDraft, setEditingDraft] = useState(false);

  if (programme.status === "deactivated") {
    return (
      <div className="flex flex-wrap gap-2">
        <Button
          size="sm"
          variant="outline"
          disabled={disabled}
          onClick={onReactivate}
        >
          Reactivate
        </Button>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      {editingDetails ? (
        <ProgrammeDetailsForm
          programme={programme}
          disabled={disabled}
          onSave={(input) => {
            onSaveDetails(input);
            setEditingDetails(false);
          }}
          onCancel={() => setEditingDetails(false)}
        />
      ) : (
        <div className="flex flex-wrap gap-2">
          <Button
            size="sm"
            variant="outline"
            disabled={disabled}
            onClick={() => setEditingDetails(true)}
          >
            Edit details
          </Button>
          {publishedVersion ? (
            <Button
              size="sm"
              variant="outline"
              disabled={disabled}
              onClick={onCreateSuccessor}
            >
              Create successor version
            </Button>
          ) : null}
          <Button
            size="sm"
            variant="outline"
            disabled={disabled}
            onClick={onDeactivate}
          >
            Deactivate
          </Button>
        </div>
      )}

      {draftVersion ? (
        editingDraft ? (
          <DraftVersionEditor
            version={draftVersion}
            templateVersions={templateVersions}
            disabled={disabled}
            onSave={(input) => {
              onSaveDraft(input);
              setEditingDraft(false);
            }}
            onPublish={() => onPublish(draftVersion.id)}
            onCancel={() => setEditingDraft(false)}
          />
        ) : (
          <div className="flex flex-wrap gap-2">
            <Button
              size="sm"
              variant="outline"
              disabled={disabled}
              onClick={() => setEditingDraft(true)}
            >
              Edit draft
            </Button>
            <Button
              size="sm"
              disabled={disabled}
              onClick={() => onPublish(draftVersion.id)}
            >
              Publish
            </Button>
          </div>
        )
      ) : null}
    </div>
  );
}

function DraftProgrammeActions({
  programme,
  version,
  templateVersions,
  disabled,
  onSaveDetails,
  onSaveDraft,
  onPublish,
  onDeleteDraft,
}: {
  programme: Programme;
  version: ProgrammeVersion;
  templateVersions: TemplateVersion[];
  disabled: boolean;
  onSaveDetails: (input: {
    programmeId: string;
    name: string;
    description?: string | null;
  }) => void;
  onSaveDraft: (input: {
    versionId: string;
    reviewTargetDays?: number | null;
    templateVersionId?: string | null;
    submissionGuidance?: string | null;
  }) => void;
  onPublish: () => void;
  onDeleteDraft: () => void;
}) {
  const [editingDetails, setEditingDetails] = useState(false);
  const [editingDraft, setEditingDraft] = useState(false);

  return (
    <div className="flex flex-col gap-3">
      {editingDetails ? (
        <ProgrammeDetailsForm
          programme={programme}
          disabled={disabled}
          onSave={(input) => {
            onSaveDetails(input);
            setEditingDetails(false);
          }}
          onCancel={() => setEditingDetails(false)}
        />
      ) : editingDraft ? (
        <DraftVersionEditor
          version={version}
          templateVersions={templateVersions}
          disabled={disabled}
          onSave={(input) => {
            onSaveDraft(input);
            setEditingDraft(false);
          }}
          onPublish={onPublish}
          onCancel={() => setEditingDraft(false)}
        />
      ) : (
        <div className="flex flex-wrap gap-2">
          <Button
            size="sm"
            variant="outline"
            disabled={disabled}
            onClick={() => setEditingDraft(true)}
          >
            Edit draft
          </Button>
          <Button size="sm" disabled={disabled} onClick={onPublish}>
            Publish
          </Button>
          <Button
            size="sm"
            variant="destructive"
            disabled={disabled}
            onClick={onDeleteDraft}
          >
            Delete draft
          </Button>
          <Button
            size="sm"
            variant="ghost"
            disabled={disabled}
            onClick={() => setEditingDetails(true)}
          >
            Edit details
          </Button>
        </div>
      )}
    </div>
  );
}

function ProgrammeDetailsForm({
  programme,
  disabled,
  onSave,
  onCancel,
}: {
  programme: Programme;
  disabled: boolean;
  onSave: (input: {
    programmeId: string;
    name: string;
    description?: string | null;
  }) => void;
  onCancel: () => void;
}) {
  const [name, setName] = useState(programme.name);
  const [description, setDescription] = useState(programme.description ?? "");

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
            onClick={onCancel}
          >
            Cancel
          </Button>
        </div>
      </div>
    </div>
  );
}

function CategoryRow({
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
      className="rounded-md border border-border px-3 py-2"
      data-testid={`category-row-${category.id}`}
    >
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="min-w-0">
          <p className="font-medium text-foreground">{category.name}</p>
          <p className="text-xs text-muted-foreground">{category.code}</p>
        </div>
        <span className="rounded-full border border-border px-2 py-0.5 text-xs font-medium uppercase">
          {formatCategoryDisplayStatus(category.status)}
        </span>
      </div>

      {expanded ? (
        <div className="mt-3 flex flex-col gap-3 border-t border-border pt-3">
          <label className="flex flex-col gap-1 text-sm">
            <Label htmlFor={`category-name-${category.id}`}>Name</Label>
            <Input
              id={`category-name-${category.id}`}
              value={name}
              onChange={(event) => setName(event.target.value)}
            />
          </label>
          <label className="flex flex-col gap-1 text-sm">
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
          <label className="flex flex-col gap-1 text-sm">
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
        <div className="mt-2 flex flex-wrap gap-2">
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
            <>
              <Button
                size="sm"
                variant="outline"
                disabled={disabled}
                onClick={onReactivate}
              >
                Reactivate
              </Button>
              <Button
                size="sm"
                variant="destructive"
                disabled={disabled}
                onClick={onDelete}
              >
                Delete
              </Button>
            </>
          )}
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
  onCancel,
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
  onCancel: () => void;
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
          <Button
            size="sm"
            variant="ghost"
            disabled={disabled}
            onClick={onCancel}
          >
            Cancel
          </Button>
        </div>
      </div>
    </div>
  );
}

export { programmeHasPublishedHistory, getProgrammeDisplayStatus };
