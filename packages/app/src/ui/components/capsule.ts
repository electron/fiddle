import { createContext, useContext } from 'react';

/** True inside a ToolbarCapsule, where controls turn into 30px capsules. */
export const CapsuleContext = createContext(false);

export function useInCapsule(): boolean {
  return useContext(CapsuleContext);
}
