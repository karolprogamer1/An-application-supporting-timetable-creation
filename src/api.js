const API_URL = import.meta.env.DEV ? '/api' : '/~20435/api';

export async function apiFetch(endpoint, options = {}) {
  const response = await fetch(`${API_URL}${endpoint}`, {
    headers: {
      'Content-Type': 'application/json',
      ...(options.headers || {}),
    },
    ...options,
  });

  if (!response.ok) {
    throw new Error(`Błąd HTTP: ${response.status}`);
  }

  const data = await response.json();

  if (data && typeof data === 'object') {
    Object.defineProperties(data, {
      ok: { value: response.ok, enumerable: false },
      status: { value: response.status, enumerable: false },
      json: { value: async () => data, enumerable: false },
    });
  }

  return data;
}