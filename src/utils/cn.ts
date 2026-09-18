import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

/** Merge conditional class names, resolving Tailwind conflicts (last wins). */
export const cn = (...inputs: ClassValue[]) => twMerge(clsx(inputs));
