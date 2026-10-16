#!/usr/bin/env node
/**
 * CobraLearn InnoTechCore — Initial Administrator Provisioning CLI
 *
 * This local-only server utility provisions the initial SUPER_ADMIN AdminProfile
 * into PostgreSQL after the user has been manually created in the Supabase Dashboard.
 *
 * Usage:
 *   npm run seed:admin -- --id="<AUTH_UUID>" --email="<EMAIL>" --name="<FULL_NAME>" [--dry-run | --apply]
 */

import { runProvisionCli } from "../src/lib/auth/admin-provisioning.ts";

async function main() {
  const exitCode = await runProvisionCli(process.argv.slice(2));
  process.exit(exitCode);
}

main().catch((err) => {
  console.error("Unexpected failure in provisioning CLI:", err);
  process.exit(1);
});
