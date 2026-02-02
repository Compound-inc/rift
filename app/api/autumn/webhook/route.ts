import { NextRequest, NextResponse } from "next/server";
import { Webhook } from "svix";
import { Autumn } from "autumn-js";
import { workos } from "@/app/api/workos";

export const runtime = "nodejs";

const PRODUCT_CHANGE_SCENARIOS = new Set(["upgrade", "downgrade"]);

type CustomerProductsUpdatedEvent = {
  type: "customer.products.updated";
  data: {
    scenario: string;
    customer: { id: string };
  };
};

const isCustomerProductsUpdatedEvent = (value: unknown): value is CustomerProductsUpdatedEvent => {
  if (!value || typeof value !== "object") return false;
  const v = value as any;
  return v.type === "customer.products.updated" && typeof v.data?.scenario === "string";
};

export async function POST(req: NextRequest) {
  const webhookSecret = process.env.AUTUMN_WEBHOOK_SECRET;
  if (!webhookSecret) {
    return NextResponse.json({ error: "AUTUMN_WEBHOOK_SECRET is not set" }, { status: 500 });
  }

  const autumnSecretKey = process.env.AUTUMN_SECRET_KEY;
  if (!autumnSecretKey) {
    return NextResponse.json({ error: "AUTUMN_SECRET_KEY is not set" }, { status: 500 });
  }

  const payload = await req.text();
  const headers = {
    "svix-id": req.headers.get("svix-id") ?? "",
    "svix-timestamp": req.headers.get("svix-timestamp") ?? "",
    "svix-signature": req.headers.get("svix-signature") ?? "",
  };

  let event: unknown;
  try {
    event = new Webhook(webhookSecret).verify(payload, headers);
  } catch {
    return NextResponse.json({ error: "Invalid webhook signature" }, { status: 400 });
  }

  if (!isCustomerProductsUpdatedEvent(event)) {
    return NextResponse.json({ status: "ignored" }, { status: 200 });
  }

  const scenario = event.data.scenario;
  if (!PRODUCT_CHANGE_SCENARIOS.has(scenario)) {
    return NextResponse.json({ status: "ignored" }, { status: 200 });
  }

  const orgId = event.data.customer?.id;
  if (!orgId) {
    return NextResponse.json({ error: "Missing customer id" }, { status: 400 });
  }

  const autumn = new Autumn({ secretKey: autumnSecretKey });

  // Cleanup: delete seat entities for all org members.
  let after: string | undefined = undefined;
  do {
    const { data, listMetadata } = await workos.userManagement.listOrganizationMemberships({
      organizationId: orgId,
      after,
      limit: 100,
    });

    for (const membership of data) {
      const userId = membership.userId;
      if (!userId) continue;
      try {
        await autumn.entities.delete(orgId, userId);
      } catch {
        // Ignore (idempotent cleanup). Webhook retries may hit already-deleted entities.
      }
    }

    after = listMetadata.after ?? undefined;
  } while (after);

  return NextResponse.json({ status: "ok", cleanup: "performed" }, { status: 200 });
}

