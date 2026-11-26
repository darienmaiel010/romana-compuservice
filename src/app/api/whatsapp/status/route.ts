import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth";
import {
  getWhatsappSenderConfiguration,
  whatsappSenderKeys,
} from "@/lib/whatsapp";

export async function GET() {
  if (!(await requireAdmin())) {
    return NextResponse.json({ error: "Acceso denegado." }, { status: 403 });
  }

  const senders = whatsappSenderKeys.map((key) => {
    const sender = getWhatsappSenderConfiguration(key);
    return {
      key,
      name: sender.name,
      phoneSuffix: sender.phoneSuffix,
      configured: sender.missing.length === 0,
      missing: sender.missing,
    };
  });

  return NextResponse.json({
    configured: senders.every((sender) => sender.configured),
    senders,
    apiVersion: process.env.WHATSAPP_API_VERSION || "v21.0",
  });
}
