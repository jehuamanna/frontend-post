import clsx from 'clsx';
import { twMerge } from 'tailwind-merge';

export const cn = (...inputs: (string | undefined | null | boolean | Record<string, unknown>)[]) =>
  twMerge(clsx(inputs));
