/* Entry for a standalone gallery build. ?theme=light|dark and ?material=none set the start state. */
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import '../global.css';
import { Gallery } from './Gallery';

const params = new URLSearchParams(window.location.search);

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <Gallery
      initialAppearance={params.get('theme') === 'light' ? 'light' : 'dark'}
      initialNoMaterial={params.get('material') === 'none'}
    />
  </StrictMode>,
);
