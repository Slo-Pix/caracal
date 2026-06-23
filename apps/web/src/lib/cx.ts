/*
Copyright (C) 2026 Garudex Labs.  All Rights Reserved.
Caracal, a product of Garudex Labs

This file provides a small class-name joining helper.
*/
export function cx(...parts: Array<string | false | null | undefined>): string {
  return parts.filter(Boolean).join(" ");
}
