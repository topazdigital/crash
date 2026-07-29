/**
 * PayHero API client for M-PESA STK push (collect) and B2C (payout).
 * Docs: https://backend.payhero.co.ke/api/v2
 */

const PAYHERO_BASE = "https://backend.payhero.co.ke/api/v2";

function authHeader(): string {
  const auth = process.env.PAYHERO_BASIC_AUTH;
  if (!auth) throw new Error("PAYHERO_BASIC_AUTH secret is not set");
  // Accept both bare token and "Basic <token>"
  return auth.startsWith("Basic ") ? auth : `Basic ${auth}`;
}

function channelId(): number {
  return Number(process.env.PAYHERO_CHANNEL_ID ?? "7470");
}

/** Normalize a Kenyan phone number to 254XXXXXXXXX format. */
export function normalizePhone(raw: string): string {
  const digits = raw.replace(/\D/g, "");
  if (digits.startsWith("254") && digits.length === 12) return digits;
  if (digits.startsWith("0") && digits.length === 10) return "254" + digits.slice(1);
  if (digits.length === 9) return "254" + digits;
  throw new Error(`Cannot normalize phone number: ${raw}`);
}

// ── STK Push (collect from customer) ─────────────────────────────────────────

export interface StkPushResult {
  success: boolean;
  checkoutRequestId?: string;
  customerMessage?: string;
  error?: string;
}

export async function initiateStkPush(params: {
  amount: number;
  phoneNumber: string; // already normalized to 254XXXXXXXXX
  externalReference: string;
  callbackUrl: string;
}): Promise<StkPushResult> {
  const body = {
    amount: params.amount,
    phone_number: params.phoneNumber,
    channel_id: channelId(),
    provider: "m-pesa",
    external_reference: params.externalReference,
    callback_url: params.callbackUrl,
  };

  let res: Response;
  try {
    res = await fetch(`${PAYHERO_BASE}/payments`, {
      method: "POST",
      headers: {
        Authorization: authHeader(),
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    });
  } catch (err) {
    return { success: false, error: String(err) };
  }

  const data = (await res.json()) as Record<string, unknown>;

  if (!res.ok || !data["success"]) {
    const msg =
      (data["errorMessage"] as string) ||
      (data["message"] as string) ||
      `HTTP ${res.status}`;
    return { success: false, error: msg };
  }

  return {
    success: true,
    checkoutRequestId: data["CheckoutRequestID"] as string | undefined,
    customerMessage: data["CustomerMessage"] as string | undefined,
  };
}

// ── B2C Payout (send to customer) ────────────────────────────────────────────

export interface WithdrawResult {
  success: boolean;
  error?: string;
}

export async function initiateWithdrawal(params: {
  amount: number;
  phoneNumber: string;
  externalReference: string;
  callbackUrl: string;
}): Promise<WithdrawResult> {
  const body = {
    amount: params.amount,
    phone_number: params.phoneNumber,
    channel_id: channelId(),
    provider: "m-pesa",
    external_reference: params.externalReference,
    callback_url: params.callbackUrl,
  };

  let res: Response;
  try {
    res = await fetch(`${PAYHERO_BASE}/withdraw-request`, {
      method: "POST",
      headers: {
        Authorization: authHeader(),
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    });
  } catch (err) {
    return { success: false, error: String(err) };
  }

  const data = (await res.json()) as Record<string, unknown>;

  if (!res.ok || !data["success"]) {
    const msg =
      (data["errorMessage"] as string) ||
      (data["message"] as string) ||
      `HTTP ${res.status}`;
    return { success: false, error: msg };
  }

  return { success: true };
}
