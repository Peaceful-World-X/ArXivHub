import { twMerge } from "tailwind-merge";

export function cn(
  ...inputs: Array<string | false | null | undefined | 0>
): string {
  return twMerge(inputs.filter(Boolean).join(" "));
}
