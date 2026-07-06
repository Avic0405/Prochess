import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as nodemailer from 'nodemailer';

type MailPayload = { to: string; subject: string; html: string };

/**
 * MailService — three-tier provider strategy
 *
 *  Tier 1 (production, recommended):
 *    RESEND_API_KEY is set → Resend HTTP API (port 443, never blocked, zero SMTP)
 *
 *  Tier 2 (production, SMTP):
 *    MAIL_HOST + MAIL_USER + MAIL_PASS are set → real SMTP transporter
 *    (Gmail port 587 STARTTLS or port 465 SSL)
 *
 *  Tier 3 (development fallback):
 *    Nothing configured → Ethereal test account (emails NOT delivered to real inboxes)
 */
@Injectable()
export class MailService implements OnModuleInit {
  private readonly logger = new Logger(MailService.name);

  private transporter: nodemailer.Transporter | null = null;
  private smtpVerified = false;
  private isEthereal = false;

  private resendApiKey: string | null = null;
  private fromAddress = 'ProChess.live <noreply@prochess.live>';

  constructor(private configService: ConfigService) {}

  async onModuleInit() {
    this.fromAddress =
      this.configService.get<string>('mail.from') ??
      'ProChess.live <noreply@prochess.live>';
    await this.initProvider();
  }

  // ── Provider initialisation ─────────────────────────────────────────────

  private async initProvider(): Promise<void> {
    const resendKey = this.configService.get<string>('mail.resendApiKey') ?? '';

    // ── Tier 1: Resend HTTP API ───────────────────────────────────────────
    if (resendKey && !resendKey.startsWith('re_placeholder')) {
      this.resendApiKey = resendKey;
      this.logger.log('');
      this.logger.log('─── Mail Provider ──────────────────────────────────');
      this.logger.log('  Mode : Resend HTTP API  (https://resend.com)');
      this.logger.log(`  From : ${this.fromAddress}`);
      this.logger.log('────────────────────────────────────────────────────');
      this.logger.log('✓ Resend ready — SMTP bypassed entirely');
      return;
    }

    // ── Tier 2 / 3: SMTP ─────────────────────────────────────────────────
    const host = this.configService.get<string>('mail.host') ?? '';
    const port = this.configService.get<number>('mail.port') ?? 587;
    const user = this.configService.get<string>('mail.user') ?? '';
    const pass = this.configService.get<string>('mail.pass') ?? '';

    this.logger.log('');
    this.logger.log('─── Mail Provider ──────────────────────────────────');
    this.logger.log('  Mode      : SMTP');
    this.logger.log(`  MAIL_HOST : ${host || '(not set)'}`);
    this.logger.log(`  MAIL_PORT : ${port}`);
    this.logger.log(`  MAIL_USER : ${user || '(not set)'}`);
    this.logger.log(`  MAIL_FROM : ${this.fromAddress}`);
    this.logger.log('  MAIL_PASS : (hidden)');
    this.logger.log('────────────────────────────────────────────────────');

    const isUnconfigured =
      !host ||
      !user ||
      !pass ||
      user.startsWith('placeholder') ||
      pass.startsWith('placeholder') ||
      (host === 'smtp.gmail.com' && user === 'noreply@prochess.live');

    if (isUnconfigured) {
      await this.initEthereal();
      return;
    }

    await this.initSmtp(host, port, user, pass);
  }

  private async initEthereal(): Promise<void> {
    this.logger.warn(
      'SMTP credentials not configured — falling back to Ethereal (emails NOT delivered to real inboxes)',
    );
    try {
      const acct = await nodemailer.createTestAccount();
      this.isEthereal = true;
      this.transporter = nodemailer.createTransport({
        host: 'smtp.ethereal.email',
        port: 587,
        secure: false,
        auth: { user: acct.user, pass: acct.pass },
        connectionTimeout: 10_000,
        greetingTimeout: 10_000,
        socketTimeout: 15_000,
      });
      this.smtpVerified = true;
      this.logger.log(`📧 Ethereal ready`);
      this.logger.log(`   Login : ${acct.user} / ${acct.pass}`);
      this.logger.log('   Preview inbox at https://ethereal.email');
    } catch (err) {
      this.logger.warn(
        `Ethereal setup failed: ${(err as Error).message} — emails will be console-logged only`,
      );
    }
  }

  private async initSmtp(host: string, port: number, user: string, pass: string): Promise<void> {
    // port 465 = SSL on connect; port 587 = plain connect → STARTTLS upgrade
    const useSSL = port === 465;

    this.transporter = nodemailer.createTransport({
      host,
      port,
      secure: useSSL,
      requireTLS: !useSSL, // refuse connection if STARTTLS unavailable on port 587
      auth: { user, pass },
      tls: {
        rejectUnauthorized: true,
        minVersion: 'TLSv1.2',
      },
      // Short timeouts — surface problems fast instead of hanging for 2 minutes
      connectionTimeout: 10_000, // 10 s — TCP connect
      greetingTimeout: 10_000,   // 10 s — wait for SMTP banner
      socketTimeout: 20_000,     // 20 s — idle after banner
    });

    // Verify the connection and credentials immediately at startup.
    // This is the single most important diagnostic step — it surfaces the real
    // error (timeout, auth failure, TLS error) in the logs right at boot time.
    this.logger.log(`Verifying SMTP connection to ${host}:${port} …`);
    try {
      await this.transporter.verify();
      this.smtpVerified = true;
      this.logger.log(`✓ SMTP authenticated and ready`);
    } catch (err: any) {
      this.smtpVerified = false;
      this.logger.error('✗ SMTP verify FAILED — emails will not be delivered');
      this.logger.error(`  message : ${err?.message ?? 'unknown'}`);
      this.logger.error(`  code    : ${err?.code ?? 'N/A'}`);
      this.logger.error(`  command : ${err?.command ?? 'N/A'}`);

      const isNetworkError = [
        'ETIMEDOUT', 'ECONNREFUSED', 'ECONNRESET', 'ENETUNREACH', 'EAI_AGAIN',
      ].includes(err?.code as string);

      if (isNetworkError) {
        this.logger.error('');
        this.logger.error(
          '  Outbound SMTP is unreachable. Possible causes:',
        );
        this.logger.error(
          '    1. IPv6 DNS — Node.js resolved smtp.gmail.com to an IPv6 address',
        );
        this.logger.error(
          '       that is unreachable from this server (common on Render free tier)',
        );
        this.logger.error(
          '    2. Outbound port 587/465 restricted by the hosting provider',
        );
        this.logger.error(
          '    3. Wrong MAIL_HOST, MAIL_PORT, or MAIL_PASS (try regenerating App Password)',
        );
        this.logger.error('');
        this.logger.error(
          '  FASTEST FIX: set RESEND_API_KEY in Render Environment',
        );
        this.logger.error(
          '  → Sign up free at https://resend.com (3 000 emails/month)',
        );
        this.logger.error(
          '  → Verify your sending domain, then add RESEND_API_KEY to Render',
        );
      } else if (err?.code === 'EAUTH' || err?.responseCode === 535) {
        this.logger.error('');
        this.logger.error('  Authentication failed. For Gmail:');
        this.logger.error('    • 2-Step Verification must be ON for your Google account');
        this.logger.error('    • MAIL_PASS must be a 16-character App Password (not your account password)');
        this.logger.error('    • Generate one at: https://myaccount.google.com → Security → App passwords');
      }
      // Do NOT throw — the app still starts; individual send calls will fail with clear errors
    }
  }

  // ── Public API ──────────────────────────────────────────────────────────

  async sendOtpEmail(email: string, username: string, otp: string): Promise<void> {
    await this.send({
      to: email,
      subject: 'Your ProChess.live verification code',
      html: buildOtpHtml(username, otp),
    });
  }

  async sendVerificationEmail(email: string, username: string, token: string): Promise<void> {
    const appUrl = this.configService.get<string>('appUrl', 'http://localhost:3000');
    const url = `${appUrl}/verify-email?token=${token}`;
    await this.send({
      to: email,
      subject: 'Verify your ProChess.live account',
      html: `<div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto">
        <h2 style="color:#6D28D9">Welcome to ProChess.live, ${username}!</h2>
        <p>Please verify your email address to get started.</p>
        <a href="${url}" style="display:inline-block;padding:12px 24px;background:#6c5ce7;color:#fff;text-decoration:none;border-radius:4px;margin:20px 0">Verify Email</a>
        <p style="color:#666;font-size:12px">This link expires in 24 hours. If you didn't create this account, ignore this email.</p>
      </div>`,
    });
  }

  async sendPasswordResetEmail(email: string, username: string, token: string): Promise<void> {
    const appUrl = this.configService.get<string>('appUrl', 'http://localhost:3000');
    const url = `${appUrl}/reset-password?token=${token}`;
    await this.send({
      to: email,
      subject: 'Reset your ProChess.live password',
      html: `<div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto">
        <h2>Password Reset Request</h2>
        <p>Hi ${username}, click below to reset your password.</p>
        <a href="${url}" style="display:inline-block;padding:12px 24px;background:#e17055;color:#fff;text-decoration:none;border-radius:4px;margin:20px 0">Reset Password</a>
        <p style="color:#666;font-size:12px">This link expires in 1 hour. If you didn't request this, ignore this email.</p>
      </div>`,
    });
  }

  async sendGameResultEmail(
    email: string,
    username: string,
    result: string,
    ratingChange: number,
  ): Promise<void> {
    await this.send({
      to: email,
      subject: `Game Result: ${result}`,
      html: `<div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto">
        <h2>Game Over, ${username}!</h2>
        <p>Result: <strong>${result}</strong></p>
        <p>Rating change: <strong style="color:${ratingChange >= 0 ? 'green' : 'red'}">${ratingChange >= 0 ? '+' : ''}${ratingChange}</strong></p>
      </div>`,
    });
  }

  // ── Internal dispatch ───────────────────────────────────────────────────

  private async send(payload: MailPayload): Promise<void> {
    this.logger.log(`→ Sending  to="${payload.to}"  subject="${payload.subject}"`);

    if (this.resendApiKey) {
      await this.sendViaResend(payload);
      return;
    }

    await this.sendViaSmtp(payload);
  }

  // ── Resend HTTP API ─────────────────────────────────────────────────────

  private async sendViaResend(payload: MailPayload): Promise<void> {
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${this.resendApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: this.fromAddress,
        to: [payload.to],
        subject: payload.subject,
        html: payload.html,
      }),
    });

    const json = (await res.json()) as Record<string, unknown>;

    if (!res.ok) {
      const detail = (json?.message as string) ?? JSON.stringify(json);
      throw new Error(`Resend API ${res.status}: ${detail}`);
    }

    this.logger.log(`✓ Resend accepted  id=${json['id'] as string}`);
  }

  // ── SMTP (Nodemailer) ───────────────────────────────────────────────────

  private async sendViaSmtp(payload: MailPayload): Promise<void> {
    if (!this.transporter) {
      const msg = `Email not sent — no transporter configured (to=${payload.to})`;
      this.logger.warn(msg);
      throw new Error(msg);
    }

    if (!this.smtpVerified && !this.isEthereal) {
      this.logger.warn(
        `SMTP verify previously failed — attempting send anyway (to=${payload.to})`,
      );
    }

    const info = await this.transporter.sendMail({
      from: this.fromAddress,
      to: payload.to,
      subject: payload.subject,
      html: payload.html,
    });

    if (this.isEthereal) {
      const preview = nodemailer.getTestMessageUrl(info);
      this.logger.log(`✓ Ethereal captured  preview=${preview}`);
    } else {
      this.logger.log(`✓ SMTP delivered  messageId=${info.messageId}`);
    }
  }
}

// ── OTP email HTML template ─────────────────────────────────────────────────

function buildOtpHtml(username: string, otp: string): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8"/>
  <meta name="viewport" content="width=device-width,initial-scale=1"/>
  <title>Verify your ProChess.live account</title>
</head>
<body style="margin:0;padding:0;background-color:#0d1117;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background-color:#0d1117;padding:40px 20px;">
    <tr>
      <td align="center">
        <table width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;background-color:#161b22;border-radius:16px;border:1px solid #30363d;overflow:hidden;">
          <tr>
            <td style="background:linear-gradient(135deg,#1e1b4b 0%,#312e81 50%,#4c1d95 100%);padding:32px 40px;text-align:center;">
              <div style="font-size:28px;font-weight:800;color:#ffffff;letter-spacing:-0.5px;">&#9823; <span style="color:#a78bfa;">ProChess</span>.live</div>
              <p style="color:#c4b5fd;margin:8px 0 0;font-size:14px;">Real-Money Chess Platform</p>
            </td>
          </tr>
          <tr>
            <td style="padding:40px;">
              <h2 style="color:#f0f6fc;font-size:22px;font-weight:700;margin:0 0 8px;">Hello, ${username}! &#128075;</h2>
              <p style="color:#8b949e;font-size:15px;line-height:1.6;margin:0 0 32px;">
                You&#39;re one step away from joining ProChess.live. Enter the verification code below to confirm your email address and create your account.
              </p>
              <div style="background:#0d1117;border:2px solid #6d28d9;border-radius:12px;padding:32px;text-align:center;margin:0 0 32px;">
                <p style="color:#8b949e;font-size:13px;font-weight:600;letter-spacing:2px;text-transform:uppercase;margin:0 0 16px;">Your Verification Code</p>
                <div style="font-size:48px;font-weight:800;letter-spacing:12px;color:#a78bfa;font-family:'Courier New',monospace;">${otp}</div>
                <p style="color:#6e7681;font-size:13px;margin:16px 0 0;">&#9200; Expires in <strong style="color:#f0f6fc;">10 minutes</strong></p>
              </div>
              <div style="background:#161b22;border:1px solid #30363d;border-radius:8px;padding:16px;margin:0 0 24px;">
                <p style="color:#8b949e;font-size:13px;margin:0;line-height:1.5;">
                  &#128274; <strong style="color:#f0f6fc;">Security tip:</strong> Never share this code with anyone. ProChess.live will never ask for your OTP outside of the verification page.
                </p>
              </div>
              <p style="color:#6e7681;font-size:13px;line-height:1.5;margin:0;">
                If you didn&#39;t create a ProChess.live account, you can safely ignore this email.
              </p>
            </td>
          </tr>
          <tr>
            <td style="background:#0d1117;padding:24px 40px;border-top:1px solid #30363d;text-align:center;">
              <p style="color:#6e7681;font-size:12px;margin:0;">&#169; 2026 ProChess.live &middot; All rights reserved</p>
              <p style="color:#6e7681;font-size:11px;margin:8px 0 0;">This is an automated message &mdash; please do not reply.</p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}
