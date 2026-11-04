// Seed data for the Magic Frames studio demo.

import type { Album, Photo } from './types';

export const photos: Photo[] = [
  {
    id: 'MF-001',
    folder: 'Engagement',
    name: 'engagement_001.jpg',
    url: 'https://images.unsplash.com/photo-1519741497674-611481863552?auto=format&fit=crop&w=1000&q=85',
  },
  {
    id: 'MF-002',
    folder: 'Engagement',
    name: 'engagement_002.jpg',
    url: 'https://images.unsplash.com/photo-1537633552985-df8429e8048b?auto=format&fit=crop&w=1000&q=85',
  },
  {
    id: 'MF-003',
    folder: 'Engagement',
    name: 'engagement_003.jpg',
    url: 'https://images.unsplash.com/photo-1529636798458-92182e662485?auto=format&fit=crop&w=1000&q=85',
  },
  {
    id: 'MF-004',
    folder: 'Engagement',
    name: 'engagement_004.jpg',
    url: 'https://images.unsplash.com/photo-1511285560929-80b456fea0bc?auto=format&fit=crop&w=1000&q=85',
  },
  {
    id: 'MF-005',
    folder: 'Engagement',
    name: 'engagement_005.jpg',
    url: 'https://images.unsplash.com/photo-1523438885200-e635ba2c371e?auto=format&fit=crop&w=1000&q=85',
  },
  {
    id: 'MF-006',
    folder: 'Engagement',
    name: 'engagement_006.jpg',
    url: 'https://images.unsplash.com/photo-1465495976277-4387d4b0e4a6?auto=format&fit=crop&w=1000&q=85',
  },
  {
    id: 'MF-007',
    folder: 'Wedding',
    name: 'wedding_001.jpg',
    url: 'https://images.unsplash.com/photo-1591604466107-ec97de577aff?auto=format&fit=crop&w=1000&q=85',
  },
  {
    id: 'MF-008',
    folder: 'Wedding',
    name: 'wedding_002.jpg',
    url: 'https://images.unsplash.com/photo-1583939003579-730e3918a45a?auto=format&fit=crop&w=1000&q=85',
  },
  {
    id: 'MF-009',
    folder: 'Wedding',
    name: 'wedding_003.jpg',
    url: 'https://images.unsplash.com/photo-1606800052052-a08af7148866?auto=format&fit=crop&w=1000&q=85',
  },
  {
    id: 'MF-010',
    folder: 'Wedding',
    name: 'wedding_004.jpg',
    url: 'https://images.unsplash.com/photo-1519225421980-888cb8b8e0f7?auto=format&fit=crop&w=1000&q=85',
  },
  {
    id: 'MF-011',
    folder: 'Haldi',
    name: 'haldi_001.jpg',
    url: 'https://images.unsplash.com/photo-1583939411023-14783179e581?auto=format&fit=crop&w=1000&q=85',
  },
  {
    id: 'MF-012',
    folder: 'Haldi',
    name: 'haldi_002.jpg',
    url: 'https://images.unsplash.com/photo-1511285560929-80b456fea0bc?auto=format&fit=crop&w=1000&q=85',
  },
  {
    id: 'MF-013',
    folder: 'Reception',
    name: 'reception_001.jpg',
    url: 'https://images.unsplash.com/photo-1507504031003-b417219a0fde?auto=format&fit=crop&w=1000&q=85',
  },
  {
    id: 'MF-014',
    folder: 'Reception',
    name: 'reception_002.jpg',
    url: 'https://images.unsplash.com/photo-1464366400600-7168b8af9bc3?auto=format&fit=crop&w=1000&q=85',
  },
];

// Raw seed albums (demo data). Drive fields are filled in below so the
// built-in albums fall back to the bundled demo photos.
const seedAlbums: Omit<Album, 'driveFolderId' | 'driveLink'>[] = [
  {
    id: 1,
    name: 'Job Maya',
    subtitle: 'The Beginning of Forever',
    password: 'maya2026',
    events: ['Engagement', 'Wedding', 'Haldi', 'Reception'],
    photos: 247,
    cover:
      'https://images.unsplash.com/photo-1519741497674-611481863552?auto=format&fit=crop&w=1000&q=85',
    status: 'Completed',
    views: 31,
    locked: false,
    selections: {},
  },
  {
    id: 2,
    name: 'Roshan Liyana',
    subtitle: 'Wedding Moments',
    password: 'roshan2026',
    events: ['Engagement', 'Wedding', 'Reception'],
    photos: 1208,
    cover:
      'https://images.unsplash.com/photo-1537633552985-df8429e8048b?auto=format&fit=crop&w=1000&q=85',
    status: 'Completed',
    views: 18,
    locked: false,
    selections: {},
  },
  {
    id: 3,
    name: 'Jebin Nayana',
    subtitle: 'Our Wedding Journey',
    password: 'jebin2026',
    events: ['Haldi', 'Wedding', 'Reception'],
    photos: 842,
    cover:
      'https://images.unsplash.com/photo-1583939003579-730e3918a45a?auto=format&fit=crop&w=1000&q=85',
    status: 'Completed',
    views: 14,
    locked: false,
    selections: {},
  },
  {
    id: 4,
    name: 'Anu & Rahul',
    subtitle: 'A Lifetime Begins',
    password: 'anu2026',
    events: ['Engagement', 'Wedding'],
    photos: 412,
    cover:
      'https://images.unsplash.com/photo-1529636798458-92182e662485?auto=format&fit=crop&w=1000&q=85',
    status: 'In progress',
    views: 9,
    locked: false,
    selections: {},
  },
  {
    id: 5,
    name: 'Meera & Arjun',
    subtitle: 'Forever Starts Here',
    password: 'meera2026',
    events: ['Haldi', 'Wedding', 'Reception'],
    photos: 234,
    cover:
      'https://images.unsplash.com/photo-1523438885200-e635ba2c371e?auto=format&fit=crop&w=1000&q=85',
    status: 'In progress',
    views: 4,
    locked: false,
    selections: {},
  },
];

export const initialAlbums: Album[] = seedAlbums.map((a) => ({
  ...a,
  driveFolderId: '',
  driveLink: '',
}));
