import React from 'react';
import { Sale } from '../types';

const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('de-DE', { style: 'currency', currency: 'EUR' }).format(amount);
};

const Receipt: React.FC<{ sale: Sale }> = ({ sale }) => {
  return (
    <div className="receipt-container">
      <div className="text-center">
        <h2 className="text-lg font-bold">Fatura</h2>
        <p>123 Pizza Lane, Food City</p>
        <p>Tel: (123) 456-7890</p>
        <hr className="my-2 border-t border-dashed border-black" />
      </div>
      <div>
        <p>ID e Shitjes: {sale.id}</p>
        <p>Data: {new Date(sale.date).toLocaleString()}</p>
        <p>Arkëtari: {sale.user.username}</p>
        <p>Tavolina: {sale.tableName}</p>
      </div>
      <hr className="my-2 border-t border-dashed border-black" />
      <table className="w-full">
        <thead>
          <tr>
            <th className="text-left">Artikulli</th>
            <th className="text-center">Sasia</th>
            <th className="text-right">Çmimi</th>
            <th className="text-right">Totali</th>
          </tr>
        </thead>
        <tbody>
          {sale.order.items.map((item) => (
            <tr key={item.id}>
              <td className="text-left">{item.name}</td>
              <td className="text-center">{item.quantity}</td>
              <td className="text-right">{parseFloat(item.price).toFixed(2)}</td>
              <td className="text-right">{(item.quantity * parseFloat(item.price)).toFixed(2)}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <hr className="my-2 border-t border-dashed border-black" />
      <div className="space-y-1">
        {sale.order.tax > 0 ? (
          <>
            <div className="flex justify-between">
              <span>Nëntotali:</span>
              <span>{formatCurrency(sale.order.subtotal)}</span>
            </div>
            <div className="flex justify-between">
              <span>Tatimi:</span>
              <span>{formatCurrency(sale.order.tax)}</span>
            </div>
          </>
        ) : null}
        <div className="flex justify-between font-bold text-sm">
          <span>Totali:</span>
          <span>{formatCurrency(sale.order.total)}</span>
        </div>
      </div>
      <hr className="my-2 border-t border-dashed border-black" />
      <div className="text-center mt-4">
        <p>Faleminderit për vizitën!</p>
        <p>Ju lutemi, na vizitoni përsëri.</p>
      </div>
    </div>
  );
};

export default Receipt;