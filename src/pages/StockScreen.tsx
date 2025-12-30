import React from 'react';
import { usePos } from '../context/PosContext';
import StockTab from '../components/admin/StockTab'; // Reusing the existing component
import { Package, Settings, BarChart4 } from 'lucide-react';
import {
    GridIcon,
    CloseIcon,
    LogoutIcon
} from '../components/common/Icons';

const StockScreen: React.FC = () => {
    const { loggedInUser, setActiveScreen, logout } = usePos();

    return (
        <div className="h-screen bg-primary z-50 flex flex-col overflow-hidden">
            {/* Header */}
            <header className="flex-shrink-0 bg-secondary flex items-center justify-between p-2 md:p-4 shadow-md z-40">
                <h1 className="hidden md:flex text-xl font-semibold text-highlight items-center gap-2">
                    <Package className="w-6 h-6 text-highlight" />
                    Stoku
                </h1>

                {/* Navigation Buttons */}
                <div className="flex items-center justify-end w-full md:w-auto space-x-2 md:space-x-4">
                    {/* Go to POS */}
                    <button
                        onClick={() => setActiveScreen('pos')}
                        className="px-4 h-11 bg-primary text-tsecondary font-semibold rounded-lg border-2 border-transparent hover:border-highlight hover:text-highlight transition-colors flex items-center gap-2"
                    >
                        <GridIcon className="w-5 h-5" />
                        <span className="hidden md:inline">POS</span>
                    </button>

                    {/* Go to Reports */}
                    <button
                        onClick={() => setActiveScreen('sales')}
                        className="px-4 h-11 bg-primary text-tsecondary font-semibold rounded-lg border-2 border-transparent hover:border-highlight hover:text-highlight transition-colors flex items-center gap-2"
                    >
                        <BarChart4 className="w-5 h-5" />
                        <span className="hidden md:inline">Raporte</span>
                    </button>

                    {/* Stoku Button (Active) */}
                    <button
                        onClick={() => setActiveScreen('stock')}
                        className="px-4 h-11 bg-primary text-highlight font-semibold rounded-lg border-2 border-highlight transition-colors flex items-center gap-2 shadow-sm"
                    >
                        <Package className="w-5 h-5" />
                        <span className="hidden md:inline">Stoku</span>
                    </button>

                    {/* Go to Menaxhimi (Admin) */}
                    <button
                        onClick={() => setActiveScreen('admin')}
                        className="px-4 h-11 bg-primary text-tsecondary font-semibold rounded-lg border-2 border-transparent hover:border-highlight hover:text-highlight transition-colors flex items-center gap-2"
                    >
                        <Settings className="w-5 h-5" />
                        <span className="hidden md:inline">Menaxhimi</span>
                    </button>

                    {/* User */}
                    <div className="w-px h-6 bg-border mx-2"></div>
                    <span className="hidden md:inline text-tsecondary"> {loggedInUser?.username}</span>

                    {/* Logout Button */}
                    <button onClick={logout} className="p-2 rounded-full text-tsecondary hover:bg-border hover:text-tmain transition-colors" title="Dil">
                        <LogoutIcon className="w-6 h-6" />
                    </button>
                </div>
            </header>

            {/* Main Content */}
            <main className="flex-grow overflow-hidden p-4 md:p-6 w-full relative flex flex-col">
                <StockTab />
            </main>
        </div>
    );
};

export default StockScreen;