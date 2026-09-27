import { Component, input, OnInit, output } from "@angular/core";
import { FormsModule } from "@angular/forms";
import { Tenant } from "../../core/models/domain.model";
import { contactValue, NoticeChannel, suppressionNote, suppressionOf } from "../../core/models/consent";
import { contactErrors, emailError, phoneError } from "../../core/utils/contact-validation";

/**
 * Formulaire d'une personne à aviser (locataire), partagé par l'admin et le
 * portail du propriétaire. Un canal dont la personne s'est désinscrite est
 * verrouillé (numéro/courriel + case) avec une note ; le serveur applique la
 * même règle.
 */
@Component({
  selector: "app-contact-form",
  imports: [FormsModule],
  templateUrl: "./contact-form.html",
  styleUrl: "./contact-form.scss"
})
export class ContactForm implements OnInit {
  readonly value = input.required<Partial<Tenant>>();
  readonly heading = input<string>("");
  readonly submitLabel = input("Enregistrer");
  readonly saving = input(false);
  readonly submitted = output<Partial<Tenant>>();
  readonly cancelled = output<void>();

  form: Partial<Tenant> = {};

  readonly emailError = emailError;
  readonly phoneError = phoneError;
  readonly contactErrors = contactErrors;

  ngOnInit(): void {
    this.form = { SmsConsent: true, EmailConsent: true, ...this.value() };
  }

  locked(channel: NoticeChannel): boolean {
    return !!suppressionOf(this.form, channel);
  }

  hasContact(channel: NoticeChannel): boolean {
    return !!contactValue(this.form, channel);
  }

  note(channel: NoticeChannel): string | null {
    const suppression = suppressionOf(this.form, channel);
    return suppression ? suppressionNote(channel, suppression) : null;
  }

  submit(): void {
    if (contactErrors(this.form)) return;
    const { Suppressions, ...fields } = this.form;
    this.submitted.emit(fields);
  }
}
