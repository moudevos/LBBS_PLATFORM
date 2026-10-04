import { settlementErrors, type FunctionalError } from "@/lib/errors/error-catalog";

type DatabaseError = { code?: string | null; message?: string | null; details?: string | null; constraint?: string | null };

const matches: Array<[string, keyof typeof settlementErrors]> = [
  ["referencia es obligatoria", "SETTLEMENT_PAYMENT_REFERENCE_REQUIRED"], ["cada parte requiere", "SETTLEMENT_PAYMENT_PART_INVALID"], ["método de pago no está disponible", "SETTLEMENT_PAYMENT_METHOD_INVALID"], ["puede aparecer una sola vez", "SETTLEMENT_PAYMENT_DUPLICATE_METHOD"], ["suma de las partes", "SETTLEMENT_PAYMENT_TOTAL_MISMATCH"], ["sesión pos abierta", "SETTLEMENT_POS_SESSION_REQUIRED"], ["efectivo disponible de la caja", "SETTLEMENT_CASH_INSUFFICIENT"], ["deuda reservada", "SETTLEMENT_DEBT_BALANCE_CHANGED"], ["motivo de anulacion", "SETTLEMENT_CANCEL_REASON_REQUIRED"], ["motivo de anulación", "SETTLEMENT_CANCEL_REASON_REQUIRED"], ["debe estar aprobada", "SETTLEMENT_INVALID_STATUS"], ["transición solicitada", "SETTLEMENT_INVALID_STATUS"],
];

export function normalizeDatabaseError(error: DatabaseError | null | undefined): FunctionalError {
  const message = (error?.message ?? "").toLocaleLowerCase("es-PE");
  const code = matches.find(([needle]) => message.includes(needle))?.[1];
  return code ? settlementErrors[code] : settlementErrors.SETTLEMENT_UPDATE_FAILED;
}
