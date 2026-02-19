import React from "react";

export function Tabs(props: {
  value: string;
  onChange: (v: string) => void;
  items: { key: string; label: string; disabled?: boolean; title?: string }[];
}) {
  const { value, onChange, items } = props;

  return (
    <div className="mt-4 flex gap-2 flex-wrap">
      {items.map((it) => (
        <button
          key={it.key}
          className={`rounded-lg px-3 py-2 text-sm border ${
            value === it.key ? "bg-black text-white border-black" : "bg-white border-gray-300 hover:bg-gray-50"
          } ${it.disabled ? "opacity-50" : ""}`}
          onClick={() => !it.disabled && onChange(it.key)}
          disabled={!!it.disabled}
          title={it.title || ""}
        >
          {it.label}
        </button>
      ))}
    </div>
  );
}
