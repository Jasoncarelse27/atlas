import React from 'react';

interface AtlasLogoProps {
  className?: string;
  size?: number;
}

/**
 * Atlas Logo - Brain/Heart Icon
 * Matches the official Atlas logo design:
 * - Outer brain/cloud shape: Light peachy-pink fill (#F3D3B8 - atlas-peach) with dark brownish-grey stroke (#5A524A)
 * - Inner heart: Dark brownish-grey fill (#5A524A - atlas-text-medium)
 */
const AtlasLogo: React.FC<AtlasLogoProps> = ({ className = '', size = 120 }) => {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 120 120"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
    >
      {/* Outer brain/cloud shape - light peachy-pink fill, dark brownish-grey stroke */}
      {/* Left lobe */}
      <path
        d="M60 18C48 18 38 24 32 32C28 28 23 26 18 28C13 30 10 35 11 40C9 42 8 45 9 48C8 52 10 56 13 58C15 60 17 62 19 64C21 66 22 68 23 70C24 72 25 74 27 76C29 78 31 79 33 80C35 81 37 81 39 81C41 81 43 81 45 80C47 79 49 78 51 76C53 74 54 72 55 70C56 68 57 66 59 64C61 62 63 60 65 58C68 56 70 52 69 48C70 45 69 42 67 40C70 35 68 30 65 28C62 26 57 28 53 32C48 24 38 18 28 18Z"
        fill="#F3D3B8"
        stroke="#5A524A"
        strokeWidth="3.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      {/* Right lobe */}
      <path
        d="M60 18C72 18 82 24 88 32C92 28 97 26 102 28C107 30 110 35 109 40C111 42 112 45 111 48C112 52 110 56 107 58C105 60 103 62 101 64C99 66 98 68 97 70C96 72 95 74 93 76C91 78 89 79 87 80C85 81 83 81 81 81C79 81 77 81 75 80C73 79 71 78 69 76C67 74 66 72 65 70C64 68 63 66 61 64C59 62 57 60 55 58C52 56 50 52 51 48C50 45 51 42 53 40C50 35 52 30 55 28C58 26 63 28 67 32C72 24 82 18 92 18Z"
        fill="#F3D3B8"
        stroke="#5A524A"
        strokeWidth="3.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      {/* Inner heart - dark brownish-grey fill, perfectly centered */}
      <path
        d="M60 48C58 46 55 43 52 43C48 43 45 46 45 50C45 53 47 56 50 58L60 68L70 58C73 56 75 53 75 50C75 46 72 43 68 43C65 43 62 46 60 48Z"
        fill="#5A524A"
      />
    </svg>
  );
};

export default AtlasLogo;

