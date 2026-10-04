import type { Visitor } from '../types';

const STORAGE_KEY = 'terrasun-visitors-v1';

export const readVisitors = (): Visitor[] => {
  if (typeof window === 'undefined') {
    return [];
  }

  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      return [];
    }

    const parsed = JSON.parse(raw) as Visitor[];
    return Array.isArray(parsed) ? parsed : [];
  } catch (error) {
    console.warn('Unable to read visitors from storage', error);
    return [];
  }
};

export const writeVisitors = (visitors: Visitor[]) => {
  if (typeof window === 'undefined') {
    return;
  }

  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(visitors));
};

export const buildProfileUrl = (id: string) => `${window.location.origin}/profile/${id}`;

export const makeVisitorId = () => {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return crypto.randomUUID().slice(0, 12);
  }

  return `visitor-${Math.random().toString(36).slice(2, 10)}`;
};

export const getInitials = (name: string) =>
  name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? '')
    .join('') || 'TS';
