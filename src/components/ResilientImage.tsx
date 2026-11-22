import React, { useState } from 'react';

interface ResilientImageProps {
  src: string;
  alt: string;
  className?: string;
  fallbackLabel?: string;
}

export const ResilientImage: React.FC<ResilientImageProps> = ({
  src,
  alt,
  className = '',
  fallbackLabel = 'SHONGI Sanctuary',
}) => {
  const [failed, setFailed] = useState(false);

  if (failed) {
    return (
      <div
        role="img"
        aria-label={alt}
        className={`flex flex-col items-center justify-center bg-gradient-to-br from-[#F1EAE1] via-[#FAF7F2] to-[#E3D9CD] text-[#2F6F63] p-4 text-center ${className}`}
      >
        <span className="material-symbols-outlined text-3xl mb-1.5 opacity-80">spa</span>
        <span className="text-xs font-medium text-[#6B6B66]">{fallbackLabel}</span>
      </div>
    );
  }

  return (
    <img
      src={src}
      alt={alt}
      referrerPolicy="no-referrer"
      onError={() => setFailed(true)}
      className={className}
    />
  );
};
