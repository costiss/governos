import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

/**
 * Merge conditional class names, de-duplicating conflicting Tailwind utilities.
 * Every styled component in the app funnels through here so variants compose.
 */
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}
