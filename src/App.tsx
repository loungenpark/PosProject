// C:\Users\loung\PosProject\App.tsx

import React from 'react';
import { usePos } from './context/PosContext';
import LoginScreen from './pages/LoginScreen';
import PosScreen from './pages/PosScreen';
import AdminScreen from './pages/AdminScreen';
import SalesScreen from './pages/SalesScreen';
import { RestaurantIcon } from './components/common/Icons';

const App: React.FC = () => {
  const { loggedInUser, isLoading, activeScreen } = usePos();

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

    // Main Router Logic
    switch (activeScreen) {
      case 'sales':
        return <SalesScreen />;
      case 'admin':
        return <AdminScreen />;
      case 'pos':
      default:
        return <PosScreen />;
    }
  };

  return (
    <div className="min-h-screen bg-primary font-sans">
      {renderContent()}
    </div>
  );
};

export default App;