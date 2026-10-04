export type TemplateKey = 'modern' | 'corporate' | 'premium';

export type Visitor = {
  id: string;
  name: string;
  photoUrl?: string | null;
  designation?: string | null;
  company?: string | null;
  email?: string | null;
  phone?: string | null;
  linkedin?: string | null;
  website?: string | null;
  github?: string | null;
  location?: string | null;
  bio?: string | null;
  template: TemplateKey;
  createdAt: string;
  updatedAt: string;
};

export type VisitorDraft = {
  id?: string;
  name: string;
  photoUrl?: string | null;
  designation?: string | null;
  company?: string | null;
  email?: string | null;
  phone?: string | null;
  linkedin?: string | null;
  website?: string | null;
  github?: string | null;
  location?: string | null;
  bio?: string | null;
  template: TemplateKey;
};
