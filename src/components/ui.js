import React from 'react';

export function Card({ title, children, className = '' }) {
  return (
    <div className={`rounded-2xl shadow p-4 bg-white ${className}`}>
      {title && <h3 className="text-lg font-semibold mb-3">{title}</h3>}
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
      className={`rounded-2xl shadow px-4 py-2 hover:opacity-90 active:scale-[0.99] transition border border-neutral-200 ${disabled ? 'opacity-50 cursor-not-allowed' : ''} ${className}`}
    >
      {children}
    </button>
  );
}

export function TextInput({ value, onChange, placeholder, className = '' }) {
  return (
    <input
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      className={`w-full rounded-xl border border-neutral-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-200 ${className}`}
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
      className={`w-full rounded-xl border border-neutral-300 px-3 py-2 bg-white ${className}`}
    >
      {children}
    </select>
  );
}
