import {
  Body,
  Container,
  Head,
  Heading,
  Hr,
  Html,
  Link,
  Preview,
  Section,
  Text,
} from "@react-email/components";
import * as React from "react";

import type { WeeklyDigestEmailProps } from "./types.js";

export function WeeklyDigestEmail({
  shopName,
  weekLabel,
  weekProfitTotal,
  marginTrend,
  topLeakTitle,
  topLeakBody,
  topLeakAmount,
  topRecommendationTitle,
  topRecommendationBody,
  runwayLabel,
  unsubscribeUrl,
  physicalAddress,
}: WeeklyDigestEmailProps) {
  return (
    <Html>
      <Head />
      <Preview>{`Weekly summary for ${shopName}: ${weekProfitTotal} contribution profit`}</Preview>
      <Body style={main}>
        <Container style={container}>
          <Heading style={heading}>Your weekly Morgan summary</Heading>
          <Text style={subheading}>
            {shopName} · {weekLabel}
          </Text>

          <Section style={card}>
            <Text style={label}>Week profit total</Text>
            <Text style={metric}>{weekProfitTotal}</Text>
          </Section>

          <Section style={card}>
            <Text style={label}>Margin trend</Text>
            <Text style={bodyText}>{marginTrend}</Text>
          </Section>

          <Section style={card}>
            <Text style={label}>Top profit leak</Text>
            {topLeakTitle ? (
              <>
                <Text style={bodyText}>{topLeakTitle}</Text>
                {topLeakAmount ? <Text style={muted}>{topLeakAmount} at risk</Text> : null}
                {topLeakBody ? <Text style={muted}>{topLeakBody}</Text> : null}
              </>
            ) : (
              <Text style={muted}>No active profit leaks this week.</Text>
            )}
          </Section>

          <Section style={card}>
            <Text style={label}>Top recommendation</Text>
            {topRecommendationTitle ? (
              <>
                <Text style={bodyText}>{topRecommendationTitle}</Text>
                {topRecommendationBody ? <Text style={muted}>{topRecommendationBody}</Text> : null}
              </>
            ) : (
              <Text style={muted}>Open Morgan for fresh recommendations.</Text>
            )}
          </Section>

          <Section style={card}>
            <Text style={label}>Cash runway</Text>
            <Text style={bodyText}>{runwayLabel}</Text>
          </Section>

          <Hr style={hr} />
          <Text style={footer}>
            You are receiving this email because weekly digest notifications are enabled for your
            Morgan store.
          </Text>
          <Text style={footer}>
            <Link href={unsubscribeUrl} style={link}>
              Unsubscribe from weekly emails
            </Link>
          </Text>
          <Text style={footer}>{physicalAddress}</Text>
        </Container>
      </Body>
    </Html>
  );
}

const main = {
  backgroundColor: "#f5f3ee",
  fontFamily: "Helvetica, Arial, sans-serif",
};

const container = {
  margin: "0 auto",
  padding: "32px 20px",
  maxWidth: "560px",
};

const heading = {
  color: "#003252",
  fontSize: "24px",
  fontWeight: 700,
  margin: "0 0 8px",
};

const subheading = {
  color: "#54565b",
  fontSize: "14px",
  margin: "0 0 24px",
};

const card = {
  backgroundColor: "#ffffff",
  border: "1px solid #e2e2e6",
  borderRadius: "12px",
  padding: "16px 18px",
  marginBottom: "12px",
};

const label = {
  color: "#54565b",
  fontSize: "12px",
  fontWeight: 700,
  letterSpacing: "0.04em",
  textTransform: "uppercase" as const,
  margin: "0 0 8px",
};

const metric = {
  color: "#003252",
  fontSize: "28px",
  fontWeight: 700,
  margin: 0,
};

const bodyText = {
  color: "#1a1814",
  fontSize: "15px",
  lineHeight: "22px",
  margin: "0 0 6px",
};

const muted = {
  color: "#54565b",
  fontSize: "14px",
  lineHeight: "20px",
  margin: "0 0 4px",
};

const hr = {
  borderColor: "#e2e2e6",
  margin: "24px 0",
};

const footer = {
  color: "#54565b",
  fontSize: "12px",
  lineHeight: "18px",
};

const link = {
  color: "#00b289",
};
