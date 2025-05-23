import { QueryClient, QueryFunction } from "@tanstack/react-query";

async function throwIfResNotOk(res: Response) {
  if (!res.ok) {
    let errorMessage = res.statusText;
    try {
      // Attempt to parse the response body as JSON
      const errorBody = await res.json();
      // If it has a 'message' property, use that as the error message
      if (errorBody && typeof errorBody.message === 'string') {
        errorMessage = errorBody.message;
      } else {
        // Fallback if no 'message' property or not JSON
        const text = await res.text(); // Re-read as text if JSON parsing failed or no message
        errorMessage = text || res.statusText;
         // Prepend status if not already part of a parsed message
        if (!errorBody?.message) {
            errorMessage = `${res.status}: ${errorMessage}`;
        }
      }
    } catch (e) {
      // If JSON parsing fails, try to get text content
      try {
        const text = await res.text();
        errorMessage = text || res.statusText;
        errorMessage = `${res.status}: ${errorMessage}`;
      } catch (textError) {
        // Fallback to just status text if all else fails
        errorMessage = `${res.status}: ${res.statusText}`;
      }
    }
    throw new Error(errorMessage);
  }
}

export async function apiRequest(
  method: string,
  url: string,
  data?: unknown | undefined,
): Promise<Response> {
  const res = await fetch(url, {
    method,
    headers: data ? { "Content-Type": "application/json" } : {},
    body: data ? JSON.stringify(data) : undefined,
    credentials: "include",
  });

  await throwIfResNotOk(res);
  return res;
}

type UnauthorizedBehavior = "returnNull" | "throw";
export const getQueryFn: <T>(options: {
  on401: UnauthorizedBehavior;
}) => QueryFunction<T> =
  ({ on401: unauthorizedBehavior }) =>
  async ({ queryKey }) => {
    const res = await fetch(queryKey[0] as string, {
      credentials: "include",
    });

    if (unauthorizedBehavior === "returnNull" && res.status === 401) {
      return null;
    }

    await throwIfResNotOk(res);
    // It's important to clone the response here if throwIfResNotOk might consume it
    // and we need to consume it again for res.json().
    // However, our current throwIfResNotOk tries to parse, so we should be fine.
    // If issues arise, clone: const resClone = res.clone(); await throwIfResNotOk(res); return await resClone.json();
    return await res.json();
  };

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      queryFn: getQueryFn({ on401: "throw" }),
      refetchInterval: false,
      refetchOnWindowFocus: false,
      staleTime: Infinity,
      retry: false,
    },
    mutations: {
      retry: false,
    },
  },
});
