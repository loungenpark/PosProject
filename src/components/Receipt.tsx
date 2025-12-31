import React from 'react';
import { useTranslation } from 'react-i18next'; // LEFT: Import translation hook
import { Sale } from '../types';

const formatCurrency = (amount: number) => {
  return new Intl.NumberFormat('de-DE', { style: 'currency', currency: 'EUR' }).format(amount);
};

const Receipt: React.FC<{ sale: Sale }> = ({ sale }) => {
  const { t } = useTranslation(); // LEFT: Init translation

  return (
    <div className="receipt-container max-w-xs mx-auto text-xs">
      <div className="text-center mb-2">
        <h2 className="text-2xl font-bold">{t('receipt.title')}</h2>
        <hr className="my-2 border-t border-dashed border-black" />
      </div>
      <div className="mt-8 mb-2">
        <p>
          {t('ticket.date')}: {new Date(sale.date).toLocaleString(undefined, {
            year: 'numeric',
            month: '2-digit',
            day: '2-digit',
            hour: 'numeric',
            minute: '2-digit',
            hour12: true
          })}
        </p>
        <p>{t('ticket.user')}: {sale.user.username}</p>
        <p>{t('ticket.table')}: {sale.tableName}</p>
      </div>
      <hr className="my-2 border-t border-dashed border-black" />
      <table className="w-full">
        <thead>
          <tr className="text-[10px] font-bold">
            <th className="text-left">{t('ticket.item')}</th>
            <th className="text-center">{t('ticket.quantity')}</th>
            <th className="text-right">{t('ticket.price')}</th>
            <th className="text-right">{t('ticket.total')}</th>
          </tr>
        </thead>
        <tbody className="mt-1">
          {sale.order.items.map((item) => (
            <tr key={item.id} className="text-xs font-bold">
              <td className="text-left whitespace-normal break-words max-w-[120px]">
                {item.name}
              </td>
              <td className="text-center">{item.quantity}</td>
              <td className="text-right">
                {(
                  typeof item.price === 'string'
                    ? parseFloat(item.price)
                    : item.price
                ).toFixed(2)}
              </td>
              <td className="text-right">
                {(
                  item.quantity *
                  (typeof item.price === 'string'
                    ? parseFloat(item.price)
                    : item.price)
                ).toFixed(2)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      <div className="mt-2">
        <hr className="my-2 border-t border-dashed border-black" />
      </div>
      <div className="space-y-2">
        {sale.order.tax > 0 ? (
          <>
            <div className="flex justify-between">
              <span>{t('receipt.subtotal')}:</span>
              <span>{formatCurrency(sale.order.subtotal)}</span>
            </div>
            <div className="flex justify-between">
              <span>{t('receipt.tax')}:</span>
              <span>{formatCurrency(sale.order.tax)}</span>
            </div>
          </>
        ) : null}
        <div className="flex justify-between font-bold text-xl mt-1">
          <span>{t('ticket.total')}:</span>
          <span>{formatCurrency(sale.order.total)}</span>
        </div>
      </div>
      <div className="mt-10">
        <hr className="my-2 border-t border-dashed border-black" />
      </div>
      <div className="text-center mt-4">
        <p>{t('receipt.thank_you')}</p>
        <p>{t('receipt.come_again')}</p>
      </div>
    </div>
  );
};

export default Receipt;