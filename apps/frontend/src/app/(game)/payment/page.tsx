'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
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
import { CreditCard, Smartphone, DollarSign, IndianRupee } from 'lucide-react';
import { useToast } from '@/hooks/useToast';

const STRIPE_KEY = process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY ?? '';
const stripeConfigured = STRIPE_KEY.length > 0 && !STRIPE_KEY.startsWith('placeholder') && !STRIPE_KEY.startsWith('pk_test_placeholder');
const stripePromise = stripeConfigured ? loadStripe(STRIPE_KEY) : null;

const RAZORPAY_KEY = process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID ?? '';
const razorpayConfigured = RAZORPAY_KEY.length > 0 && !RAZORPAY_KEY.startsWith('placeholder') && !RAZORPAY_KEY.startsWith('rzp_test_placeholder');

export default function PaymentPage() {
  const { user } = useAuthStore();
  const isIndia = user?.region === 'INR';
  const paymentReady = isIndia ? razorpayConfigured : stripeConfigured;

  return (
    <div className="min-h-screen bg-background flex items-center justify-center px-4">
      <div className="w-full max-w-md space-y-6">
        <div className="text-center">
          <h1 className="text-2xl font-bold">Add Funds</h1>
          <p className="text-muted-foreground mt-1">
            {isIndia ? 'Deposit INR via Razorpay' : 'Deposit USD via Stripe'}
          </p>
        </div>

        {!paymentReady ? (
          <div className="bg-yellow-500/10 border border-yellow-500/30 rounded-xl p-5 text-center space-y-2">
            <p className="font-semibold text-yellow-500">Payments not configured</p>
            <p className="text-sm text-muted-foreground">
              {isIndia
                ? 'Add a real RAZORPAY_KEY_ID to enable INR deposits.'
                : 'Add a real STRIPE_PUBLISHABLE_KEY to enable USD deposits.'}
            </p>
          </div>
        ) : isIndia ? <RazorpayDeposit /> : <StripeDeposit />}
      </div>
    </div>
  );
}

function StripeDeposit() {
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

  if (!clientSecret) {
    return (
      <div className="bg-card border rounded-xl p-6 space-y-4">
        <div className="space-y-2">
          <label className="text-sm font-medium flex items-center gap-2">
            <DollarSign className="w-4 h-4" /> Amount (USD)
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
          {['10', '25', '50', '100', '250', '500'].map((v) => (
            <button
              key={v}
              onClick={() => setAmount(v)}
              className="py-2 px-3 rounded-lg border text-sm hover:bg-muted transition-colors"
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
      <StripePaymentForm amount={parseFloat(amount)} />
    </Elements>
  );
}

function StripePaymentForm({ amount }: { amount: number }) {
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
      confirmParams: {
        return_url: `${window.location.origin}/payment/success`,
      },
      redirect: 'if_required',
    });

    if (error) {
      toast({ variant: 'destructive', title: error.message });
      setLoading(false);
    } else {
      toast({ title: 'Payment successful!', description: `$${amount} added to your wallet` });
      router.push('/dashboard');
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

function RazorpayDeposit() {
  const [amount, setAmount] = useState('');
  const [loading, setLoading] = useState(false);
  const { user } = useAuthStore();
  const { toast } = useToast();
  const router = useRouter();

  const handleRazorpay = async () => {
    if (!amount || parseFloat(amount) < 50) {
      toast({ variant: 'destructive', title: 'Enter a valid amount (min ₹50)' });
      return;
    }

    setLoading(true);
    try {
      const { data } = await api.post('/payments/razorpay/create-order', {
        amount: parseFloat(amount),
      });

      const rzp = new (window as any).Razorpay({
        key: data.keyId,
        amount: Math.round(parseFloat(amount) * 100),
        currency: 'INR',
        name: 'Chess Platform',
        description: 'Wallet Top-up',
        order_id: data.orderId,
        handler: async (response: any) => {
          try {
            await api.post('/payments/razorpay/verify', {
              orderId: data.orderId,
              paymentId: response.razorpay_payment_id,
              signature: response.razorpay_signature,
            });
            toast({ title: 'Payment successful!', description: `₹${amount} added to your wallet` });
            router.push('/dashboard');
          } catch {
            toast({ variant: 'destructive', title: 'Payment verification failed' });
          }
        },
        prefill: { email: user?.email },
        theme: { color: '#6c5ce7' },
      });

      rzp.open();
    } catch (e: any) {
      toast({ variant: 'destructive', title: e?.response?.data?.message ?? 'Error' });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="bg-card border rounded-xl p-6 space-y-4">
      <div className="space-y-2">
        <label className="text-sm font-medium flex items-center gap-2">
          <IndianRupee className="w-4 h-4" /> Amount (INR)
        </label>
        <Input
          type="number"
          placeholder="Enter amount (min ₹50)"
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          min="50"
        />
      </div>
      <div className="grid grid-cols-3 gap-2">
        {['100', '250', '500', '1000', '2500', '5000'].map((v) => (
          <button
            key={v}
            onClick={() => setAmount(v)}
            className="py-2 px-3 rounded-lg border text-sm hover:bg-muted transition-colors"
          >
            ₹{v}
          </button>
        ))}
      </div>
      <Button onClick={handleRazorpay} className="w-full" disabled={loading}>
        {loading ? 'Processing...' : (
          <><Smartphone className="w-4 h-4 mr-2" /> Pay with Razorpay</>
        )}
      </Button>
    </div>
  );
}
