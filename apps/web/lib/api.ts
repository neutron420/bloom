const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001";

export interface User {
  id: string;
  name: string;
  email: string | null;
  profilePicture?: string | null;
  createdAt?: string;
}

export interface AuthResponse {
  message: string;
  user: User;
  token: string;
}

export interface LoginCredentials {
  email: string;
  password: string;
}

export interface RegisterCredentials {
  name: string;
  email?: string;
  password: string;
}

export interface GuestCredentials {
  name: string;
}

async function parseJSONResponse(response: Response): Promise<any> {
  const contentType = response.headers.get("content-type");
  if (contentType && contentType.includes("application/json")) {
    return response.json();
  } else {
    const text = await response.text();
    throw new Error(`Server returned non-JSON response: ${text.substring(0, 100)}`);
  }
}

// API utility functions
export async function register(credentials: RegisterCredentials): Promise<AuthResponse> {
  const response = await fetch(`${API_BASE_URL}/api/auth/register`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(credentials),
  });

  if (!response.ok) {
    try {
      const error = await parseJSONResponse(response);
      throw new Error(error.error || "Registration failed");
    } catch (err) {
      if (err instanceof Error && err.message.includes("non-JSON")) {
        throw new Error(`Registration failed: ${response.status} ${response.statusText}`);
      }
      throw err;
    }
  }

  return parseJSONResponse(response);
}

export async function login(credentials: LoginCredentials): Promise<AuthResponse> {
  const response = await fetch(`${API_BASE_URL}/api/auth/login`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(credentials),
  });

  if (!response.ok) {
    try {
      const error = await parseJSONResponse(response);
      throw new Error(error.error || "Login failed");
    } catch (err) {
      if (err instanceof Error && err.message.includes("non-JSON")) {
        throw new Error(`Login failed: ${response.status} ${response.statusText}`);
      }
      throw err;
    }
  }

  return parseJSONResponse(response);
}

export async function guestLogin(credentials: GuestCredentials): Promise<AuthResponse> {
  const response = await fetch(`${API_BASE_URL}/api/auth/guest`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(credentials),
  });

  if (!response.ok) {
    try {
      const error = await parseJSONResponse(response);
      throw new Error(error.error || "Guest login failed");
    } catch (err) {
      if (err instanceof Error && err.message.includes("non-JSON")) {
        throw new Error(`Guest login failed: ${response.status} ${response.statusText}`);
      }
      throw err;
    }
  }

  return parseJSONResponse(response);
}

export async function googleAuth(token: string): Promise<AuthResponse> {
  const response = await fetch(`${API_BASE_URL}/api/auth/google`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ token }),
  });

  if (!response.ok) {
    try {
      const error = await parseJSONResponse(response);
      throw new Error(error.error || "Google authentication failed");
    } catch (err) {
      if (err instanceof Error && err.message.includes("non-JSON")) {
        throw new Error(`Google authentication failed: ${response.status} ${response.statusText}. Make sure the backend server is running.`);
      }
      throw err;
    }
  }

  return parseJSONResponse(response);
}

export async function getCurrentUser(token: string): Promise<{ user: User }> {
  const response = await fetch(`${API_BASE_URL}/api/auth/me`, {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });

  if (!response.ok) {
    try {
      const error = await parseJSONResponse(response);
      throw new Error(error.error || "Failed to get user");
    } catch (err) {
      if (err instanceof Error && err.message.includes("non-JSON")) {
        throw new Error(`Failed to get user: ${response.status} ${response.statusText}`);
      }
      throw err;
    }
  }

  return parseJSONResponse(response);
}

export interface CreateMeetingResponse {
  message: string;
  meeting: {
    id: string;
    roomId: string;
    title: string;
    createdAt: string;
  };
  meetingUrl: string;
}

export async function createMeeting(token: string | null): Promise<CreateMeetingResponse> {
  const headers: HeadersInit = {
    "Content-Type": "application/json",
  };
  
  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }

  const response = await fetch(`${API_BASE_URL}/api/meetings/create`, {
    method: "POST",
    headers,
  });

  if (!response.ok) {
    try {
      const error = await parseJSONResponse(response);
      throw new Error(error.error || "Failed to create meeting");
    } catch (err) {
      if (err instanceof Error && err.message.includes("non-JSON")) {
        throw new Error(`Failed to create meeting: ${response.status} ${response.statusText}`);
      }
      throw err;
    }
  }

  return parseJSONResponse(response);
}

