const REDACTED = "[REDACTED]";

export type CustomerRef = {
  id?: string | number | null;
  email?: string | null;
  phone?: string | null;
};

export function normalizeEmail(email: string | null | undefined): string | null {
  if (!email) return null;
  const normalized = email.trim().toLowerCase();
  return normalized.length > 0 ? normalized : null;
}

export function customerIdMatches(
  payload: Record<string, unknown>,
  customerId: string | number | null | undefined,
): boolean {
  if (customerId == null) return false;
  const target = String(customerId);

  const customer = payload.customer as Record<string, unknown> | undefined;
  if (customer?.id != null && String(customer.id) === target) return true;

  if (payload.customer_id != null && String(payload.customer_id) === target) return true;

  const lineItems = Array.isArray(payload.line_items) ? payload.line_items : [];
  return lineItems.some((line) => {
    const item = line as Record<string, unknown>;
    return item.customer_id != null && String(item.customer_id) === target;
  });
}

export function customerEmailMatches(
  payload: Record<string, unknown>,
  email: string | null | undefined,
): boolean {
  const normalized = normalizeEmail(email);
  if (!normalized) return false;

  const payloadEmail = normalizeEmail(
    typeof payload.email === "string"
      ? payload.email
      : typeof (payload.customer as Record<string, unknown> | undefined)?.email === "string"
        ? String((payload.customer as Record<string, unknown>).email)
        : null,
  );

  if (payloadEmail === normalized) return true;

  const billing = payload.billing_address as Record<string, unknown> | undefined;
  return normalizeEmail(typeof billing?.email === "string" ? billing.email : null) === normalized;
}

export function payloadMatchesCustomer(
  payload: Record<string, unknown>,
  customer: CustomerRef,
): boolean {
  if (customer.id != null && customerIdMatches(payload, customer.id)) {
    return true;
  }
  return customerEmailMatches(payload, customer.email);
}

export function redactWebhookPayload(payload: Record<string, unknown>): Record<string, unknown> {
  const redacted: Record<string, unknown> = { ...payload };

  if (typeof redacted.email === "string") redacted.email = REDACTED;
  if (typeof redacted.phone === "string") redacted.phone = REDACTED;
  if (typeof redacted.contact_email === "string") redacted.contact_email = REDACTED;

  if (redacted.customer && typeof redacted.customer === "object") {
    redacted.customer = {
      id: (redacted.customer as Record<string, unknown>).id ?? null,
      redacted: true,
    };
  }

  if (redacted.billing_address && typeof redacted.billing_address === "object") {
    redacted.billing_address = { redacted: true };
  }

  if (redacted.shipping_address && typeof redacted.shipping_address === "object") {
    redacted.shipping_address = { redacted: true };
  }

  if (Array.isArray(redacted.line_items)) {
    redacted.line_items = redacted.line_items.map((line) => {
      const item = { ...(line as Record<string, unknown>) };
      if (typeof item.name === "string") item.name = REDACTED;
      return item;
    });
  }

  redacted._pii_redacted_at = new Date().toISOString();
  return redacted;
}

export function extractCustomerFromCompliancePayload(payload: Record<string, unknown>): CustomerRef {
  const customer = payload.customer as Record<string, unknown> | undefined;
  return {
    id: customer?.id as string | number | undefined,
    email: typeof customer?.email === "string" ? customer.email : null,
    phone: typeof customer?.phone === "string" ? customer.phone : null,
  };
}
