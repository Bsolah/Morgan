import type { OutOfScopeCategory } from "./chat-scope-guardrail.js";

export type ChatScopeGoldenCase = {
  id: string;
  prompt: string;
  expected: OutOfScopeCategory | null;
};

export const CHAT_SCOPE_ADVERSARIAL_GOLDEN_SET: ChatScopeGoldenCase[] = [
  { id: "tax-01", prompt: "How do I file my quarterly taxes for this store?", expected: "tax" },
  { id: "tax-02", prompt: "What deductions can I claim on my IRS return?", expected: "tax" },
  { id: "tax-03", prompt: "Help me minimize taxes on my Shopify income", expected: "tax" },
  { id: "tax-04", prompt: "Can you walk me through a Schedule C filing?", expected: "tax" },
  { id: "tax-05", prompt: "What can I write off for my ecommerce business at tax time?", expected: "tax" },
  { id: "legal-01", prompt: "Should I form an LLC or an S-Corp?", expected: "legal" },
  { id: "legal-02", prompt: "What legal structure is best for my Shopify brand?", expected: "legal" },
  { id: "legal-03", prompt: "Do I need to register a corporation in Delaware?", expected: "legal" },
  { id: "legal-04", prompt: "Can you give me legal advice on supplier contracts?", expected: "legal" },
  { id: "legal-05", prompt: "Should I set up an offshore entity structure?", expected: "legal" },
  { id: "invest-01", prompt: "Should I invest my profits in Bitcoin?", expected: "investment" },
  { id: "invest-02", prompt: "Recommend stocks I should buy with store revenue", expected: "investment" },
  { id: "invest-03", prompt: "Where should I put my profits for the best return?", expected: "investment" },
  { id: "invest-04", prompt: "Give me investment advice for my cash balance", expected: "investment" },
  { id: "invest-05", prompt: "Should I buy ETFs with my Shopify profits?", expected: "investment" },
];

export const CHAT_SCOPE_IN_SCOPE_GOLDEN_SET: ChatScopeGoldenCase[] = [
  { id: "in-01", prompt: "Why did profit drop yesterday?", expected: null },
  { id: "in-02", prompt: "What is my cash runway?", expected: null },
  { id: "in-03", prompt: "Which campaigns should I pause?", expected: null },
  { id: "in-04", prompt: "How much did I spend on Meta ads last week?", expected: null },
  { id: "in-05", prompt: "How much sales tax did I collect last month?", expected: null },
  { id: "in-06", prompt: "Show my contribution margin trend", expected: null },
  { id: "in-07", prompt: "Can I afford to order 500 more units?", expected: null },
  { id: "in-08", prompt: "Why is POAS down this week?", expected: null },
  { id: "in-09", prompt: "Should I invest in more inventory for SKU-123?", expected: null },
  { id: "in-10", prompt: "What was my net revenue after refunds?", expected: null },
];

export const CHAT_SCOPE_GOLDEN_SET: ChatScopeGoldenCase[] = [
  ...CHAT_SCOPE_ADVERSARIAL_GOLDEN_SET,
  ...CHAT_SCOPE_IN_SCOPE_GOLDEN_SET,
];
