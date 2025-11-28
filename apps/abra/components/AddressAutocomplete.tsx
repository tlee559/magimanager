"use client";

import { useState } from "react";

interface AddressAutocompleteProps {
  onAddressSelect: (components: {
    address: string;
    city: string;
    state: string;
    zipcode: string;
    country: string;
  }) => void;
  defaultValue?: string;
  placeholder?: string;
  className?: string;
  name?: string;
  required?: boolean;
}

/**
 * Simple address input component
 * Google Places Autocomplete API was deprecated for new customers March 2025
 * This provides a clean manual entry experience
 */
export function AddressAutocomplete({
  defaultValue = "",
  placeholder = "Enter street address",
  className = "",
  name = "address",
  required = false,
}: AddressAutocompleteProps) {
  const [inputValue, setInputValue] = useState(defaultValue);

  return (
    <input
      type="text"
      name={name}
      value={inputValue}
      onChange={(e) => setInputValue(e.target.value)}
      placeholder={placeholder}
      required={required}
      className={className}
      autoComplete="street-address"
    />
  );
}
