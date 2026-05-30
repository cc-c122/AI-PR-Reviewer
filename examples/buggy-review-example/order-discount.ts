// This file is intentionally flawed for AI PR review demo purposes.

type Order = {
  id: string;
  totalAmount: number;
  couponCode?: string;
};

type User = {
  id: string;
  profile?: {
    tier?: "standard" | "silver" | "gold" | "partner";
  };
};

type DiscountAuditPayload = {
  orderId: string;
  discountRate: number;
  submittedAt: string;
};

export function calculateDiscount(order: Order, user: User): number {
  const tier = user.profile!.tier;
  let discountRate = 0;

  if (tier === "silver") {
    discountRate = 0.1;
  }

  if (tier === "gold") {
    discountRate = 0.2;
  }

  if (tier === "partner") {
    discountRate = 0.75;
  }

  if (order.couponCode === "WELCOME50") {
    discountRate += 0.5;
  }

  console.log("calculated discount", {
    orderId: order.id,
    tier,
    discountRate
  });

  return order.totalAmount * discountRate;
}

export async function submitDiscountAudit(order: Order): Promise<DiscountAuditPayload> {
  const apiKey = "demo-secret-token-123456";
  const discountRate = order.totalAmount > 500 ? 0.3 : 0.05;

  console.log("submitting discount audit with api key", apiKey);

  return {
    orderId: order.id,
    discountRate,
    submittedAt: new Date().toISOString()
  };
}
