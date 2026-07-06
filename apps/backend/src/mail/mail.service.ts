import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Resend } from 'resend';

type MailPayload = { to: string; subject: string; html: string };

@Injectable()
export class MailService implements OnModuleInit {
  private readonly logger = new Logger(MailService.name);

  private resend!: Resend;
  private fromAddress = 'onboarding@resend.dev';
  private apiKeySet = false;

  constructor(private configService: ConfigService) {}

  onModuleInit(): void {
    const apiKey = this.configService.get<string>('mail.resendApiKey') ?? '';
    this.fromAddress =
      this.configService.get<string>('mail.from') ?? 'onboarding@resend.dev';

    this.logger.log('');
    this.logger.log('─── Email Provider ─────────────────────────────────');
    this.logger.log('  Provider : Resend SDK  (https://resend.com)');
    this.logger.log(`  From     : ${this.fromAddress}`);
    this.logger.log(`  API Key  : ${apiKey ? apiKey.slice(0, 10) + '…' : '(NOT SET ⚠)'}`);
    this.logger.log('────────────────────────────────────────────────────');

    if (!apiKey) {
      this.logger.error(
        '✗ RESEND_API_KEY is not set — email sends will fail. ' +
          'Add it to Render → Environment.',
      );
      this.resend = new Resend('invalid-placeholder');
      this.apiKeySet = false;
    } else {
      this.resend = new Resend(apiKey);
      this.apiKeySet = true;
      this.logger.log('✓ Resend SDK initialised');
    }
  }

  // ── Provider state (AuthService + HealthController) ─────────────────────

  /** true when RESEND_API_KEY is present */
  get isReady(): boolean {
    return this.apiKeySet;
  }

  /** Instant check — no network call required */
  verifyConnection(): { status: 'ok' | 'error'; provider: string; detail?: string } {
    if (this.apiKeySet) {
      return {
        status: 'ok',
        provider: 'resend',
        detail: `Sending from: ${this.fromAddress}`,
      };
    }
    return {
      status: 'error',
      provider: 'resend',
      detail:
        'RESEND_API_KEY is not set. ' +
        'Sign up at https://resend.com (free: 3 000 emails/month) and add the key to Render Environment.',
    };
  }

  // ── Public email API ─────────────────────────────────────────────────────

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

  // ── Internal dispatch ────────────────────────────────────────────────────

  private async send(payload: MailPayload): Promise<void> {
    this.logger.log(
      `→ Sending  from="${this.fromAddress}"  to="${payload.to}"  subject="${payload.subject}"`,
    );

    if (!this.apiKeySet) {
      throw new Error(
        'Email not sent — RESEND_API_KEY is not configured. ' +
          'Add it to Render Environment to enable email delivery.',
      );
    }

    const { data, error } = await this.resend.emails.send({
      from: this.fromAddress,
      to: [payload.to],
      subject: payload.subject,
      html: payload.html,
    });

    if (error) {
      const detail = JSON.stringify(error);
      this.logger.error(`✗ Resend error  to="${payload.to}"  error=${detail}`);
      throw new Error(`Resend delivery failed: ${detail}`);
    }

    this.logger.log(`✓ Resend sent  id="${data?.id}"  to="${payload.to}"`);
  }
}

// ── OTP email HTML template ──────────────────────────────────────────────────

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
