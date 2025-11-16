import React, { useMemo } from 'react';
import { Table, OrderItem, User } from '../types';

interface OrderTicketProps {
  table: Table;
  newItems: OrderItem[];
  user: User | null;
}

const OrderTicket: React.FC<OrderTicketProps> = ({ table, newItems, user }) => {
  const now = new Date();

  const total = useMemo(() => {
    return newItems.reduce((acc, item) => acc + (item.price * item.quantity), 0);
  }, [newItems]);

  return (
    <div className="order-ticket-container">
      <div className="text-center mb-2">
        <h2 className="text-xl font-bold">Porosia</h2>
        <h3 className="text-lg font-bold">Tavolina: {table.name}</h3>
      </div>
      <div className="text-xs mb-2">
        <p>Data: {now.toLocaleString()}</p>
        {user && <p>Kamarieri: {user.username}</p>}
      </div>
      <hr className="my-2 border-t border-dashed border-black" />
      <div>
        {newItems.map((item, index) => (
          <div key={`${item.id}-${index}`} className="flex justify-between items-center my-1 text-base">
            <span className="font-bold">{item.quantity}x</span>
            <span className="flex-grow text-left ml-2">{item.name}</span>
            <span>{(item.price * item.quantity).toFixed(2)}</span>
          </div>
        ))}
      </div>
      <hr className="my-2 border-t border-dashed border-black" />
      <div className="flex justify-between font-bold text-base">
          <span>Totali i Porosisë:</span>
          <span>{total.toFixed(2)} €</span>
      </div>
    </div>
  );
};

export default OrderTicket;