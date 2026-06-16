import React from 'react';
import { renderToString } from 'react-dom/server';
import StockModule from './src/features/StockModule.jsx';
import { PanelProvider } from './src/context/PanelContext.jsx';

try {
  const html = renderToString(
    <PanelProvider>
      <StockModule />
    </PanelProvider>
  );
  console.log("RENDER SUCCESS!");
} catch (err) {
  console.error("RENDER ERROR:", err);
}
