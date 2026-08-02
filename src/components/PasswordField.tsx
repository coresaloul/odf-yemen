import { useMemo, useState } from "react";
import { Eye, EyeOff, RefreshCw } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const ALPHABET = "abcdefghijkmnopqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789!@#$%*?-_";

export function generatePassword(length = 14) {
  const bytes = new Uint32Array(length);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => ALPHABET[b % ALPHABET.length]).join("");
}

type Strength = { score: 0 | 1 | 2 | 3 | 4; label: string; className: string };

export function passwordStrength(value: string): Strength {
  let score = 0;
  if (value.length >= 6) score++;
  if (value.length >= 10) score++;
  if (/[a-z]/.test(value) && /[A-Z]/.test(value)) score++;
  if (/\d/.test(value)) score++;
  if (/[^A-Za-z0-9]/.test(value)) score++;
  if (value.length < 4) score = Math.min(score, 1);
  const s = Math.min(score, 4) as Strength["score"];
  const labels = ["ضعيفة جداً", "ضعيفة", "متوسطة", "جيدة", "قوية"];
  const classes = [
    "bg-destructive",
    "bg-destructive",
    "bg-amber-500",
    "bg-emerald-500",
    "bg-emerald-600",
  ];
  return { score: s, label: labels[s]!, className: classes[s]! };
}

type Props = {
  id: string;
  label?: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  autoComplete?: string;
  required?: boolean;
  showGenerator?: boolean;
  showMeter?: boolean;
  hint?: string;
};

export function PasswordField({
  id,
  label = "كلمة المرور",
  value,
  onChange,
  placeholder = "••••••••",
  autoComplete = "new-password",
  required,
  showGenerator = true,
  showMeter = true,
  hint = "أي رقم أو نص مقبول — القياس إرشادي فقط.",
}: Props) {
  const [visible, setVisible] = useState(false);
  const strength = useMemo(() => passwordStrength(value), [value]);

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between gap-2">
        <Label htmlFor={id}>{label}</Label>
        {showGenerator && (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="h-7 gap-1 px-2 text-xs"
            onClick={() => {
              onChange(generatePassword());
              setVisible(true);
            }}
          >
            <RefreshCw className="size-3" /> توليد كلمة مرور
          </Button>
        )}
      </div>
      <div className="relative">
        <Input
          id={id}
          dir="ltr"
          type={visible ? "text" : "password"}
          value={value}
          required={required}
          autoComplete={autoComplete}
          placeholder={placeholder}
          onChange={(e) => onChange(e.target.value)}
          className="pl-10"
        />
        <button
          type="button"
          aria-label={visible ? "إخفاء كلمة المرور" : "إظهار كلمة المرور"}
          onClick={() => setVisible((v) => !v)}
          className="absolute inset-y-0 left-0 flex w-10 items-center justify-center text-muted-foreground hover:text-foreground"
        >
          {visible ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
        </button>
      </div>
      {showMeter && (
        <div className="space-y-1">
          <div className="flex gap-1">
            {[0, 1, 2, 3].map((i) => (
              <span
                key={i}
                className={cn(
                  "h-1.5 flex-1 rounded-full",
                  value && strength.score > i ? strength.className : "bg-muted",
                )}
              />
            ))}
          </div>
          <p className="text-xs text-muted-foreground">
            {value ? `قوة كلمة المرور: ${strength.label}` : hint}
          </p>
        </div>
      )}
    </div>
  );
}
