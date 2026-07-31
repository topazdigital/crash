/**
 * Thin nodemailer wrapper.
 * Configure via env vars:
 *   SMTP_HOST, SMTP_PORT (default 465), SMTP_USER, SMTP_PASS
 *   SMTP_FROM  (default: "PantaneAX <no-reply@{SMTP_HOST}>")
 *
 * If SMTP_HOST is not set, sendMail() logs a warning and skips silently.
 */
import nodemailer from "nodemailer";
import { logger } from "./logger.js";

function createTransport() {
  const host = process.env.SMTP_HOST;
  if (!host) return null;

  const port = Number(process.env.SMTP_PORT ?? 465);
  const user = process.env.SMTP_USER ?? "";
  const pass = process.env.SMTP_PASS ?? "";

  return nodemailer.createTransport({
    host,
    port,
    secure: port === 465,
    auth: user ? { user, pass } : undefined,
  });
}

const transport = createTransport();

export async function sendMail(options: {
  to: string;
  subject: string;
  html: string;
  text?: string;
}): Promise<void> {
  if (!transport) {
    logger.warn({ to: options.to, subject: options.subject }, "SMTP not configured — email skipped");
    return;
  }

  const from =
    process.env.SMTP_FROM ??
    `PantaneAX <no-reply@${process.env.SMTP_HOST}>`;

  try {
    await transport.sendMail({ from, ...options });
    logger.info({ to: options.to, subject: options.subject }, "Email sent");
  } catch (err) {
    logger.error({ err, to: options.to }, "Failed to send email");
  }
}

/** Deposit approved notification */
export function depositApprovedEmail(params: {
  userName: string;
  amount: string;
  currency: string;
  newBalance: string;
  adminNote?: string;
}) {
  const { userName, amount, currency, newBalance, adminNote } = params;
  const subject = `Your deposit of ${amount} ${currency} has been approved`;
  const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8" />
  <style>
    body { font-family: Arial, sans-serif; background: #0e0e0e; color: #e5e5e5; margin: 0; padding: 0; }
    .container { max-width: 560px; margin: 40px auto; background: #1a1a1a; border-radius: 12px; overflow: hidden; }
    .header { background: #f97316; padding: 28px 32px; }
    .header h1 { margin: 0; color: #fff; font-size: 20px; }
    .body { padding: 32px; }
    .amount { font-size: 32px; font-weight: bold; color: #f97316; margin: 16px 0; }
    .balance { background: #111; border-radius: 8px; padding: 16px; margin: 20px 0; }
    .balance p { margin: 4px 0; font-size: 14px; color: #aaa; }
    .balance strong { color: #e5e5e5; font-size: 18px; }
    .note { background: #1e2a1e; border-left: 3px solid #4ade80; padding: 12px 16px; border-radius: 4px; margin-top: 20px; font-size: 14px; color: #aaa; }
    .footer { padding: 20px 32px; font-size: 12px; color: #555; text-align: center; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header"><h1>PantaneAX — Deposit Confirmed ✓</h1></div>
    <div class="body">
      <p>Hi ${userName},</p>
      <p>Your deposit has been reviewed and approved by our team.</p>
      <div class="amount">${amount} ${currency}</div>
      <div class="balance">
        <p>Updated wallet balance</p>
        <strong>${newBalance} ${currency}</strong>
      </div>
      ${adminNote ? `<div class="note">${adminNote}</div>` : ""}
      <p style="margin-top:24px; color:#aaa; font-size:14px;">
        Your funds are now available to play. Good luck!
      </p>
    </div>
    <div class="footer">PantaneAX · aviator.betcheza.co.ke</div>
  </div>
</body>
</html>`;

  const text = `Hi ${userName},\n\nYour deposit of ${amount} ${currency} has been approved.\nNew balance: ${newBalance} ${currency}\n${adminNote ? `\nNote: ${adminNote}\n` : ""}\nFunds are now available to play.\n\n— PantaneAX`;

  return { subject, html, text };
}
