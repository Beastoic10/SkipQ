'use client';

import { useEffect } from 'react';
import Clarity from '@microsoft/clarity';

/**
 * Initialises Microsoft Clarity once when the app first mounts in the browser.
 * Rendered inside the root layout so every route (customer, admin, terminal)
 * is automatically tracked — no per-page wiring needed.
 *
 * The project ID is read from the NEXT_PUBLIC_CLARITY_PROJECT_ID env var so
 * no secret is hard-coded or committed. If the var is absent (e.g. in CI
 * without env secrets) the component silently does nothing.
 */
export default function ClarityProvider() {
  useEffect(() => {
    const projectId = process.env.NEXT_PUBLIC_CLARITY_PROJECT_ID;
    if (!projectId) return;

    Clarity.init(projectId);
  }, []); // empty dep-array → runs exactly once per page-load

  return null; // renders no DOM nodes
}
