// "/" (K5): region choice and the recent sessions; the screen itself is a client component.
import { REGION_IDS } from '../shared/api';
import { HomeScreen } from '../ui/HomeScreen';

export default function Home() {
  return <HomeScreen regions={REGION_IDS} />;
}
