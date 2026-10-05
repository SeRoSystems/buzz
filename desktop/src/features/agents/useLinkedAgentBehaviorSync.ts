import * as React from "react";
import { useQueryClient } from "@tanstack/react-query";

import { managedAgentsQueryKey, useUpdateManagedAgentMutation } from "./hooks";
import { linkedAgentBehaviorUpdates } from "./lib/linkedAgentBehaviorUpdates";
import { listManagedAgents } from "@/shared/api/tauri";
import type { AgentPersona, ManagedAgent } from "@/shared/api/types";

/**
 * Carry edited definition behavior ("Who can send instructions", parallelism)
 * onto the agents created from it, through the same instance update the
 * agent's own edit dialog uses (it restarts local runtimes on an access change
 * and strictly publishes the managed policy). `sync` resolves to a user-facing
 * error when any linked agent kept its old behavior.
 */
export function useLinkedAgentBehaviorSync() {
  const queryClient = useQueryClient();
  const updateManagedAgentMutation = useUpdateManagedAgentMutation();
  const [isPending, setIsPending] = React.useState(false);

  async function sync(
    previousPersona: AgentPersona | undefined,
    savedPersona: AgentPersona,
  ): Promise<string | null> {
    setIsPending(true);
    try {
      return await syncAgents(previousPersona, savedPersona);
    } finally {
      setIsPending(false);
    }
  }

  async function syncAgents(
    previousPersona: AgentPersona | undefined,
    savedPersona: AgentPersona,
  ): Promise<string | null> {
    const failurePrefix = `Updated ${savedPersona.displayName}, but applying its new settings to its agents failed.`;
    let agents: ManagedAgent[];
    try {
      agents = await queryClient.fetchQuery({
        queryKey: managedAgentsQueryKey,
        queryFn: listManagedAgents,
      });
    } catch (error) {
      return `${failurePrefix} ${error instanceof Error ? error.message : String(error)}`;
    }
    const failures: string[] = [];
    for (const update of linkedAgentBehaviorUpdates(
      previousPersona,
      savedPersona,
      agents,
    )) {
      const name =
        agents.find((agent) => agent.pubkey === update.pubkey)?.name ??
        update.pubkey;
      try {
        const result = await updateManagedAgentMutation.mutateAsync(update);
        if (result.profileSyncError) {
          failures.push(`${name}: ${result.profileSyncError}`);
        }
      } catch (error) {
        failures.push(
          `${name}: ${error instanceof Error ? error.message : String(error)}`,
        );
      }
    }
    return failures.length > 0
      ? `${failurePrefix} ${failures.join("; ")}. Change it from each agent's own settings.`
      : null;
  }

  return { sync, isPending };
}
