import type {
  AdminRole,
  MfaRecoveryStatus,
  MfaRecoveryActorType,
  AdminMfaRecovery,
} from "@prisma/client";

export type { AdminRole, MfaRecoveryStatus, MfaRecoveryActorType, AdminMfaRecovery };

export type AdminMfaRecoveryRecord = AdminMfaRecovery;

export interface EmergencyMfaResetPayload {
  targetId: string;
  expectedEmail: string;
  justification: string;
  /** Backwards compatibility alias */
  targetAdminId?: string;
}

export interface EmergencyMfaResetResult {
  recoveryId: string;
  targetId: string;
  targetEmail: string;
  status: MfaRecoveryStatus;
  factorId?: string | null;
  message: string;
  quarantined?: boolean;
  factorDeleted?: boolean;
}

export interface CompleteMfaReenrollmentResult {
  success: boolean;
  recoveryId: string;
  targetId: string;
  newFactorId: string;
  message: string;
}

export interface ReconcileMfaRecoveryPayload {
  recoveryId: string;
  notes?: string;
  expectedTargetEmail?: string;
}

export interface ReconcileMfaRecoveryResult {
  recoveryId: string;
  targetId: string;
  status: MfaRecoveryStatus;
  mfaRecoveryPending: boolean;
  message: string;
}
