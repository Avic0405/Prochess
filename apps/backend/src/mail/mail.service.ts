import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as nodemailer from 'nodemailer';

@Injectable()
export class MailService implements OnModuleInit {
  private readonly logger = new Logger(MailService.name);
  private transporter: nodemailer.Transporter | null = null;
  private isEthereal = false;

  constructor(private configService: ConfigService) {}

  async onModuleInit() {
    await this.initTransporter();
  }

  private async initTransporter() {
    const host = this.configService.get<string>('mail.host') ?? '';
    const user = this.configService.get<string>('mail.user') ?? '';
    const pass = this.configService.get<string>('mail.pass') ?? '';

    const isPlaceholder =
      !host || !user || !pass ||
      user.startsWith('placeholder') ||
      pass.startsWith('placeholder') ||
      host === 'smtp.gmail.com' && user === 'noreply@prochess.live';

    if (isPlaceholder) {
      // Auto-create an Ethereal test account for dev
      try {
        const testAccount = await nodemailer.createTestAccount();
        this.isEthereal = true;
        this.transporter = nodemailer.createTransport({
          host: 'smtp.ethereal.email',
          port: 587,
          secure: false,
          auth: { user: testAccount.user, pass: testAccount.pass },
        });
        this.logger.log('📧 Ethereal test account ready — emails previewed at https://ethereal.email');
        this.logger.log(`   Login: ${testAccount.user} / ${testAccount.pass}`);
      } catch (err) {
        this.logger.warn('Could not create Ethereal test account — emails will be logged only', err);
      }
    } else {
      this.transporter = nodemailer.createTransport({
        host,
        port: this.configService.get<number>('mail.port', 587),
        secure: false,
        auth: { user, pass },
      });
    }
  }

  async sendVerificationEmail(email: string, username: string, token: string) {
    const appUrl = this.configService.get<string>('appUrl', 'http://localhost:3000');
    const verificationUrl = `${appUrl}/verify-email?token=${token}`;

    await this.send({
      to: email,
      subject: 'Verify your ProChess.live account',
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2 style="color: #6D28D9;">Welcome to ProChess.live, ${username}!</h2>
          <p>Please verify your email address to get started.</p>
          <a href="${verificationUrl}"
             style="display: inline-block; padding: 12px 24px; background: #6c5ce7;
                    color: white; text-decoration: none; border-radius: 4px; margin: 20px 0;">
            Verify Email
          </a>
          <p style="color: #666; font-size: 12px;">
            This link expires in 24 hours. If you didn't create this account, ignore this email.
          </p>
        </div>
      `,
    });
  }

  async sendOtpEmail(email: string, username: string, otp: string) {
    await this.send({
      to: email,
      subject: 'Verify your ProChess.live account',
      html: `<!DOCTYPE html>
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
          <!-- Header -->
          <tr>
            <td style="background:linear-gradient(135deg,#1e1b4b 0%,#312e81 50%,#4c1d95 100%);padding:32px 40px;text-align:center;">
              <div style="font-size:28px;font-weight:800;color:#ffffff;letter-spacing:-0.5px;">
                &#9823; <span style="color:#a78bfa;">ProChess</span>.live
              </div>
              <p style="color:#c4b5fd;margin:8px 0 0;font-size:14px;">Real-Money Chess Platform</p>
            </td>
          </tr>
          <!-- Body -->
          <tr>
            <td style="padding:40px;">
              <h2 style="color:#f0f6fc;font-size:22px;font-weight:700;margin:0 0 8px;">Hello, ${username}! &#128075;</h2>
              <p style="color:#8b949e;font-size:15px;line-height:1.6;margin:0 0 32px;">
                You're one step away from joining ProChess.live. Enter the verification code below to confirm your email address and create your account.
              </p>
              <!-- OTP Box -->
              <div style="background:#0d1117;border:2px solid #6d28d9;border-radius:12px;padding:32px;text-align:center;margin:0 0 32px;">
                <p style="color:#8b949e;font-size:13px;font-weight:600;letter-spacing:2px;text-transform:uppercase;margin:0 0 16px;">Your Verification Code</p>
                <div style="font-size:48px;font-weight:800;letter-spacing:12px;color:#a78bfa;font-family:'Courier New',monospace;">${otp}</div>
                <p style="color:#6e7681;font-size:13px;margin:16px 0 0;">&#9200; Expires in <strong style="color:#f0f6fc;">10 minutes</strong></p>
              </div>
              <!-- Security note -->
              <div style="background:#161b22;border:1px solid #30363d;border-radius:8px;padding:16px;margin:0 0 24px;">
                <p style="color:#8b949e;font-size:13px;margin:0;line-height:1.5;">
                  &#128274; <strong style="color:#f0f6fc;">Security tip:</strong> Never share this code with anyone. ProChess.live will never ask for your OTP outside of the verification page.
                </p>
              </div>
              <p style="color:#6e7681;font-size:13px;line-height:1.5;margin:0;">
                If you didn't create a ProChess.live account, you can safely ignore this email. Someone may have entered your email address by mistake.
              </p>
            </td>
          </tr>
          <!-- Footer -->
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
</html>`,
    });
  }

  async sendPasswordResetEmail(email: string, username: string, token: string) {
    const appUrl = this.configService.get<string>('appUrl', 'http://localhost:3000');
    const resetUrl = `${appUrl}/reset-password?token=${token}`;

    await this.send({
      to: email,
      subject: 'Reset your ProChess.live password',
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2>Password Reset Request</h2>
          <p>Hi ${username}, click below to reset your password.</p>
          <a href="${resetUrl}"
             style="display: inline-block; padding: 12px 24px; background: #e17055;
                    color: white; text-decoration: none; border-radius: 4px; margin: 20px 0;">
            Reset Password
          </a>
          <p style="color: #666; font-size: 12px;">
            This link expires in 1 hour. If you didn't request this, ignore this email.
          </p>
        </div>
      `,
    });
  }

  async sendGameResultEmail(email: string, username: string, result: string, ratingChange: number) {
    await this.send({
      to: email,
      subject: `Game Result: ${result}`,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2>Game Over, ${username}!</h2>
          <p>Result: <strong>${result}</strong></p>
          <p>Rating change: <strong style="color: ${ratingChange >= 0 ? 'green' : 'red'}">
            ${ratingChange >= 0 ? '+' : ''}${ratingChange}
          </strong></p>
        </div>
      `,
    });
  }

  private async send(options: { to: string; subject: string; html: string }) {
    if (!this.transporter) {
      this.logger.warn(`Email not sent (no transporter): ${options.subject} → ${options.to}`);
      return;
    }

    try {
      const from = this.configService.get<string>('mail.from') ?? 'ProChess.live <noreply@prochess.live>';
      const info = await this.transporter.sendMail({ from, ...options });

      if (this.isEthereal) {
        const previewUrl = nodemailer.getTestMessageUrl(info);
        this.logger.log(`📧 Email preview: ${previewUrl}`);
      }
    } catch (error) {
      this.logger.error(`Failed to send email to ${options.to}: ${(error as Error).message}`);
    }
  }
}
