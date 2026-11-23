# Known issues and release follow-ups

| Follow-up | Owner / timing | Evidence or next check |
| --- | --- | --- |
| Remove remaining PUBLIC EXECUTE privileges on private functions | SENTINEL, planned | **To confirm:** the planning estimate of about 345 private functions with PUBLIC EXECUTE, against a dated ACL inventory. #406 and #424 hardened specific functions. |
| Set default privileges for future private functions | SENTINEL, planned | Review defaults for the roles that create functions alongside the existing-function cleanup. Preserve explicit grants required by RLS and RPC callers. |
| Rebuild 5 Why | December | Manual 5 Why entry is deferred to the rebuild (#418). |
| Verify preview database isolation | Release owner, before pilot smoke | **To confirm:** preview environment isolation for the release candidate. See the [release snapshot](../qa/PROJECT-CURRENT-STATE.md). |

## Earlier incidents

Pinned draft activation (#324) shipped in #331. The facilitator time-budget change shipped in #327, followed by settlement and Skills response-contract fixes in #356. The [runtime notes](./leanai-runtime.md) describe the current controls.
