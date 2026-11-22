import { describe, expect, it } from "vitest";

import { formHasUserDraft } from "@/components/ui/use-form-dialog-guard";

describe("formHasUserDraft", () => {
  it("detects values in editable fields and ignores hidden inputs", () => {
    const form = document.createElement("form");
    form.innerHTML = `
      <input type="hidden" name="assessmentId" value="a-1" />
      <input type="text" name="title" value="" />
      <textarea name="description"></textarea>
    `;
    document.body.appendChild(form);

    expect(formHasUserDraft(form)).toBe(false);

    const title = form.querySelector<HTMLInputElement>('input[name="title"]');
    title!.value = "Draft title";

    expect(formHasUserDraft(form)).toBe(true);
    form.remove();
  });
});
