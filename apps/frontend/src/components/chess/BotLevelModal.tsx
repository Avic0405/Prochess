'use client';

import { useState } from 'react';
import * as Dialog from '@radix-ui/react-dialog';
import { useRouter } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import api from '@/lib/api';
import { Button } from '@/components/ui/Button';
import { cn } from '@/lib/utils';
import { toast } from '@/hooks/useToast';
import { trackBotLevelSelected } from '@/lib/analytics/events';
import { Bot, Lock, X, Trophy, Loader2 } from 'lucide-react';

interface BotLevelModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

interface BotLevelDto {
  id: string;
  level: number;
  name: string;
  elo: number;
  description: string;
  isUnlocked: boolean;
  wins: number;
  losses: number;
  draws: number;
  attempts: number;
}

export function BotLevelModal({ open, onOpenChange }: BotLevelModalProps) {
  const router = useRouter();
  const [startingLevelId, setStartingLevelId] = useState<string | null>(null);

  const { data: levels = [], isLoading } = useQuery<BotLevelDto[]>({
    queryKey: ['bot-levels'],
    queryFn: () => api.get('/bot/levels').then((r) => r.data),
    enabled: open,
  });

  const handlePlay = async (lvl: BotLevelDto) => {
    if (!lvl.isUnlocked || startingLevelId) return;
    setStartingLevelId(lvl.id);
    try {
      await api.post('/bot/start', { levelId: lvl.id });
      trackBotLevelSelected({ level: lvl.level, name: lvl.name, elo: lvl.elo });
      onOpenChange(false);
      router.push(`/bot/${lvl.level}`);
    } catch (e: any) {
      toast({
        variant: 'destructive',
        title: 'Could not start bot game',
        description: e?.response?.data?.message ?? 'Please try again.',
      });
    } finally {
      setStartingLevelId(null);
    }
  };

  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-50 bg-black/80 backdrop-blur-[3px] animate-in fade-in duration-200" />
        <Dialog.Content
          className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 outline-none"
          aria-describedby={undefined}
        >
          <div className="relative w-full max-w-2xl max-h-[90vh] overflow-y-auto rounded-2xl border bg-card shadow-2xl animate-in zoom-in-95 fade-in slide-in-from-bottom-3 duration-300 p-5 sm:p-7">
            <Dialog.Close asChild>
              <button
                className="absolute top-4 right-4 p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
                aria-label="Close"
              >
                <X className="w-5 h-5" />
              </button>
            </Dialog.Close>

            <Dialog.Title asChild>
              <h2 className="text-2xl font-bold flex items-center gap-2">
                <Bot className="w-6 h-6 text-primary" /> Choose Bot Level
              </h2>
            </Dialog.Title>
            <p className="text-muted-foreground text-sm mt-1 mb-6">
              Defeat each level to unlock the next one
            </p>

            {isLoading ? (
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                {Array.from({ length: 8 }, (_, i) => (
                  <div key={i} className="h-28 bg-muted rounded-xl animate-pulse" />
                ))}
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                {levels.map((lvl) => (
                  <div
                    key={lvl.id}
                    className={cn(
                      'relative rounded-xl border-2 p-4 transition-all',
                      lvl.isUnlocked
                        ? 'border-primary/60 bg-primary/5'
                        : 'border-border bg-muted/20 opacity-70',
                    )}
                  >
                    {lvl.isUnlocked ? (
                      <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded bg-green-500/15 text-green-500">
                        UNLOCKED
                      </span>
                    ) : (
                      <Lock className="absolute top-3 right-3 w-3.5 h-3.5 text-muted-foreground" />
                    )}

                    <p className="text-xs text-muted-foreground mt-2">Level {lvl.level}</p>
                    <p className="font-bold text-base">{lvl.name}</p>
                    <p className="text-xs text-muted-foreground flex items-center gap-1 mt-0.5">
                      <Trophy className="w-3 h-3" /> ~{lvl.elo}
                    </p>
                    <p className="text-xs text-muted-foreground mt-2 min-h-[2rem]">
                      {lvl.isUnlocked ? lvl.description : `Defeat the previous level to unlock`}
                    </p>

                    {lvl.isUnlocked ? (
                      <Button
                        size="sm"
                        className="w-full mt-3"
                        disabled={startingLevelId === lvl.id}
                        onClick={() => handlePlay(lvl)}
                      >
                        {startingLevelId === lvl.id ? (
                          <Loader2 className="w-4 h-4 animate-spin" />
                        ) : (
                          'Play'
                        )}
                      </Button>
                    ) : (
                      <Button size="sm" variant="outline" className="w-full mt-3" disabled>
                        Locked
                      </Button>
                    )}
                  </div>
                ))}
              </div>
            )}

            <div className="mt-6 bg-muted/30 border rounded-xl p-4 text-sm">
              <p className="font-semibold mb-2">About Bot Mode</p>
              <ul className="text-muted-foreground text-xs space-y-1 list-disc list-inside">
                <li>Play offline against our AI</li>
                <li>Different levels, different strengths</li>
                <li>Improve your skills step by step</li>
                <li>Your progress is saved automatically</li>
              </ul>
            </div>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
