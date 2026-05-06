import { NextResponse } from 'next/server';
import { getBoxfulStates } from '@/lib/boxful/client';

export async function GET() {
  const result = await getBoxfulStates();
  return NextResponse.json(result);
}
