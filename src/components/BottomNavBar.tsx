import React from 'react';
import { TabType, LanguageCode } from '../types';
import { getTranslation } from '../utils/i18n';

interface BottomNavBarProps {
  currentTab: TabType;
  language: LanguageCode;
  onSelectTab: (tab: TabType) => void;
}

export const BottomNavBar: React.FC<BottomNavBarProps> = ({
  currentTab,
  language,
  onSelectTab,
}) => {
  const navItems: {
    id: TabType;
    labelKey: string;
    fallbackLabel: string;
    icon: string;
  }[] = [
    { id: 'home', labelKey: 'navHome', fallbackLabel: 'HOME', icon: 'home' },
    { id: 'health', labelKey: 'navHealth', fallbackLabel: 'HEALTH', icon: 'monitor_heart' },
    { id: 'triage', labelKey: 'navTriage', fallbackLabel: 'TRIAGE', icon: 'mic' },
    { id: 'consult', labelKey: 'navConsult', fallbackLabel: 'CONSULT', icon: 'video_camera_front' },
    { id: 'records', labelKey: 'navRecords', fallbackLabel: 'RECORDS', icon: 'folder_shared' },
    { id: 'profile', labelKey: 'navProfile', fallbackLabel: 'PROFILE', icon: 'badge' },
  ];

  return (
    <nav
      id="mobile-bottom-nav-bar"
      className="bg-slate-950 text-white fixed bottom-0 left-0 w-full z-40 h-[64px] border-t border-slate-800 flex justify-around items-center px-1 pb-safe md:hidden shadow-2xl backdrop-blur-md"
    >
      {navItems.map((item) => {
        const isActive = currentTab === item.id;
        const label = getTranslation(language, item.labelKey as any) || item.fallbackLabel;
        return (
          <button
            key={item.id}
            id={`bottom-nav-${item.id}`}
            onClick={() => onSelectTab(item.id)}
            className={`flex flex-col items-center justify-center transition-all py-1 px-2 rounded-xl ${
              isActive
                ? 'bg-teal-500/20 text-teal-300 border-b-2 border-teal-400'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <span className={`material-symbols-outlined text-[20px] ${isActive ? 'scale-110 text-teal-300' : ''}`}>
              {item.icon}
            </span>
            <span className="text-[9px] font-bold uppercase tracking-wider mt-0.5 font-mono truncate max-w-[50px]">
              {label}
            </span>
          </button>
        );
      })}
    </nav>
  );
};
