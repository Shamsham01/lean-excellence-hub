"use client";

import { useState } from "react";
import { PlatformMemberAvatar } from "@/components/platform/platform-member-avatar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { PersonSelectOption } from "@/modules/organisation/site-context";

export function SchedulePeoplePicker({
  name,
  label,
  options,
  initialIds,
  multiple = false,
}: {
  name: string;
  label: string;
  options: PersonSelectOption[];
  initialIds: string[];
  multiple?: boolean;
}) {
  const [ids, setIds] = useState(initialIds);
  const [expanded, setExpanded] = useState(false);
  const [query, setQuery] = useState("");
  const selected = options.filter((person) => ids.includes(person.id));
  const matches = options.filter(
    (person) =>
      !ids.includes(person.id) &&
      person.label
        .toLocaleLowerCase()
        .includes(query.trim().toLocaleLowerCase()),
  );
  function toggle(person: PersonSelectOption) {
    if (ids.includes(person.id)) setIds(ids.filter((id) => id !== person.id));
    else setIds(multiple ? [...ids, person.id] : [person.id]);
    setQuery("");
    setExpanded(false);
  }
  function choice(person: PersonSelectOption, checked: boolean) {
    return (
      <Button
        key={person.id}
        type="button"
        variant="outline"
        aria-pressed={checked}
        className="h-auto min-h-11 max-w-full text-left whitespace-normal"
        onClick={() => toggle(person)}
      >
        <PlatformMemberAvatar
          displayName={person.name}
          avatarUrl={person.avatarUrl ?? null}
          size="sm"
        />
        {person.label}
        {checked && <span aria-hidden>&times;</span>}
      </Button>
    );
  }
  return (
    <div className="space-y-2">
      <Label htmlFor={name}>{label}</Label>
      <div className="flex flex-wrap gap-2">
        {selected.map((person) => choice(person, true))}
      </div>
      {selected.map((person) => (
        <input key={person.id} type="hidden" name={name} value={person.id} />
      ))}
      <Input
        id={name}
        className="min-h-11"
        placeholder="Search by name"
        value={query}
        autoComplete="off"
        required={!multiple && selected.length === 0}
        onFocus={() => setExpanded(true)}
        onChange={(event) => {
          setQuery(event.target.value);
          setExpanded(true);
        }}
      />
      {expanded && (
        <div
          role="group"
          aria-label={label + " options"}
          className="flex flex-wrap gap-2"
        >
          {matches.slice(0, 12).map((person) => choice(person, false))}
          {matches.length === 0 && (
            <p className="text-sm text-muted-foreground">No matching people.</p>
          )}
          {matches.length > 12 && (
            <p className="text-sm text-muted-foreground">
              Refine your search to see more people.
            </p>
          )}
        </div>
      )}
    </div>
  );
}
