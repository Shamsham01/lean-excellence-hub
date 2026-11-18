"use client";

import Link from "next/link";
import { useId, useRef, useState, type FormEvent } from "react";

import { Button } from "@/components/ui/button";
import {
  CI_AREAS,
  EMPLOYEE_RANGES,
  HONEYPOT_FIELD,
  earlyAccessMessages,
  validateEarlyAccess,
  type EarlyAccessErrors,
  type EarlyAccessField,
} from "@/lib/marketing/early-access";
import { GET_FREE_ACCESS_CTA } from "@/lib/marketing/demo-booking";
import { landingCopy } from "@/lib/marketing/landing-copy";
import { cn } from "@/lib/utils";

import { RequestDemoControl } from "./primitives";

const copy = landingCopy;

type Values = {
  fullName: string;
  workEmail: string;
  company: string;
  role: string;
  sites: string;
  employees: string;
  ciAreas: string[];
  consent: boolean;
  marketingOptIn: boolean;
  [HONEYPOT_FIELD]: string;
};

const EMPTY: Values = {
  fullName: "",
  workEmail: "",
  company: "",
  role: "",
  sites: "",
  employees: "",
  ciAreas: [],
  consent: false,
  marketingOptIn: false,
  [HONEYPOT_FIELD]: "",
};

const ORDER: EarlyAccessField[] = [
  "fullName",
  "workEmail",
  "company",
  "role",
  "sites",
  "employees",
  "ciAreas",
  "consent",
];

type Status = "idle" | "submitting" | "success";

export function EarlyAccessForm() {
  const id = useId();
  const [values, setValues] = useState<Values>(EMPTY);
  const [touched, setTouched] = useState<
    Partial<Record<EarlyAccessField, boolean>>
  >({});
  const [submitted, setSubmitted] = useState(false);
  const [status, setStatus] = useState<Status>("idle");
  const [formError, setFormError] = useState<string | null>(null);
  const [serverErrors, setServerErrors] = useState<EarlyAccessErrors>({});
  const formRef = useRef<HTMLFormElement>(null);
  const successRef = useRef<HTMLHeadingElement>(null);

  const result = validateEarlyAccess(values);
  const clientErrors: EarlyAccessErrors = result.ok ? {} : result.errors;

  function errorFor(field: EarlyAccessField) {
    if (!(submitted || touched[field])) return undefined;
    return clientErrors[field] ?? serverErrors[field];
  }

  function set<K extends keyof Values>(key: K, value: Values[K]) {
    setValues((current) => ({ ...current, [key]: value }));
    if (key in serverErrors) {
      setServerErrors((current) => ({ ...current, [key]: undefined }));
    }
  }

  function blur(field: EarlyAccessField) {
    setTouched((current) => ({ ...current, [field]: true }));
  }

  function focusFirstInvalid(errors: EarlyAccessErrors) {
    const first = ORDER.find((field) => errors[field]);
    if (!first) return;
    const target = formRef.current?.querySelector<HTMLElement>(
      `[data-field="${first}"]`,
    );
    target?.focus();
  }

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (status === "submitting") return;
    setSubmitted(true);
    setFormError(null);

    if (!result.ok) {
      focusFirstInvalid(result.errors);
      return;
    }

    setStatus("submitting");
    try {
      const response = await fetch("/api/early-access", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...values,
          sourcePage: window.location.pathname,
        }),
      });
      const body = (await response.json().catch(() => ({}))) as {
        error?: string;
        message?: string;
        fields?: EarlyAccessErrors;
      };

      if (response.ok) {
        setStatus("success");
        requestAnimationFrame(() => successRef.current?.focus());
        return;
      }

      setStatus("idle");
      if (response.status === 422 && body.fields) {
        setServerErrors(body.fields);
        focusFirstInvalid(body.fields);
        return;
      }
      if (response.status === 503) {
        setFormError(body.message ?? earlyAccessMessages.notConfigured);
        return;
      }
      if (response.status === 429) {
        setFormError(earlyAccessMessages.rateLimited);
        return;
      }
      setFormError(earlyAccessMessages.failed);
    } catch {
      setStatus("idle");
      setFormError(earlyAccessMessages.failed);
    }
  }

  if (status === "success") {
    return (
      <div className="lv-form-success" role="status">
        <h3 ref={successRef} tabIndex={-1}>
          {copy.access.successTitle}
        </h3>
        <p>{copy.access.successBody}</p>
        <RequestDemoControl />
      </div>
    );
  }

  const describedBy = (field: EarlyAccessField) =>
    errorFor(field) ? `${id}-${field}-error` : undefined;

  function errorText(field: EarlyAccessField) {
    const message = errorFor(field);
    return message ? (
      <p id={`${id}-${field}-error`} className="lv-field-error">
        {message}
      </p>
    ) : null;
  }

  function textField({
    field,
    type = "text",
    autoComplete,
    inputMode,
    pattern,
  }: {
    field: "fullName" | "workEmail" | "company" | "role" | "sites";
    type?: "text" | "email";
    autoComplete?: string;
    inputMode?: "numeric" | "email" | "text";
    pattern?: string;
  }) {
    const meta = copy.fields[field];
    const error = errorFor(field);
    return (
      <div className={cn("lv-field", field === "sites" && "lv-field-sites")}>
        <label htmlFor={`${id}-${field}`}>{meta.label}</label>
        <input
          id={`${id}-${field}`}
          data-field={field}
          name={field}
          type={type}
          value={values[field]}
          placeholder={meta.placeholder}
          autoComplete={autoComplete}
          inputMode={inputMode}
          pattern={pattern}
          required
          aria-required="true"
          aria-invalid={error ? true : undefined}
          aria-describedby={describedBy(field)}
          onChange={(event) => set(field, event.target.value)}
          onBlur={() => blur(field)}
        />
        {errorText(field)}
      </div>
    );
  }

  return (
    <form
      ref={formRef}
      className="lv-form"
      noValidate
      onSubmit={onSubmit}
      aria-describedby={formError ? `${id}-form-error` : undefined}
    >
      <div className="lv-form-grid">
        {textField({ field: "fullName", autoComplete: "name" })}
        {textField({
          field: "workEmail",
          type: "email",
          autoComplete: "email",
          inputMode: "email",
        })}
        {textField({ field: "company", autoComplete: "organization" })}
        {textField({ field: "role", autoComplete: "organization-title" })}
        {textField({
          field: "sites",
          autoComplete: "off",
          inputMode: "numeric",
          pattern: "[0-9]*",
        })}
        <div className="lv-field">
          <label htmlFor={`${id}-employees`}>
            {copy.fields.employees.label}
          </label>
          <select
            id={`${id}-employees`}
            data-field="employees"
            name="employees"
            value={values.employees}
            required
            aria-required="true"
            aria-invalid={errorFor("employees") ? true : undefined}
            aria-describedby={describedBy("employees")}
            onChange={(event) => {
              set("employees", event.target.value);
              blur("employees");
            }}
            onBlur={() => blur("employees")}
            data-empty={values.employees ? undefined : "true"}
          >
            <option value="" disabled>
              {copy.fields.employees.placeholder}
            </option>
            {EMPLOYEE_RANGES.map((range) => (
              <option key={range} value={range}>
                {range}
              </option>
            ))}
          </select>
          {errorText("employees")}
        </div>
      </div>

      <fieldset
        className="lv-chips"
        aria-describedby={describedBy("ciAreas")}
        aria-invalid={errorFor("ciAreas") ? true : undefined}
      >
        <legend>{copy.fields.ciAreas.label}</legend>
        <div className="lv-chip-list">
          {CI_AREAS.map((area, index) => {
            const checked = values.ciAreas.includes(area);
            return (
              <label
                key={area}
                className="lv-chip"
                data-checked={checked || undefined}
              >
                <input
                  type="checkbox"
                  name="ciAreas"
                  value={area}
                  checked={checked}
                  data-field={index === 0 ? "ciAreas" : undefined}
                  onChange={(event) => {
                    set(
                      "ciAreas",
                      event.target.checked
                        ? [...values.ciAreas, area]
                        : values.ciAreas.filter((item) => item !== area),
                    );
                    blur("ciAreas");
                  }}
                />
                <span>{area}</span>
              </label>
            );
          })}
        </div>
        {errorText("ciAreas")}
      </fieldset>

      <div className="lv-honeypot" aria-hidden="true">
        <label htmlFor={`${id}-${HONEYPOT_FIELD}`}>Website</label>
        <input
          id={`${id}-${HONEYPOT_FIELD}`}
          name={HONEYPOT_FIELD}
          type="text"
          tabIndex={-1}
          autoComplete="off"
          value={values[HONEYPOT_FIELD]}
          onChange={(event) => set(HONEYPOT_FIELD, event.target.value)}
        />
      </div>

      <div className="lv-consents">
        <div className="lv-check">
          <input
            id={`${id}-consent`}
            data-field="consent"
            type="checkbox"
            name="consent"
            checked={values.consent}
            required
            aria-required="true"
            aria-invalid={errorFor("consent") ? true : undefined}
            aria-describedby={describedBy("consent")}
            onChange={(event) => {
              set("consent", event.target.checked);
              blur("consent");
            }}
          />
          <label htmlFor={`${id}-consent`}>
            I agree to the <Link href="/terms">Terms</Link> and I&apos;m happy
            for Lean Excellence Hub to contact me about early access and the
            product. I can withdraw at any time. See our{" "}
            <Link href="/privacy">Privacy Policy</Link>.
          </label>
        </div>
        {errorText("consent")}
        <div className="lv-check">
          <input
            id={`${id}-marketing`}
            type="checkbox"
            name="marketingOptIn"
            checked={values.marketingOptIn}
            onChange={(event) => set("marketingOptIn", event.target.checked)}
          />
          <label htmlFor={`${id}-marketing`}>
            Also send me occasional product news and updates. You can
            unsubscribe at any time.
          </label>
        </div>
      </div>

      {formError ? (
        <p id={`${id}-form-error`} className="lv-form-error" role="alert">
          {formError}
        </p>
      ) : null}

      <div className="lv-submit">
        <Button
          type="submit"
          size="lg"
          className="marketing-cta"
          disabled={status === "submitting"}
          aria-disabled={status === "submitting" || undefined}
        >
          {status === "submitting"
            ? copy.access.submitting
            : GET_FREE_ACCESS_CTA}
        </Button>
        <p className="lv-form-note">
          {copy.access.privacyNote} See our{" "}
          <Link href="/privacy">Privacy Policy</Link> and{" "}
          <Link href="/terms">Terms</Link>.
        </p>
      </div>
    </form>
  );
}
