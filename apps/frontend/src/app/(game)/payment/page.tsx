'use client';

import { useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import Script from 'next/script';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useAuthStore } from '@/store/authStore';
import { loadStripe } from '@stripe/stripe-js';
import {
  Elements,
  PaymentElement,
  useStripe,
  useElements,
} from '@stripe/react-stripe-js';
import api from '@/lib/api';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { CreditCard, Smartphone, DollarSign, IndianRupee, ArrowLeft, CheckCircle, XCircle } from 'lucide-react';
import { useToast } from '@/hooks/useToast';
import { cn } from '@/lib/utils';
import Link from 'next/link';
import { Currency } from '@/types';

const STRIPE_KEY = process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY ?? '';
const stripeConfigured =
  STRIPE_KEY.length > 0 &&
  !STRIPE_KEY.startsWith('placeholder') &&
  !STRIPE_KEY.startsWith('pk_test_placeholder');
const stripePromise = stripeConfigured ? loadStripe(STRIPE_KEY) : null;

const RAZORPAY_KEY = process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID ?? '';
const razorpayConfigured =
  RAZORPAY_KEY.length > 0 &&
  !RAZORPAY_KEY.startsWith('placeholder') &&
  !RAZORPAY_KEY.startsWith('rzp_test_placeholder');

const CURRENCY_FLAGS: Record<string, string> = {
  USD: '🇺🇸',
  INR: '🇮🇳',
  EUR: '🇪🇺',
  GBP: '🇬🇧',
};

const GATEWAY_FOR: Record<string, 'razorpay' | 'stripe'> = {
  INR: 'razorpay',
  USD: 'stripe',
  EUR: 'stripe',
  GBP: 'stripe',
};

export default function PaymentPage() {
  const { user } = useAuthStore();
  const queryClient = useQueryClient();

  const { data: wallets = [] } = useQuery<any[]>({
    queryKey: ['wallets'],
    queryFn: () => api.get('/wallet').then((r) => r.data),
  });

  const activeWallet = wallets.find((w: any) => w.isActive) ?? wallets[0];
  const defaultCurrency: Currency =
    (activeWallet?.currency as Currency) ?? (user?.region as Currency) ?? 'USD';

  const [selectedCurrency, setSelectedCurrency] = useState<Currency | null>(null);
  const activeCurrency: Currency = selectedCurrency ?? defaultCurrency;
  const gateway = GATEWAY_FOR[activeCurrency] ?? 'stripe';
  const paymentReady = gateway === 'razorpay' ? razorpayConfigured : stripeConfigured;

  const onSuccess = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: ['wallets'] });
    queryClient.invalidateQueries({ queryKey: ['wallet-balance'] });
    queryClient.invalidateQueries({ queryKey: ['wallet-transactions'] });
  }, [queryClient]);

  return (
    <>
      {/* Load Razorpay checkout.js — required for the popup */}
      <Script
        src="https://checkout.razorpay.com/v1/checkout.js"
        strategy="lazyOnload"
      />

      <div className="min-h-screen bg-background flex items-center justify-center px-4">
        <div className="w-full max-w-md space-y-6">
          {/* Header */}
          <div className="flex items-center gap-3">
            <Button asChild variant="ghost" size="sm" className="gap-1.5">
              <Link href="/wallet">
                <ArrowLeft className="w-4 h-4" /> Back
              </Link>
            </Button>
            <h1 className="text-2xl font-bold">Add Funds</h1>
          </div>

          {/* Currency selector (only if user has multiple wallets) */}
          {wallets.length > 1 && (
            <div className="space-y-2">
              <p className="text-sm font-medium text-muted-foreground">Select wallet to top up:</p>
              <div className="flex flex-wrap gap-2">
                {wallets.map((w: any) => (
                  <button
                    key={w.currency}
                    onClick={() => setSelectedCurrency(w.currency as Currency)}
                    className={cn(
                      'px-3 py-1.5 rounded-full text-sm font-medium border transition-colors',
                      activeCurrency === w.currency
                        ? 'bg-primary text-primary-foreground border-primary'
                        : 'border-border hover:bg-muted',
                    )}
                  >
                    {CURRENCY_FLAGS[w.currency]} {w.currency}
                  </button>
                ))}
              </div>
            </div>
          )}

          <div className="text-center">
            <p className="text-muted-foreground">
              {gateway === 'razorpay'
                ? `Deposit ${activeCurrency} via Razorpay`
                : `Deposit ${activeCurrency} via Stripe`}
            </p>
          </div>

          {!paymentReady ? (
            <div className="bg-yellow-500/10 border border-yellow-500/30 rounded-xl p-5 text-center space-y-2">
              <p className="font-semibold text-yellow-500">Payments not configured</p>
              <p className="text-sm text-muted-foreground">
                {gateway === 'razorpay'
                  ? 'Add real RAZORPAY_KEY_ID to .env to enable INR deposits.'
                  : 'Add real STRIPE_PUBLISHABLE_KEY to .env to enable USD deposits.'}
              </p>
            </div>
          ) : gateway === 'razorpay' ? (
            <RazorpayDeposit currency={activeCurrency} onSuccess={onSuccess} />
          ) : (
            <StripeDeposit currency={activeCurrency} onSuccess={onSuccess} />
          )}
        </div>
      </div>
    </>
  );
}

// ─── Razorpay ─────────────────────────────────────────────────────────────────

function RazorpayDeposit({
  currency,
  onSuccess,
}: {
  currency: Currency;
  onSuccess: () => void;
}) {
  const [amount, setAmount] = useState('');
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState<'idle' | 'success' | 'failed' | 'cancelled'>('idle');
  const { user } = useAuthStore();
  const { toast } = useToast();
  const router = useRouter();

  const quickAmounts = ['100', '250', '500', '1000', '2500', '5000'];
  const minAmount = 50;

  const handleRazorpay = async () => {
    const parsed = parseFloat(amount);
    if (!amount || parsed < minAmount) {
      toast({ variant: 'destructive', title: `Minimum deposit is ₹${minAmount}` });
      return;
    }

    setLoading(true);
    try {
      const { data } = await api.post('/payments/razorpay/create-order', {
        amount: parsed,
      });

      const rzpOptions = {
        key: data.keyId,
        amount: data.amount * 100, // paise
        currency: 'INR',
        name: 'Chess Platform',
        description: `Wallet Top-up — ${currency}`,
        order_id: data.orderId,
        handler: async (response: any) => {
          try {
            await api.post('/payments/razorpay/verify', {
              orderId: data.orderId,
              paymentId: response.razorpay_payment_id,
              signature: response.razorpay_signature,
            });
            setStatus('success');
            onSuccess();
            toast({
              title: 'Payment successful!',
              description: `₹${parsed.toFixed(2)} added to your wallet`,
            });
            setTimeout(() => router.push('/wallet'), 1500);
          } catch (err: any) {
            setStatus('failed');
            toast({
              variant: 'destructive',
              title: 'Verification failed',
              description: err?.response?.data?.message ?? 'Please contact support if amount was debited.',
            });
          }
        },
        prefill: {
          email: user?.email ?? '',
          name: user?.username ?? '',
        },
        notes: { userId: user?.id },
        theme: { color: '#6c5ce7' },
        modal: {
          ondismiss: () => {
            setLoading(false);
            setStatus('cancelled');
          },
        },
      };

      const rzp = new (window as any).Razorpay(rzpOptions);
      rzp.on('payment.failed', (response: any) => {
        setStatus('failed');
        toast({
          variant: 'destructive',
          title: 'Payment failed',
          description: response?.error?.description ?? 'Your payment was not processed.',
        });
      });
      rzp.open();
    } catch (e: any) {
      setLoading(false);
      toast({ variant: 'destructive', title: e?.response?.data?.message ?? 'Could not create order' });
    }
  };

  if (status === 'success') {
    return (
      <div className="bg-green-500/10 border border-green-500/30 rounded-xl p-8 text-center space-y-3">
        <CheckCircle className="w-12 h-12 text-green-500 mx-auto" />
        <p className="font-semibold text-green-500 text-lg">Payment Successful!</p>
        <p className="text-sm text-muted-foreground">₹{parseFloat(amount).toFixed(2)} added to your wallet.</p>
        <Button asChild size="sm" variant="outline">
          <Link href="/wallet">View Wallet</Link>
        </Button>
      </div>
    );
  }

  if (status === 'failed') {
    return (
      <div className="bg-destructive/10 border border-destructive/30 rounded-xl p-8 text-center space-y-3">
        <XCircle className="w-12 h-12 text-destructive mx-auto" />
        <p className="font-semibold text-destructive text-lg">Payment Failed</p>
        <p className="text-sm text-muted-foreground">Your payment was not processed. No money was deducted.</p>
        <Button size="sm" variant="outline" onClick={() => setStatus('idle')}>Try Again</Button>
      </div>
    );
  }

  return (
    <div className="bg-card border rounded-xl p-6 space-y-4">
      {status === 'cancelled' && (
        <div className="bg-yellow-500/10 border border-yellow-500/30 rounded-lg px-3 py-2 text-sm text-yellow-600 dark:text-yellow-400">
          Payment was cancelled. You can try again below.
        </div>
      )}

      <div className="space-y-2">
        <label className="text-sm font-medium flex items-center gap-2">
          <IndianRupee className="w-4 h-4" /> Amount (INR)
        </label>
        <Input
          type="number"
          placeholder={`Enter amount (min ₹${minAmount})`}
          value={amount}
          onChange={(e) => { setAmount(e.target.value); setStatus('idle'); }}
          min={minAmount}
        />
      </div>

      <div className="grid grid-cols-3 gap-2">
        {quickAmounts.map((v) => (
          <button
            key={v}
            onClick={() => setAmount(v)}
            className={cn(
              'py-2 px-3 rounded-lg border text-sm hover:bg-muted transition-colors',
              amount === v && 'border-primary bg-primary/5',
            )}
          >
            ₹{v}
          </button>
        ))}
      </div>

      <Button onClick={handleRazorpay} className="w-full" disabled={loading}>
        {loading ? 'Opening Razorpay...' : (
          <><Smartphone className="w-4 h-4 mr-2" /> Pay ₹{amount || '0'} with Razorpay</>
        )}
      </Button>

      <p className="text-xs text-center text-muted-foreground">
        Secured by Razorpay · Test mode · UPI / Cards / Netbanking
      </p>
    </div>
  );
}

// ─── Stripe ───────────────────────────────────────────────────────────────────

function StripeDeposit({
  currency,
  onSuccess,
}: {
  currency: Currency;
  onSuccess: () => void;
}) {
  const [amount, setAmount] = useState('');
  const [clientSecret, setClientSecret] = useState('');
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();

  const initiatePayment = async () => {
    if (!amount || parseFloat(amount) < 1) {
      toast({ variant: 'destructive', title: 'Enter a valid amount (min $1)' });
      return;
    }
    setLoading(true);
    try {
      const { data } = await api.post('/payments/stripe/create-intent', {
        amount: parseFloat(amount),
      });
      setClientSecret(data.clientSecret);
    } catch (e: any) {
      toast({ variant: 'destructive', title: e?.response?.data?.message ?? 'Error' });
    } finally {
      setLoading(false);
    }
  };

  const quickAmounts = ['10', '25', '50', '100', '250', '500'];

  if (!clientSecret) {
    return (
      <div className="bg-card border rounded-xl p-6 space-y-4">
        <div className="space-y-2">
          <label className="text-sm font-medium flex items-center gap-2">
            <DollarSign className="w-4 h-4" /> Amount ({currency})
          </label>
          <Input
            type="number"
            placeholder="Enter amount (min $1)"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            min="1"
          />
        </div>
        <div className="grid grid-cols-3 gap-2">
          {quickAmounts.map((v) => (
            <button
              key={v}
              onClick={() => setAmount(v)}
              className={cn(
                'py-2 px-3 rounded-lg border text-sm hover:bg-muted transition-colors',
                amount === v && 'border-primary bg-primary/5',
              )}
            >
              ${v}
            </button>
          ))}
        </div>
        <Button onClick={initiatePayment} className="w-full" disabled={loading}>
          {loading ? 'Processing...' : (
            <><CreditCard className="w-4 h-4 mr-2" /> Continue to Payment</>
          )}
        </Button>
      </div>
    );
  }

  return (
    <Elements stripe={stripePromise} options={{ clientSecret }}>
      <StripePaymentForm amount={parseFloat(amount)} onSuccess={onSuccess} />
    </Elements>
  );
}

function StripePaymentForm({
  amount,
  onSuccess,
}: {
  amount: number;
  onSuccess: () => void;
}) {
  const stripe = useStripe();
  const elements = useElements();
  const router = useRouter();
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!stripe || !elements) return;

    setLoading(true);
    const { error } = await stripe.confirmPayment({
      elements,
      confirmParams: { return_url: `${window.location.origin}/payment/success` },
      redirect: 'if_required',
    });

    if (error) {
      toast({ variant: 'destructive', title: error.message });
      setLoading(false);
    } else {
      onSuccess();
      toast({ title: 'Payment successful!', description: `$${amount} added to your wallet` });
      router.push('/wallet');
    }
  };

  return (
    <form onSubmit={handleSubmit} className="bg-card border rounded-xl p-6 space-y-4">
      <div className="text-center p-3 bg-muted rounded-lg">
        <p className="text-2xl font-bold">${amount}</p>
        <p className="text-sm text-muted-foreground">will be added to your wallet</p>
      </div>
      <PaymentElement />
      <Button type="submit" className="w-full" disabled={loading || !stripe}>
        {loading ? 'Processing...' : `Pay $${amount}`}
      </Button>
    </form>
  );
}
