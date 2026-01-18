import React from 'react';

export function Card({ title, children, className = '' }) {
  return (
    <div className={`bg-white/75 backdrop-blur-sm rounded-lg shadow-lg p-3 sm:p-4 ${className}`}>
      {title && <h2 className="text-base sm:text-lg font-semibold mb-3 sm:mb-4">{title}</h2>}
      {children}
    </div>
  );
}

export function Button({ children, onClick, type = 'button', className = '', disabled = false }) {
  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled}
      className={`button text-sm sm:text-base ${disabled ? 'opacity-50 cursor-not-allowed' : ''} ${className}`}
    >
      {children}
    </button>
  );
}

export function TextInput({
  value,
  onChange,
  placeholder,
  type = 'text',
  className = '',
  onKeyDown,
  disabled = false,
}) {
  return (
    <input
      type={type}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      onKeyDown={onKeyDown}
      placeholder={placeholder}
      disabled={disabled}
      className={`w-full text-base ${disabled ? 'opacity-60 cursor-not-allowed' : ''} ${className}`}
    />
  );
}

export function Select({
  value,
  onChange,
  children,
  className = '',
  multiple = false,
  disabled = false,
}) {
  return (
    <select
      multiple={multiple}
      value={value}
      onChange={(e) => {
        if (multiple) {
          const vals = Array.from(e.target.selectedOptions).map((o) => o.value);
          onChange(vals);
        } else {
          onChange(e.target.value);
        }
      }}
      disabled={disabled}
      className={`w-full text-base ${disabled ? 'opacity-60 cursor-not-allowed' : ''} ${className}`}
    >
      {children}
    </select>
  );
}
