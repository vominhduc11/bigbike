export type PasswordStrength = "empty" | "weak" | "fair" | "good" | "strong";

export function getPasswordStrength(password: string): PasswordStrength {
  if (!password) return "empty";

  let score = 0;
  if (password.length >= 8) score += 1;
  if (password.length >= 12) score += 1;
  if (/[a-z]/.test(password) && /[A-Z]/.test(password)) score += 1;
  if (/\d/.test(password)) score += 1;
  if (/[^A-Za-z0-9]/.test(password)) score += 1;

  if (score <= 1) return "weak";
  if (score === 2) return "fair";
  if (score === 3) return "good";
  return "strong";
}

const filledSegments: Record<PasswordStrength, number> = {
  empty: 0,
  weak: 1,
  fair: 2,
  good: 3,
  strong: 4,
};

const segmentColor: Record<Exclude<PasswordStrength, "empty">, string> = {
  weak: "bg-destructive",
  fair: "bg-state-warning",
  good: "bg-blue",
  strong: "bg-success",
};

export function PasswordStrengthMeter({
  password,
  label,
  labels,
  compact = false,
}: {
  password: string;
  label: string;
  labels: Record<PasswordStrength, string>;
  compact?: boolean;
}) {
  const strength = getPasswordStrength(password);
  const filled = filledSegments[strength];
  const color = strength === "empty" ? "bg-border" : segmentColor[strength];

  return (
    <output
      data-password-strength={strength}
      aria-live="polite"
      className={
        compact
          ? "mb-1 block text-a5-meta text-muted-foreground md:mb-5 lg:mb-3"
          : "mb-5 block text-a5-meta text-muted-foreground"
      }
    >
      <span className="flex items-center justify-between gap-3">
        <span>{label}</span>
        <span className="font-semibold text-foreground">{labels[strength]}</span>
      </span>
      <span className="mt-1 grid grid-cols-4 gap-1 md:mt-2" aria-hidden="true">
        {Array.from({ length: 4 }, (_, index) => (
          <span key={index} className={index < filled ? `h-1 ${color}` : "h-1 bg-border"} />
        ))}
      </span>
    </output>
  );
}
