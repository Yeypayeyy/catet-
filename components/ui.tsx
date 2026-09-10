"use client";

// Komponen dasar, diturunkan dari sistem desain Catet! (Fase 2.1).
//
// Gayanya ditulis sebagai inline style yang menunjuk ke CSS variable, persis
// seperti aslinya. Sengaja tidak diterjemahkan ke class Tailwind: yang ini
// sudah benar dan sudah teruji di kit desainnya, dan menerjemahkannya cuma
// menambah kesempatan salah tanpa menghasilkan apa-apa. Tailwind tetap dipakai
// untuk tata letak halaman.

import { useId, useState, type CSSProperties, type ReactNode } from "react";
import { Icon, type NamaIkon } from "@/components/Icon";
import { formatRupiah } from "@/lib/format";

/* ---------- Amount ---------- */

const UKURAN_NOMINAL = {
  xl: { fontSize: "var(--amount-xl-size)", lineHeight: "var(--amount-xl-line)", fontWeight: 600, letterSpacing: "var(--amount-xl-tracking)" },
  lg: { fontSize: "var(--amount-lg-size)", lineHeight: "var(--amount-lg-line)", fontWeight: 600, letterSpacing: "var(--amount-lg-tracking)" },
  md: { fontSize: "var(--amount-md-size)", lineHeight: "var(--amount-md-line)", fontWeight: 600, letterSpacing: "var(--amount-md-tracking)" },
  sm: { fontSize: "var(--amount-sm-size)", lineHeight: "var(--amount-sm-line)", fontWeight: 500, letterSpacing: 0 },
} as const;

/**
 * Nominal Rupiah. Pengeluaran netral tanpa minus, pemasukan hijau dengan "+".
 * Pada ukuran besar "Rp" mengecil dan meredup supaya angkanya yang menonjol.
 */
export function Amount({
  value,
  direction = "debit",
  size = "md",
  muted = false,
}: {
  value: bigint | number | string;
  direction?: "debit" | "credit";
  size?: keyof typeof UKURAN_NOMINAL;
  muted?: boolean;
}) {
  const teks = formatRupiah(value);
  const masuk = direction === "credit";
  const kecilkanPrefix = size === "xl" || size === "lg";
  const angka = teks.replace(/^−?Rp/, "");
  const tanda = teks.startsWith("−") ? "−" : masuk ? "+" : "";

  return (
    <span
      style={{
        fontFamily: "var(--font-sans)",
        fontVariantNumeric: "tabular-nums lining-nums",
        fontFeatureSettings: "var(--amount-features)",
        color: muted ? "var(--ink-2)" : masuk ? "var(--income)" : "var(--expense)",
        whiteSpace: "nowrap",
        ...UKURAN_NOMINAL[size],
      }}
    >
      {tanda}
      <span
        style={
          kecilkanPrefix
            ? {
                fontSize: "calc(1em * var(--amount-prefix-scale))",
                fontWeight: 500,
                color: muted ? "var(--ink-3)" : masuk ? "var(--income)" : "var(--ink-2)",
                marginRight: "0.08em",
                letterSpacing: 0,
              }
            : undefined
        }
      >
        Rp
      </span>
      {angka}
    </span>
  );
}

/* ---------- Button ---------- */

const VARIAN = {
  primary: { background: "var(--accent)", color: "var(--accent-fg)" },
  secondary: { background: "var(--surface)", color: "var(--ink)", borderColor: "var(--border-strong)" },
  ghost: { background: "transparent", color: "var(--ink-2)" },
  danger: { background: "transparent", color: "var(--danger)", borderColor: "var(--border)" },
} as const;

export function Button({
  variant = "primary",
  size = "md",
  full = false,
  disabled = false,
  icon,
  children,
  onClick,
  type = "button",
}: {
  variant?: keyof typeof VARIAN;
  size?: "md" | "sm";
  full?: boolean;
  disabled?: boolean;
  icon?: ReactNode;
  children?: ReactNode;
  onClick?: () => void;
  type?: "button" | "submit";
}) {
  const [ditekan, setDitekan] = useState(false);
  const [fokus, setFokus] = useState(false);

  return (
    <button
      type={type}
      disabled={disabled}
      onClick={onClick}
      onPointerDown={() => setDitekan(true)}
      onPointerUp={() => setDitekan(false)}
      onPointerLeave={() => setDitekan(false)}
      onFocus={() => setFokus(true)}
      onBlur={() => setFokus(false)}
      style={{
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        gap: "var(--space-2)",
        height: size === "sm" ? "var(--control-h-sm)" : "var(--control-h)",
        padding: size === "sm" ? "0 var(--space-3)" : "0 var(--space-5)",
        fontSize: size === "sm" ? "var(--text-label-size)" : "var(--text-body-size)",
        lineHeight: "var(--text-body-line)",
        fontWeight: 500,
        borderRadius: "var(--radius-md)",
        border: "1px solid transparent",
        cursor: disabled ? "default" : "pointer",
        userSelect: "none",
        whiteSpace: "nowrap",
        outline: "none",
        WebkitTapHighlightColor: "transparent",
        transition:
          "background var(--duration-fast) var(--ease-out), transform var(--duration-fast) var(--ease-out)",
        ...VARIAN[variant],
        ...(full ? { width: "100%" } : null),
        ...(ditekan && !disabled
          ? {
              background: variant === "primary" ? "var(--accent-hover)" : "var(--surface-pressed)",
              transform: "scale(0.96)",
            }
          : null),
        ...(fokus ? { boxShadow: "0 0 0 3px var(--focus-ring)" } : null),
        ...(disabled ? { opacity: 0.4 } : null),
      }}
    >
      {icon}
      {children}
    </button>
  );
}

/* ---------- Chip kategori ---------- */

export function CategoryChip({
  label,
  selected = false,
  suggested = false,
  count,
  onSelect,
  disabled = false,
}: {
  label: string;
  selected?: boolean;
  suggested?: boolean;
  count?: number;
  onSelect?: () => void;
  disabled?: boolean;
}) {
  const [ditekan, setDitekan] = useState(false);

  return (
    <button
      type="button"
      aria-pressed={selected}
      disabled={disabled}
      onClick={onSelect}
      onPointerDown={() => setDitekan(true)}
      onPointerUp={() => setDitekan(false)}
      onPointerLeave={() => setDitekan(false)}
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: "var(--space-2)",
        height: "var(--chip-h)",
        padding: "0 var(--space-4)",
        borderRadius: "var(--radius-full)",
        background: selected ? "var(--accent)" : ditekan ? "var(--accent-soft)" : "var(--surface-2)",
        color: selected ? "var(--accent-fg)" : "var(--ink)",
        border: `1px solid ${selected ? "var(--accent)" : suggested ? "var(--border-strong)" : "var(--border)"}`,
        fontSize: "var(--text-body-size)",
        lineHeight: "var(--text-body-line)",
        fontWeight: 500,
        cursor: disabled ? "default" : "pointer",
        opacity: disabled ? 0.4 : 1,
        whiteSpace: "nowrap",
        userSelect: "none",
        outline: "none",
        WebkitTapHighlightColor: "transparent",
        transform: ditekan && !disabled ? "scale(0.95)" : "none",
        transition:
          "background var(--duration-fast) var(--ease-out), transform var(--duration-fast) var(--ease-out)",
      }}
    >
      {label}
      {count != null ? (
        <span
          style={{
            fontVariantNumeric: "tabular-nums",
            color: selected ? "var(--accent-fg)" : "var(--ink-3)",
            fontWeight: 400,
          }}
        >
          {count}
        </span>
      ) : null}
    </button>
  );
}

/** Baris chip yang menggulir mendatar kalau tidak muat. */
export function ChipRow({ children, style }: { children: ReactNode; style?: CSSProperties }) {
  return (
    <div
      style={{
        display: "flex",
        gap: "var(--space-2)",
        flexWrap: "nowrap",
        overflowX: "auto",
        scrollbarWidth: "none",
        ...style,
      }}
    >
      {children}
    </div>
  );
}

/* ---------- Input ---------- */

export function Input({
  label,
  hint,
  error,
  amount = false,
  prefix,
  suffix,
  value,
  onChange,
  placeholder,
  type = "text",
}: {
  label?: string;
  hint?: string;
  error?: string;
  amount?: boolean;
  prefix?: string;
  suffix?: string;
  value?: string;
  onChange?: (nilai: string) => void;
  placeholder?: string;
  type?: string;
}) {
  const [fokus, setFokus] = useState(false);
  const id = useId();
  const warnaGaris = error ? "var(--danger)" : fokus ? "var(--accent)" : "var(--border)";

  return (
    <label htmlFor={id} style={{ display: "flex", flexDirection: "column", gap: "var(--space-1)" }}>
      {label ? (
        <span
          style={{
            fontSize: "var(--text-label-size)",
            lineHeight: "var(--text-label-line)",
            fontWeight: 500,
            color: "var(--ink-2)",
          }}
        >
          {label}
        </span>
      ) : null}
      <span
        style={{
          display: "flex",
          alignItems: "center",
          gap: "var(--space-2)",
          minHeight: amount ? 60 : "var(--control-h)",
          padding: "0 var(--space-4)",
          background: "var(--surface-2)",
          border: `1px solid ${warnaGaris}`,
          borderRadius: "var(--radius-md)",
          boxShadow: fokus ? "0 0 0 3px var(--focus-ring)" : "none",
          transition: "border-color var(--duration-fast), box-shadow var(--duration-fast)",
        }}
      >
        {prefix || amount ? (
          <span style={{ color: "var(--ink-3)", fontWeight: 500 }}>{prefix ?? "Rp"}</span>
        ) : null}
        <input
          id={id}
          type={type}
          value={value}
          placeholder={placeholder}
          inputMode={amount ? "numeric" : undefined}
          onChange={(e) => onChange?.(e.target.value)}
          onFocus={() => setFokus(true)}
          onBlur={() => setFokus(false)}
          style={{
            flex: 1,
            minWidth: 0,
            background: "transparent",
            border: 0,
            outline: "none",
            padding: 0,
            color: "var(--ink)",
            fontSize: amount ? "var(--amount-lg-size)" : "var(--text-body-size)",
            lineHeight: amount ? "var(--amount-lg-line)" : "var(--text-body-line)",
            fontWeight: amount ? 600 : 400,
            letterSpacing: amount ? "var(--amount-lg-tracking)" : 0,
            fontVariantNumeric: "tabular-nums lining-nums",
          }}
        />
        {suffix ? (
          <span style={{ color: "var(--ink-3)", fontSize: "var(--text-label-size)" }}>{suffix}</span>
        ) : null}
      </span>
      {error || hint ? (
        <span
          style={{
            fontSize: "var(--text-caption-size)",
            lineHeight: "var(--text-caption-line)",
            color: error ? "var(--danger)" : "var(--ink-3)",
          }}
        >
          {error ?? hint}
        </span>
      ) : null}
    </label>
  );
}

/* ---------- Empty state ---------- */

/** Kondisi kosong di app ini adalah kabar baik, jadi nadanya tenang. */
export function EmptyState({
  icon = "kotak-masuk",
  title,
  description,
  action,
  compact = false,
}: {
  icon?: NamaIkon;
  title: string;
  description?: string;
  action?: ReactNode;
  compact?: boolean;
}) {
  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        textAlign: "center",
        gap: "var(--space-3)",
        padding: compact ? "var(--space-8) var(--space-4)" : "var(--space-12) var(--space-6)",
        color: "var(--ink)",
      }}
    >
      <span
        style={{
          width: 56,
          height: 56,
          borderRadius: "var(--radius-full)",
          background: "var(--accent-soft)",
          display: "inline-flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <Icon name={icon} size={26} color="var(--accent)" />
      </span>
      <div
        style={{
          fontSize: "var(--text-body-size)",
          lineHeight: "var(--text-body-line)",
          fontWeight: 500,
          maxWidth: 280,
        }}
      >
        {title}
      </div>
      {description ? (
        <div
          style={{
            fontSize: "var(--text-label-size)",
            lineHeight: "var(--text-label-line)",
            color: "var(--ink-3)",
            maxWidth: 280,
          }}
        >
          {description}
        </div>
      ) : null}
      {action ? <div style={{ marginTop: "var(--space-3)" }}>{action}</div> : null}
    </div>
  );
}

/* ---------- Banner peringatan ---------- */

/**
 * Satu-satunya tempat warna kuning muncul. Dipakai untuk device yang lama
 * tidak mengirim, outbox menumpuk, dan DLQ yang tidak kosong.
 */
export function WarningBanner({
  tone = "warning",
  title,
  description,
  action,
  onDismiss,
}: {
  tone?: "warning" | "danger";
  title: string;
  description?: string;
  action?: ReactNode;
  onDismiss?: () => void;
}) {
  const bahaya = tone === "danger";
  const fg = bahaya ? "var(--danger)" : "var(--warning-fg)";

  return (
    <div
      role="status"
      style={{
        display: "flex",
        alignItems: "flex-start",
        gap: "var(--space-3)",
        padding: "var(--space-4)",
        borderRadius: "var(--radius-lg)",
        background: bahaya ? "var(--danger-bg)" : "var(--warning-bg)",
        border: `1px solid ${bahaya ? "var(--danger)" : "var(--warning-border)"}`,
        color: fg,
      }}
    >
      <Icon
        name="peringatan"
        size={20}
        color={bahaya ? "var(--danger)" : "var(--warning)"}
        style={{ marginTop: 1 }}
      />
      <div style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column", gap: 2 }}>
        <div
          style={{
            fontSize: "var(--text-label-size)",
            lineHeight: "var(--text-label-line)",
            fontWeight: 600,
          }}
        >
          {title}
        </div>
        {description ? (
          <div
            style={{
              fontSize: "var(--text-label-size)",
              lineHeight: "var(--text-label-line)",
              opacity: 0.9,
            }}
          >
            {description}
          </div>
        ) : null}
        {action ? (
          <div style={{ marginTop: "var(--space-2)", display: "flex", gap: "var(--space-2)" }}>
            {action}
          </div>
        ) : null}
      </div>
      {onDismiss ? (
        <button
          type="button"
          aria-label="Tutup"
          onClick={onDismiss}
          style={{
            background: "transparent",
            border: 0,
            padding: 0,
            width: 28,
            height: 28,
            display: "inline-flex",
            alignItems: "center",
            justifyContent: "center",
            color: fg,
            cursor: "pointer",
            borderRadius: "var(--radius-sm)",
          }}
        >
          <Icon name="silang" size={16} />
        </button>
      ) : null}
    </div>
  );
}
