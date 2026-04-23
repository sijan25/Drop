'use client';

import { useEffect, useMemo, useState } from 'react';
import { createClient } from '@/lib/supabase/client';

type UseDropViewerCountOptions = {
  enabled?: boolean;
  initialCount?: number | null;
  trackSelf?: boolean;
};

export function useDropViewerCount(
  dropId: string | null | undefined,
  {
    enabled = true,
    initialCount = 0,
    trackSelf = false,
  }: UseDropViewerCountOptions = {},
) {
  const baseline = useMemo(() => {
    const normalized = typeof initialCount === 'number' && Number.isFinite(initialCount)
      ? initialCount
      : 0;
    return trackSelf ? Math.max(normalized, 1) : Math.max(normalized, 0);
  }, [initialCount, trackSelf]);

  const [viewerState, setViewerState] = useState<{ dropId: string; value: number } | null>(null);

  useEffect(() => {
    if (!dropId || !enabled) return;

    const supabase = createClient();
    const channel = supabase.channel(`viewers-${dropId}`, {
      config: {
        presence: {
          key: `${trackSelf ? 'viewer' : 'observer'}-${Math.random().toString(36).slice(2)}`,
        },
      },
    });

    const syncCount = () => {
      const state = channel.presenceState();
      const total = Object.values(state).reduce((sum, entries) => (
        Array.isArray(entries) ? sum + entries.length : sum
      ), 0);
      setViewerState({
        dropId,
        value: trackSelf ? Math.max(total, 1) : total,
      });
    };

    channel
      .on('presence', { event: 'sync' }, syncCount)
      .subscribe(async status => {
        if (status !== 'SUBSCRIBED') return;
        if (trackSelf) {
          await channel.track({ at: Date.now() });
        } else {
          syncCount();
        }
      });

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [dropId, enabled, trackSelf]);

  return viewerState && viewerState.dropId === dropId ? viewerState.value : baseline;
}
