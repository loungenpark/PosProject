import React, { useMemo } from 'react';
import { Table, OrderItem, User } from '../types';

interface OrderTicketProps {
  table: Table;
  newItems: OrderItem[];
  user: User | null;
}

// ==========================================================================
// UPDATED COMPONENT DEFINITION
// We wrap the component in `React.forwardRef` so the printing library can access it.
// ==========================================================================
const OrderTicket = React.forwardRef<HTMLDivElement, OrderTicketProps>(({ table, newItems, user }, ref) => {
  const now = new Date();

  const total = useMemo(() => {
    return newItems.reduce((acc, item) => acc + (item.price * item.quantity), 0);
  }, [newItems]);

  return (
    <div className="order-ticket-container max-w-xs mx-auto text-xs" ref={ref}>
      <div className="text-center mb-2">
        <h2 className="text-2xl font-bold">Porosia</h2>
        <hr className="my-2 border-t border-dashed border-black" />
      </div>
      <div className="mt-8 mb-4">
        <p>
          Data: {now.toLocaleString(undefined, {
            year: 'numeric',
            month: '2-digit',
            day: '2-digit',
            hour: 'numeric',
            minute: '2-digit',
            hour12: true
          })}
        </p>
        {user && <p>Shfrytëzuesi: {user.username}</p>}
        <p>Tavolina: {table.name}</p>
      </div>
      <hr className="my-4 border-t border-dashed border-black" />
      <table className="w-full">
        <thead>
          <tr className="text-[10px] font-bold">
            <th className="text-left">Artikulli</th>
            <th className="text-center">Sasia</th>
            <th className="text-right">Çmimi</th>
            <th className="text-right">Totali</th>
          </tr>
        </thead>
        <tbody className="mt-2">
          {newItems.map((item, index) => (
            <tr key={`${item.id}-${index}`} className="text-xs font-bold">
              <td className="text-left whitespace-normal break-words max-w-[120px]">{item.name}</td>
              <td className="text-center">{item.quantity}</td>
              <td className="text-right">
                {(typeof item.price === 'string'
                  ? parseFloat(item.price)
                  : item.price
                ).toFixed(2)}
              </td>
              <td className="text-right">
                {(item.quantity *
                  (typeof item.price === 'string'
                    ? parseFloat(item.price)
                    : item.price)
                ).toFixed(2)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      <div className="mt-4">
        <hr className="my-4 border-t border-dashed border-black" />
      </div>
      <div className="flex justify-between font-bold text-xl mt-2">
        <span>Totali:</span>
        <span>{total.toFixed(2)} €</span>
      </div>
    </div>
  );
});

export default OrderTicket;