import React from 'react';
import { usePos } from './context/PosContext';
import LoginScreen from './components/LoginScreen';
import PosScreen from './components/PosScreen';
import Receipt from './components/Receipt';
import OrderTicket from './components/OrderTicket'; // --- NEW ---
import { RestaurantIcon } from './components/common/Icons';

const SyncStatus: React.FC = () => {
    const { isOnline, isSyncing } = usePos();

    let statusText = '';
    let bgColor = '';

    if (!isOnline) {
        statusText = 'Offline Mode - Të dhënat do të sinkronizohen kur të kthehet lidhja.';
        bgColor = 'bg-yellow-600';
    } else if (isSyncing) {
        statusText = 'Duke sinkronizuar të dhënat offline...';
        bgColor = 'bg-blue-600';
    } else {
        return null;
    }

    return (
        <div className={`fixed top-0 left-0 right-0 p-2 text-center text-white text-sm z-[100] ${bgColor} transition-all`}>
            {statusText}
        </div>
    );
};


const App: React.FC = () => {
  // --- MODIFIED: Added orderToPrint ---
  const { loggedInUser, saleToPrint, orderToPrint, isLoading } = usePos();

  if (isLoading) {
    return (
        <div className="flex flex-col items-center justify-center min-h-screen bg-primary text-text-secondary">
            <RestaurantIcon className="w-20 h-20 text-highlight animate-pulse" />
            <p className="mt-4 text-lg">Duke u ngarkuar sistemi...</p>
        </div>
    );
  }

  const renderContent = () => {
    if (!loggedInUser) {
      return <LoginScreen />;
    }
    return <PosScreen />;
  };

  return (
    <div className="min-h-screen bg-primary font-sans">
      {/* <SyncStatus /> */}
      {renderContent()}
      {saleToPrint && <Receipt sale={saleToPrint} />}
      {/* --- NEW: Render the OrderTicket for printing --- */}
      {orderToPrint && <OrderTicket table={orderToPrint.table} newItems={orderToPrint.newItems} />}
    </div>
  );
};

export default App;