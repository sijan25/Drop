import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { requireTrustedRequestOrigin } from '@/lib/security/request';
import { deleteFromCloudinary } from '@/lib/cloudinary/server';

export async function POST(request: NextRequest) {
  const originError = requireTrustedRequestOrigin(request);
  if (originError) return NextResponse.json({ error: 'Origen no permitido' }, { status: 403 });

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });

  let publicIds: string[];
  try {
    const body = await request.json();
    publicIds = Array.isArray(body.publicIds) ? body.publicIds : [body.publicId].filter(Boolean);
  } catch {
    return NextResponse.json({ error: 'Body inválido' }, { status: 400 });
  }

  if (!publicIds.length) return NextResponse.json({ deleted: [] });

  const ids = publicIds.slice(0, 100);
  const deleted: string[] = [];

  await Promise.allSettled(ids.map(async id => {
    await deleteFromCloudinary(id);
    deleted.push(id);
  }));

  return NextResponse.json({ deleted });
}
