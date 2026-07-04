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
