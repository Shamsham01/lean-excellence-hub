"use client";

import { useState } from "react";

import {
  addCiProjectMethodologyPhase,
  createCiProjectMethodologySuccessorVersion,
  publishCiProjectMethodologyVersion,
} from "@/app/(platform)/platform/projects/actions";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import type {
  MethodologyPhaseRow,
  MethodologyVersionRow,
} from "@/lib/projects/types";

type MethodologyEditorProps = {
  methodologyId: string;
  methodologyName: string;
  methodologyCode: string;
  versions: MethodologyVersionRow[];
  phases: MethodologyPhaseRow[];
  canManage: boolean;
};

export function MethodologyEditor({
  methodologyId,
  methodologyName,
  methodologyCode,
  versions,
  phases,
  canManage,
}: MethodologyEditorProps) {
  const draftVersion = versions.find((version) => version.status === "draft");
  const publishedVersion = versions.find(
    (version) => version.status === "published",
  );
  const draftPhases = phases.filter(
    (phase) => phase.methodology_version_id === draftVersion?.id,
  );

  const [message, setMessage] = useState<string | null>(null);
  const [phaseKey, setPhaseKey] = useState("");
  const [phaseTitle, setPhaseTitle] = useState("");
  const [phaseDescription, setPhaseDescription] = useState("");

  async function handleAddPhase() {
    if (!draftVersion || !phaseKey.trim() || !phaseTitle.trim()) return;
    try {
      await addCiProjectMethodologyPhase({
        methodologyVersionId: draftVersion.id,
        phaseKey: phaseKey.trim(),
        title: phaseTitle.trim(),
        displayOrder: draftPhases.length + 1,
        ...(phaseDescription.trim()
          ? { description: phaseDescription.trim() }
          : {}),
      });
      setPhaseKey("");
      setPhaseTitle("");
      setPhaseDescription("");
      setMessage("Phase added");
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "Failed to add phase");
    }
  }

  async function handlePublish() {
    if (!draftVersion) return;
    try {
      await publishCiProjectMethodologyVersion(draftVersion.id);
      setMessage("Methodology version published");
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "Publish failed");
    }
  }

  async function handleSuccessor() {
    try {
      await createCiProjectMethodologySuccessorVersion(methodologyId);
      setMessage("Successor draft created");
    } catch (err) {
      setMessage(
        err instanceof Error ? err.message : "Successor creation failed",
      );
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="typography-page-title">{methodologyName}</h1>
        <p className="text-sm text-muted-foreground">{methodologyCode}</p>
      </div>

      {message ? (
        <p className="text-sm text-muted-foreground">{message}</p>
      ) : null}

      <Card>
        <CardHeader>
          <CardTitle>Versions</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-2">
          {versions.map((version) => (
            <div
              key={version.id}
              className="flex items-center justify-between rounded-md border border-border px-3 py-2 text-sm"
            >
              <span>Version {version.version_number}</span>
              <Badge variant="outline">{version.status}</Badge>
            </div>
          ))}
          {canManage && publishedVersion && !draftVersion ? (
            <Button size="sm" variant="outline" onClick={handleSuccessor}>
              Create successor draft
            </Button>
          ) : null}
        </CardContent>
      </Card>

      {draftVersion ? (
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle>Draft phases</CardTitle>
            {canManage ? (
              <Button
                size="sm"
                onClick={handlePublish}
                disabled={draftPhases.length === 0}
              >
                Publish version
              </Button>
            ) : null}
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
            {draftPhases.map((phase) => (
              <div
                key={phase.id}
                className="rounded-md border border-border px-3 py-2 text-sm"
              >
                <p className="font-medium">
                  {phase.display_order}. {phase.title}
                </p>
                <p className="text-muted-foreground">{phase.phase_key}</p>
                {phase.description ? (
                  <p className="text-muted-foreground">{phase.description}</p>
                ) : null}
              </div>
            ))}

            {canManage ? (
              <div className="flex flex-col gap-2 rounded-lg border border-dashed border-border p-3">
                <Input
                  placeholder="Phase key"
                  value={phaseKey}
                  onChange={(e) => setPhaseKey(e.target.value)}
                />
                <Input
                  placeholder="Phase title"
                  value={phaseTitle}
                  onChange={(e) => setPhaseTitle(e.target.value)}
                />
                <Textarea
                  rows={2}
                  placeholder="Description (optional)"
                  value={phaseDescription}
                  onChange={(e) => setPhaseDescription(e.target.value)}
                />
                <Button size="sm" variant="outline" onClick={handleAddPhase}>
                  Add phase
                </Button>
              </div>
            ) : null}
          </CardContent>
        </Card>
      ) : null}

      {publishedVersion ? (
        <Card>
          <CardHeader>
            <CardTitle>Published phases</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-2">
            {phases
              .filter(
                (phase) => phase.methodology_version_id === publishedVersion.id,
              )
              .map((phase) => (
                <div
                  key={phase.id}
                  className="rounded-md border border-border px-3 py-2 text-sm"
                >
                  {phase.display_order}. {phase.title}
                </div>
              ))}
          </CardContent>
        </Card>
      ) : null}
    </div>
  );
}
