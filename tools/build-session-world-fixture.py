import json, sys
# Regenerates spec/local-world/fixtures/session-world.json (session-world-seam/v1 FIXTURE).
# Usage: python3 -I tools/build-session-world-fixture.py spec/local-world/fixtures/session-world.json
SD, CS, CV, WA = "session/v4", "canvas/v6", "canvas/v6", "world-adapter/v7"
def err(code, reason, phase="validate"):
    return {"code": code, "phase": phase, "retryability": "AFTER_NEW_FACTS", "mutationState": "NONE", "transactionRef": None, "causeCode": None, "reason": reason}
def ok(wire, rid, result): return {"contractVersion": wire, "requestId": rid, "result": result, "error": None}
def ko(wire, rid, e): return {"contractVersion": wire, "requestId": rid, "result": None, "error": e}
S1, S2 = "fixture-session-S1", "fixture-session-S2"
A, B = "fixture-world-A", "fixture-world-B"
lc = lambda w, inc, rev: {"connectionRef": "fixture-connection-" + w[-1], "connectionIncarnationRef": inc, "worldRef": w, "selectionRevision": rev}
def cc(s, w, local, srev, selrev):
    return {"currentSession": s, "activeWorldRef": w, "orderedSelectedObjectRefs": [], "sessionRevision": srev, "selectionRevision": selrev, "localContext": local}
def desc(w, inc, readiness="READY"):
    return {"adapterId": "fixture-adapter", "connectionRef": "fixture-connection-" + w[-1], "worldRef": w, "displayName": "FIXTURE world " + w[-1], "capabilityRevision": "fixture-cap-1", "payloadVersion": "local-world/v1", "readiness": readiness, "connectionIncarnationRef": inc}
incA, incB, incA2 = "fixture-incarnation-A-1", "fixture-incarnation-B-1", "fixture-incarnation-A-2"
invA = {"capabilityRevision": "fixture-cap-1", "connections": [desc(A, incA)]}
invB = {"capabilityRevision": "fixture-cap-1", "connections": [desc(B, incB)]}
ctxS1A = lc(A, incA, "fixture-selection-S1-1"); ctxS2A = lc(A, incA, "fixture-selection-S2-1"); ctxS1B = lc(B, incB, "fixture-selection-S1-2"); ctxS1A3 = lc(A, incA, "fixture-selection-S1-3")
steps = []
def step(title, wire, op, req, resp): steps.append({"title": title, "wire": wire, "operation": op, "request": req, "response": resp})
step("1 known Session S1 without a world reads UNBOUND", CV, "ReadWorldSelectionContext",
     {"contractVersion": CV, "sessionRef": S1, "requestId": "r1", "worldRef": A},
     ok(CV, "r1", {"sessionRef": S1, "worldRef": A, "inventory": invA, "selection": {"sessionRef": S1, "sessionRevision": "fixture-session-S1-rev-1", "status": "UNBOUND"}}))
step("2 S1 selects A", CV, "SelectWorldConnection",
     {"contractVersion": CV, "sessionRef": S1, "requestId": "r2", "worldRef": A, "connectionRef": "fixture-connection-A", "expectedRevision": "fixture-selection-S1-0", "expectedContext": None, "connectionIncarnationRef": incA},
     ok(CV, "r2", cc(S1, A, ctxS1A, "fixture-session-S1-rev-1", "fixture-selection-S1-1")))
step("3 S2 selects the same A", CV, "SelectWorldConnection",
     {"contractVersion": CV, "sessionRef": S2, "requestId": "r3", "worldRef": A, "connectionRef": "fixture-connection-A", "expectedRevision": "fixture-selection-S2-0", "expectedContext": None, "connectionIncarnationRef": incA},
     ok(CV, "r3", cc(S2, A, ctxS2A, "fixture-session-S2-rev-1", "fixture-selection-S2-1")))
step("4 Canvas inventory of A lists S1 and S2", CS, "ListWorldSelections",
     {"contractVersion": CS, "requestId": "r4", "worldRef": A},
     ok(CS, "r4", {"worldRef": A, "inventoryRevision": "fixture-inventory-A-2", "sessionRefs": [S1, S2], "retirementReservationRef": None}))
step("5 S1 switches A to B", CV, "SwitchWorldConnection",
     {"contractVersion": CV, "sessionRef": S1, "requestId": "r5", "worldRef": A, "fromWorldRef": A, "toConnectionRef": "fixture-connection-B", "toWorldRef": B, "expectedRevision": "fixture-selection-S1-1", "expectedContext": ctxS1A},
     ok(CV, "r5", cc(S1, B, ctxS1B, "fixture-session-S1-rev-1", "fixture-selection-S1-2")))
step("6 A is still selected by S2 only", CS, "ListWorldSelections",
     {"contractVersion": CS, "requestId": "r6", "worldRef": A},
     ok(CS, "r6", {"worldRef": A, "inventoryRevision": "fixture-inventory-A-3", "sessionRefs": [S2], "retirementReservationRef": None}))
step("7 S1 switches B back to A", CV, "SwitchWorldConnection",
     {"contractVersion": CV, "sessionRef": S1, "requestId": "r7", "worldRef": B, "fromWorldRef": B, "toConnectionRef": "fixture-connection-A", "toWorldRef": A, "expectedRevision": "fixture-selection-S1-2", "expectedContext": ctxS1B},
     ok(CV, "r7", cc(S1, A, ctxS1A3, "fixture-session-S1-rev-1", "fixture-selection-S1-3")))
step("8 retiring A while selected is refused", CS, "ReserveWorldRetirement",
     {"contractVersion": CS, "requestId": "r8", "worldRef": A, "expectedInventoryRevision": "fixture-inventory-A-4"},
     ko(CS, "r8", err("TRANSACTION_CONFLICT", "SCOPE_DENIED")))
step("9 S1 unbinds A", CS, "UnselectWorldConnection",
     {"contractVersion": CS, "sessionRef": S1, "requestId": "r9", "worldRef": A, "expectedRevision": "fixture-selection-S1-3", "expectedContext": ctxS1A3},
     ok(CS, "r9", cc(S1, None, None, "fixture-session-S1-rev-1", "fixture-selection-S1-4")))
step("10 Workshop retires S2 before deleting it", CS, "RetireSessionSelection",
     {"contractVersion": CS, "sessionRef": S2, "requestId": "r10"},
     ok(CS, "r10", {"sessionRef": S2, "releasedWorldRef": A, "selectionRevision": "fixture-selection-S2-2"}))
step("11 A has no selecting Session", CS, "ListWorldSelections",
     {"contractVersion": CS, "requestId": "r11", "worldRef": A},
     ok(CS, "r11", {"worldRef": A, "inventoryRevision": "fixture-inventory-A-6", "sessionRefs": [], "retirementReservationRef": None}))
step("12 Adapter reserves A for deletion", CS, "ReserveWorldRetirement",
     {"contractVersion": CS, "requestId": "r12", "worldRef": A, "expectedInventoryRevision": "fixture-inventory-A-6"},
     ok(CS, "r12", {"worldRef": A, "reservationRef": "fixture-reservation-A-1", "inventoryRevision": "fixture-inventory-A-6"}))
step("13 selecting A under reservation is refused", CV, "SelectWorldConnection",
     {"contractVersion": CV, "sessionRef": S1, "requestId": "r13", "worldRef": A, "connectionRef": "fixture-connection-A", "expectedRevision": "fixture-selection-S1-4", "expectedContext": None, "connectionIncarnationRef": incA},
     ko(CV, "r13", err("TRANSACTION_CONFLICT", "SCOPE_DENIED")))
step("14 Adapter deleted A and releases RETIRED", CS, "ReleaseWorldRetirement",
     {"contractVersion": CS, "requestId": "r14", "worldRef": A, "reservationRef": "fixture-reservation-A-1", "outcome": "RETIRED"},
     ok(CS, "r14", {"worldRef": A, "reservationRef": "fixture-reservation-A-1", "outcome": "RETIRED", "inventoryRevision": "fixture-inventory-A-7"}))
step("15 retired S2 is no longer a known Session", SD, "ReadSessionIdentity",
     {"contractVersion": SD, "requestId": "r15", "sessionRef": S2},
     ko(SD, "r15", err("SESSION_NOT_FOUND", "IDENTITY_UNVERIFIED")))
fixture = {
 "evidence": "FIXTURE · session-world-seam/v1 public contract fixture; fixture Sessions/worlds, not a Canvas/Workshop/Adapter implementation or real runtime",
 "sessionDirectory": {
  "list": {"request": {"contractVersion": SD, "requestId": "d1"}, "response": ok(SD, "d1", {"directoryRevision": "fixture-directory-1", "sessions": [{"sessionRef": S1, "sessionRevision": "fixture-session-S1-rev-1"}, {"sessionRef": S2, "sessionRevision": "fixture-session-S2-rev-1"}]})},
  "read": {"request": {"contractVersion": SD, "requestId": "d2", "sessionRef": S1}, "response": ok(SD, "d2", {"sessionRef": S1, "sessionRevision": "fixture-session-S1-rev-1"})},
  "unknown": {"request": {"contractVersion": SD, "requestId": "d3", "sessionRef": "fixture-session-unknown"}, "response": ko(SD, "d3", err("SESSION_NOT_FOUND", "IDENTITY_UNVERIFIED"))}
 },
 "adapterInventory": {"A": invA, "B": invB, "AReopened": {"capabilityRevision": "fixture-cap-2", "connections": [desc(A, incA2)]}, "AStopped": {"capabilityRevision": "fixture-cap-3", "connections": []}},
 "ownerAScenario": steps,
 "sessionDeletion": {
  "unsupportedCapabilities": {"providerRef": "fixture-workshop", "capabilityRevision": "fixture-ws-cap-1", "worldRef": None, "engineBounds": None, "limits": [], "recoveryGuarantee": None, "stateProfile": None, "sessionDeleteSupported": False, "imageMediaTypes": [], "model": None},
  "supportedCapabilities": {"providerRef": "fixture-workshop", "capabilityRevision": "fixture-ws-cap-2", "worldRef": None, "engineBounds": None, "limits": [], "recoveryGuarantee": None, "stateProfile": None, "sessionDeleteSupported": True, "imageMediaTypes": [], "model": None},
  "unsupported": {"request": {"contractVersion": "session/v4", "sessionRef": S1, "requestId": "x1", "expectedRevision": "fixture-session-S1-rev-1"}, "response": ko("session/v4", "x1", err("SESSION_DELETE_UNSUPPORTED", "DELETE_SEAM_ABSENT")), "retireCalled": False},
  "deleted": {"request": {"contractVersion": "session/v4", "sessionRef": S2, "requestId": "x2", "expectedRevision": "fixture-session-S2-rev-1"}, "response": ok("session/v4", "x2", {"sessionRef": S2, "deleted": True, "remainingArtifactRefs": []}), "afterRetireStep": "10"}
 },
 "connectionState": {
  "boundS2A": {"context": cc(S2, A, ctxS2A, "fixture-session-S2-rev-1", "fixture-selection-S2-1"), "connectionRef": "fixture-connection-A", "status": "BOUND"},
  "unboundS1": {"sessionRef": S1, "sessionRevision": "fixture-session-S1-rev-1", "status": "UNBOUND"}
 }
}
json.dump(fixture, open(sys.argv[1], "w"), indent=2, ensure_ascii=False); open(sys.argv[1], "a").write("\n")
print(len(steps), "steps")
