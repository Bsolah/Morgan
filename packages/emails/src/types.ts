export type WeeklyDigestEmailProps = {
  shopName: string;
  weekLabel: string;
  weekProfitTotal: string;
  marginTrend: string;
  topLeakTitle: string | null;
  topLeakBody: string | null;
  topLeakAmount: string | null;
  topRecommendationTitle: string | null;
  topRecommendationBody: string | null;
  runwayLabel: string;
  unsubscribeUrl: string;
  physicalAddress: string;
};

export type RenderedWeeklyDigestEmail = {
  subject: string;
  html: string;
  text: string;
};
