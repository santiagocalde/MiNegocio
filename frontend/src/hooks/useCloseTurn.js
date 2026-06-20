import { useState, useCallback, useRef } from 'react';

export default function useCloseTurn(resumenData, initialCash = 0) {
  const [isClosingCaja, setIsClosingCaja] = useState(false);
  const [closeCajaPin, setCloseCajaPin] = useState('');
  const [countedCash, setCountedCash] = useState('');
  const cashRef = useRef(null);

  const calculateCajaDiff = useCallback(() => {
    const counted = parseFloat(countedCash) || 0;
    const totalEfectivo = resumenData?.total_efectivo || 0;
    return counted - totalEfectivo - (initialCash || 0);
  }, [countedCash, resumenData, initialCash]);

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
