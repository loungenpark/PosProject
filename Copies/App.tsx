import React from 'react';
import { usePos } from './context/PosContext';
import LoginScreen from './components/LoginScreen';
import PosScreen from './components/PosScreen';
import Receipt from './components/Receipt';
import OrderTicket from './components/OrderTicket';
import { RestaurantIcon } from './components/common/Icons';

const App: React.FC = () => {
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
      <div id="main-app">
        {renderContent()}
      </div>

      <div id="printable-area">
        {saleToPrint && <Receipt sale={saleToPrint} />}
        {orderToPrint && <OrderTicket table={orderToPrint.table} newItems={orderToPrint.newItems} user={loggedInUser} />}
      </div>
    </div>
  );
};

export default App;