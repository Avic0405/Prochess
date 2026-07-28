import {
  Injectable,
  BadRequestException,
  NotFoundException,
  Logger,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../prisma/prisma.service';
import { WalletService } from '../wallet/wallet.service';
import { NotificationsService } from '../notifications/notifications.service';
import Stripe from 'stripe';
// eslint-disable-next-line @typescript-eslint/no-var-requires
const Razorpay = require('razorpay');
import { createHmac } from 'crypto';
import { Currency } from '@prisma/client';

@Injectable()
export class PaymentsService {
  private readonly logger = new Logger(PaymentsService.name);
  private stripe: Stripe;
  private razorpay: any;

  constructor(
    private configService: ConfigService,
    private prisma: PrismaService,
    private walletService: WalletService,
    private notifications: NotificationsService,
  ) {
    this.stripe = new Stripe(
      configService.get<string>('stripe.secretKey') ?? '',
      { apiVersion: '2024-04-10' },
    );

    this.razorpay = new Razorpay({
      key_id: configService.get<string>('razorpay.keyId') ?? '',
      key_secret: configService.get<string>('razorpay.keySecret') ?? '',
    });
  }

  private get stripeConfigured(): boolean {
    const key = this.configService.get<string>('stripe.secretKey') ?? '';
    return key.length > 0 && !key.startsWith('placeholder') && !key.startsWith('sk_test_placeholder');
  }

  private get razorpayConfigured(): boolean {
    const key = this.configService.get<string>('razorpay.keyId') ?? '';
    return key.length > 0 && !key.startsWith('placeholder') && !key.startsWith('rzp_test_placeholder');
  }

  // ─── Stripe Deposit ────────────────────────────────────────────────────────

  async createStripePaymentIntent(userId: string, amountUsd: number) {
    if (!this.stripeConfigured) {
      throw new BadRequestException(
        'Stripe is not configured. Add real STRIPE_SECRET_KEY to .env to enable deposits.',
      );
    }
    if (amountUsd < 1 || amountUsd > 10000) {
      throw new BadRequestException('Amount must be between $1 and $10,000');
    }

    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { email: true, username: true },
    });
    if (!user) throw new NotFoundException('User not found');

    const intent = await this.stripe.paymentIntents.create({
      amount: Math.round(amountUsd * 100), // cents
      currency: 'usd',
      metadata: { userId, type: 'deposit' },
      receipt_email: user.email,
    });

    // Track pending transaction — always deposits into USD wallet
    const wallet = await this.walletService.getOrCreateWallet(userId, Currency.USD);
    await this.prisma.transaction.create({
      data: {
        walletId: wallet.id,
        amount: amountUsd,
        currency: Currency.USD,
        type: 'DEPOSIT',
        status: 'PENDING',
        gatewayRef: intent.id,
        description: 'Stripe deposit',
      },
    });

    return {
      clientSecret: intent.client_secret,
      paymentIntentId: intent.id,
    };
  }

  async handleStripeWebhook(payload: Buffer, signature: string) {
    let event: Stripe.Event;

    try {
      event = this.stripe.webhooks.constructEvent(
        payload,
        signature,
        this.configService.get<string>('stripe.webhookSecret') ?? '',
      );
    } catch (err) {
      throw new BadRequestException(`Webhook signature verification failed`);
    }

    switch (event.type) {
      case 'payment_intent.succeeded':
        await this.handleStripeSuccess(event.data.object as Stripe.PaymentIntent);
        break;
      case 'payment_intent.payment_failed':
        await this.handleStripeFailure(event.data.object as Stripe.PaymentIntent);
        break;
    }

    return { received: true };
  }

  private async handleStripeSuccess(intent: Stripe.PaymentIntent) {
    const transaction = await this.prisma.transaction.findFirst({
      where: { gatewayRef: intent.id, status: 'PENDING' },
      include: { wallet: true },
    });

    if (!transaction) return;

    await this.prisma.$transaction([
      this.prisma.transaction.update({
        where: { id: transaction.id },
        data: { status: 'COMPLETED' },
      }),
      this.prisma.wallet.update({
        where: { id: transaction.walletId },
        data: { balance: { increment: transaction.amount } },
      }),
    ]);

    await this.notifications.create(transaction.wallet.userId, {
      type: 'PAYMENT_SUCCESS',
      title: 'Deposit Successful',
      body: `$${transaction.amount} added to your wallet`,
      data: { transactionId: transaction.id },
    });
  }

  private async handleStripeFailure(intent: Stripe.PaymentIntent) {
    await this.prisma.transaction.updateMany({
      where: { gatewayRef: intent.id },
      data: { status: 'FAILED' },
    });
  }

  // ─── Razorpay Deposit ──────────────────────────────────────────────────────

  async createRazorpayOrder(userId: string, amountInr: number) {
    if (!this.razorpayConfigured) {
      throw new BadRequestException(
        'Razorpay is not configured. Add real RAZORPAY_KEY_ID and RAZORPAY_KEY_SECRET to .env to enable deposits.',
      );
    }
    if (amountInr < 50 || amountInr > 500000) {
      throw new BadRequestException('Amount must be between ₹50 and ₹5,00,000');
    }

    const order = await this.razorpay.orders.create({
      amount: Math.round(amountInr * 100), // paise
      currency: 'INR',
      notes: { userId, type: 'deposit' },
    });

    // Track pending transaction — always deposits into INR wallet
    const wallet = await this.walletService.getOrCreateWallet(userId, Currency.INR);
    await this.prisma.transaction.create({
      data: {
        walletId: wallet.id,
        amount: amountInr,
        currency: Currency.INR,
        type: 'DEPOSIT',
        status: 'PENDING',
        gatewayRef: order.id,
        description: 'Razorpay deposit',
      },
    });

    return {
      orderId: order.id,
      amount: amountInr,
      currency: 'INR',
      keyId: this.configService.get<string>('razorpay.keyId'),
    };
  }

  async verifyRazorpayPayment(data: {
    orderId: string;
    paymentId: string;
    signature: string;
  }) {
    const { orderId, paymentId, signature } = data;
    const secret = this.configService.get<string>('razorpay.keySecret') ?? '';

    const expectedSignature = createHmac('sha256', secret)
      .update(`${orderId}|${paymentId}`)
      .digest('hex');

    if (expectedSignature !== signature) {
      throw new BadRequestException('Invalid payment signature');
    }

    const transaction = await this.prisma.transaction.findFirst({
      where: { gatewayRef: orderId },
      include: { wallet: true },
    });

    if (!transaction) throw new NotFoundException('Transaction not found');

    // Idempotent: webhook may have already credited the wallet
    if (transaction.status === 'COMPLETED') {
      return { success: true, transactionId: transaction.id };
    }

    await this.prisma.$transaction([
      this.prisma.transaction.update({
        where: { id: transaction.id },
        data: { status: 'COMPLETED', gatewayPayload: { paymentId, signature } },
      }),
      this.prisma.wallet.update({
        where: { id: transaction.walletId },
        data: { balance: { increment: transaction.amount } },
      }),
    ]);

    await this.notifications.create(transaction.wallet.userId, {
      type: 'PAYMENT_SUCCESS',
      title: 'Deposit Successful',
      body: `₹${transaction.amount} added to your wallet`,
      data: { transactionId: transaction.id },
    });

    return { success: true, transactionId: transaction.id };
  }

  // ─── Razorpay Webhook ──────────────────────────────────────────────────────

  async handleRazorpayWebhook(rawBody: Buffer, signature: string) {
    const webhookSecret = this.configService.get<string>('razorpay.webhookSecret') ?? '';
    const isPlaceholder = !webhookSecret || webhookSecret.startsWith('placeholder');

    if (!isPlaceholder) {
      const expectedSignature = createHmac('sha256', webhookSecret)
        .update(rawBody.toString())
        .digest('hex');
      if (expectedSignature !== signature) {
        throw new BadRequestException('Invalid Razorpay webhook signature');
      }
    } else {
      this.logger.warn('Razorpay webhook secret not configured — skipping signature check');
    }

    let event: any;
    try {
      event = JSON.parse(rawBody.toString());
    } catch {
      throw new BadRequestException('Invalid webhook payload');
    }

    this.logger.log(`Razorpay webhook event: ${event.event}`);

    switch (event.event) {
      case 'payment.captured':
        await this.handleRazorpayPaymentCaptured(event.payload?.payment?.entity);
        break;
      case 'payment.failed':
        await this.handleRazorpayPaymentFailed(event.payload?.payment?.entity);
        break;
      default:
        this.logger.log(`Unhandled Razorpay event: ${event.event}`);
    }

    return { received: true };
  }

  private async handleRazorpayPaymentCaptured(payment: any) {
    if (!payment?.order_id) return;
    const orderId: string = payment.order_id;

    const transaction = await this.prisma.transaction.findFirst({
      where: { gatewayRef: orderId },
      include: { wallet: true },
    });

    if (!transaction) {
      this.logger.warn(`Razorpay webhook: no transaction for order ${orderId}`);
      return;
    }

    // Idempotent: already processed (verify endpoint got here first)
    if (transaction.status === 'COMPLETED') {
      this.logger.log(`Razorpay webhook: order ${orderId} already completed`);
      return;
    }

    await this.prisma.$transaction([
      this.prisma.transaction.update({
        where: { id: transaction.id },
        data: {
          status: 'COMPLETED',
          gatewayPayload: { paymentId: payment.id, source: 'webhook' },
        },
      }),
      this.prisma.wallet.update({
        where: { id: transaction.walletId },
        data: { balance: { increment: transaction.amount } },
      }),
    ]);

    await this.notifications.create(transaction.wallet.userId, {
      type: 'PAYMENT_SUCCESS',
      title: 'Deposit Successful',
      body: `₹${transaction.amount} added to your wallet`,
      data: { transactionId: transaction.id },
    });

    this.logger.log(`Razorpay webhook: credited ₹${transaction.amount} for order ${orderId}`);
  }

  private async handleRazorpayPaymentFailed(payment: any) {
    if (!payment?.order_id) return;
    await this.prisma.transaction.updateMany({
      where: { gatewayRef: payment.order_id, status: 'PENDING' },
      data: { status: 'FAILED' },
    });
    this.logger.log(`Razorpay webhook: payment failed for order ${payment.order_id}`);
  }

  // ─── Payment History ───────────────────────────────────────────────────────

  async getPaymentHistory(userId: string, page = 1, limit = 20) {
    const skip = (page - 1) * limit;

    const [transactions, total] = await Promise.all([
      this.prisma.transaction.findMany({
        where: {
          wallet: { userId },
          type: { in: ['DEPOSIT', 'WITHDRAWAL'] },
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
        include: {
          wallet: { select: { currency: true } },
        },
      }),
      this.prisma.transaction.count({
        where: {
          wallet: { userId },
          type: { in: ['DEPOSIT', 'WITHDRAWAL'] },
        },
      }),
    ]);

    return { transactions, total, page, limit };
  }

  // ─── Escrow (Paid Game) ────────────────────────────────────────────────────

  async holdEscrow(gameId: string, userId: string, amount: number, currency: Currency) {
    const wallet = await this.prisma.wallet.findFirst({ where: { userId, currency } });
    if (!wallet) throw new NotFoundException(`No ${currency} wallet found`);

    if (Number(wallet.balance) < amount) {
      throw new BadRequestException('Insufficient wallet balance');
    }

    await this.prisma.$transaction([
      this.prisma.wallet.update({
        where: { id: wallet.id },
        data: {
          balance: { decrement: amount },
          lockedBalance: { increment: amount },
        },
      }),
      this.prisma.transaction.create({
        data: {
          walletId: wallet.id,
          gameId,
          amount,
          currency,
          type: 'GAME_STAKE',
          status: 'COMPLETED',
          description: `Escrow for game ${gameId}`,
        },
      }),
    ]);

    return { success: true };
  }

  async releaseEscrow(
    gameId: string,
    winnerId: string | null,
    whitePlayerId: string,
    blackPlayerId: string,
    stake: number,
    currency: Currency,
  ) {
    const commission = this.configService.get<number>('platform.commission', 0.1);
    const totalPot = stake * 2;

    if (winnerId) {
      // Winner takes 90%
      const winnerAmount = totalPot * (1 - commission);
      const platformAmount = totalPot * commission;

      const loserId = winnerId === whitePlayerId ? blackPlayerId : whitePlayerId;
      const [winnerWallet, loserWallet] = await Promise.all([
        this.prisma.wallet.findFirst({ where: { userId: winnerId, currency } }),
        this.prisma.wallet.findFirst({ where: { userId: loserId, currency } }),
      ]);

      if (!winnerWallet || !loserWallet) throw new NotFoundException('Wallet not found');

      const commissionEach = platformAmount / 2; // each player contributed half

      await this.prisma.$transaction([
        // Unlock loser's stake (no payout)
        this.prisma.wallet.update({
          where: { id: loserWallet.id },
          data: { lockedBalance: { decrement: stake } },
        }),
        // Unlock winner's stake and credit winnings
        this.prisma.wallet.update({
          where: { id: winnerWallet.id },
          data: {
            lockedBalance: { decrement: stake },
            balance: { increment: winnerAmount },
          },
        }),
        // Record win transaction
        this.prisma.transaction.create({
          data: {
            walletId: winnerWallet.id,
            gameId,
            amount: winnerAmount,
            type: 'GAME_WIN',
            status: 'COMPLETED',
            description: `Won game ${gameId} (after ${commission * 100}% commission)`,
          },
        }),
        // Record commission for winner (their share of platform fee)
        this.prisma.transaction.create({
          data: {
            walletId: winnerWallet.id,
            gameId,
            amount: commissionEach,
            type: 'COMMISSION',
            status: 'COMPLETED',
            description: `Platform commission for game ${gameId}`,
          },
        }),
        // Record commission for loser (their share of platform fee)
        this.prisma.transaction.create({
          data: {
            walletId: loserWallet.id,
            gameId,
            amount: commissionEach,
            type: 'COMMISSION',
            status: 'COMPLETED',
            description: `Platform commission for game ${gameId}`,
          },
        }),
      ]);

      this.logger.log(
        `Escrow released: game=${gameId} winner=${winnerId} amount=${winnerAmount} commission=${platformAmount}`,
      );
    } else {
      // Draw - refund both minus small fee (2%)
      const drawFee = stake * 0.02;
      const refundAmount = stake - drawFee;

      const [whiteWallet, blackWallet] = await Promise.all([
        this.prisma.wallet.findFirst({ where: { userId: whitePlayerId, currency } }),
        this.prisma.wallet.findFirst({ where: { userId: blackPlayerId, currency } }),
      ]);

      if (!whiteWallet || !blackWallet) throw new NotFoundException('Wallet not found');

      await this.prisma.$transaction([
        this.prisma.wallet.update({
          where: { id: whiteWallet.id },
          data: {
            lockedBalance: { decrement: stake },
            balance: { increment: refundAmount },
          },
        }),
        this.prisma.wallet.update({
          where: { id: blackWallet.id },
          data: {
            lockedBalance: { decrement: stake },
            balance: { increment: refundAmount },
          },
        }),
        this.prisma.transaction.create({
          data: {
            walletId: whiteWallet.id,
            gameId,
            amount: refundAmount,
            type: 'GAME_REFUND',
            status: 'COMPLETED',
            description: `Draw refund for game ${gameId}`,
          },
        }),
        this.prisma.transaction.create({
          data: {
            walletId: blackWallet.id,
            gameId,
            amount: refundAmount,
            type: 'GAME_REFUND',
            status: 'COMPLETED',
            description: `Draw refund for game ${gameId}`,
          },
        }),
      ]);
    }
  }

  async initiateWithdrawal(userId: string, amount: number, bankDetails: Record<string, string>) {
    // Use the currency from bankDetails if provided, otherwise fall back to active wallet
    const requestedCurrency = bankDetails.currency as Currency | undefined;
    const wallet = requestedCurrency
      ? await this.prisma.wallet.findFirst({ where: { userId, currency: requestedCurrency } })
      : await this.prisma.wallet.findFirst({ where: { userId, isActive: true } });

    if (!wallet) throw new NotFoundException('Wallet not found');

    if (Number(wallet.balance) < amount) {
      throw new BadRequestException('Insufficient balance');
    }

    if (amount < (wallet.currency === 'INR' ? 100 : 10)) {
      throw new BadRequestException('Minimum withdrawal not met');
    }

    await this.prisma.$transaction([
      this.prisma.wallet.update({
        where: { id: wallet.id },
        data: { balance: { decrement: amount } },
      }),
      this.prisma.transaction.create({
        data: {
          walletId: wallet.id,
          amount,
          type: 'WITHDRAWAL',
          status: 'PENDING',
          description: 'Withdrawal request',
          metadata: bankDetails,
        },
      }),
    ]);

    return { message: 'Withdrawal initiated. Processing within 2-3 business days.' };
  }
}
