/**
 * Vitest setup file
 * Configures testing environment and global mocks
 */

import { expect, afterEach, vi } from "vitest";
import { cleanup } from "@testing-library/react";
import "@testing-library/jest-dom/vitest";

// Cleanup after each test
afterEach(() => {
  cleanup();
});

// Mock localStorage
const localStorageMock = {
  getItem: vi.fn(),
  setItem: vi.fn(),
  removeItem: vi.fn(),
  clear: vi.fn(),
  length: 0,
  key: vi.fn(),
};
Object.defineProperty(window, "localStorage", { value: localStorageMock });

// Mock navigator.serviceWorker
Object.defineProperty(navigator, "serviceWorker", {
  value: {
    ready: Promise.resolve({
      pushManager: {
        getSubscription: vi.fn().mockResolvedValue(null),
        subscribe: vi.fn(),
      },
    }),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
  },
  writable: true,
});

// Mock Notification API
Object.defineProperty(window, "Notification", {
  value: {
    permission: "default",
    requestPermission: vi.fn().mockResolvedValue("granted"),
  },
  writable: true,
});

// Mock fetch
global.fetch = vi.fn();

// Mock IndexedDB
const indexedDBMock = {
  open: vi.fn(),
};
Object.defineProperty(window, "indexedDB", { value: indexedDBMock });
