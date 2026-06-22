import { Resend } from "resend";

import { env, isResendConfigured } from "../config.js";

export type TransactionalEmailResult = {
  sent: boolean;
  skipped: boolean;
  reason?: string;
  messageId?: string;
};

export async function sendTransactionalEmail(input: {
  to: string;
  subject: string;
  html: string;
  text: string;
  listUnsubscribeUrl: string;
}): Promise<TransactionalEmailResult> {
  if (!isResendConfigured()) {
    return { sent: false, skipped: true, reason: "resend_not_configured" };
  }

  const resend = new Resend(env.RESEND_API_KEY);
  const response = await resend.emails.send({
    from: env.EMAIL_FROM,
    to: input.to,
    subject: input.subject,
    html: input.html,
    text: input.text,
    headers: {
      "List-Unsubscribe": `<${input.listUnsubscribeUrl}>`,
      "List-Unsubscribe-Post": "List-Unsubscribe=One-Click",
    },
  });

  if (response.error) {
    return { sent: false, skipped: true, reason: response.error.message };
  }

  return {
    sent: true,
    skipped: false,
    messageId: response.data?.id,
  };
}
