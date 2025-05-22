import React, { useState, useCallback } from "react";

export interface Toast {
  id: string;
  title?: string;
  description?: string;
  action?: React.ReactNode;
  variant?: "default" | "destructive";
}

const TOAST_LIMIT = 1;
const TOAST_REMOVE_DELAY = 1000000;

let count = 0;
function genId() {
  count = (count + 1) % Number.MAX_VALUE;
  return count.toString();
}

type ToasterToast = Toast & {
  id: string;
  title?: string;
  description?: string;
  action?: React.ReactNode;
  variant?: "default" | "destructive";
};

let memoryState: {
  toasts: ToasterToast[];
} = {
  toasts: [],
};

let listeners: Array<(state: typeof memoryState) => void> = [];

function dispatch(action: {
  type: "ADD_TOAST" | "UPDATE_TOAST" | "DISMISS_TOAST" | "REMOVE_TOAST";
  toast?: Partial<ToasterToast>;
}) {
  switch (action.type) {
    case "ADD_TOAST":
      memoryState.toasts = [action.toast, ...memoryState.toasts].slice(0, TOAST_LIMIT) as ToasterToast[];
      break;
    case "UPDATE_TOAST":
      memoryState.toasts = memoryState.toasts.map((t) =>
        t.id === action.toast?.id ? { ...t, ...action.toast } : t
      );
      break;
    case "DISMISS_TOAST": {
      const { id } = action.toast || {};
      if (id) {
        memoryState.toasts = memoryState.toasts.map((t) =>
          t.id === id || id === undefined
            ? {
                ...t,
              }
            : t
        );
      }
      break;
    }
    case "REMOVE_TOAST":
      if (action.toast?.id === undefined) {
        memoryState.toasts = [];
      } else {
        memoryState.toasts = memoryState.toasts.filter((t) => t.id !== action.toast?.id);
      }
      break;
  }
  listeners.forEach((listener) => {
    listener(memoryState);
  });
}

function toast({ ...props }: Omit<ToasterToast, "id">) {
  const id = genId();

  const update = (props: ToasterToast) =>
    dispatch({
      type: "UPDATE_TOAST",
      toast: { ...props, id },
    });
  const dismiss = () => dispatch({ type: "DISMISS_TOAST", toast: { id } });

  dispatch({
    type: "ADD_TOAST",
    toast: {
      ...props,
      id,
    } as ToasterToast,
  });

  return {
    id: id,
    dismiss,
    update,
  };
}

function useToast() {
  const [state, setState] = useState<typeof memoryState>(memoryState);

  React.useEffect(() => {
    listeners.push(setState);
    return () => {
      const index = listeners.indexOf(setState);
      if (index > -1) {
        listeners.splice(index, 1);
      }
    };
  }, [state]);

  return {
    ...state,
    toast,
    dismiss: (toastId?: string) => dispatch({ type: "DISMISS_TOAST", toast: { id: toastId } }),
  };
}

export { useToast, toast };
