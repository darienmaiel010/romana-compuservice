export const whatsappSenderKeys = ["erika"] as const;

export type WhatsappSenderKey = (typeof whatsappSenderKeys)[number];

export const whatsappSenders: Record<
  WhatsappSenderKey,
  {
    name: string;
    phoneSuffix: string;
    accessTokenEnv: string;
    phoneNumberIdEnv: string;
  }
> = {
  erika: {
    name: "Erika",
    phoneSuffix: "8736",
    accessTokenEnv: "WHATSAPP_ERIKA_ACCESS_TOKEN",
    phoneNumberIdEnv: "WHATSAPP_ERIKA_PHONE_NUMBER_ID",
  },
};

export function getWhatsappSenderConfiguration(key: WhatsappSenderKey) {
  const sender = whatsappSenders[key];
  const accessToken = process.env[sender.accessTokenEnv];
  const phoneNumberId = process.env[sender.phoneNumberIdEnv];
  const missing = [
    !accessToken && sender.accessTokenEnv,
    !phoneNumberId && sender.phoneNumberIdEnv,
  ].filter((value): value is string => Boolean(value));

  return { ...sender, accessToken, phoneNumberId, missing };
}
