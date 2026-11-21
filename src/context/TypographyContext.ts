import { createContext, useContext } from 'react';

/** Informa se as fontes locais estão prontas; false usa a tipografia nativa. */
export const TypographyContext = createContext(false);
export const usePrototypeFonts = () => useContext(TypographyContext);
