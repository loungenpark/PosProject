import React, { useState, } from 'react';
import { usePos } from '../context/PosContext';
import ProfileTab from '../components/admin/ProfileTab';
import { TaxSettings, PrintingSettings, OperationalDaySettings } from '../components/admin/SettingsTab';
import TableManager from '../components/admin/TableManager';
import { CloseIcon, MenuIcon, TableIcon, PercentIcon, UserGroupIcon, BoxIcon, PrinterIcon, RestaurantIcon, ClockIcon, GridIcon, PieChartIcon, PackageIcon } from '../components/common/Icons';

// Sub-components
import UsersTab from '../components/admin/UsersTab';
// SupplyTab import removed
import MenuTab from '../components/admin/MenuTab';
// StockTab removed


// --- Main Admin Screen Component ---
type AdminTab = 'menu' | 'users' | 'tax' | 'tables' | 'operationalDay' | 'printimi' | 'profile';

// Note: No props needed as it's a top-level route now
const AdminScreen: React.FC = () => {
  const { loggedInUser, setActiveScreen } = usePos();
  const [activeTab, setActiveTab] = useState<AdminTab>('menu');

  return (
    // FIXED: h-screen prevents window scrolling, allowing internal sticky headers to work
    <div className="h-screen bg-primary z-50 flex flex-col overflow-hidden">
      <header className="flex-shrink-0 bg-secondary flex items-center justify-between p-2 md:p-4 shadow-md z-40">
        <h1 className="hidden md:flex text-xl font-bold text-tmain items-center gap-2">
          <PackageIcon className="w-6 h-6 text-highlight" />
          Menaxhimi
        </h1>
        <div className="flex items-center justify-end w-full md:w-auto space-x-2 md:space-x-4">
          {/* // Button style updated for consistency */}
          <button onClick={() => setActiveScreen('pos')} className="px-4 py-2 bg-primary text-tmain font-semibold rounded-lg border border-transparent hover:border-highlight hover:text-highlight transition-colors flex items-center gap-2">
            <GridIcon className="w-5 h-5" />
            <span className="hidden md:inline">POS</span>
          </button>
          {/* // Button style updated for consistency */}
          <button onClick={() => setActiveScreen('sales')} className="px-4 py-2 bg-primary text-tmain font-semibold rounded-lg border border-transparent hover:border-highlight hover:text-highlight transition-colors flex items-center gap-2">
            <PieChartIcon className="w-5 h-5" />
            <span className="hidden md:inline">Raporte</span>
          </button>
          {/* Add Stock Button */}
          <button onClick={() => setActiveScreen('stock')} className="px-4 py-2 bg-primary text-tmain font-semibold rounded-lg border border-transparent hover:border-highlight hover:text-highlight transition-colors flex items-center gap-2">
            <BoxIcon className="w-5 h-5" />
            <span className="hidden md:inline">Stoku</span>
          </button>
          {/* // Vertical separator added for consistency */}
          <div className="w-px h-6 bg-border mx-2"></div>
          <span className="text-tsecondary"> {loggedInUser?.username}</span>
          <button onClick={() => setActiveScreen('pos')} className="p-2 rounded-full text-tsecondary hover:bg-border hover:text-tmain transition-colors">
            <CloseIcon className="w-6 h-6" />
          </button>
        </div>
      </header>

      {/* Container for Tabs and Content */}
      <div className="flex flex-col flex-grow overflow-hidden">
        {/* Tabs - Fixed height, no longer relies on sticky positioning */}
        {/* Tabs - Fixed height, no longer relies on sticky positioning */}
        <nav className="z-30 w-full bg-secondary p-2 flex overflow-x-auto space-x-2 border-b border-border flex-shrink-0 shadow-sm">
          {/* Menu Tab */}
          <button onClick={() => setActiveTab('menu')} className={`flex-shrink-0 flex items-center space-x-2 px-4 py-3 border-b-2 font-semibold transition-colors whitespace-nowrap ${activeTab === 'menu' ? 'border-highlight text-highlight' : 'border-transparent text-tsecondary hover:text-highlight hover:border-highlight'}`}>
            <MenuIcon className="w-5 h-5" />
            <span>Menutë</span>
          </button>
          {/* Users Tab */}
          <button onClick={() => setActiveTab('users')} className={`flex-shrink-0 flex items-center space-x-2 px-4 py-3 border-b-2 font-semibold transition-colors whitespace-nowrap ${activeTab === 'users' ? 'border-highlight text-highlight' : 'border-transparent text-tsecondary hover:text-highlight hover:border-highlight'}`}>
            <UserGroupIcon className="w-5 h-5" />
            <span>Përdoruesit</span>
          </button>
          {/* Tables Tab */}
          <button onClick={() => setActiveTab('tables')} className={`flex-shrink-0 flex items-center space-x-2 px-4 py-3 border-b-2 font-semibold transition-colors whitespace-nowrap ${activeTab === 'tables' ? 'border-highlight text-highlight' : 'border-transparent text-tsecondary hover:text-highlight hover:border-highlight'}`}>
            <TableIcon className="w-5 h-5" />
            <span>Tavolinat</span>
          </button>
          {/* Tax Tab */}
          <button onClick={() => setActiveTab('tax')} className={`flex-shrink-0 flex items-center space-x-2 px-4 py-3 border-b-2 font-semibold transition-colors whitespace-nowrap ${activeTab === 'tax' ? 'border-highlight text-highlight' : 'border-transparent text-tsecondary hover:text-highlight hover:border-highlight'}`}>
            <PercentIcon className="w-5 h-5" />
            <span>Tatimi</span>
          </button>
          {/* Operational Day Tab */}
          <button onClick={() => setActiveTab('operationalDay')} className={`flex-shrink-0 flex items-center space-x-2 px-4 py-3 border-b-2 font-semibold transition-colors whitespace-nowrap ${activeTab === 'operationalDay' ? 'border-highlight text-highlight' : 'border-transparent text-tsecondary hover:text-highlight hover:border-highlight'}`}>
            <ClockIcon className="w-5 h-5" />
            <span>Dita Operacionale</span>
          </button>
          {/* Printing Tab */}
          <button onClick={() => setActiveTab('printimi')} className={`flex-shrink-0 flex items-center space-x-2 px-4 py-3 border-b-2 font-semibold transition-colors whitespace-nowrap ${activeTab === 'printimi' ? 'border-highlight text-highlight' : 'border-transparent text-tsecondary hover:text-highlight hover:border-highlight'}`}>
            <PrinterIcon className="w-5 h-5" />
            <span>Printimi</span>
          </button>
          {/* Profile Tab */}
          <button onClick={() => setActiveTab('profile')} className={`flex-shrink-0 flex items-center space-x-2 px-4 py-3 border-b-2 font-semibold transition-colors whitespace-nowrap ${activeTab === 'profile' ? 'border-highlight text-highlight' : 'border-transparent text-tsecondary hover:text-highlight hover:border-highlight'}`}>
            <RestaurantIcon className="w-5 h-5" />
            <span>Profil</span>
          </button>
        </nav>

        {/* Main Content - locked container, children must handle scrolling */}
        <main className="flex-grow overflow-hidden p-4 md:p-6 w-full relative flex flex-col">
          {activeTab === 'menu' && <MenuTab />}
          {activeTab === 'users' && <UsersTab />}
          {activeTab === 'tax' && <TaxSettings />}
          {activeTab === 'tables' && <TableManager />}
          {activeTab === 'operationalDay' && <OperationalDaySettings />}
          {activeTab === 'printimi' && <PrintingSettings />}
          {activeTab === 'profile' && <ProfileTab />}
        </main>
      </div>
    </div>
  );

};

export default AdminScreen;