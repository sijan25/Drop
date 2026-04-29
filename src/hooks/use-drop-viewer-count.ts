'use client';

import { useEffect, useRef, useState } from 'react';
import { createClient } from '@/lib/supabase/client';

type Options = {
  enabled?: boolean;
  initialCount?: number | null;
  trackSelf?: boolean;
};

// Uses Broadcast (not Presence) for reliable cross-browser viewer counting.
// Each viewer sends a heartbeat every 10s; observer counts unique active sessions.
export function useDropViewerCount(
  dropId: string | null | undefined,
  { enabled = true, initialCount = 0, trackSelf = false }: Options = {},
) {
  const base = typeof initialCount === 'number' && Number.isFinite(initialCount) ? initialCount : 0;
  const [count, setCount] = useState<number | null>(null);
  const sessionId = useRef(`${Date.now()}-${Math.random().toString(36).slice(2)}`).current;
  const peers = useRef(new Map<string, number>());

  useEffect(() => {
    if (!dropId || !enabled) return;

    const supabase = createClient();
    const HEARTBEAT_MS = 5_000;
    const STALE_MS = 15_000;

    function recount() {
      const now = Date.now();
      for (const [id, ts] of peers.current) {
        if (now - ts > STALE_MS) peers.current.delete(id);
      }
      setCount(peers.current.size + (trackSelf ? 1 : 0));
    }

    const channel = supabase.channel(`viewers-v2-${dropId}`);

    const sendHb = () =>
      channel.send({ type: 'broadcast', event: 'hb', payload: { s: sessionId } }).catch(() => {});

    channel
      .on('broadcast', { event: 'hb' }, ({ payload }) => {
        const sid = (payload as { s?: string })?.s;
        if (!sid || sid === sessionId) return;
        const isNew = !peers.current.has(sid);
        peers.current.set(sid, Date.now());
        recount();
        // Respond immediately to new peers so they see us right away
        if (trackSelf && isNew) sendHb();
      })
      .on('broadcast', { event: 'ping' }, () => {
        if (trackSelf) sendHb();
      })
      .subscribe(status => {
        if (status !== 'SUBSCRIBED') return;
        if (trackSelf) {
          sendHb();
        } else {
          channel.send({ type: 'broadcast', event: 'ping', payload: {} }).catch(() => {});
        }
      });

    const heartbeatTimer = trackSelf
      ? setInterval(() => {
          channel.send({ type: 'broadcast', event: 'hb', payload: { s: sessionId } }).catch(() => {});
          recount();
        }, HEARTBEAT_MS)
      : null;

    const cleanupTimer = setInterval(recount, STALE_MS);

    return () => {
      if (heartbeatTimer) clearInterval(heartbeatTimer);
      clearInterval(cleanupTimer);
      void supabase.removeChannel(channel);
    };
  }, [dropId, enabled, trackSelf, sessionId]);

  // Show baseline from DB until first heartbeat received
  if (count === null) {
    return trackSelf ? Math.max(base, 1) : base;
  }
  return count;
}
