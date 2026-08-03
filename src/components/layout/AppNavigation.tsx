export interface NavigationTab {
  id: string;
  icon: string;
  label: string;
}

interface AppNavigationProps {
  tabs: NavigationTab[];
  activeTab: string;
  onChange: (tabId: string) => void;
}

export function AppNavigation({ tabs, activeTab, onChange }: AppNavigationProps) {
  return (
    <nav className="nav-bar">
      {tabs.map((tab) => (
        <button
          key={tab.id}
          className={`nav-item ${activeTab === tab.id ? 'active' : ''}`}
          onClick={() => onChange(tab.id)}
        >
          <span>{tab.icon}</span>
          {tab.label}
        </button>
      ))}
    </nav>
  );
}
