import React, { useState, } from 'react';
import { usePos } from '../context/PosContext';
import ProfileTab from '../components/admin/ProfileTab';
import { TaxSettings, PrintingSettings, OperationalDaySettings } from '../components/admin/SettingsTab';
import TableManager from '../components/admin/TableManager';
import { Settings, Package, BarChart4 } from 'lucide-react';
import { useTranslation } from 'react-i18next'; // LEFT: Import translation hook
import { LogoutIcon, CloseIcon, MenuIcon, TableIcon, PercentIcon, UserGroupIcon, PrinterIcon, RestaurantIcon, ClockIcon, GridIcon } from '../components/common/Icons';
import LanguageSwitcher from '../components/LanguageSwitcher'; // LEFT: Import Language Switcher

// Sub-components
import UsersTab from '../components/admin/UsersTab';
// SupplyTab import removed
import MenuTab from '../components/admin/MenuTab';
// StockTab removed


// --- Main Admin Screen Component ---
type AdminTab = 'menu' | 'users' | 'tax' | 'tables' | 'operationalDay' | 'printimi' | 'profile';

// Note: No props needed as it's a top-level route now
const AdminScreen: React.FC = () => {
  const { loggedInUser, setActiveScreen, logout } = usePos();
  const { t } = useTranslation(); // LEFT: Init translation
  const [activeTab, setActiveTab] = useState<AdminTab>('menu');

  return (
    // FIXED: h-screen prevents window scrolling, allowing internal sticky headers to work
    <div className="h-screen bg-primary z-50 flex flex-col overflow-hidden">
      <header className="flex-shrink-0 bg-secondary flex items-center justify-between p-2 md:p-4 shadow-md z-40">
        <h1 className="hidden md:flex text-xl font-semibold text-highlight items-center gap-2">
          <Settings className="w-6 h-6 text-highlight" />
          {t('nav.admin')}
        </h1>
        <div className="flex items-center justify-end w-full md:w-auto space-x-2 md:space-x-4">
          {/* POS Button */}
          <button
            onClick={() => setActiveScreen('pos')}
            className="px-4 h-11 bg-primary text-tsecondary font-semibold rounded-lg border-2 border-transparent hover:border-highlight hover:text-highlight transition-colors flex items-center gap-2"
          >
            <GridIcon className="w-5 h-5" />
            <span className="hidden md:inline">{t('nav.pos')}</span>
          </button>

          {/* Raporte Button */}
          <button
            onClick={() => setActiveScreen('sales')}
            className="px-4 h-11 bg-primary text-tsecondary font-semibold rounded-lg border-2 border-transparent hover:border-highlight hover:text-highlight transition-colors flex items-center gap-2"
          >
            <BarChart4 className="w-5 h-5" />
            <span className="hidden md:inline">{t('nav.reports')}</span>
          </button>

          {/* Stoku Button */}
          <button
            onClick={() => setActiveScreen('stock')}
            className="px-4 h-11 bg-primary text-tsecondary font-semibold rounded-lg border-2 border-transparent hover:border-highlight hover:text-highlight transition-colors flex items-center gap-2"
          >
            <Package className="w-5 h-5" />
            <span className="hidden md:inline">{t('nav.stock')}</span>
          </button>

          {/* Menaxhimi Button (Active) */}
          <button
            onClick={() => setActiveScreen('admin')}
            className="px-4 h-11 bg-primary text-highlight font-semibold rounded-lg border-2 border-highlight transition-colors flex items-center gap-2 shadow-sm"
          >
            <Settings className="w-5 h-5" />
            <span className="hidden md:inline">{t('nav.admin')}</span>
          </button>

          {/* Separator & User */}
          <div className="w-px h-6 bg-border mx-2"></div>
          <span className="hidden md:inline text-tsecondary"> {loggedInUser?.username}</span>

          {/* Logout Button */}
          <button onClick={logout} className="p-2 rounded-full text-tsecondary hover:bg-border hover:text-tmain transition-colors" title={t('nav.logout')}>
            <LogoutIcon className="w-6 h-6" />
          </button>
        </div>
      </header>

      {/* Container for Tabs and Content */}
      <div className="flex flex-col flex-grow overflow-hidden">

        {/* Navigation Bar Container (Flex Row) */}
        <div className="z-30 w-full bg-secondary flex border-b border-border shadow-sm flex-shrink-0">

          {/* Scrollable Tabs */}
          <nav className="flex-grow flex overflow-x-auto space-x-2 p-2">
            {/* Menu Tab */}
            <button onClick={() => setActiveTab('menu')} className={`flex-shrink-0 flex items-center space-x-2 px-4 py-3 border-b-2 font-semibold transition-colors whitespace-nowrap ${activeTab === 'menu' ? 'border-highlight text-highlight' : 'border-transparent text-tsecondary hover:text-highlight hover:border-highlight'}`}>
              <MenuIcon className="w-5 h-5" />
              <span>{t('admin.tabs.menu')}</span>
            </button>
            {/* Users Tab */}
            <button onClick={() => setActiveTab('users')} className={`flex-shrink-0 flex items-center space-x-2 px-4 py-3 border-b-2 font-semibold transition-colors whitespace-nowrap ${activeTab === 'users' ? 'border-highlight text-highlight' : 'border-transparent text-tsecondary hover:text-highlight hover:border-highlight'}`}>
              <UserGroupIcon className="w-5 h-5" />
              <span>{t('admin.tabs.users')}</span>
            </button>
            {/* Tables Tab */}
            <button onClick={() => setActiveTab('tables')} className={`flex-shrink-0 flex items-center space-x-2 px-4 py-3 border-b-2 font-semibold transition-colors whitespace-nowrap ${activeTab === 'tables' ? 'border-highlight text-highlight' : 'border-transparent text-tsecondary hover:text-highlight hover:border-highlight'}`}>
              <TableIcon className="w-5 h-5" />
              <span>{t('admin.tabs.tables')}</span>
            </button>
            {/* Tax Tab */}
            <button onClick={() => setActiveTab('tax')} className={`flex-shrink-0 flex items-center space-x-2 px-4 py-3 border-b-2 font-semibold transition-colors whitespace-nowrap ${activeTab === 'tax' ? 'border-highlight text-highlight' : 'border-transparent text-tsecondary hover:text-highlight hover:border-highlight'}`}>
              <PercentIcon className="w-5 h-5" />
              <span>{t('admin.settings.tax_title')}</span>
            </button>
            {/* Operational Day Tab */}
            <button onClick={() => setActiveTab('operationalDay')} className={`flex-shrink-0 flex items-center space-x-2 px-4 py-3 border-b-2 font-semibold transition-colors whitespace-nowrap ${activeTab === 'operationalDay' ? 'border-highlight text-highlight' : 'border-transparent text-tsecondary hover:text-highlight hover:border-highlight'}`}>
              <ClockIcon className="w-5 h-5" />
              <span>{t('admin.settings.op_day_title')}</span>
            </button>
            {/* Printing Tab */}
            <button onClick={() => setActiveTab('printimi')} className={`flex-shrink-0 flex items-center space-x-2 px-4 py-3 border-b-2 font-semibold transition-colors whitespace-nowrap ${activeTab === 'printimi' ? 'border-highlight text-highlight' : 'border-transparent text-tsecondary hover:text-highlight hover:border-highlight'}`}>
              <PrinterIcon className="w-5 h-5" />
              <span>{t('admin.settings.print_title')}</span>
            </button>
            {/* Profile Tab */}
            <button onClick={() => setActiveTab('profile')} className={`flex-shrink-0 flex items-center space-x-2 px-4 py-3 border-b-2 font-semibold transition-colors whitespace-nowrap ${activeTab === 'profile' ? 'border-highlight text-highlight' : 'border-transparent text-tsecondary hover:text-highlight hover:border-highlight'}`}>
              <RestaurantIcon className="w-5 h-5" />
              <span>{t('admin.tabs.profile')}</span>
            </button>

          </nav>

          {/* RIGHT: Static Language Switcher (Far Right) */}
          <div className="p-2 border-l border-border flex items-center bg-secondary">
            <LanguageSwitcher />
          </div>
        </div>

        {/* Main Content - locked container, children must handle scrolling */}
        <main className="flex-grow overflow-hidden p-4 md:p-6 w-full relative flex flex-col">
          {activeTab === 'menu' && <MenuTab />}
          {activeTab === 'users' && <UsersTab />}
          {activeTab === 'tax' && <TaxSettings />}
          {activeTab === 'tables' && <TableManager />}
          {activeTab === 'operationalDay' && <OperationalDaySettings />}
          {activeTab === 'printimi' && <PrintingSettings />}
          {activeTab === 'profile' && (
            <div className="h-full overflow-y-auto space-y-6">
              {/* LEFT: Language Switcher Removed (Moved to Header) */}

              {/* Existing Profile Tab */}
              <ProfileTab />
            </div>
          )}
        </main>
      </div>
    </div>
  );

};

export default AdminScreen;