#!/usr/bin/env node
/**
 * CobraLearn Orbit — Host Break-Glass Emergency MFA Recovery CLI
 *
 * This local-only server utility performs controlled break-glass emergency MFA recovery
 * for a locked-out SUPER_ADMIN account when peer web recovery is unavailable.
 *
 * Usage:
 *   Dry-run inspection (default):
 *     node --env-file=.env --experimental-strip-types scripts/emergency-mfa-reset.ts --id="<UUID>" --email="<EMAIL>"
 *
 *   Destructive execution (--apply):
 *     node --env-file=.env --experimental-strip-types scripts/emergency-mfa-reset.ts --id="<UUID>" --email="<EMAIL>" --reason="<JUSTIFICATION>" --environment="<EXPECTED_ENV>" --apply
 */

import { runEmergencyMfaCli } from "../src/lib/auth/emergency-mfa-cli.ts";

async function main() {
  const exitCode = await runEmergencyMfaCli(process.argv.slice(2));
  process.exit(exitCode);
}

main().catch((err) => {
  console.error("Unexpected failure in emergency MFA recovery CLI:", err);
  process.exit(1);
});
