// Future setup file for the WhatsApp invite EmailJS flow.
// Fill in serviceId, templateId, and publicKey when you are ready to enable it.
export const WHATSAPP_INVITE_EMAILJS_SETUP = {
  enabled: false,
  setupFile: "emailjs-whatsapp-invite.setup.js",
  serviceId: "",
  templateId: "",
  publicKey: "",
  subject: "Official WhatsApp Invite - {{gender_label}}",
  requiredTemplateVariables: [
    "to_name",
    "to_email",
    "gender_label",
    "event_name",
    "group_link",
    "whatsapp_group_link",
    "message",
    "custom_message",
  ],
  messageBody: [
    "Hello {{to_name}},",
    "",
    "Please join the official {{gender_label}} WhatsApp group for {{event_name}}.",
    "Group link: {{group_link}}",
    "",
    "This group will be used for race updates, instructions, and event notices.",
    "",
    "Thank you,",
    "Kharagpur D Star Athletic Club",
  ].join("\n"),
  htmlTemplate: `<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>WhatsApp Group Invite</title>
  </head>
  <body style="margin:0;padding:0;background:#f4f7fb;font-family:Arial,Helvetica,sans-serif;color:#1f2937;">
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="background:#f4f7fb;padding:24px 0;">
      <tr>
        <td align="center">
          <table role="presentation" width="600" cellspacing="0" cellpadding="0" border="0" style="width:600px;max-width:100%;background:#ffffff;border-radius:18px;overflow:hidden;box-shadow:0 10px 30px rgba(15,23,42,0.12);">
            <tr>
              <td style="background:linear-gradient(135deg,#0b1220,#172554);padding:28px 32px;color:#ffffff;">
                <div style="font-size:12px;letter-spacing:0.14em;text-transform:uppercase;color:#f59e0b;font-weight:700;">KDSAC</div>
                <h1 style="margin:10px 0 0;font-size:28px;line-height:1.2;">WhatsApp Group Invite</h1>
                <p style="margin:10px 0 0;font-size:15px;opacity:0.9;">Kharagpur Mini Marathon 2026</p>
              </td>
            </tr>
            <tr>
              <td style="padding:32px;">
                <p style="margin:0 0 16px;font-size:16px;line-height:1.7;">Hello {{to_name}},</p>
                <p style="margin:0 0 16px;font-size:16px;line-height:1.7;">
                  You are invited to join the official <strong>{{gender_label}}</strong> WhatsApp group for
                  <strong>{{event_name}}</strong>.
                </p>
                <p style="margin:0 0 24px;font-size:16px;line-height:1.7;">
                  Please join the group to receive race updates, instructions, and event notices.
                </p>
                <div style="text-align:center;margin:0 0 24px;">
                  <a
                    href="{{group_link}}"
                    style="display:inline-block;background:#c40f2f;color:#ffffff;text-decoration:none;padding:14px 24px;border-radius:12px;font-weight:700;font-size:15px;"
                  >
                    Join WhatsApp Group
                  </a>
                </div>
                <div style="background:#f8fafc;border-left:4px solid #c40f2f;padding:16px 18px;border-radius:12px;">
                  <p style="margin:0;font-size:14px;line-height:1.7;white-space:pre-line;">{{message}}</p>
                </div>
              </td>
            </tr>
            <tr>
              <td style="padding:16px 32px;background:#f8fafc;color:#64748b;font-size:12px;line-height:1.6;">
                Kharagpur D Star Athletic Club
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>`,
};
