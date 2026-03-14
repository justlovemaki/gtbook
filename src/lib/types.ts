export interface Bookmark {
  id: string;
  title: string;
  url: string;
  level: number;
}

export interface Directory {
  id: string;
  title: string;
  level: number;
  children: (Bookmark | Directory)[];
}

export interface FavoriteFile {
  filename: string;
  path: string;
  content: string;
  sha: string;
  tree: (Bookmark | Directory)[];
}

export interface AppConfig {
  githubToken: string;
  owner: string;
  repo: string;
  path: string;
  openaiKey: string;
  openaiBaseUrl?: string;
}
