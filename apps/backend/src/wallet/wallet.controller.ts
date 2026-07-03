import {
  Controller, Get, Post, Patch, Body, Query, UseGuards,
  DefaultValuePipe, ParseIntPipe, BadRequestException,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiBody } from '@nestjs/swagger';
import { IsEnum } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { WalletService } from './wallet.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { Currency } from '@prisma/client';

class CurrencyDto {
  @ApiProperty({ enum: Currency })
  @IsEnum(Currency)
  currency!: Currency;
}

@ApiTags('wallet')
@ApiBearerAuth('access-token')
@UseGuards(JwtAuthGuard)
@Controller('wallet')
export class WalletController {
  constructor(private walletService: WalletService) {}

  @Get()
  @ApiOperation({ summary: 'List all wallets' })
  getAllWallets(@CurrentUser('id') userId: string) {
    return this.walletService.getAllWallets(userId);
  }

  @Get('active')
  @ApiOperation({ summary: 'Get active wallet' })
  getActiveWallet(@CurrentUser('id') userId: string) {
    return this.walletService.getActiveWallet(userId);
  }

  @Patch('active')
  @ApiOperation({ summary: 'Switch active wallet' })
  @ApiBody({ type: CurrencyDto })
  switchActiveWallet(
    @CurrentUser('id') userId: string,
    @Body() dto: CurrencyDto,
  ) {
    if (!Object.values(Currency).includes(dto.currency)) {
      throw new BadRequestException('Invalid currency');
    }
    return this.walletService.switchActiveWallet(userId, dto.currency);
  }

  @Post()
  @ApiOperation({ summary: 'Create a new wallet for a currency' })
  @ApiBody({ type: CurrencyDto })
  createWallet(
    @CurrentUser('id') userId: string,
    @Body() dto: CurrencyDto,
  ) {
    if (!Object.values(Currency).includes(dto.currency)) {
      throw new BadRequestException('Invalid currency');
    }
    return this.walletService.createWallet(userId, dto.currency);
  }

  @Get('balance')
  @ApiOperation({ summary: 'Get active wallet balance (legacy)' })
  getBalance(@CurrentUser('id') userId: string) {
    return this.walletService.getBalance(userId);
  }

  @Get('transactions')
  @ApiOperation({ summary: 'Get transaction history (all wallets)' })
  getTransactions(
    @CurrentUser('id') userId: string,
    @Query('page', new DefaultValuePipe(1), ParseIntPipe) page: number,
    @Query('limit', new DefaultValuePipe(20), ParseIntPipe) limit: number,
  ) {
    return this.walletService.getTransactionHistory(userId, page, limit);
  }
}
