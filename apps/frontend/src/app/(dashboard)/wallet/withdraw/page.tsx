'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useMutation, useQuery } from '@tanstack/react-query';
import api from '@/lib/api';
import { useAuthStore } from '@/store/authStore';
import { useToast } from '@/hooks/useToast';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { formatCurrency } from '@/lib/utils';
import { ArrowLeft, ArrowUpRight, AlertTriangle } from 'lucide-react';
import Link from 'next/link';

export default function WithdrawPage() {
  const router = useRouter();
  const { user } = useAuthStore();
  const { toast } = useToast();
  const currency = (user?.region ?? 'USD') as 'USD' | 'INR';
  const isINR = currency === 'INR';

  const [amount, setAmount] = useState('');
  const [accountDetails, setAccountDetails] = useState({
    // USD: Stripe — bank account
    accountHolderName: '',
    routingNumber: '',
    accountNumber: '',
    // INR: UPI / bank
    upiId: '',
    bankAccountNumber: '',
    ifscCode: '',
  });

  const { data: balance } = useQuery({
    queryKey: ['wallet-balance'],
    queryFn: () => api.get('/wallet/balance').then((r) => r.data),
  });

  const withdrawMutation = useMutation({
    mutationFn: (payload: Record<string, unknown>) =>
      api.post('/payments/withdraw', payload).then((r) => r.data),
    onSuccess: () => {
      toast({ title: 'Withdrawal initiated', description: 'Funds will arrive within 1–3 business days.' });
      router.push('/wallet');
    },
    onError: (e: any) => {
      toast({
        variant: 'destructive',
        title: 'Withdrawal failed',
        description: e?.response?.data?.message ?? 'Please try again.',
      });
    },
  });

  const available = parseFloat(balance?.balance ?? '0');
  const requested = parseFloat(amount || '0');
  const minAmount = isINR ? 100 : 5;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (requested < minAmount) {
      toast({
        variant: 'destructive',
        title: 'Amount too low',
        description: `Minimum withdrawal is ${formatCurrency(minAmount, currency)}.`,
      });
      return;
    }

    if (requested > available) {
      toast({ variant: 'destructive', title: 'Insufficient balance' });
      return;
    }

    const payload: Record<string, unknown> = { amount: requested, currency };

    if (isINR) {
      if (accountDetails.upiId) {
        payload.method = 'UPI';
        payload.upiId = accountDetails.upiId;
      } else {
        payload.method = 'BANK';
        payload.bankAccountNumber = accountDetails.bankAccountNumber;
        payload.ifscCode = accountDetails.ifscCode;
        payload.accountHolderName = accountDetails.accountHolderName;
      }
    } else {
      payload.method = 'BANK';
      payload.accountHolderName = accountDetails.accountHolderName;
      payload.routingNumber = accountDetails.routingNumber;
      payload.accountNumber = accountDetails.accountNumber;
    }

    withdrawMutation.mutate(payload);
  };

  const updateField = (key: keyof typeof accountDetails, value: string) =>
    setAccountDetails((prev) => ({ ...prev, [key]: value }));

  return (
    <div className="max-w-lg mx-auto p-6 space-y-8">
      <div className="flex items-center gap-3">
        <Button asChild variant="ghost" size="sm" className="gap-1.5">
          <Link href="/wallet">
            <ArrowLeft className="w-4 h-4" /> Back
          </Link>
        </Button>
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <ArrowUpRight className="w-6 h-6 text-primary" /> Withdraw Funds
        </h1>
      </div>

      {/* Balance info */}
      <div className="bg-card border rounded-xl p-4 flex items-center justify-between">
        <p className="text-sm text-muted-foreground">Available balance</p>
        <p className="font-bold text-lg">
          {formatCurrency(available, currency)}
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Amount */}
        <div className="space-y-2">
          <label className="text-sm font-medium">
            Amount ({isINR ? '₹' : '$'})
          </label>
          <div className="relative">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm">
              {isINR ? '₹' : '$'}
            </span>
            <Input
              type="number"
              placeholder={isINR ? 'e.g. 500' : 'e.g. 20'}
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              className="pl-8"
              min={minAmount}
              max={available}
              step="0.01"
              required
            />
          </div>
          <p className="text-xs text-muted-foreground">
            Minimum: {formatCurrency(minAmount, currency)} · Maximum: {formatCurrency(available, currency)}
          </p>
        </div>

        {/* INR withdrawal form */}
        {isINR && (
          <div className="space-y-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">UPI ID (fastest)</label>
              <Input
                placeholder="yourname@upi"
                value={accountDetails.upiId}
                onChange={(e) => updateField('upiId', e.target.value)}
              />
            </div>

            <div className="flex items-center gap-3 text-xs text-muted-foreground">
              <div className="flex-1 h-px bg-border" />
              or bank transfer
              <div className="flex-1 h-px bg-border" />
            </div>

            <div className="space-y-3">
              <div className="space-y-2">
                <label className="text-sm font-medium">Account holder name</label>
                <Input
                  placeholder="Full name"
                  value={accountDetails.accountHolderName}
                  onChange={(e) => updateField('accountHolderName', e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">Bank account number</label>
                <Input
                  placeholder="12-digit account number"
                  value={accountDetails.bankAccountNumber}
                  onChange={(e) => updateField('bankAccountNumber', e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">IFSC code</label>
                <Input
                  placeholder="e.g. SBIN0001234"
                  value={accountDetails.ifscCode}
                  onChange={(e) => updateField('ifscCode', e.target.value)}
                />
              </div>
            </div>
          </div>
        )}

        {/* USD withdrawal form */}
        {!isINR && (
          <div className="space-y-3">
            <div className="space-y-2">
              <label className="text-sm font-medium">Account holder name</label>
              <Input
                placeholder="Full legal name"
                value={accountDetails.accountHolderName}
                onChange={(e) => updateField('accountHolderName', e.target.value)}
                required
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Routing number</label>
              <Input
                placeholder="9-digit routing number"
                value={accountDetails.routingNumber}
                onChange={(e) => updateField('routingNumber', e.target.value)}
                required
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Account number</label>
              <Input
                placeholder="Bank account number"
                value={accountDetails.accountNumber}
                onChange={(e) => updateField('accountNumber', e.target.value)}
                required
              />
            </div>
          </div>
        )}

        {/* Note */}
        <div className="flex gap-2 bg-yellow-500/10 border border-yellow-500/30 rounded-xl p-4 text-sm text-yellow-600 dark:text-yellow-400">
          <AlertTriangle className="w-4 h-4 flex-shrink-0 mt-0.5" />
          <p>
            Withdrawals are processed manually and may take 1–3 business days.
            {isINR
              ? ' UPI transfers are typically processed same day.'
              : ' A 10% platform fee applies if applicable based on your account.'}
          </p>
        </div>

        <Button
          type="submit"
          className="w-full gap-2"
          disabled={withdrawMutation.isPending || !amount || requested <= 0}
        >
          <ArrowUpRight className="w-4 h-4" />
          {withdrawMutation.isPending ? 'Processing...' : `Withdraw ${amount ? formatCurrency(requested, currency) : ''}`}
        </Button>
      </form>
    </div>
  );
}
