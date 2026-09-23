import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

function readSource(path: string) {
  return readFileSync(path, "utf8");
}

describe("NAV-CLICK-001 Training navigation primitives", () => {
  it("uses AppLink on the training hub matrix, courses, curriculum, and sessions controls", () => {
    const source = readSource("src/app/(platform)/platform/training/page.tsx");

    expect(source).toContain('from "@/components/ui/app-link"');
    expect(source).toContain('data-testid="training-matrix-link"');
    expect(source).toContain('data-testid="training-courses-link"');
    expect(source).toContain('data-testid="training-curriculum-link"');
    expect(source).toContain('data-testid="training-sessions-link"');
    expect(source).toContain('href="/platform/training/matrix"');
    expect(source).toContain('href="/platform/training/courses"');
    expect(source).toContain('href="/platform/training/curriculum"');
    expect(source).toContain('href="/platform/training/sessions"');
    expect(source).not.toMatch(/from ["']next\/link["']/);
  });

  it("uses AppLink for course list, course detail Back, sessions, session Back, curriculum, and matrix Back", () => {
    const courses = readSource(
      "src/app/(platform)/platform/training/courses/page.tsx",
    );
    const courseDetail = readSource(
      "src/app/(platform)/platform/training/courses/[id]/page.tsx",
    );
    const sessions = readSource(
      "src/app/(platform)/platform/training/sessions/page.tsx",
    );
    const sessionDetail = readSource(
      "src/app/(platform)/platform/training/sessions/[id]/page.tsx",
    );
    const curriculum = readSource(
      "src/app/(platform)/platform/training/curriculum/page.tsx",
    );
    const matrix = readSource(
      "src/app/(platform)/platform/training/matrix/page.tsx",
    );

    expect(courses).toContain('from "@/components/ui/app-link"');
    expect(courses).toContain('data-testid="training-courses-back-link"');
    expect(courses).toContain('data-testid="training-course-new-button"');
    expect(courses).toContain('href="/platform/training/courses?new=1"');
    expect(courseDetail).toContain('data-testid="training-course-back-link"');
    expect(sessions).toContain('data-testid="training-sessions-back-link"');
    expect(sessionDetail).toContain('data-testid="training-session-back-link"');
    expect(sessionDetail).toContain(
      'data-testid="training-session-course-link"',
    );
    expect(curriculum).toContain('data-testid="training-curriculum-back-link"');
    expect(matrix).toContain('data-testid="training-matrix-back-link"');
    expect(courses).not.toMatch(/from ["']next\/link["']/);
    expect(courseDetail).not.toMatch(/from ["']next\/link["']/);
    expect(sessions).not.toMatch(/from ["']next\/link["']/);
    expect(sessionDetail).not.toMatch(/from ["']next\/link["']/);
    expect(curriculum).not.toMatch(/from ["']next\/link["']/);
    expect(matrix).not.toMatch(/from ["']next\/link["']/);
  });

  it("opens a newly created training course with navigateTo instead of a push/refresh race", () => {
    const createForm = readSource(
      "src/components/training/course-create-form.tsx",
    );
    const draftEditor = readSource(
      "src/components/training/course-draft-editor.tsx",
    );
    const actions = readSource(
      "src/app/(platform)/platform/training/actions.ts",
    );

    expect(createForm).toContain('from "@/lib/navigation/navigate"');
    expect(createForm).toContain("navigateTo(");
    expect(createForm).toContain(
      "`/platform/training/courses/${result.courseId}`",
    );
    expect(createForm).not.toMatch(/router\.push\(/);
    expect(draftEditor).toContain("navigateTo(");
    expect(actions).toContain("create_training_course_draft");
    expect(actions).toContain("publish_training_course_version");
    expect(actions).toContain("TRAINING_PERMISSIONS.catalogManage");
  });

  it("keeps bulk completion as a same-page refresh rather than a create-and-open race", () => {
    const source = readSource(
      "src/components/training/bulk-completion-dialog.tsx",
    );

    expect(source).toContain("router.refresh()");
    expect(source).not.toMatch(/router\.push\(/);
  });
});

describe("NAV-CLICK-001 Skills navigation primitives", () => {
  it("uses AppLink on the skills hub catalogue and matrix controls", () => {
    const source = readSource("src/app/(platform)/platform/skills/page.tsx");

    expect(source).toContain('from "@/components/ui/app-link"');
    expect(source).toContain('data-testid="skills-matrix-link"');
    expect(source).toContain('data-testid="skills-catalog-link"');
    expect(source).toContain('href="/platform/skills/matrix"');
    expect(source).toContain('href="/platform/skills/catalog"');
    expect(source).not.toMatch(/from ["']next\/link["']/);
  });

  it("uses AppLink for catalogue rows, skill detail Back, and matrix person/skill links", () => {
    const catalog = readSource(
      "src/app/(platform)/platform/skills/catalog/page.tsx",
    );
    const detail = readSource(
      "src/app/(platform)/platform/skills/[id]/page.tsx",
    );
    const matrixPage = readSource(
      "src/app/(platform)/platform/skills/matrix/page.tsx",
    );
    const matrix = readSource("src/components/skills/skills-matrix.tsx");

    expect(catalog).toContain('data-testid="skills-catalog-back-link"');
    expect(catalog).toContain("href={`/platform/skills/${skill.id}`}");
    expect(detail).toContain('data-testid="skills-detail-back-link"');
    expect(detail).toContain('href="/platform/skills/catalog"');
    expect(matrixPage).toContain('data-testid="skills-matrix-back-link"');
    expect(matrix).toContain("href={`/platform/people/${membership.id}`}");
    expect(matrix).toContain("href={`/platform/skills/${skill.id}`}");
    expect(catalog).not.toMatch(/from ["']next\/link["']/);
    expect(detail).not.toMatch(/from ["']next\/link["']/);
    expect(matrixPage).not.toMatch(/from ["']next\/link["']/);
  });
});

describe("NAV-CLICK-001 Recognition navigation primitives", () => {
  it("uses AppLink on the recognition hub Award and Types controls", () => {
    const source = readSource(
      "src/app/(platform)/platform/recognition/page.tsx",
    );

    expect(source).toContain('from "@/components/ui/app-link"');
    expect(source).toContain('data-testid="recognition-award-link"');
    expect(source).toContain('data-testid="recognition-types-link"');
    expect(source).toContain('href="/platform/recognition/new"');
    expect(source).toContain('href="/platform/recognition/types"');
    expect(source).toContain("href={`/platform/recognition/${item.id}`}");
    expect(source).not.toMatch(/from ["']next\/link["']/);
  });

  it("uses AppLink for types Back, new Back, history rows, and detail Back/recipient/source", () => {
    const types = readSource(
      "src/app/(platform)/platform/recognition/types/page.tsx",
    );
    const createPage = readSource(
      "src/app/(platform)/platform/recognition/new/page.tsx",
    );
    const detail = readSource(
      "src/app/(platform)/platform/recognition/[id]/page.tsx",
    );
    const history = readSource(
      "src/components/recognition/recognition-history.tsx",
    );

    expect(types).toContain('data-testid="recognition-types-back-link"');
    expect(createPage).toContain('data-testid="recognition-new-back-link"');
    expect(detail).toContain('data-testid="recognition-detail-back-link"');
    expect(detail).toContain('data-testid="recognition-source-link"');
    expect(detail).toContain("improvement_suggestions");
    expect(detail).not.toContain("resource_records");
    expect(history).toContain("href={`/platform/recognition/${award.id}`}");
    expect(types).not.toMatch(/from ["']next\/link["']/);
    expect(createPage).not.toMatch(/from ["']next\/link["']/);
    expect(detail).not.toMatch(/from ["']next\/link["']/);
  });

  it("opens a newly awarded recognition with navigateTo instead of a push/refresh race", () => {
    const source = readSource(
      "src/components/recognition/award-recognition-form.tsx",
    );
    const actions = readSource(
      "src/app/(platform)/platform/recognition/actions.ts",
    );

    expect(source).toContain('from "@/lib/navigation/navigate"');
    expect(source).toContain("navigateTo(");
    expect(source).toContain("`/platform/recognition/${result.id}`");
    expect(source).not.toMatch(/router\.push\(/);
    expect(source).not.toMatch(/router\.refresh\(/);
    expect(source).not.toMatch(/from ["']next\/link["']/);
    expect(actions).toContain("id: data as string");
    expect(actions).toContain('revalidatePath("/platform/recognition")');
  });

  it("signs into the compiled nav-click spec once so the workforce shard stays under GoTrue limits", () => {
    const source = readSource(
      "tests/e2e/training-skills-recognition-nav-click.spec.ts",
    );
    const signIns = source.match(/signInAsDemoUser\(/g) ?? [];

    expect(signIns).toHaveLength(1);
    expect(source).toContain("test.beforeAll");
  });

  it("keeps type create and revoke as same-page refreshes", () => {
    const types = readSource(
      "src/components/recognition/recognition-type-management.tsx",
    );
    const history = readSource(
      "src/components/recognition/recognition-history.tsx",
    );

    expect(types).toContain("router.refresh()");
    expect(types).not.toMatch(/router\.push\(/);
    expect(history).toContain("router.refresh()");
    expect(history).not.toMatch(/router\.push\(/);
  });
});
