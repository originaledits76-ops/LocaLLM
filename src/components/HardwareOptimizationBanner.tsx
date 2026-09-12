/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { Zap, AlertTriangle, X } from 'lucide-react';
import { isWebGpuSupported } from '../services/webllmRunner';

export const HardwareOptimizationBanner: React.FC = () => {
  const [hasWebGpu, setHasWebGpu] = useState<boolean | null>(null);
  const [isDismissed, setIsDismissed] = useState(false);

  useEffect(() => {
    isWebGpuSupported().then((supported) => {
      setHasWebGpu(supported);
    });
  }, []);

  if (hasWebGpu === null || isDismissed) {
    return null;
  }

  return (
    <div
      className={`px-3 py-2 border-b text-xs transition-colors flex items-center justify-between gap-2 ${
        hasWebGpu
          ? 'bg-emerald-50/90 border-emerald-200/80 text-emerald-900'
          : 'bg-amber-50/95 border-amber-200 text-amber-950'
      }`}
    >
      <div className="flex items-center gap-2 max-w-4xl mx-auto w-full">
        {hasWebGpu ? (
          <Zap className="w-4 h-4 text-emerald-600 shrink-0" />
        ) : (
          <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
        )}

        <div className="flex-1 truncate">
          {hasWebGpu ? (
            <span>
              <strong className="font-semibold">Hardware GPU Acceleration Active:</strong> High-speed local inference enabled.
            </span>
          ) : (
            <span>
              <strong className="font-semibold">Standard CPU Mode:</strong> Running on device CPU processor.
            </span>
          )}
        </div>

        <button
          type="button"
          onClick={() => setIsDismissed(true)}
          className="p-1 hover:bg-black/5 rounded-md shrink-0 ml-1 text-zinc-500"
          title="Dismiss notification"
          aria-label="Dismiss notification"
        >
          <X className="w-3.5 h-3.5" />
        </button>
      </div>
    </div>
  );
};

