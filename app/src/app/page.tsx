// "/" (K5, K5.1): region choice and the recent sessions; the screen itself is a client component.
// This server component reads the region names from the server's label catalog (the same memoized
// catalog as the API) at REQUEST time -- force-dynamic, so a pack change is not frozen into the
// build -- and passes plain { id, label } props.
import { getPackLabels } from '../server/env';
import { REGION_IDS } from '../shared/api';
import { HomeScreen, type RegionOption } from '../ui/HomeScreen';

export const dynamic = 'force-dynamic';

export default function Home() {
  const names = getPackLabels().regions;
  const regions: RegionOption[] = REGION_IDS.map((id) => ({ id, label: Object.hasOwn(names, id) ? (names[id] as string) : id }));
  return <HomeScreen regions={regions} />;
}
