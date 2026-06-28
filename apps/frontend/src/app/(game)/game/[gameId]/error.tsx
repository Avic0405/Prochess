'use client';

import Link from 'next/link';
import { Button } from '@/components/ui/Button';
import { AlertTriangle } from 'lucide-react';

export default function GameError({ error }: { error: Error }) {
  return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="text-center space-y-4">
        <AlertTriangle className="w-10 h-10 text-destructive mx-auto" />
        <p className="font-medium">{error.message || 'Game not found'}</p>
        <Button asChild variant="outline">
          <Link href="/lobby">Back to Lobby</Link>
        </Button>
      </div>
    </div>
  );
}
