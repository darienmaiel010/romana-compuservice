export function normalizeWhatsAppPhone(phone: string | null | undefined) {
  const digits = (phone ?? "").replace(/\D/g, "");
  if (digits.length === 10) return `1${digits}`;
  if (digits.length >= 11 && digits.length <= 15) return digits;
  return null;
}

export function buildWhatsAppLink(phone: string | null | undefined, customerName: string) {
  const number = normalizeWhatsAppPhone(phone);
  if (!number) return null;

  const text = `Hola ${customerName}, le escribimos de ROMANA COMPUSERVICE.`;
  return `https://wa.me/${number}?text=${encodeURIComponent(text)}`;
}
