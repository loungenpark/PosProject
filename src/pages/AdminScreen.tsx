import React, { useState, } from 'react';
import { usePos } from '../context/PosContext';
import ProfileTab from '../components/admin/ProfileTab';
import { TaxSettings, TableSettings, PrintingSettings, OperationalDaySettings } from '../components/admin/SettingsTab';;
import { CloseIcon, MenuIcon, TableIcon, PercentIcon, UserGroupIcon, BoxIcon, PrinterIcon, UploadIcon, RestaurantIcon, ClockIcon  } from '../components/common/Icons';

// Sub-components
import UsersTab from '../components/admin/UsersTab';
// SupplyTab import removed
import MenuTab from '../components/admin/MenuTab';
import StockTab from '../components/admin/StockTab';




// --- Main Admin Screen Component ---
type AdminTab = 'menu' | 'stock' | 'users' | 'tax' | 'tables' | 'operationalDay' | 'printimi' | 'profile';

// Note: No props needed as it's a top-level route now
const AdminScreen: React.FC = () => {
  const { loggedInUser, setActiveScreen } = usePos();
  const [activeTab, setActiveTab] = useState<AdminTab>('menu');

  return (
    // Changed fixed inset-0 to min-h-screen to allow window scrolling
    <div className="min-h-screen bg-primary z-50 flex flex-col relative">
      <header className="sticky top-0 bg-secondary flex items-center justify-between p-2 md:p-4 shadow-md z-40">
        <h1 className="hidden md:block text-xl font-bold text-text-main">Menaxhimi</h1>
        <div className="flex items-center justify-end w-full md:w-auto space-x-2 md:space-x-4">
          <button onClick={() => setActiveScreen('pos')} className="px-4 py-2 bg-accent text-text-main font-semibold rounded-lg hover:bg-highlight transition-colors flex items-center space-x-2">
            <RestaurantIcon className="w-5 h-5" />
            <span>POS</span>
          </button>
          <button onClick={() => setActiveScreen('sales')} className="px-4 py-2 bg-accent text-text-main font-semibold rounded-lg hover:bg-highlight transition-colors">
             Raporte
          </button>
          <span className="text-text-secondary ml-4"> {loggedInUser?.username}</span>
          <button onClick={() => setActiveScreen('pos')} className="p-2 rounded-full text-text-secondary hover:bg-accent hover:text-white transition-colors">
            <CloseIcon className="w-6 h-6" />
          </button>
        </div>
      </header>

      {/* Changed flex-grow overflow-hidden to just flex-grow */}
      <div className="flex flex-col flex-grow">
        {/* Horizontal Scrollable Tabs - Sticky below header */}
        <nav className="sticky top-[72px] z-30 w-full bg-secondary p-2 flex overflow-x-auto space-x-2 border-b border-accent flex-shrink-0 shadow-sm">
            <button onClick={() => setActiveTab('menu')} className={`flex-shrink-0 flex items-center space-x-2 px-4 py-3 rounded-t-md transition-colors whitespace-nowrap ${activeTab === 'menu' ? 'bg-highlight text-white' : 'hover:bg-accent text-text-secondary'}`}>
                <MenuIcon className="w-5 h-5"/>
                <span>Menutë</span>
            </button>
            <button onClick={() => setActiveTab('stock')} className={`flex-shrink-0 flex items-center space-x-2 px-4 py-3 rounded-t-md transition-colors whitespace-nowrap ${activeTab === 'stock' ? 'bg-highlight text-white' : 'hover:bg-accent text-text-secondary'}`}>
                <BoxIcon className="w-5 h-5"/>
                <span>Stoku</span>
            </button>
            <button onClick={() => setActiveTab('users')} className={`flex-shrink-0 flex items-center space-x-2 px-4 py-3 rounded-t-md transition-colors whitespace-nowrap ${activeTab === 'users' ? 'bg-highlight text-white' : 'hover:bg-accent text-text-secondary'}`}>
                <UserGroupIcon className="w-5 h-5"/>
                <span>Përdoruesit</span>
            </button>
            <button onClick={() => setActiveTab('tables')} className={`flex-shrink-0 flex items-center space-x-2 px-4 py-3 rounded-t-md transition-colors whitespace-nowrap ${activeTab === 'tables' ? 'bg-highlight text-white' : 'hover:bg-accent text-text-secondary'}`}>
                <TableIcon className="w-5 h-5"/>
                <span>Tavolinat</span>
            </button>
            <button onClick={() => setActiveTab('tax')} className={`flex-shrink-0 flex items-center space-x-2 px-4 py-3 rounded-t-md transition-colors whitespace-nowrap ${activeTab === 'tax' ? 'bg-highlight text-white' : 'hover:bg-accent text-text-secondary'}`}>
                <PercentIcon className="w-5 h-5"/>
                <span>Tatimi</span>
            </button>
            <button onClick={() => setActiveTab('operationalDay')} className={`flex-shrink-0 flex items-center space-x-2 px-4 py-3 rounded-t-md transition-colors whitespace-nowrap ${activeTab === 'operationalDay' ? 'bg-highlight text-white' : 'hover:bg-accent text-text-secondary'}`}>
                <ClockIcon className="w-5 h-5"/>
                <span>Dita Operacionale</span>
            </button>

            <button onClick={() => setActiveTab('printimi')} className={`flex-shrink-0 flex items-center space-x-2 px-4 py-3 rounded-t-md transition-colors whitespace-nowrap ${activeTab === 'printimi' ? 'bg-highlight text-white' : 'hover:bg-accent text-text-secondary'}`}>
                <PrinterIcon className="w-5 h-5"/>
                <span>Printimi</span>
            </button>
            <button onClick={() => setActiveTab('profile')} className={`flex-shrink-0 flex items-center space-x-2 px-4 py-3 rounded-t-md transition-colors whitespace-nowrap ${activeTab === 'profile' ? 'bg-highlight text-white' : 'hover:bg-accent text-text-secondary'}`}>
                <RestaurantIcon className="w-5 h-5"/>
                <span>Profil</span>
            </button>
        </nav>

        {/* Main Content - Removed overflow-y-auto to fix nested scroll DnD issue */}
        <main className="flex-grow p-4 md:p-6 w-full">
            {activeTab === 'menu' && <MenuTab />}
            {activeTab === 'stock' && <StockTab />}
            {activeTab === 'users' && <UsersTab />}
            {activeTab === 'tax' && <TaxSettings />}
            {activeTab === 'tables' && <TableSettings />}
            {activeTab === 'operationalDay' && <OperationalDaySettings />}
            {activeTab === 'printimi' && <PrintingSettings />}
            {activeTab === 'profile' && <ProfileTab />}
        </main>
      </div>
    </div>
  );

};

export default AdminScreen;