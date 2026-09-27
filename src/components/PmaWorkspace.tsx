/** LIVE-5: the module and capability entrances share one real monitoring workspace. */
import MonitoringWorkspace, { type MonitorTab } from './MonitoringWorkspace';
import { type Lang } from '../data/framework';
export type PmaTab = MonitorTab;
export default function PmaWorkspace(props: { lang: Lang; projectId: string; initialTab?: PmaTab; hideTabs?: boolean }) {
  return <MonitoringWorkspace {...props} />;
}
