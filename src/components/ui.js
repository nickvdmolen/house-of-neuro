import React from 'react';

export function Card({ title, children, className = '' }) {
  return (
    <div className={`bg-white/95 backdrop-blur-sm rounded-lg shadow-lg p-4 ${className}`}>
      {title && <h2 className="text-lg font-semibold mb-4">{title}</h2>}
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
      className={`button ${disabled ? 'opacity-50 cursor-not-allowed' : ''} ${className}`}
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
}) {
  return (
    <input
      type={type}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      onKeyDown={onKeyDown}
      placeholder={placeholder}
      className={`w-full ${className}`}
    />
  );
}

export function Select({ value, onChange, children, className = '', multiple = false }) {
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
      className={`w-full ${className}`}
    >
      {children}
    </select>
  );
}
