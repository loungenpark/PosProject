// C:\Users\loung\PosProject\App.tsx

import React from 'react';
import { usePos } from './context/PosContext';
import LoginScreen from './components/LoginScreen';
import PosScreen from './components/PosScreen';
import { RestaurantIcon } from './components/common/Icons';

const App: React.FC = () => {
  // THIS IS OUR PROOF THAT THE NEW FILE IS RUNNING
  console.log('✅✅✅ --- RUNNING LATEST App.tsx --- ✅✅✅');

  // We only need loggedInUser and isLoading now. The printing state is removed.
  const { loggedInUser, isLoading } = usePos();

  // The broken useEffect hooks have been completely removed.
  // Printing is now handled directly inside PosContext.tsx when a sale is made.
  // This permanently solves the infinite loop problem.

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
    // NOTE: The "min-h-screen" class here is likely the cause of the
    // "long blank page" issue. We will fix this NEXT, after we confirm
    // the application is stable.
    <div className="min-h-screen bg-primary font-sans">
      {renderContent()}
    </div>
  );
};

export default App;