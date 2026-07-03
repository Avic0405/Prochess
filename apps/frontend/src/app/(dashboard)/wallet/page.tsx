'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import Link from 'next/link';
import api from '@/lib/api';
import { useAuthStore } from '@/store/authStore';
import { formatCurrency } from '@/lib/utils';
import { Button } from '@/components/ui/Button';
import { Wallet, ArrowDownLeft, ArrowUpRight, Lock, Clock, Plus, Check, RefreshCw } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useToast } from '@/hooks/useToast';
import { Currency } from '@/types';

const TYPE_LABELS: Record<string, string> = {
  DEPOSIT: 'Deposit',
  WITHDRAWAL: 'Withdrawal',
  GAME_STAKE: 'Game Stake (Escrow)',
  GAME_WIN: 'Game Winnings',
  GAME_REFUND: 'Draw Refund',
  COMMISSION: 'Platform Fee',
};

const TYPE_SIGN: Record<string, 'credit' | 'debit' | 'neutral'> = {
  DEPOSIT: 'credit',
  WITHDRAWAL: 'debit',
  GAME_STAKE: 'debit',
  GAME_WIN: 'credit',
  GAME_REFUND: 'credit',
  COMMISSION: 'debit',
};

const CURRENCY_FLAGS: Record<string, string> = {
  USD: '🇺🇸',
  INR: '🇮🇳',
  EUR: '🇪🇺',
  GBP: '🇬🇧',
};

const ALL_CURRENCIES: Currency[] = ['USD', 'INR', 'EUR', 'GBP'];

export default function WalletPage() {
  const { user } = useAuthStore();
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [creating, setCreating] = useState<Currency | null>(null);

  const { data: wallets = [], isLoading: walletsLoading } = useQuery<any[]>({
    queryKey: ['wallets'],
    queryFn: () => api.get('/wallet').then((r) => r.data),
  });

  const { data: txData, isLoading: txLoading } = useQuery({
    queryKey: ['wallet-transactions'],
    queryFn: () => api.get('/wallet/transactions?limit=30').then((r) => r.data),
  });

  const switchMutation = useMutation({
    mutationFn: (currency: Currency) =>
      api.patch('/wallet/active', { currency }).then((r) => r.data),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['wallets'] });
      queryClient.invalidateQueries({ queryKey: ['wallet-balance'] });
      toast({ title: `Active wallet switched to ${data.currency}` });
    },
    onError: (e: any) =>
      toast({ variant: 'destructive', title: e?.response?.data?.message ?? 'Error' }),
  });

  const createMutation = useMutation({
    mutationFn: (currency: Currency) =>
      api.post('/wallet', { currency }).then((r) => r.data),
    onSuccess: (data) => {
      setCreating(null);
      queryClient.invalidateQueries({ queryKey: ['wallets'] });
      toast({ title: `${data.currency} wallet created` });
    },
    onError: (e: any) => {
      setCreating(null);
      toast({ variant: 'destructive', title: e?.response?.data?.message ?? 'Error' });
    },
  });

  const activeWallet = wallets.find((w) => w.isActive) ?? wallets[0];
  const existingCurrencies = new Set(wallets.map((w) => w.currency));
  const availableCurrencies = ALL_CURRENCIES.filter((c) => !existingCurrencies.has(c));

  return (
    <div className="max-w-3xl mx-auto p-4 sm:p-6 space-y-6 sm:space-y-8">
      <h1 className="text-2xl font-bold flex items-center gap-3">
        <Wallet className="w-6 h-6 text-primary" /> My Wallet
      </h1>

      {/* Active Competitive Wallet */}
      <div className="bg-gradient-to-br from-primary/20 to-primary/5 border border-primary/30 rounded-2xl p-6">
        <p className="text-xs font-semibold text-primary uppercase tracking-wider mb-3">
          Active Competitive Wallet
        </p>
        {walletsLoading ? (
          <div className="h-12 w-48 bg-muted rounded animate-pulse" />
        ) : activeWallet ? (
          <div className="flex items-center justify-between flex-wrap gap-4">
            <div>
              <p className="text-3xl sm:text-4xl font-bold">
                {formatCurrency(activeWallet.balance ?? 0, activeWallet.currency)}
              </p>
              <p className="text-sm text-muted-foreground mt-1 flex items-center gap-1.5">
                {CURRENCY_FLAGS[activeWallet.currency]} {activeWallet.currency} Wallet
                {activeWallet.lockedBalance > 0 && (
                  <span className="flex items-center gap-1 text-xs text-muted-foreground">
                    · <Lock className="w-3 h-3" />
                    {formatCurrency(activeWallet.lockedBalance, activeWallet.currency)} in escrow
                  </span>
                )}
              </p>
            </div>
            <div className="flex gap-2">
              <Button asChild size="sm" className="gap-2">
                <Link href="/payment">
                  <ArrowDownLeft className="w-4 h-4" /> Deposit
                </Link>
              </Button>
              <Button asChild variant="outline" size="sm" className="gap-2">
                <Link href="/wallet/withdraw">
                  <ArrowUpRight className="w-4 h-4" /> Withdraw
                </Link>
              </Button>
            </div>
          </div>
        ) : (
          <p className="text-muted-foreground text-sm">No wallets yet. Create one below.</p>
        )}
      </div>

      {/* All Wallets */}
      <div className="space-y-3">
        <h2 className="text-base font-semibold flex items-center gap-2">
          <RefreshCw className="w-4 h-4 text-muted-foreground" /> All Wallets
        </h2>

        {walletsLoading ? (
          <div className="space-y-2">
            {[...Array(2)].map((_, i) => (
              <div key={i} className="h-16 bg-muted rounded-xl animate-pulse" />
            ))}
          </div>
        ) : (
          <div className="space-y-2">
            {wallets.map((w) => (
              <div
                key={w.id}
                className={cn(
                  'flex items-center justify-between bg-card border rounded-xl p-4 transition-colors',
                  w.isActive && 'border-primary/50 bg-primary/5',
                )}
              >
                <div className="flex items-center gap-3">
                  <span className="text-2xl">{CURRENCY_FLAGS[w.currency] ?? '💰'}</span>
                  <div>
                    <p className="font-medium flex items-center gap-2">
                      {w.currency}
                      {w.isActive && (
                        <span className="text-xs px-1.5 py-0.5 bg-primary/20 text-primary rounded-full font-semibold">
                          Active
                        </span>
                      )}
                    </p>
                    <p className="text-sm text-muted-foreground">
                      {formatCurrency(w.balance, w.currency)}
                      {w.lockedBalance > 0 && (
                        <span className="ml-1 text-xs">
                          · <Lock className="w-2.5 h-2.5 inline" /> {formatCurrency(w.lockedBalance, w.currency)}
                        </span>
                      )}
                    </p>
                  </div>
                </div>

                {!w.isActive && (
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => switchMutation.mutate(w.currency)}
                    disabled={switchMutation.isPending}
                    className="gap-1.5 shrink-0"
                  >
                    <Check className="w-3.5 h-3.5" /> Set Active
                  </Button>
                )}
              </div>
            ))}

            {/* Add new wallet */}
            {availableCurrencies.length > 0 && (
              <div className="border border-dashed rounded-xl p-4">
                <p className="text-sm text-muted-foreground mb-3">Add a new wallet:</p>
                <div className="flex flex-wrap gap-2">
                  {availableCurrencies.map((c) => (
                    <Button
                      key={c}
                      size="sm"
                      variant="outline"
                      disabled={createMutation.isPending && creating === c}
                      onClick={() => {
                        setCreating(c);
                        createMutation.mutate(c);
                      }}
                      className="gap-1.5"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      {CURRENCY_FLAGS[c]} {c}
                    </Button>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Transaction history */}
      <div className="bg-card border rounded-xl overflow-hidden">
        <div className="px-6 py-4 border-b flex items-center gap-2">
          <Clock className="w-4 h-4 text-muted-foreground" />
          <h2 className="font-semibold">Transaction History</h2>
        </div>

        {txLoading ? (
          <div className="p-6 space-y-3">
            {[...Array(5)].map((_, i) => (
              <div key={i} className="h-14 bg-muted rounded-lg animate-pulse" />
            ))}
          </div>
        ) : !txData?.transactions?.length ? (
          <div className="p-8 text-center text-muted-foreground">No transactions yet</div>
        ) : (
          <div className="divide-y">
            {txData.transactions.map((tx: any) => {
              const sign = TYPE_SIGN[tx.type] ?? 'neutral';
              const label = TYPE_LABELS[tx.type] ?? tx.type;
              const txCurrency = tx.currency ?? activeWallet?.currency ?? 'USD';

              return (
                <div key={tx.id} className="flex items-center justify-between px-4 sm:px-6 py-3 sm:py-4 hover:bg-muted/30 transition-colors">
                  <div className="flex items-center gap-4">
                    <div className={cn(
                      'w-10 h-10 rounded-full flex items-center justify-center',
                      sign === 'credit' && 'bg-green-500/10',
                      sign === 'debit' && 'bg-destructive/10',
                      sign === 'neutral' && 'bg-muted',
                    )}>
                      {sign === 'credit'
                        ? <ArrowDownLeft className="w-5 h-5 text-green-500" />
                        : <ArrowUpRight className={cn('w-5 h-5', sign === 'debit' ? 'text-destructive' : 'text-muted-foreground')} />
                      }
                    </div>
                    <div>
                      <p className="font-medium text-sm">{label}</p>
                      <p className="text-xs text-muted-foreground">
                        {CURRENCY_FLAGS[txCurrency]} {txCurrency} ·{' '}
                        {new Date(tx.createdAt).toLocaleDateString('en-US', {
                          month: 'short', day: 'numeric', year: 'numeric',
                          hour: '2-digit', minute: '2-digit',
                        })}
                      </p>
                    </div>
                  </div>

                  <div className="text-right">
                    <p className={cn(
                      'font-semibold',
                      sign === 'credit' && 'text-green-500',
                      sign === 'debit' && 'text-destructive',
                    )}>
                      {sign === 'credit' ? '+' : sign === 'debit' ? '-' : ''}
                      {formatCurrency(tx.amount, txCurrency)}
                    </p>
                    <span className={cn(
                      'text-xs px-2 py-0.5 rounded-full',
                      tx.status === 'COMPLETED' && 'bg-green-500/10 text-green-500',
                      tx.status === 'PENDING' && 'bg-yellow-500/10 text-yellow-500',
                      tx.status === 'FAILED' && 'bg-destructive/10 text-destructive',
                    )}>
                      {tx.status}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
