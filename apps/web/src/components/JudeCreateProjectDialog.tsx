import { GitBranchIcon, PlusIcon } from "lucide-react";
import { type FormEvent, useEffect, useState } from "react";
import * as Effect from "effect/Effect";

import {
  judeSessionDisplayName,
  listJudeGitHubIdentities,
  listJudeModels,
  provisionJudeProject,
  type JudeGitHubIdentity,
  type JudeModel,
} from "~/connection/jude";
import { onCreateJudeProject } from "~/judeProjectBus";
import { Button } from "~/components/ui/button";
import {
  Dialog,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogPopup,
  DialogTitle,
} from "~/components/ui/dialog";
import { Input } from "~/components/ui/input";
import { Label } from "~/components/ui/label";
import {
  Select,
  SelectItem,
  SelectPopup,
  SelectTrigger,
  SelectValue,
} from "~/components/ui/select";
import { stackedThreadToast, toastManager } from "~/components/ui/toast";

const JUDE_PROJECTS = ["app", "website", "admin-v2", "jude", "jenny"] as const;
type JudeProject = (typeof JUDE_PROJECTS)[number];

const PROJECT_LABELS: Record<JudeProject, string> = {
  app: "prezly/prezly",
  website: "prezly/website-nextjs",
  "admin-v2": "prezly/admin-ui-v2",
  jude: "prezly/jude",
  jenny: "prezly/jenny",
};

const DEFAULT_BASE_REFS: Record<JudeProject, string> = {
  app: "master",
  website: "main",
  "admin-v2": "main",
  jude: "main",
  jenny: "main",
};

const DEFAULT_MODEL = "gpt-5.6-sol";

function parseLicenseIds(value: string): ReadonlyArray<string> {
  return [...new Set(value.split(/[\s,]+/).filter(Boolean))];
}

function identityLabel(identity: JudeGitHubIdentity): string {
  if (identity.legacy) return "Shared token";
  return identity.name === "jude" ? "Jude" : identity.name;
}

export function JudeCreateProjectDialog() {
  const [open, setOpen] = useState(false);
  const [project, setProject] = useState<JudeProject>("app");
  const [name, setName] = useState("");
  const [baseRef, setBaseRef] = useState(DEFAULT_BASE_REFS.app);
  const [model, setModel] = useState(DEFAULT_MODEL);
  const [githubIdentity, setGitHubIdentity] = useState("");
  const [customLicenses, setCustomLicenses] = useState("");
  const [identities, setIdentities] = useState<ReadonlyArray<JudeGitHubIdentity>>([]);
  const [models, setModels] = useState<ReadonlyArray<JudeModel>>([]);
  const [status, setStatus] = useState<"idle" | "creating">("idle");
  const [error, setError] = useState<string | null>(null);
  const busy = status !== "idle";
  const canSubmit = name.trim().length > 0 && baseRef.trim().length > 0 && !busy;

  useEffect(
    () =>
      onCreateJudeProject(() => {
        setError(null);
        setOpen(true);
      }),
    [],
  );

  useEffect(() => {
    if (!open || identities.length > 0 || models.length > 0) return;
    void Promise.allSettled([
      Effect.runPromise(listJudeGitHubIdentities()).then((next) => {
        setIdentities(next);
        setGitHubIdentity(next.find((identity) => identity.default)?.name ?? next[0]?.name ?? "");
      }),
      Effect.runPromise(listJudeModels()).then((next) => {
        setModels(next);
        if (next.some((candidate) => candidate.id === DEFAULT_MODEL)) setModel(DEFAULT_MODEL);
        else if (next[0]) setModel(next[0].id);
      }),
    ]);
  }, [identities.length, models.length, open]);

  const selectedModelName = models.find((candidate) => candidate.id === model)?.name ?? model;

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!canSubmit) return;
    setError(null);
    setStatus("creating");
    let acceptedByJude = false;
    try {
      const session = await provisionJudeProject(
        {
          prompt: name.trim(),
          project,
          model,
          baseRef: baseRef.trim(),
          ...(githubIdentity ? { githubIdentity } : {}),
          ...(project === "app" && customLicenses.trim()
            ? { customLicenses: parseLicenseIds(customLicenses) }
            : {}),
        },
        {
          onCreated: (created) => {
            acceptedByJude = true;
            setOpen(false);
            setStatus("idle");
            setName("");
            toastManager.add(
              stackedThreadToast({
                type: "success",
                title: "Creating project",
                description: `${created.prompt} is provisioning in Jude and is now visible in the sidebar.`,
              }),
            );
          },
        },
      );
      toastManager.add(
        stackedThreadToast({
          type: "success",
          title: "Project ready",
          description: `${judeSessionDisplayName(session)} is connected and ready to use.`,
        }),
      );
    } catch (cause) {
      setStatus("idle");
      const message = cause instanceof Error ? cause.message : "Could not create the Jude project.";
      if (acceptedByJude) {
        toastManager.add(
          stackedThreadToast({
            type: "error",
            title: "Jude project provisioning failed",
            description: message,
          }),
        );
      } else {
        setError(message);
      }
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!busy) setOpen(next);
      }}
    >
      <DialogPopup className="max-w-xl overflow-hidden">
        <form
          className="flex min-h-0 flex-col overflow-hidden"
          onSubmit={(event) => void handleSubmit(event)}
        >
          <DialogHeader>
            <DialogTitle>Create project</DialogTitle>
            <DialogDescription>
              Provision an isolated Jude environment. It will be added to the project picker when it
              is ready.
            </DialogDescription>
          </DialogHeader>
          <div
            data-slot="dialog-panel"
            className="grid min-h-0 flex-1 gap-4 overflow-y-auto px-6 pb-6 pt-1"
          >
            <div className="grid gap-2">
              <Label htmlFor="jude-project-name">Environment name</Label>
              <Input
                id="jude-project-name"
                value={name}
                onChange={(event) => setName(event.target.value)}
                placeholder="e.g. Improve story search"
                disabled={busy}
                autoFocus
              />
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="grid gap-2">
                <Label>Repository</Label>
                <Select
                  value={project}
                  onValueChange={(value) => {
                    if (value === null) return;
                    const next = value as JudeProject;
                    setProject(next);
                    setBaseRef(DEFAULT_BASE_REFS[next]);
                  }}
                  disabled={busy}
                >
                  <SelectTrigger>
                    <SelectValue>{PROJECT_LABELS[project]}</SelectValue>
                  </SelectTrigger>
                  <SelectPopup>
                    {JUDE_PROJECTS.map((item) => (
                      <SelectItem key={item} value={item}>
                        {PROJECT_LABELS[item]}
                      </SelectItem>
                    ))}
                  </SelectPopup>
                </Select>
              </div>
              <div className="grid gap-2">
                <Label htmlFor="jude-base-ref">Branch</Label>
                <Input
                  id="jude-base-ref"
                  value={baseRef}
                  onChange={(event) => setBaseRef(event.target.value)}
                  disabled={busy}
                />
              </div>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="grid gap-2">
                <Label>GitHub identity</Label>
                <Select
                  value={githubIdentity}
                  onValueChange={(value) => {
                    if (value !== null) setGitHubIdentity(value);
                  }}
                  disabled={busy || identities.length === 0}
                >
                  <SelectTrigger>
                    <SelectValue>
                      {identities.find((item) => item.name === githubIdentity)
                        ? identityLabel(identities.find((item) => item.name === githubIdentity)!)
                        : "Configured token"}
                    </SelectValue>
                  </SelectTrigger>
                  <SelectPopup>
                    {identities.map((identity) => (
                      <SelectItem key={identity.name} value={identity.name}>
                        {identityLabel(identity)}
                      </SelectItem>
                    ))}
                  </SelectPopup>
                </Select>
              </div>
              <div className="grid gap-2">
                <Label>Model</Label>
                <Select
                  value={model}
                  onValueChange={(value) => {
                    if (value !== null) setModel(value);
                  }}
                  disabled={busy || models.length === 0}
                >
                  <SelectTrigger>
                    <SelectValue>{selectedModelName}</SelectValue>
                  </SelectTrigger>
                  <SelectPopup>
                    {models.map((item) => (
                      <SelectItem key={item.id} value={item.id}>
                        {item.name}
                      </SelectItem>
                    ))}
                  </SelectPopup>
                </Select>
              </div>
            </div>
            {project === "app" ? (
              <div className="grid gap-2">
                <Label htmlFor="jude-license-ids">
                  Custom licenses{" "}
                  <span className="font-normal text-muted-foreground">(optional)</span>
                </Label>
                <Input
                  id="jude-license-ids"
                  value={customLicenses}
                  onChange={(event) => setCustomLicenses(event.target.value)}
                  placeholder="e.g. 24181, 24182"
                  disabled={busy}
                />
              </div>
            ) : null}
            {error ? (
              <p role="alert" className="text-destructive text-sm">
                {error}
              </p>
            ) : null}
            {busy ? (
              <div className="flex items-center gap-2 text-muted-foreground text-sm">
                <GitBranchIcon className="size-4" />
                Creating the Jude environment…
              </div>
            ) : null}
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setOpen(false)} disabled={busy}>
              Cancel
            </Button>
            <Button type="submit" disabled={!canSubmit}>
              <PlusIcon className="size-4" />
              Create Jude environment
            </Button>
          </DialogFooter>
        </form>
      </DialogPopup>
    </Dialog>
  );
}
