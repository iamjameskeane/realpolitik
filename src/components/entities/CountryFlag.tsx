/**
 * Country flag component using CDN-hosted flag images
 * Works reliably across all platforms including Windows
 */

"use client";

import { getCountryCode, getFlagUrl, getEntityIcon } from "@/lib/entities";

interface CountryFlagProps {
  countryName: string;
  size?: number;
  className?: string;
}

export function CountryFlag({ countryName, size = 24, className = "" }: CountryFlagProps) {
  const countryCode = getCountryCode(countryName);

  if (!countryCode) {
    // Fallback to globe emoji if country not recognized
    return <span className={className}>{getEntityIcon("country")}</span>;
  }

  return (
    <img
      src={getFlagUrl(countryCode, size * 2)} // 2x for retina
      alt={`${countryName} flag`}
      width={size}
      height={Math.round(size * 0.75)} // Flags are typically 4:3 aspect ratio
      className={`inline-block object-contain ${className}`}
      style={{ width: size, height: "auto" }}
      loading="lazy"
    />
  );
}
