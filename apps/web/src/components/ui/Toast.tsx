/*
Copyright (C) 2026 Garudex Labs.  All Rights Reserved.
Caracal, a product of Garudex Labs

This file provides the toast provider whose messages are stored in the navbar notifications center.
*/
import { useCallback, type ReactNode } from "react";

import { pushNotification } from "@/platform/state/notifications";
import { ToastContext, type ToastMessage } from "./toastContext";

export function ToastProvider({ children }: { children: ReactNode }) {
  const push = useCallback((toast: Omit<ToastMessage, "id">) => {
    pushNotification({ tone: toast.tone, title: toast.title, description: toast.description });
  }, []);

  return <ToastContext.Provider value={push}>{children}</ToastContext.Provider>;
}
