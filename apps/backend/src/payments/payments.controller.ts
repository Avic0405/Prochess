import {
  Controller,
  Post,
  Get,
  Body,
  Headers,
  Req,
  RawBodyRequest,
  UseGuards,
  HttpCode,
  HttpStatus,
  Query,
} from '@nestjs/common';
import { Request } from 'express';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { PaymentsService } from './payments.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { Public } from '../auth/decorators/public.decorator';
import { IsNumber, IsPositive, IsString, IsOptional } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

class CreateStripePaymentDto {
  @ApiProperty({ example: 50 })
  @IsNumber()
  @IsPositive()
  amount!: number;
}

class CreateRazorpayOrderDto {
  @ApiProperty({ example: 500 })
  @IsNumber()
  @IsPositive()
  amount!: number;
}

class VerifyRazorpayDto {
  @ApiProperty()
  @IsString()
  orderId!: string;

  @ApiProperty()
  @IsString()
  paymentId!: string;

  @ApiProperty()
  @IsString()
  signature!: string;
}

class WithdrawDto {
  @ApiProperty({ example: 50 })
  @IsNumber()
  @IsPositive()
  amount!: number;

  @ApiProperty({ example: 'USD' })
  @IsString()
  @IsOptional()
  currency?: string;

  @ApiProperty({ example: 'BANK' })
  @IsString()
  @IsOptional()
  method?: string;

  @ApiProperty()
  @IsString()
  @IsOptional()
  accountHolderName?: string;

  @ApiProperty()
  @IsString()
  @IsOptional()
  routingNumber?: string;

  @ApiProperty()
  @IsString()
  @IsOptional()
  accountNumber?: string;

  @ApiProperty()
  @IsString()
  @IsOptional()
  upiId?: string;

  @ApiProperty()
  @IsString()
  @IsOptional()
  bankAccountNumber?: string;

  @ApiProperty()
  @IsString()
  @IsOptional()
  ifscCode?: string;
}

@ApiTags('payments')
@Controller('payments')
@UseGuards(JwtAuthGuard)
export class PaymentsController {
  constructor(private paymentsService: PaymentsService) {}

  @Post('stripe/create-intent')
  @ApiBearerAuth('access-token')
  @ApiOperation({ summary: 'Create Stripe payment intent for deposit' })
  createStripeIntent(
    @CurrentUser('id') userId: string,
    @Body() dto: CreateStripePaymentDto,
  ) {
    return this.paymentsService.createStripePaymentIntent(userId, dto.amount);
  }

  @Public()
  @Post('stripe/webhook')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Stripe webhook endpoint' })
  stripeWebhook(
    @Req() req: RawBodyRequest<Request>,
    @Headers('stripe-signature') signature: string,
  ) {
    return this.paymentsService.handleStripeWebhook(req.rawBody!, signature);
  }

  @Post('razorpay/create-order')
  @ApiBearerAuth('access-token')
  @ApiOperation({ summary: 'Create Razorpay order for INR deposit' })
  createRazorpayOrder(
    @CurrentUser('id') userId: string,
    @Body() dto: CreateRazorpayOrderDto,
  ) {
    return this.paymentsService.createRazorpayOrder(userId, dto.amount);
  }

  @Post('razorpay/verify')
  @ApiBearerAuth('access-token')
  @ApiOperation({ summary: 'Verify Razorpay payment and credit wallet' })
  verifyRazorpay(@Body() dto: VerifyRazorpayDto) {
    return this.paymentsService.verifyRazorpayPayment(dto);
  }

  @Public()
  @Post('razorpay/webhook')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Razorpay webhook — payment.captured / payment.failed' })
  razorpayWebhook(
    @Req() req: RawBodyRequest<Request>,
    @Headers('x-razorpay-signature') signature: string,
  ) {
    return this.paymentsService.handleRazorpayWebhook(req.rawBody!, signature ?? '');
  }

  @Get('history')
  @ApiBearerAuth('access-token')
  @ApiOperation({ summary: 'Get deposit and withdrawal history' })
  getPaymentHistory(
    @CurrentUser('id') userId: string,
    @Query('page') page = 1,
    @Query('limit') limit = 20,
  ) {
    return this.paymentsService.getPaymentHistory(userId, +page, +limit);
  }

  @Post('withdraw')
  @ApiBearerAuth('access-token')
  @ApiOperation({ summary: 'Initiate withdrawal' })
  withdraw(
    @CurrentUser('id') userId: string,
    @Body() dto: WithdrawDto,
  ) {
    const { amount, currency, method, ...accountFields } = dto;
    const bankDetails: Record<string, string> = { ...(method && { method }), ...(currency && { currency }) };
    for (const [k, v] of Object.entries(accountFields)) {
      if (v !== undefined) bankDetails[k] = v;
    }
    return this.paymentsService.initiateWithdrawal(userId, amount, bankDetails);
  }
}
