'use client';

import { useState, useEffect, useRef, useCallback, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useAuthStore } from '@/store/authStore';
import { Button } from '@/components/ui/Button';
import { useToast } from '@/hooks/useToast';
import { Mail, RefreshCw, CheckCircle, ArrowLeft, ShieldCheck } from 'lucide-react';
import { cn } from '@/lib/utils';

const OTP_LENGTH = 6;
const TIMER_SECONDS = 600; // 10 minutes
const RESEND_COOLDOWN = 60; // 60 seconds

function VerifyOtpContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { verifyOtp, resendOtp, isLoading } = useAuthStore();
  const { toast } = useToast();

  const email = searchParams.get('email') ?? '';

  // OTP digit state
  const [digits, setDigits] = useState<string[]>(Array(OTP_LENGTH).fill(''));
  const inputRefs = useRef<(HTMLInputElement | null)[]>([]);

  // Timer state — restore from sessionStorage for accurate remaining time on refresh
  const [timeLeft, setTimeLeft] = useState<number>(() => {
    if (typeof window === 'undefined') return TIMER_SECONDS;
    const stored = sessionStorage.getItem('otp_expires_at');
    if (stored) {
      const remaining = Math.floor((parseInt(stored) - Date.now()) / 1000);
      return Math.max(0, remaining);
    }
    return TIMER_SECONDS;
  });
  const [resendCooldown, setResendCooldown] = useState(RESEND_COOLDOWN);
  const [canResend, setCanResend] = useState(false);
  const [isResending, setIsResending] = useState(false);
  const [verifyError, setVerifyError] = useState('');
  const [isVerified, setIsVerified] = useState(false);

  // Redirect if no email in URL
  useEffect(() => {
    if (!email) {
      router.replace('/register');
    }
  }, [email, router]);

  // Main 10-minute countdown
  useEffect(() => {
    if (timeLeft <= 0 || isVerified) return;
    const id = setInterval(() => {
      setTimeLeft((t) => {
        if (t <= 1) { clearInterval(id); return 0; }
        return t - 1;
      });
    }, 1000);
    return () => clearInterval(id);
  }, [timeLeft, isVerified]);

  // 60-second resend cooldown
  useEffect(() => {
    if (canResend) return;
    if (resendCooldown <= 0) { setCanResend(true); return; }
    const id = setInterval(() => {
      setResendCooldown((c) => {
        if (c <= 1) { clearInterval(id); setCanResend(true); return 0; }
        return c - 1;
      });
    }, 1000);
    return () => clearInterval(id);
  }, [canResend, resendCooldown]);

  const formatTime = (s: number) => {
    const m = Math.floor(s / 60);
    const sec = s % 60;
    return `${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')}`;
  };

  // OTP input handlers
  const handleDigitChange = (index: number, value: string) => {
    const sanitized = value.replace(/\D/g, '');
    if (!sanitized && value !== '') return; // non-numeric, ignore

    const newDigits = [...digits];

    if (sanitized.length > 1) {
      // Handle paste across the whole field
      const pasted = sanitized.slice(0, OTP_LENGTH);
      for (let i = 0; i < OTP_LENGTH; i++) {
        newDigits[i] = pasted[i] ?? '';
      }
      setDigits(newDigits);
      inputRefs.current[Math.min(pasted.length, OTP_LENGTH - 1)]?.focus();
      return;
    }

    newDigits[index] = sanitized;
    setDigits(newDigits);
    setVerifyError('');

    if (sanitized && index < OTP_LENGTH - 1) {
      inputRefs.current[index + 1]?.focus();
    }
  };

  const handleKeyDown = (index: number, e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Backspace') {
      if (!digits[index] && index > 0) {
        const newDigits = [...digits];
        newDigits[index - 1] = '';
        setDigits(newDigits);
        inputRefs.current[index - 1]?.focus();
      }
    } else if (e.key === 'ArrowLeft' && index > 0) {
      inputRefs.current[index - 1]?.focus();
    } else if (e.key === 'ArrowRight' && index < OTP_LENGTH - 1) {
      inputRefs.current[index + 1]?.focus();
    }
  };

  const handlePaste = (e: React.ClipboardEvent<HTMLInputElement>) => {
    e.preventDefault();
    const text = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, OTP_LENGTH);
    const newDigits = Array(OTP_LENGTH).fill('');
    for (let i = 0; i < text.length; i++) newDigits[i] = text[i];
    setDigits(newDigits);
    inputRefs.current[Math.min(text.length, OTP_LENGTH - 1)]?.focus();
  };

  const otp = digits.join('');
  const isOtpComplete = otp.length === OTP_LENGTH;

  const handleVerify = useCallback(async () => {
    if (!isOtpComplete || isLoading) return;
    setVerifyError('');
    try {
      await verifyOtp(email, otp);
      setIsVerified(true);
      sessionStorage.removeItem('otp_expires_at');
      toast({ title: 'Account created!', description: 'Welcome to ProChess.live' });
      // Small delay so the success state is visible before redirect
      setTimeout(() => router.push('/dashboard'), 1500);
    } catch (err: any) {
      const msg = err?.response?.data?.message ?? 'Verification failed. Please try again.';
      setVerifyError(msg);
      // Clear OTP boxes on error so user can re-enter
      setDigits(Array(OTP_LENGTH).fill(''));
      inputRefs.current[0]?.focus();
    }
  }, [isOtpComplete, isLoading, verifyOtp, email, otp, toast, router]);

  const handleResend = async () => {
    if (!canResend || isResending) return;
    setIsResending(true);
    try {
      const result = await resendOtp(email);
      // Reset timers
      const newExpiry = Date.now() + 10 * 60 * 1000;
      sessionStorage.setItem('otp_expires_at', String(newExpiry));
      setTimeLeft(TIMER_SECONDS);
      setResendCooldown(RESEND_COOLDOWN);
      setCanResend(false);
      setDigits(Array(OTP_LENGTH).fill(''));
      setVerifyError('');
      inputRefs.current[0]?.focus();
      toast({ title: 'Code resent!', description: result.message });
    } catch (err: any) {
      const msg = err?.response?.data?.message ?? 'Failed to resend. Please try again.';
      toast({ variant: 'destructive', title: 'Resend failed', description: msg });
    } finally {
      setIsResending(false);
    }
  };

  if (!email) return null;

  // Success state
  if (isVerified) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background px-4">
        <div className="w-full max-w-md text-center space-y-4">
          <div className="w-20 h-20 rounded-full bg-green-500/20 flex items-center justify-center mx-auto">
            <CheckCircle className="w-10 h-10 text-green-500" />
          </div>
          <h2 className="text-2xl font-bold">Email Verified!</h2>
          <p className="text-muted-foreground">Your account has been created. Redirecting to dashboard…</p>
          <div className="flex justify-center">
            <span className="animate-spin rounded-full h-5 w-5 border-2 border-primary border-t-transparent" />
          </div>
        </div>
      </div>
    );
  }

  const isExpired = timeLeft === 0;

  return (
    <div className="min-h-screen flex items-center justify-center bg-background px-4 py-12">
      <div className="w-full max-w-md space-y-8">
        {/* Header */}
        <div className="text-center space-y-3">
          <div className="w-16 h-16 rounded-2xl bg-primary/10 border border-primary/20 flex items-center justify-center mx-auto">
            <ShieldCheck className="w-8 h-8 text-primary" />
          </div>
          <h1 className="text-3xl font-bold">Verify your email</h1>
          <p className="text-muted-foreground text-sm leading-relaxed">
            We sent a 6-digit code to
          </p>
          <div className="flex items-center justify-center gap-2 bg-muted rounded-lg px-4 py-2 w-fit mx-auto">
            <Mail className="w-4 h-4 text-primary shrink-0" />
            <span className="font-medium text-sm break-all">{email}</span>
          </div>
        </div>

        {/* Card */}
        <div className="bg-card border rounded-xl p-8 shadow-lg space-y-6">

          {/* Timer */}
          <div className="text-center">
            {isExpired ? (
              <p className="text-destructive text-sm font-medium">Code expired — request a new one below</p>
            ) : (
              <div className="space-y-1">
                <p className="text-xs text-muted-foreground font-medium uppercase tracking-wide">Code expires in</p>
                <p className={cn(
                  'text-2xl font-mono font-bold tabular-nums',
                  timeLeft <= 60 ? 'text-destructive' : 'text-foreground',
                )}>
                  {formatTime(timeLeft)}
                </p>
              </div>
            )}
          </div>

          {/* OTP Boxes */}
          <div className="space-y-3">
            <div className="flex justify-center gap-2 sm:gap-3">
              {digits.map((d, i) => (
                <input
                  key={i}
                  ref={(el) => { inputRefs.current[i] = el; }}
                  type="text"
                  inputMode="numeric"
                  pattern="[0-9]*"
                  maxLength={1}
                  value={d}
                  disabled={isExpired || isLoading || isVerified}
                  autoComplete="one-time-code"
                  className={cn(
                    'w-11 h-14 sm:w-12 sm:h-16 text-center text-xl sm:text-2xl font-bold rounded-xl border-2 bg-background',
                    'focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/20',
                    'transition-all duration-150 select-none',
                    'disabled:opacity-50 disabled:cursor-not-allowed',
                    d ? 'border-primary/60 bg-primary/5' : 'border-border',
                    verifyError && !d ? 'border-destructive' : '',
                  )}
                  onChange={(e) => handleDigitChange(i, e.target.value)}
                  onKeyDown={(e) => handleKeyDown(i, e)}
                  onPaste={handlePaste}
                  onFocus={(e) => e.target.select()}
                />
              ))}
            </div>

            {/* Error message */}
            {verifyError && (
              <p className="text-destructive text-sm text-center font-medium">{verifyError}</p>
            )}
          </div>

          {/* Verify Button */}
          <Button
            className="w-full"
            disabled={!isOtpComplete || isLoading || isExpired}
            onClick={handleVerify}
          >
            {isLoading ? (
              <span className="flex items-center gap-2">
                <span className="animate-spin rounded-full h-4 w-4 border-2 border-primary-foreground border-t-transparent" />
                Verifying…
              </span>
            ) : (
              <span className="flex items-center gap-2">
                <CheckCircle className="w-4 h-4" /> Verify Account
              </span>
            )}
          </Button>

          {/* Resend */}
          <div className="text-center">
            <p className="text-sm text-muted-foreground mb-2">Didn&apos;t receive the code?</p>
            <Button
              variant="ghost"
              size="sm"
              disabled={!canResend || isResending}
              onClick={handleResend}
              className="gap-2"
            >
              <RefreshCw className={cn('w-4 h-4', isResending && 'animate-spin')} />
              {isResending
                ? 'Sending…'
                : canResend
                ? 'Resend Code'
                : `Resend in ${resendCooldown}s`}
            </Button>
          </div>
        </div>

        {/* Back link */}
        <button
          onClick={() => router.push('/register')}
          className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors mx-auto"
        >
          <ArrowLeft className="w-4 h-4" /> Back to Register
        </button>
      </div>
    </div>
  );
}

export default function VerifyOtpPage() {
  return (
    <Suspense>
      <VerifyOtpContent />
    </Suspense>
  );
}
