import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getWhatsappSenderConfiguration } from "@/lib/whatsapp";
import { normalizeWhatsAppPhone } from "@/lib/phone";

const templateNames = {
  received: "Equipo recibido",
  budget: "Presupuesto",
  ready: "Listo para entregar",
} as const;

export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const user = await requireUser();
  if (!user) {
    return NextResponse.json({ error: "Acceso denegado." }, { status: 403 });
  }

  const body = (await request.json().catch(() => null)) as Record<string, unknown> | null;
  if (!body) {
    return NextResponse.json({ error: "La solicitud no contiene JSON válido." }, { status: 400 });
  }

  const type = body.type;
  if (type !== "received" && type !== "budget" && type !== "ready") {
    return NextResponse.json({ error: "Tipo de mensaje no válido." }, { status: 400 });
  }

  const senderKey = body.sender;
  if (senderKey !== "erika") {
    return NextResponse.json({ error: "Línea de WhatsApp no válida." }, { status: 400 });
  }

  const sender = getWhatsappSenderConfiguration(senderKey);
  if (!sender.accessToken || !sender.phoneNumberId) {
    return NextResponse.json(
      {
        error: `WhatsApp Business para ${sender.name} no está configurado. Faltan: ${sender.missing.join(", ")}. No se envió ningún mensaje.`,
      },
      { status: 503 },
    );
  }

  const { id } = await context.params;

  const order = await prisma.repairOrder.findUnique({
    where: { id },
    include: {
      customer: true,
      equipment: true,
      budgets: { orderBy: { createdAt: "desc" }, take: 1 },
      payments: true,
    },
  });
  if (!order) {
    return NextResponse.json({ error: "Orden no encontrada." }, { status: 404 });
  }

  const phone = normalizeWhatsAppPhone(order.customer.whatsapp ?? order.customer.phone);
  if (!phone) {
    return NextResponse.json(
      { error: "El cliente no tiene un número de teléfono válido." },
      { status: 400 },
    );
  }

  const template = await prisma.whatsappTemplate.findUnique({
    where: { name: templateNames[type] },
  });
  if (!template || !template.active) {
    return NextResponse.json(
      { error: "La plantilla solicitada no existe o está desactivada." },
      { status: 400 },
    );
  }

  const total = order.budgets[0] ? Number(order.budgets[0].total) : 0;
  const paid = order.payments.reduce((sum, payment) => sum + Number(payment.amount), 0);
  const values: Record<string, string> = {
    cliente: order.customer.name,
    orden: order.orderNumber,
    equipo: [order.equipment.type, order.equipment.brand, order.equipment.model]
      .filter(Boolean)
      .join(" "),
    total: total.toFixed(2),
    balance: (total - paid).toFixed(2),
  };
  const message = template.body.replace(/\{\{(\w+)\}\}/g, (placeholder, key: string) =>
    values[key] ?? placeholder,
  );
  const version = process.env.WHATSAPP_API_VERSION || "v21.0";

  let response: Response;
  try {
    response = await fetch(
      `https://graph.facebook.com/${version}/${sender.phoneNumberId}/messages`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${sender.accessToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          messaging_product: "whatsapp",
          recipient_type: "individual",
          to: phone,
          type: "text",
          text: { body: message, preview_url: false },
        }),
        cache: "no-store",
      },
    );
  } catch {
    return NextResponse.json(
      { error: "No se pudo conectar con WhatsApp Business. No se confirmó el envío." },
      { status: 502 },
    );
  }

  const result = await response.json().catch(() => null);
  if (!response.ok) {
    const providerMessage =
      typeof result?.error?.message === "string"
        ? result.error.message
        : "WhatsApp rechazó el mensaje.";
    return NextResponse.json(
      { error: `${providerMessage} No se confirmó el envío.` },
      { status: 502 },
    );
  }

  const providerMessageId = result?.messages?.[0]?.id;
  if (typeof providerMessageId !== "string") {
    return NextResponse.json(
      { error: "WhatsApp respondió sin confirmar la aceptación del mensaje." },
      { status: 502 },
    );
  }

  await prisma.orderHistory.create({
    data: {
      orderId: order.id,
      userId: user.id,
      action: `Mensaje aceptado por WhatsApp (${sender.name})`,
      comment: `${template.name}; línea ${sender.name} (•••• ${sender.phoneSuffix}); ID del proveedor: ${providerMessageId}. La entrega al destinatario no está confirmada.`,
    },
  });

  return NextResponse.json({
    accepted: true,
    delivered: false,
    sender: sender.name,
    message: `WhatsApp aceptó el mensaje mediante ${sender.name}; la entrega al destinatario no está confirmada.`,
  });
}
