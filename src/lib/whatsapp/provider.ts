/**
 * Camada de abstração do WhatsApp.
 * A aplicação depende apenas de `WhatsAppProvider`; trocar Evolution API por
 * API Oficial (Meta Cloud) ou Z-API = escrever outro adapter.
 *
 * Fase 1 (protótipo): não usado — as mensagens são simuladas no store.
 * Fase 2: usado por route handlers (src/app/api/whatsapp/...) no servidor.
 */

export interface ProviderInstance {
  instanceName: string;
  status: "open" | "close" | "connecting";
  phone?: string;
}

export interface IncomingMessage {
  instanceName: string;
  from: string; // telefone com DDI
  pushName?: string;
  text: string;
  messageId: string;
  timestamp: number;
}

export interface WhatsAppProvider {
  createInstance(instanceName: string, webhookUrl: string): Promise<{ qrCodeBase64?: string }>;
  getQrCode(instanceName: string): Promise<string | undefined>;
  getStatus(instanceName: string): Promise<ProviderInstance>;
  sendText(instanceName: string, to: string, text: string): Promise<{ messageId: string }>;
  logout(instanceName: string): Promise<void>;
  /** Converte o payload bruto do webhook no formato interno. */
  parseWebhook(body: unknown): IncomingMessage | null;
}

/** Adapter da Evolution API v2 (https://doc.evolution-api.com). */
export class EvolutionProvider implements WhatsAppProvider {
  constructor(
    private baseUrl = process.env.EVOLUTION_API_URL ?? "",
    private apiKey = process.env.EVOLUTION_API_KEY ?? "",
  ) {}

  private async call<T>(path: string, init?: RequestInit): Promise<T> {
    const res = await fetch(`${this.baseUrl}${path}`, {
      ...init,
      headers: { "Content-Type": "application/json", apikey: this.apiKey, ...(init?.headers ?? {}) },
    });
    if (!res.ok) throw new Error(`Evolution API ${res.status}: ${await res.text()}`);
    return res.json() as Promise<T>;
  }

  async createInstance(instanceName: string, webhookUrl: string) {
    const r = await this.call<{ qrcode?: { base64?: string } }>("/instance/create", {
      method: "POST",
      body: JSON.stringify({
        instanceName,
        integration: "WHATSAPP-BAILEYS",
        qrcode: true,
        webhook: { url: webhookUrl, byEvents: false, events: ["MESSAGES_UPSERT", "CONNECTION_UPDATE"] },
      }),
    });
    return { qrCodeBase64: r.qrcode?.base64 };
  }

  async getQrCode(instanceName: string) {
    const r = await this.call<{ base64?: string }>(`/instance/connect/${instanceName}`);
    return r.base64;
  }

  async getStatus(instanceName: string): Promise<ProviderInstance> {
    const r = await this.call<{ instance: { state: ProviderInstance["status"] } }>(`/instance/connectionState/${instanceName}`);
    return { instanceName, status: r.instance.state };
  }

  async sendText(instanceName: string, to: string, text: string) {
    const r = await this.call<{ key: { id: string } }>(`/message/sendText/${instanceName}`, {
      method: "POST",
      body: JSON.stringify({ number: to, text }),
    });
    return { messageId: r.key.id };
  }

  async logout(instanceName: string) {
    await this.call(`/instance/logout/${instanceName}`, { method: "DELETE" });
  }

  parseWebhook(body: unknown): IncomingMessage | null {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const b = body as any;
    if (b?.event !== "messages.upsert" || b?.data?.key?.fromMe) return null;
    const text = b.data.message?.conversation ?? b.data.message?.extendedTextMessage?.text;
    if (!text) return null;
    return {
      instanceName: b.instance,
      from: String(b.data.key.remoteJid).split("@")[0],
      pushName: b.data.pushName,
      text,
      messageId: b.data.key.id,
      timestamp: Number(b.data.messageTimestamp) * 1000,
    };
  }
}
