import type {
  AgentPersona,
  ManagedAgent,
  UpdateManagedAgentInput,
} from "@/shared/api/types";

type PersonaBehavior = Pick<
  AgentPersona,
  "respondTo" | "respondToAllowlist" | "parallelism"
>;
type PersonaAccess = Pick<AgentPersona, "respondTo" | "respondToAllowlist">;

function allowlistEqual(left: readonly string[], right: readonly string[]) {
  return (
    left.length === right.length &&
    left.every((value, index) => value === right[index])
  );
}

function accessEqual(
  left: PersonaAccess,
  right: Pick<ManagedAgent, "respondTo" | "respondToAllowlist"> | PersonaAccess,
) {
  if (left.respondTo !== right.respondTo) return false;
  return (
    left.respondTo !== "allowlist" ||
    allowlistEqual(left.respondToAllowlist, right.respondToAllowlist)
  );
}

/**
 * Behavior fields to apply to one linked agent after its definition was
 * edited: "Who can send instructions" and parallelism. Without the pre-edit
 * definition there is no proof a setting changed, so nothing propagates.
 *
 * Definition behavior is otherwise only a mint-time default, so editing it
 * saved silently without changing the running agents. Only a setting the edit
 * actually changed to an explicit value propagates: unrelated definition
 * edits must not overwrite behavior the owner later chose for an individual
 * agent.
 */
export function linkedAgentBehaviorUpdate(
  previous: PersonaBehavior | undefined,
  persona: PersonaBehavior,
  agent: Pick<
    ManagedAgent,
    "pubkey" | "respondTo" | "respondToAllowlist" | "parallelism"
  >,
): UpdateManagedAgentInput | null {
  if (!previous) return null;

  const update: UpdateManagedAgentInput = { pubkey: agent.pubkey };
  let hasChanges = false;

  const respondTo = persona.respondTo;
  if (
    respondTo != null &&
    !accessEqual(previous, persona) &&
    !accessEqual(persona, agent)
  ) {
    update.respondTo = respondTo;
    if (respondTo === "allowlist") {
      update.respondToAllowlist = [...persona.respondToAllowlist];
    }
    hasChanges = true;
  }

  const parallelism = persona.parallelism;
  if (
    parallelism != null &&
    previous.parallelism !== parallelism &&
    agent.parallelism !== parallelism
  ) {
    update.parallelism = parallelism;
    hasChanges = true;
  }

  return hasChanges ? update : null;
}

/** {@link linkedAgentBehaviorUpdate} for every agent created from `persona`. */
export function linkedAgentBehaviorUpdates(
  previous: PersonaBehavior | undefined,
  persona: Pick<AgentPersona, "id"> & PersonaBehavior,
  agents: readonly ManagedAgent[],
): UpdateManagedAgentInput[] {
  return agents
    .filter((agent) => agent.personaId === persona.id)
    .map((agent) => linkedAgentBehaviorUpdate(previous, persona, agent))
    .filter((update) => update !== null);
}
