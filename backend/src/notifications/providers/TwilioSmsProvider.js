import twilio from "twilio";
import { SmsProvider } from "./SmsProvider.js";
import { ConfigService } from "../../config/configService.js";
import { InternalServerError } from "../../errors/Errors.js";

const configService = new ConfigService();

export class TwilioSmsProvider extends SmsProvider {
  constructor() {
    super();
    const accountSid = configService.get("TWILIO_ACCOUNT_SID");
    const authToken = configService.get("TWILIO_AUTH_TOKEN");
    this.messagingServiceSid = configService.get("TWILIO_MESSAGING_SERVICE_SID");

    if (!accountSid || !authToken || !this.messagingServiceSid) {
      throw new InternalServerError(
        "Configuration Twilio incomplète: TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN et TWILIO_MESSAGING_SERVICE_SID sont requis."
      );
    }

    this.client = twilio(accountSid, authToken);
    this.statusCallback = configService.get("NODE_URL")
      ? `${configService.get("NODE_URL")}/api/webhook/twilio/status`
      : undefined;
  }

  async send({ to, body }) {
    const message = await this.client.messages.create({
      to,
      body,
      messagingServiceSid: this.messagingServiceSid,
      ...(this.statusCallback ? { statusCallback: this.statusCallback } : {})
    });
    return { providerMessageId: message.sid };
  }
}
