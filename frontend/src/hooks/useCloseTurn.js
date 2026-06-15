import { useState, useCallback, useRef } from 'react';

export default function useCloseTurn(todaySalesTotal) {
  const [isClosingCaja, setIsClosingCaja] = useState(false);
  const [closeCajaPin, setCloseCajaPin] = useState('');
  const [countedCash, setCountedCash] = useState('');
  const cashRef = useRef(null);

  const calculateCajaDiff = useCallback(() => {
    const counted = parseFloat(countedCash) || 0;
    return counted - (todaySalesTotal || 0);
  }, [countedCash, todaySalesTotal]);

  const resetCloseTurn = useCallback(() => {
    setIsClosingCaja(false);
    setCountedCash('');
    setCloseCajaPin('');
  }, []);

  return {
    isClosingCaja, setIsClosingCaja,
    closeCajaPin, setCloseCajaPin,
    countedCash, setCountedCash,
    cashRef,
    calculateCajaDiff,
    resetCloseTurn,
  };
}
