export interface Book {
  id: string;
  title: string;
  author: string;
  coverUrl?: string;
  genre?: string;
  year?: string;
  isbn?: string;
  pages?: string;
  readingTime?: string;
  synopsis?: string;
  rating?: number; // 0-5
  comment?: string;
  dateRead?: string; // ISO String
  libraryBookId?: string;
}

export type BookFormat = 'epub' | 'pdf' | 'mobi' | 'azw3' | 'otro';

export interface LibraryBook {
  id: string;
  title: string;
  author: string;
  format: BookFormat;
  fileName: string;
  fileSize: number; // in bytes
  dateAdded: string; // ISO String
  coverUrl?: string;
  genre?: string;
  year?: string;
  pages?: string;
  synopsis?: string;
  status: 'pending' | 'reading' | 'read';
  readingBookId?: string; // ID in readings if read
}

export interface RecommendedBook {
  id: string;
  title: string;
  author: string;
  coverUrl?: string;
  year?: string;
  pages?: string;
  genre?: string;
  synopsis?: string;
  reason: string;
  basedOnTitle?: string;
  basedOnRating?: number;
}

