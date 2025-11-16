import React, { useEffect, useRef } from 'react';
import { usePos } from './context/PosContext';
import LoginScreen from './components/LoginScreen';
import PosScreen from './components/PosScreen';
import Receipt from './components/Receipt';
import OrderTicket from './components/OrderTicket';
import { RestaurantIcon } from './components/common/Icons';
import { printComponent } from './utils/printHelper'; // <-- Import our new helper

// SyncStatus component remains the same...
const SyncStatus: React.FC = () => { /* ...no changes here... */ };

const App: React.FC = () => {
  const { loggedInUser, saleToPrint, orderToPrint, isLoading } = usePos();
  
  // Create a ref to hold a reference to our printable div
  const printableRef = useRef<HTMLDivElement>(null);

  // This useEffect will run whenever saleToPrint or orderToPrint changes
  useEffect(() => {
    // If the ref points to a rendered component, and there's something to print...
    if (printableRef.current && (saleToPrint || orderToPrint)) {
      // Call our reliable print helper!
      printComponent(printableRef.current);
    }
  }, [saleToPrint, orderToPrint]); // Dependencies array

  if (isLoading) {
    // ... no changes here ...
  }

  const renderContent = () => {
    // ... no changes here ...
  };

  return (
    <div className="min-h-screen bg-primary font-sans">
      {/* The main app is no longer in a separate div */}
      {renderContent()}

      {/* 
        This div is now completely hidden. Its only purpose is to
        hold the component so React renders it and our 'printableRef'
        can grab its HTML content.
      */}
      <div ref={printableRef} style={{ display: 'none' }}>
        {saleToPrint && <Receipt sale={saleToPrint} />}
        {orderToPrint && <OrderTicket table={orderToPrint.table} newItems={orderToPrint.newItems} />}
      </div>
    </div>
  );
};

export default App;