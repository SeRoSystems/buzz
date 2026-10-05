import assert from "node:assert/strict";
import test from "node:test";

import { linkedAgentBehaviorUpdates } from "./linkedAgentBehaviorUpdates.ts";

const ALICE = "a".repeat(64);
const BOB = "b".repeat(64);

function persona(respondTo, respondToAllowlist = [], parallelism = null) {
  return { id: "persona-1", respondTo, respondToAllowlist, parallelism };
}

function agent(
  pubkey,
  respondTo,
  respondToAllowlist = [],
  personaId = "persona-1",
  parallelism = 1,
) {
  return { pubkey, personaId, respondTo, respondToAllowlist, parallelism };
}

test("access change on a definition updates its linked agents", () => {
  const updates = linkedAgentBehaviorUpdates(
    persona("owner-only"),
    persona("allowlist", [ALICE]),
    [agent("p1", "anyone"), agent("p2", "owner-only")],
  );

  assert.deepEqual(updates, [
    { pubkey: "p1", respondTo: "allowlist", respondToAllowlist: [ALICE] },
    { pubkey: "p2", respondTo: "allowlist", respondToAllowlist: [ALICE] },
  ]);
});

test("allowlist membership change counts as an access change", () => {
  const updates = linkedAgentBehaviorUpdates(
    persona("allowlist", [ALICE]),
    persona("allowlist", [ALICE, BOB]),
    [agent("p1", "allowlist", [ALICE])],
  );

  assert.deepEqual(updates, [
    { pubkey: "p1", respondTo: "allowlist", respondToAllowlist: [ALICE, BOB] },
  ]);
});

test("non-allowlist modes do not send an allowlist", () => {
  const updates = linkedAgentBehaviorUpdates(
    persona("owner-only"),
    persona("anyone"),
    [agent("p1", "owner-only")],
  );

  assert.deepEqual(updates, [{ pubkey: "p1", respondTo: "anyone" }]);
});

test("unchanged definition access leaves individually chosen agent access alone", () => {
  const updates = linkedAgentBehaviorUpdates(
    persona("owner-only"),
    persona("owner-only"),
    [agent("p1", "anyone")],
  );

  assert.deepEqual(updates, []);
});

test("definitions without an explicit policy never touch agents", () => {
  const updates = linkedAgentBehaviorUpdates(persona("anyone"), persona(null), [
    agent("p1", "anyone"),
  ]);

  assert.deepEqual(updates, []);
});

test("an unknown pre-edit definition never overwrites agent access", () => {
  const updates = linkedAgentBehaviorUpdates(undefined, persona("anyone"), [
    agent("p1", "owner-only"),
  ]);

  assert.deepEqual(updates, []);
});

test("only agents linked to the edited definition that differ are updated", () => {
  const updates = linkedAgentBehaviorUpdates(
    persona("owner-only"),
    persona("anyone"),
    [
      agent("p1", "anyone"),
      agent("p2", "owner-only", [], "persona-2"),
      agent("p3", "owner-only", [], null),
    ],
  );

  assert.deepEqual(updates, []);
});

test("parallelism change on a definition updates its linked agents", () => {
  const updates = linkedAgentBehaviorUpdates(
    persona("owner-only", [], 2),
    persona("owner-only", [], 4),
    [agent("p1", "anyone"), agent("p2", "owner-only", [], "persona-1", 4)],
  );

  assert.deepEqual(updates, [{ pubkey: "p1", parallelism: 4 }]);
});

test("access and parallelism changes combine into one update per agent", () => {
  const updates = linkedAgentBehaviorUpdates(
    persona("owner-only", [], 2),
    persona("anyone", [], 4),
    [agent("p1", "owner-only")],
  );

  assert.deepEqual(updates, [
    { pubkey: "p1", respondTo: "anyone", parallelism: 4 },
  ]);
});

test("unchanged or cleared definition parallelism leaves agents alone", () => {
  for (const next of [null, 2]) {
    const updates = linkedAgentBehaviorUpdates(
      persona("owner-only", [], 2),
      persona("owner-only", [], next),
      [agent("p1", "owner-only", [], "persona-1", 6)],
    );

    assert.deepEqual(updates, []);
  }
});
