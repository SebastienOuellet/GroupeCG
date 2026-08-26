import nodemailer from "nodemailer";
import { EmailProvider } from "./EmailProvider.js";
import { ConfigService } from "../../config/configService.js";
import { InternalServerError } from "../../errors/Errors.js";

const configService = new ConfigService();

export class NodemailerEmailProvider extends EmailProvider {
  constructor() {
    super();
    const server = configService.get("SMTPGO_SERVER");
    const user = configService.get("SMTPGO_USER");
    const pw = configService.get("SMTPGO_PW");

    if (!server || !user || !pw) {
      throw new InternalServerError(
        "Configuration SMTP incomplète: SMTPGO_SERVER, SMTPGO_USER et SMTPGO_PW sont requis."
      );
    }

    this.from = configService.get("NO_REPLY_EMAIL");
    this.transporter = nodemailer.createTransport({
      host: server,
      port: configService.get("SMTPGO_PORT"),
      auth: { user, pass: pw }
    });
  }

  async send({ to, subject, html, text }) {
    const info = await this.transporter.sendMail({
      from: this.from,
      to,
      subject,
      html,
      text
    });
    return { providerMessageId: info.messageId };
  }
}
