"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

import {
  archiveBenefitCategory,
  createBenefitCategory,
  upsertBenefitReportingSettings,
} from "@/app/(platform)/platform/benefits/actions";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import type { BenefitCategoryRow, BenefitReportingSettingsRow } from "@/lib/benefits/types";

type BenefitCategoryManagementProps = {
  categories: BenefitCategoryRow[];
  reportingSettings: BenefitReportingSettingsRow | null;
};

export function BenefitCategoryManagement({
  categories,
  reportingSettings,
}: BenefitCategoryManagementProps) {
  const router = useRouter();
  const [message, setMessage] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [code, setCode] = useState("");
  const [description, setDescription] = useState("");
  const [fiscalMonth, setFiscalMonth] = useState(
    String(reportingSettings?.fiscal_year_start_month ?? 1),
  );

  async function handleCreateCategory() {
    if (!name.trim() || !code.trim()) {
      setMessage("Name and code are required");
      return;
    }
    const result = await createBenefitCategory({
      name: name.trim(),
      code: code.trim(),
      ...(description.trim() ? { description: description.trim() } : {}),
    });
    setMessage(result.error ?? "Category created");
    if (!result.error) {
      setName("");
      setCode("");
      setDescription("");
    }
    router.refresh();
  }

  async function handleArchiveCategory(categoryId: string) {
    const result = await archiveBenefitCategory(categoryId);
    setMessage(result.error ?? "Category archived");
    router.refresh();
  }

  async function handleSaveSettings() {
    const month = Number(fiscalMonth);
    if (month < 1 || month > 12) {
      setMessage("Fiscal month must be between 1 and 12");
      return;
    }
    const result = await upsertBenefitReportingSettings(month);
    setMessage(result.error ?? "Reporting settings updated");
    router.refresh();
  }

  return (
    <div className="flex flex-col gap-6" data-testid="benefit-category-management">
      <Card>
        <CardHeader>
          <CardTitle>Reporting settings</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-4 sm:max-w-sm">
          <div className="flex flex-col gap-2">
            <Label>Fiscal year start month</Label>
            <Input
              type="number"
              min={1}
              max={12}
              value={fiscalMonth}
              onChange={(e) => setFiscalMonth(e.target.value)}
            />
          </div>
          <Button size="sm" onClick={() => handleSaveSettings()}>
            Save settings
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Create category</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-3 sm:grid-cols-2">
          <div className="flex flex-col gap-2">
            <Label>Name</Label>
            <Input value={name} onChange={(e) => setName(e.target.value)} />
          </div>
          <div className="flex flex-col gap-2">
            <Label>Code</Label>
            <Input value={code} onChange={(e) => setCode(e.target.value)} />
          </div>
          <div className="flex flex-col gap-2 sm:col-span-2">
            <Label>Description</Label>
            <Textarea rows={2} value={description} onChange={(e) => setDescription(e.target.value)} />
          </div>
          <Button size="sm" className="sm:col-span-2" onClick={() => handleCreateCategory()}>
            Add category
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Categories</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-2">
          {categories.length === 0 ? (
            <p className="text-sm text-muted-foreground">No categories configured yet.</p>
          ) : (
            categories.map((category) => (
              <div
                key={category.id}
                className="flex flex-col gap-2 rounded-lg border border-border px-3 py-3 sm:flex-row sm:items-center sm:justify-between"
              >
                <div>
                  <p className="font-medium">{category.name}</p>
                  <p className="text-sm text-muted-foreground">
                    {category.code}
                    {category.description ? ` · ${category.description}` : ""}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-xs text-muted-foreground">{category.status}</span>
                  {category.status === "active" ? (
                    <Button size="sm" variant="outline" onClick={() => handleArchiveCategory(category.id)}>
                      Archive
                    </Button>
                  ) : null}
                </div>
              </div>
            ))
          )}
        </CardContent>
      </Card>

      {message ? (
        <p className="rounded-md border border-border bg-muted/30 px-3 py-2 text-sm text-muted-foreground">
          {message}
        </p>
      ) : null}
    </div>
  );
}
