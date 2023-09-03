import { useId } from "react";
import { Input } from "./ui/input";
import { Label } from "./ui/label";

export function Field({
  inputProps = {},
  labelProps,
  name,
  error,
}: {
  labelProps: React.LabelHTMLAttributes<HTMLLabelElement>;
  inputProps: Omit<React.InputHTMLAttributes<HTMLInputElement>, "name">;
  name: string;
  error?: string;
}) {
  const id = useId();

  return (
    <div className="flex flex-col gap-y-2">
      <Label htmlFor={id} {...labelProps} />
      <Input id={id} {...inputProps} name={name} />
      <p className="text-sm text-destructive">{error}</p>
    </div>
  );
}
