import { render } from "@react-email/render";

import type { RenderedWeeklyDigestEmail, WeeklyDigestEmailProps } from "./types.js";
import { WeeklyDigestEmail } from "./weekly-digest.js";

export type { RenderedWeeklyDigestEmail, WeeklyDigestEmailProps } from "./types.js";
export { WeeklyDigestEmail } from "./weekly-digest.js";

export async function renderWeeklyDigestEmail(
  props: WeeklyDigestEmailProps,
): Promise<RenderedWeeklyDigestEmail> {
  const html = await render(WeeklyDigestEmail(props));
  const text = await render(WeeklyDigestEmail(props), { plainText: true });

  return {
    subject: `Weekly Morgan summary · ${props.weekLabel}`,
    html,
    text,
  };
}
