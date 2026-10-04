// "/s/[id]" (K5): the session feed; data is fetched in the browser from the relative /api routes.
import type { Metadata } from 'next';

import { SessionScreen } from '../../../ui/SessionScreen';

export const metadata: Metadata = { title: 'Сессия · Бродяжник' };

export default async function SessionPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <SessionScreen key={id} id={id} />;
}
