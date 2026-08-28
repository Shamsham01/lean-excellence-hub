"use client";

import { useMemo, useState } from "react";

import { ContextualHelpLabel } from "@/components/help/contextual-help";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

type JobFunction = {
  id: string;
  name: string;
  code: string;
  description: string | null;
};

type JobFunctionsListProps = {
  jobFunctions: JobFunction[];
  canManage: boolean;
  onCreate: (input: {
    name: string;
    code: string;
    description?: string;
  }) => Promise<{ error?: string; ok?: true }>;
};

export function JobFunctionsList({
  jobFunctions,
  canManage,
  onCreate,
}: JobFunctionsListProps) {
  const [search, setSearch] = useState("");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [name, setName] = useState("");
  const [code, setCode] = useState("");
  const [description, setDescription] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const filtered = useMemo(() => {
    const query = search.trim().toLowerCase();
    if (!query) return jobFunctions;
    return jobFunctions.filter(
      (jobFunction) =>
        jobFunction.name.toLowerCase().includes(query) ||
        jobFunction.code.toLowerCase().includes(query) ||
        (jobFunction.description ?? "").toLowerCase().includes(query),
    );
  }, [jobFunctions, search]);

  async function handleCreate(event: React.FormEvent) {
    event.preventDefault();
    setLoading(true);
    setMessage(null);

    const result = await onCreate({
      name: name.trim(),
      code: code.trim(),
      ...(description.trim() ? { description: description.trim() } : {}),
    });

    if (result.error) {
      setMessage(result.error);
    } else {
      setName("");
      setCode("");
      setDescription("");
      setMessage(null);
      setDialogOpen(false);
    }

    setLoading(false);
  }

  return (
    <div className="flex flex-col gap-4" data-testid="job-functions-list">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-col gap-1">
          <p className="text-sm text-muted-foreground">
            <ContextualHelpLabel topic="job-function">
              Job functions
            </ContextualHelpLabel>{" "}
            describe what people do at work. They do not grant application
            permissions.
          </p>
        </div>
        {canManage ? (
          <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
            <DialogTrigger asChild>
              <Button type="button" data-testid="add-job-function-button">
                Add job function
              </Button>
            </DialogTrigger>
            <DialogContent>
              <form
                onSubmit={handleCreate}
                data-testid="job-function-create-form"
              >
                <DialogHeader>
                  <DialogTitle>Add job function</DialogTitle>
                  <DialogDescription>
                    Define a role people perform in your organisation, such as
                    Team Leader or Quality Technician.
                  </DialogDescription>
                </DialogHeader>
                <div className="flex flex-col gap-4 py-4">
                  <div className="flex flex-col gap-2">
                    <Label htmlFor="jf-name">Name</Label>
                    <Input
                      id="jf-name"
                      value={name}
                      onChange={(event) => setName(event.target.value)}
                      placeholder="Production Operator"
                      required
                    />
                  </div>
                  <div className="flex flex-col gap-2">
                    <Label htmlFor="jf-code">Code</Label>
                    <Input
                      id="jf-code"
                      value={code}
                      onChange={(event) => setCode(event.target.value)}
                      placeholder="production-operator"
                      required
                    />
                  </div>
                  <div className="flex flex-col gap-2">
                    <Label htmlFor="jf-description">
                      Description (optional)
                    </Label>
                    <Textarea
                      id="jf-description"
                      value={description}
                      onChange={(event) => setDescription(event.target.value)}
                      rows={3}
                    />
                  </div>
                  {message ? (
                    <p className="text-sm text-destructive" role="alert">
                      {message}
                    </p>
                  ) : null}
                </div>
                <DialogFooter>
                  <Button type="submit" disabled={loading}>
                    {loading ? "Creating…" : "Create job function"}
                  </Button>
                </DialogFooter>
              </form>
            </DialogContent>
          </Dialog>
        ) : null}
      </div>

      <Input
        value={search}
        onChange={(event) => setSearch(event.target.value)}
        placeholder="Search job functions"
        aria-label="Search job functions"
        data-testid="job-functions-search"
      />

      {filtered.length ? (
        <ul className="flex flex-col gap-2">
          {filtered.map((jobFunction) => (
            <li
              key={jobFunction.id}
              className="rounded-md border border-border p-3 text-sm"
              data-testid={`job-function-item-${jobFunction.code}`}
            >
              <p className="font-medium text-foreground">{jobFunction.name}</p>
              <p className="text-xs text-muted-foreground">
                {jobFunction.code}
              </p>
              {jobFunction.description ? (
                <p className="mt-1 text-muted-foreground">
                  {jobFunction.description}
                </p>
              ) : null}
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-sm text-muted-foreground">
          {search.trim()
            ? "No job functions match your search."
            : "No job functions yet."}
        </p>
      )}
    </div>
  );
}
