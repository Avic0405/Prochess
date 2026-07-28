'use client';

import { useState } from 'react';
import { useAuthStore } from '@/store/authStore';
import { useToast } from '@/hooks/useToast';
import api from '@/lib/api';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { cn } from '@/lib/utils';
import {
  User, Lock, Globe, Eye, EyeOff, Check, ChevronRight,
} from 'lucide-react';
import { trackProfileUpdated, trackSettingsChanged } from '@/lib/analytics/events';

function SectionCard({
  icon: Icon,
  title,
  description,
  children,
}: {
  icon: React.ElementType;
  title: string;
  description: string;
  children: React.ReactNode;
}) {
  return (
    <div className="bg-card border rounded-2xl overflow-hidden">
      <div className="flex items-center gap-3 px-6 py-4 border-b bg-muted/30">
        <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center">
          <Icon className="w-4 h-4 text-primary" />
        </div>
        <div>
          <h2 className="font-semibold text-sm">{title}</h2>
          <p className="text-xs text-muted-foreground">{description}</p>
        </div>
      </div>
      <div className="p-4 sm:p-6">{children}</div>
    </div>
  );
}

function PasswordInput({
  label,
  value,
  onChange,
  placeholder,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
}) {
  const [show, setShow] = useState(false);
  return (
    <div className="space-y-1.5">
      <label className="text-sm font-medium">{label}</label>
      <div className="relative">
        <Input
          type={show ? 'text' : 'password'}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder ?? '••••••••'}
          className="pr-10"
        />
        <button
          type="button"
          onClick={() => setShow((s) => !s)}
          className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
          tabIndex={-1}
        >
          {show ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
        </button>
      </div>
    </div>
  );
}

export default function SettingsPage() {
  const { user, updateUser, fetchMe } = useAuthStore();
  const { toast } = useToast();

  // Profile form
  const [username, setUsername] = useState(user?.username ?? '');
  const [region, setRegion] = useState<string>(user?.region ?? 'USD');
  const [savingProfile, setSavingProfile] = useState(false);

  // Password form
  const [currentPw, setCurrentPw] = useState('');
  const [newPw, setNewPw] = useState('');
  const [confirmPw, setConfirmPw] = useState('');
  const [savingPw, setSavingPw] = useState(false);

  const profileDirty = username !== user?.username || region !== user?.region;

  const saveProfile = async () => {
    if (!profileDirty) return;
    if (username.length < 3 || username.length > 20 || !/^[a-zA-Z0-9_]+$/.test(username)) {
      toast({ variant: 'destructive', title: 'Username must be 3–20 chars, letters/numbers/underscore only' });
      return;
    }
    setSavingProfile(true);
    try {
      const { data } = await api.put('/users/me', { username, region });
      updateUser({ username: data.username, region: data.region });
      const changedFields = [
        username !== user?.username ? 'username' : null,
        region !== user?.region ? 'region' : null,
      ].filter((f): f is string => f !== null);
      trackProfileUpdated({ fields: changedFields });
      toast({ title: 'Profile updated!' });
    } catch (e: any) {
      toast({ variant: 'destructive', title: e?.response?.data?.message ?? 'Failed to update profile' });
    } finally {
      setSavingProfile(false);
    }
  };

  const changePassword = async () => {
    if (!currentPw || !newPw || !confirmPw) {
      toast({ variant: 'destructive', title: 'All password fields are required' });
      return;
    }
    if (newPw.length < 8) {
      toast({ variant: 'destructive', title: 'New password must be at least 8 characters' });
      return;
    }
    if (newPw !== confirmPw) {
      toast({ variant: 'destructive', title: 'New passwords do not match' });
      return;
    }
    setSavingPw(true);
    try {
      await api.post('/auth/change-password', { currentPassword: currentPw, newPassword: newPw });
      trackSettingsChanged({ setting: 'password' });
      toast({ title: 'Password changed successfully!' });
      setCurrentPw('');
      setNewPw('');
      setConfirmPw('');
    } catch (e: any) {
      toast({ variant: 'destructive', title: e?.response?.data?.message ?? 'Failed to change password' });
    } finally {
      setSavingPw(false);
    }
  };

  if (!user) return null;

  return (
    <div className="max-w-2xl mx-auto p-4 sm:p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Settings</h1>
        <p className="text-muted-foreground text-sm mt-1">Manage your account preferences</p>
      </div>

      {/* Profile */}
      <SectionCard icon={User} title="Profile" description="Update your display name and region">
        <div className="space-y-4">
          {/* Email — read-only */}
          <div className="space-y-1.5">
            <label className="text-sm font-medium">Email</label>
            <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-muted border text-sm text-muted-foreground">
              {user.email}
              <span className="ml-auto text-xs bg-primary/10 text-primary px-2 py-0.5 rounded-full">verified</span>
            </div>
          </div>

          {/* Username */}
          <div className="space-y-1.5">
            <label className="text-sm font-medium">Username</label>
            <Input
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="Your username"
              maxLength={20}
            />
            <p className="text-xs text-muted-foreground">3–20 characters, letters, numbers and underscores only</p>
          </div>

          {/* Region / Currency */}
          <div className="space-y-1.5">
            <label className="text-sm font-medium flex items-center gap-1.5">
              <Globe className="w-3.5 h-3.5" /> Region & Currency
            </label>
            <div className="grid grid-cols-2 gap-3">
              {(['USD', 'INR'] as const).map((r) => (
                <button
                  key={r}
                  onClick={() => setRegion(r)}
                  className={cn(
                    'flex items-center justify-between px-4 py-3 rounded-xl border-2 text-sm font-medium transition-all',
                    region === r
                      ? 'border-primary bg-primary/10 text-foreground'
                      : 'border-border text-muted-foreground hover:border-primary/40',
                  )}
                >
                  <span>{r === 'USD' ? '🇺🇸  USD ($)' : '🇮🇳  INR (₹)'}</span>
                  {region === r && <Check className="w-4 h-4 text-primary" />}
                </button>
              ))}
            </div>
          </div>

          <Button onClick={saveProfile} disabled={savingProfile || !profileDirty} className="w-full">
            {savingProfile ? 'Saving...' : 'Save Profile'}
          </Button>
        </div>
      </SectionCard>

      {/* Security */}
      <SectionCard icon={Lock} title="Security" description="Change your account password">
        <div className="space-y-4">
          <PasswordInput label="Current Password" value={currentPw} onChange={setCurrentPw} />
          <PasswordInput label="New Password" value={newPw} onChange={setNewPw} placeholder="Min. 8 characters" />
          <PasswordInput label="Confirm New Password" value={confirmPw} onChange={setConfirmPw} placeholder="Re-enter new password" />

          <div className="pt-1">
            <Button onClick={changePassword} disabled={savingPw} className="w-full">
              {savingPw ? 'Changing...' : 'Change Password'}
            </Button>
          </div>

          <p className="text-xs text-muted-foreground text-center">
            Forgot your current password?{' '}
            <a href="/forgot-password" className="text-primary hover:underline">
              Reset via email
            </a>
          </p>
        </div>
      </SectionCard>

      {/* Account info */}
      <SectionCard icon={ChevronRight} title="Account" description="Your account details">
        <div className="space-y-3 text-sm">
          {[
            { label: 'Member since', value: new Date(user.createdAt).toLocaleDateString() },
            { label: 'Rating',       value: `${user.rating} ELO` },
            { label: 'Role',         value: user.role },
          ].map(({ label, value }) => (
            <div key={label} className="flex items-center justify-between py-2 border-b last:border-0">
              <span className="text-muted-foreground">{label}</span>
              <span className="font-medium">{value}</span>
            </div>
          ))}
          <div className="flex items-center justify-between py-2">
            <span className="text-muted-foreground">Profile</span>
            <a
              href={`/profile/${user.username}`}
              className="text-primary hover:underline font-medium text-sm flex items-center gap-1"
            >
              View public profile <ChevronRight className="w-3.5 h-3.5" />
            </a>
          </div>
        </div>
      </SectionCard>
    </div>
  );
}
