import { createContext, useContext, useEffect, useMemo, useRef, useState, type ChangeEvent, type FormEvent } from 'react';
import html2canvas from 'html2canvas';
import { QRCodeSVG } from 'qrcode.react';
import { Link, Navigate, Route, Routes, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { buildProfileUrl, getInitials, makeVisitorId, readVisitors, writeVisitors } from './lib/storage';
import type { TemplateKey, Visitor, VisitorDraft } from './types';

const templateMeta: Record<
  TemplateKey,
  {
    label: string;
    surface: string;
    badge: string;
    accent: string;
    text: string;
    smallText: string;
    footer: string;
  }
> = {
  modern: {
    label: 'Modern',
    surface: 'bg-slate-950 text-white',
    badge: 'bg-cyan-500/20 text-cyan-200 ring-1 ring-cyan-400/40',
    accent: 'text-cyan-300',
    text: 'text-slate-100',
    smallText: 'text-slate-300',
    footer: 'text-slate-300',
  },
  corporate: {
    label: 'Corporate',
    surface: 'bg-white text-slate-900',
    badge: 'bg-slate-100 text-slate-700 ring-1 ring-slate-200',
    accent: 'text-sky-700',
    text: 'text-slate-800',
    smallText: 'text-slate-500',
    footer: 'text-slate-500',
  },
  premium: {
    label: 'Premium',
    surface: 'bg-gradient-to-br from-[#121B2A] via-[#181A2B] to-[#0F172A] text-white',
    badge: 'bg-amber-400/15 text-amber-200 ring-1 ring-amber-300/30',
    accent: 'text-amber-200',
    text: 'text-slate-100',
    smallText: 'text-slate-300',
    footer: 'text-slate-300',
  },
};

const emptyForm: VisitorDraft = {
  name: '',
  photoUrl: '',
  designation: '',
  company: '',
  email: '',
  phone: '',
  linkedin: '',
  website: '',
  github: '',
  location: '',
  bio: '',
  template: 'modern',
};

const safeHref = (value?: string | null) => {
  if (!value) return '#';
  if (/^https?:\/\//i.test(value)) return value;
  return `https://${value}`;
};

const formatTimeAgo = (value: string) => {
  const diffMinutes = Math.max(1, Math.round((Date.now() - new Date(value).getTime()) / 60000));
  if (diffMinutes < 60) return `${diffMinutes} minute${diffMinutes === 1 ? '' : 's'} ago`;
  const diffHours = Math.round(diffMinutes / 60);
  if (diffHours < 24) return `${diffHours} hour${diffHours === 1 ? '' : 's'} ago`;
  const diffDays = Math.round(diffHours / 24);
  return `${diffDays} day${diffDays === 1 ? '' : 's'} ago`;
};

const normalizeDraft = (draft: VisitorDraft) => ({
  ...draft,
  name: draft.name.trim(),
  photoUrl: draft.photoUrl?.trim() || null,
  designation: draft.designation?.trim() || null,
  company: draft.company?.trim() || null,
  email: draft.email?.trim() || null,
  phone: draft.phone?.trim() || null,
  linkedin: draft.linkedin?.trim() || null,
  website: draft.website?.trim() || null,
  github: draft.github?.trim() || null,
  location: draft.location?.trim() || null,
  bio: draft.bio?.trim() || null,
  template: draft.template ?? 'modern',
});

const generateVCard = (visitor: Visitor) => {
  const lines = ['BEGIN:VCARD', 'VERSION:3.0', `FN:${visitor.name}`];

  if (visitor.company) lines.push(`ORG:${visitor.company}`);
  if (visitor.designation) lines.push(`TITLE:${visitor.designation}`);
  if (visitor.phone) lines.push(`TEL:${visitor.phone}`);
  if (visitor.email) lines.push(`EMAIL:${visitor.email}`);
  if (visitor.linkedin) lines.push(`URL:${safeHref(visitor.linkedin)}`);
  if (visitor.website) lines.push(`URL:${safeHref(visitor.website)}`);

  lines.push('END:VCARD');
  return lines.join('\n');
};

type VisitorContextType = {
  visitors: Visitor[];
  upsertVisitor: (draft: VisitorDraft) => Visitor;
};

const VisitorContext = createContext<VisitorContextType | undefined>(undefined);

function App() {
  const [visitors, setVisitors] = useState<Visitor[]>(() => readVisitors());

  const upsertVisitor = (draft: VisitorDraft) => {
    const normalized = normalizeDraft(draft);
    const now = new Date().toISOString();
    const existing = normalized.id ? visitors.find((visitor) => visitor.id === normalized.id) : null;

    const nextVisitor: Visitor = existing
      ? {
          ...existing,
          ...normalized,
          id: existing.id,
          template: normalized.template || existing.template,
          updatedAt: now,
        }
      : {
          id: normalized.id || makeVisitorId(),
          name: normalized.name,
          photoUrl: normalized.photoUrl,
          designation: normalized.designation,
          company: normalized.company,
          email: normalized.email,
          phone: normalized.phone,
          linkedin: normalized.linkedin,
          website: normalized.website,
          github: normalized.github,
          location: normalized.location,
          bio: normalized.bio,
          template: normalized.template,
          createdAt: now,
          updatedAt: now,
        };

    setVisitors((current) => {
      const list = existing
        ? current.map((visitor) => (visitor.id === nextVisitor.id ? nextVisitor : visitor))
        : [nextVisitor, ...current];
      writeVisitors(list);
      return list;
    });

    return nextVisitor;
  };

  const value = useMemo(() => ({ visitors, upsertVisitor }), [visitors]);

  return (
    <VisitorContext.Provider value={value}>
      <Routes>
        <Route path="/" element={<DashboardPage />} />
        <Route path="/create" element={<CreatePage />} />
        <Route path="/design" element={<DesignPage />} />
        <Route path="/preview/:id" element={<PreviewPage />} />
        <Route path="/profile/:id" element={<ProfilePage />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </VisitorContext.Provider>
  );
}

function useVisitors() {
  const context = useContext(VisitorContext);
  if (!context) {
    throw new Error('Visitor context is missing');
  }
  return context;
}

function DashboardPage() {
  const { visitors } = useVisitors();
  const sorted = [...visitors].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

  return (
    <div className="min-h-screen bg-slate-100 px-4 py-8 text-slate-800 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-6xl">
        <header className="mb-8 flex items-center justify-between gap-4 rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
          <div>
            <p className="text-xs uppercase tracking-[0.2em] text-sky-700">TerraSun Technologies</p>
            <h1 className="mt-2 text-2xl font-semibold text-slate-900">Visitor Cards Dashboard</h1>
          </div>
          <Link to="/create" className="button-primary">
            + Create New Card
          </Link>
        </header>

        <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="mb-5 flex items-center justify-between">
            <h2 className="text-xl font-semibold text-slate-900">Recent Visitors</h2>
            <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-medium text-slate-600">{sorted.length} cards</span>
          </div>

          {sorted.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 p-8 text-center text-slate-500">
              No cards created yet. Start with a new visitor profile.
            </div>
          ) : (
            <div className="space-y-4">
              {sorted.map((visitor) => (
                <div key={visitor.id} className="flex flex-col gap-3 rounded-2xl border border-slate-200 bg-slate-50 p-4 md:flex-row md:items-center md:justify-between">
                  <div className="flex items-center gap-4">
                    <div className="flex h-12 w-12 items-center justify-center rounded-full bg-sky-100 text-sm font-semibold text-sky-700">
                      {visitor.photoUrl ? <img src={visitor.photoUrl} alt={visitor.name} className="h-full w-full rounded-full object-cover" /> : getInitials(visitor.name)}
                    </div>
                    <div>
                      <p className="text-lg font-semibold text-slate-900">{visitor.name}</p>
                      <p className="text-sm text-slate-500">{visitor.company || 'Independent Visitor'}</p>
                      <p className="mt-1 text-xs text-slate-400">Created {formatTimeAgo(visitor.createdAt)}</p>
                    </div>
                  </div>

                  <div className="flex gap-2">
                    <Link to={`/preview/${visitor.id}`} className="button-secondary">
                      View
                    </Link>
                    <Link to={`/create?visitorId=${visitor.id}`} className="button-secondary">
                      Edit
                    </Link>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>
      </div>
    </div>
  );
}

function CreatePage() {
  const { visitors, upsertVisitor } = useVisitors();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const visitorId = searchParams.get('visitorId') || undefined;
  const existingVisitor = visitorId ? visitors.find((visitor) => visitor.id === visitorId) : undefined;
  const [form, setForm] = useState<VisitorDraft>(() => {
    if (!existingVisitor) {
      return { ...emptyForm, template: 'modern' };
    }

    return {
      id: existingVisitor.id,
      name: existingVisitor.name,
      photoUrl: existingVisitor.photoUrl || '',
      designation: existingVisitor.designation || '',
      company: existingVisitor.company || '',
      email: existingVisitor.email || '',
      phone: existingVisitor.phone || '',
      linkedin: existingVisitor.linkedin || '',
      website: existingVisitor.website || '',
      github: existingVisitor.github || '',
      location: existingVisitor.location || '',
      bio: existingVisitor.bio || '',
      template: existingVisitor.template,
    };
  });

  useEffect(() => {
    if (existingVisitor) {
      setForm({
        id: existingVisitor.id,
        name: existingVisitor.name,
        photoUrl: existingVisitor.photoUrl || '',
        designation: existingVisitor.designation || '',
        company: existingVisitor.company || '',
        email: existingVisitor.email || '',
        phone: existingVisitor.phone || '',
        linkedin: existingVisitor.linkedin || '',
        website: existingVisitor.website || '',
        github: existingVisitor.github || '',
        location: existingVisitor.location || '',
        bio: existingVisitor.bio || '',
        template: existingVisitor.template,
      });
    }
  }, [existingVisitor]);

  const handleChange = (event: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = event.target;
    setForm((current) => ({ ...current, [name]: value }));
  };

  const handlePhotoChange = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = () => {
      setForm((current) => ({ ...current, photoUrl: String(reader.result || '') }));
    };
    reader.readAsDataURL(file);
  };

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const clean = normalizeDraft(form);

    if (!clean.name) {
      return;
    }

    const saved = upsertVisitor(clean);

    if (existingVisitor) {
      navigate(`/preview/${saved.id}`);
      return;
    }

    navigate(`/design?visitorId=${saved.id}`);
  };

  return (
    <div className="min-h-screen bg-slate-100 px-4 py-8 text-slate-800 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-5xl">
        <header className="mb-6 flex flex-wrap items-center justify-between gap-4 rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
          <div>
            <p className="text-xs uppercase tracking-[0.2em] text-sky-700">TerraSun</p>
            <h1 className="mt-2 text-2xl font-semibold text-slate-900">{existingVisitor ? 'Edit Visitor Details' : 'Create Visitor Card'}</h1>
          </div>
          <Link to="/" className="button-secondary">
            Back to dashboard
          </Link>
        </header>

        <form onSubmit={handleSubmit} className="grid gap-6 rounded-3xl border border-slate-200 bg-white p-5 shadow-sm lg:grid-cols-[1.2fr_0.8fr]">
          <div className="grid gap-4 md:grid-cols-2">
            <label className="field md:col-span-2">
              <span>Name *</span>
              <input name="name" value={form.name} onChange={handleChange} placeholder="Rahul Sharma" required />
            </label>

            <label className="field">
              <span>Designation</span>
              <input name="designation" value={form.designation || ''} onChange={handleChange} placeholder="Product Manager" />
            </label>

            <label className="field">
              <span>Company / Organization</span>
              <input name="company" value={form.company || ''} onChange={handleChange} placeholder="ABC Technologies" />
            </label>

            <label className="field">
              <span>Email</span>
              <input type="email" name="email" value={form.email || ''} onChange={handleChange} placeholder="rahul@example.com" />
            </label>

            <label className="field">
              <span>Phone</span>
              <input name="phone" value={form.phone || ''} onChange={handleChange} placeholder="9876543210" />
            </label>

            <label className="field">
              <span>LinkedIn</span>
              <input name="linkedin" value={form.linkedin || ''} onChange={handleChange} placeholder="linkedin.com/in/rahul" />
            </label>

            <label className="field">
              <span>Website</span>
              <input name="website" value={form.website || ''} onChange={handleChange} placeholder="www.rahulsharma.dev" />
            </label>

            <label className="field">
              <span>GitHub</span>
              <input name="github" value={form.github || ''} onChange={handleChange} placeholder="github.com/rahul" />
            </label>

            <label className="field">
              <span>Location</span>
              <input name="location" value={form.location || ''} onChange={handleChange} placeholder="Mumbai, India" />
            </label>

            <label className="field md:col-span-2">
              <span>About</span>
              <textarea name="bio" value={form.bio || ''} onChange={handleChange} rows={4} placeholder="Helping teams build meaningful digital experiences." />
            </label>
          </div>

          <aside className="space-y-4 rounded-2xl border border-slate-200 bg-slate-50 p-4">
            <div>
              <p className="mb-2 text-sm font-medium text-slate-700">Profile Photo</p>
              <div className="flex items-center gap-4">
                <div className="flex h-20 w-20 items-center justify-center overflow-hidden rounded-full border border-slate-200 bg-white text-lg font-semibold text-sky-700">
                  {form.photoUrl ? <img src={form.photoUrl} alt="Profile preview" className="h-full w-full object-cover" /> : getInitials(form.name || 'Visitor')}
                </div>
                <label className="button-secondary cursor-pointer">
                  Upload photo
                  <input type="file" accept="image/*" className="hidden" onChange={handlePhotoChange} />
                </label>
              </div>
            </div>

            <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-4">
              <p className="text-sm font-medium text-slate-700">Quick form tips</p>
              <ul className="mt-2 space-y-2 text-sm text-slate-500">
                <li>• Only name is required.</li>
                <li>• Leave optional fields empty if they are not available.</li>
                <li>• Choose a modern card template after saving.</li>
              </ul>
            </div>

            <button type="submit" className="button-primary w-full text-center">
              {existingVisitor ? 'Save Changes' : 'Choose Design'}
            </button>
          </aside>
        </form>
      </div>
    </div>
  );
}

function DesignPage() {
  const { visitors, upsertVisitor } = useVisitors();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const visitorId = searchParams.get('visitorId');
  const visitor = visitorId ? visitors.find((entry) => entry.id === visitorId) : undefined;
  const [selected, setSelected] = useState<TemplateKey>(visitor?.template ?? 'modern');

  useEffect(() => {
    if (visitor) {
      setSelected(visitor.template);
    }
  }, [visitor]);

  if (!visitor) {
    return <Navigate to="/create" replace />;
  }

  const handleChoose = () => {
    upsertVisitor({ ...visitor, template: selected });
    navigate(`/preview/${visitor.id}`);
  };

  return (
    <div className="min-h-screen bg-slate-100 px-4 py-8 text-slate-800 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-6xl">
        <header className="mb-6 flex flex-wrap items-center justify-between gap-4 rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
          <div>
            <p className="text-xs uppercase tracking-[0.2em] text-sky-700">TerraSun</p>
            <h1 className="mt-2 text-2xl font-semibold text-slate-900">Choose a Card Design</h1>
          </div>
          <button onClick={() => navigate(`/create?visitorId=${visitor.id}`)} className="button-secondary">
            Edit details
          </button>
        </header>

        <div className="grid gap-6 lg:grid-cols-3">
          {(Object.keys(templateMeta) as TemplateKey[]).map((templateKey) => {
            const selectedCard = templateKey === selected;
            return (
              <button key={templateKey} type="button" onClick={() => setSelected(templateKey)} className="text-left">
                <div className={`overflow-hidden rounded-3xl border p-3 shadow-card transition ${selectedCard ? 'border-sky-500 ring-2 ring-sky-200' : 'border-slate-200 bg-white'}`}>
                  <div className={`h-64 rounded-2xl p-4 ${templateMeta[templateKey].surface}`}>
                    <div className="flex h-full flex-col justify-between">
                      <div className="flex items-start justify-between">
                        <div>
                          <div className={`inline-flex rounded-full px-2 py-1 text-[10px] font-medium uppercase tracking-[0.25em] ${templateMeta[templateKey].badge}`}>
                            TerraSun
                          </div>
                          <div className="mt-4 text-xl font-semibold">{visitor.name}</div>
                          <div className={`mt-1 text-sm ${templateMeta[templateKey].smallText}`}>
                            {visitor.designation || 'Visitor'}
                          </div>
                        </div>
                        <div className="rounded-xl border border-white/10 bg-white/5 p-2 text-[10px] uppercase tracking-[0.2em] text-white/80">
                          QR
                        </div>
                      </div>

                      <div className="flex items-end justify-between gap-3">
                        <div>
                          <div className={`text-sm font-medium ${templateMeta[templateKey].accent}`}>
                            {visitor.company || 'TerraSun Visitor'}
                          </div>
                          <div className={`mt-1 text-[10px] uppercase tracking-[0.22em] ${templateMeta[templateKey].footer}`}>
                            Scan to connect
                          </div>
                        </div>
                        <div className="flex h-16 w-16 items-center justify-center rounded-lg bg-white p-2 shadow-lg">
                          <div className="grid h-full w-full grid-cols-4 gap-[2px] bg-slate-800 p-[3px]">
                            {Array.from({ length: 16 }, (_, index) => (
                              <div key={index} className={`rounded-[1px] ${index % 2 === 0 ? 'bg-slate-900' : 'bg-white'}`} />
                            ))}
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                  <div className="mt-4 flex items-center justify-between">
                    <span className="text-sm font-medium text-slate-700">{templateMeta[templateKey].label}</span>
                    <span className="text-xs text-slate-400">90mm × 50mm</span>
                  </div>
                </div>
              </button>
            );
          })}
        </div>

        <div className="mt-8 flex justify-end">
          <button type="button" onClick={handleChoose} className="button-primary">
            Generate Card
          </button>
        </div>
      </div>
    </div>
  );
}

function PreviewPage() {
  const { visitors } = useVisitors();
  const navigate = useNavigate();
  const { id } = useParams();
  const cardRef = useRef<HTMLDivElement | null>(null);
  const visitor = visitors.find((entry) => entry.id === id);

  if (!visitor) {
    return <Navigate to="/" replace />;
  }

  const profileUrl = buildProfileUrl(visitor.id);

  const handleDownload = async () => {
    if (!cardRef.current) return;

    const canvas = await html2canvas(cardRef.current, { backgroundColor: '#ffffff', scale: 2 });
    const link = document.createElement('a');
    link.href = canvas.toDataURL('image/png');
    link.download = `${visitor.name.toLowerCase().replace(/\s+/g, '-')}-visit-card.png`;
    link.click();
  };

  return (
    <div className="min-h-screen bg-slate-100 px-4 py-8 text-slate-800 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-6xl">
        <header className="mb-6 flex flex-wrap items-center justify-between gap-4 rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
          <div>
            <p className="text-xs uppercase tracking-[0.2em] text-sky-700">Generated Card</p>
            <h1 className="mt-2 text-2xl font-semibold text-slate-900">{visitor.name}</h1>
          </div>
          <div className="flex flex-wrap gap-2 no-print">
            <button onClick={() => navigate(`/create?visitorId=${visitor.id}`)} className="button-secondary">
              Edit
            </button>
            <button onClick={() => navigate(`/design?visitorId=${visitor.id}`)} className="button-secondary">
              Change Design
            </button>
            <button type="button" onClick={() => window.print()} className="button-secondary">
              Print
            </button>
            <button type="button" onClick={handleDownload} className="button-primary">
              Download
            </button>
          </div>
        </header>

        <div className="grid gap-6 lg:grid-cols-[1.2fr_0.8fr]">
          <div className="rounded-3xl border border-slate-200 bg-white p-4 shadow-sm">
            <div ref={cardRef} className="mx-auto max-w-2xl">
              <CardPreview visitor={visitor} />
            </div>
          </div>

          <aside className="space-y-5 rounded-3xl border border-slate-200 bg-white p-4 shadow-sm">
            <div>
              <p className="text-xs uppercase tracking-[0.2em] text-slate-500">Digital Profile</p>
              <p className="mt-2 break-all text-sm text-slate-700">{profileUrl}</p>
              <div className="mt-4 flex flex-wrap gap-2">
                <a href={profileUrl} target="_blank" rel="noreferrer" className="button-secondary">
                  Open Digital Profile
                </a>
              </div>
            </div>

            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
              <p className="text-sm font-medium text-slate-700">QR preview</p>
              <div className="mt-4 flex justify-center rounded-2xl bg-white p-4 shadow-sm">
                <QRCodeSVG value={profileUrl} size={180} includeMargin />
              </div>
              <p className="mt-4 text-xs uppercase tracking-[0.2em] text-slate-500">QR destination</p>
              <p className="mt-2 break-all text-sm text-slate-700">{profileUrl}</p>
              <a href={profileUrl} target="_blank" rel="noreferrer" className="mt-4 inline-flex button-secondary">
                Test QR
              </a>
            </div>
          </aside>
        </div>
      </div>
    </div>
  );
}

function ProfilePage() {
  const { visitors } = useVisitors();
  const { id } = useParams();
  const visitor = visitors.find((entry) => entry.id === id);

  if (!visitor) {
    return <Navigate to="/" replace />;
  }

  const saveContact = () => {
    const vCard = generateVCard(visitor);
    const blob = new Blob([vCard], { type: 'text/vcard;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = `${visitor.name.toLowerCase().replace(/\s+/g, '-')}.vcf`;
    anchor.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="min-h-screen bg-slate-100 px-4 py-8 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-4xl rounded-[32px] border border-slate-200 bg-white p-4 shadow-card md:p-6">
        <div className="rounded-[28px] border border-slate-200 bg-slate-50 p-4 md:p-6">
          <div className="flex flex-col items-center gap-5 text-center md:gap-6">
            <div className="flex h-28 w-28 items-center justify-center overflow-hidden rounded-full border-4 border-white bg-sky-100 text-3xl font-semibold text-sky-700 shadow-sm">
              {visitor.photoUrl ? <img src={visitor.photoUrl} alt={visitor.name} className="h-full w-full object-cover" /> : getInitials(visitor.name)}
            </div>
            <div>
              <h1 className="text-3xl font-semibold text-slate-900 md:text-4xl">{visitor.name}</h1>
              {visitor.designation && <p className="mt-2 text-lg text-slate-600">{visitor.designation}</p>}
              {visitor.company && <p className="mt-1 text-base text-slate-500">{visitor.company}</p>}
            </div>
          </div>

          <div className="mt-6 flex flex-wrap justify-center gap-3">
            <button type="button" onClick={saveContact} className="button-primary">
              Save Contact
            </button>
            {visitor.phone && (
              <a href={`tel:${visitor.phone}`} className="button-secondary">
                Call
              </a>
            )}
            {visitor.email && (
              <a href={`mailto:${visitor.email}`} className="button-secondary">
                Email
              </a>
            )}
          </div>

          {visitor.bio && (
            <div className="mt-6 rounded-2xl border border-slate-200 bg-white p-5 text-left">
              <p className="text-xs uppercase tracking-[0.2em] text-slate-500">About</p>
              <p className="mt-3 text-base leading-7 text-slate-700">{visitor.bio}</p>
            </div>
          )}

          <div className="mt-6 grid gap-4 sm:grid-cols-2">
            {visitor.email && (
              <InfoPill label="Email" value={visitor.email} href={`mailto:${visitor.email}`} />
            )}
            {visitor.phone && (
              <InfoPill label="Phone" value={visitor.phone} href={`tel:${visitor.phone}`} />
            )}
            {visitor.location && <InfoPill label="Location" value={visitor.location} />}
            {visitor.website && <InfoPill label="Website" value={visitor.website} href={safeHref(visitor.website)} />}
            {visitor.linkedin && <InfoPill label="LinkedIn" value={visitor.linkedin} href={safeHref(visitor.linkedin)} />}
            {visitor.github && <InfoPill label="GitHub" value={visitor.github} href={safeHref(visitor.github)} />}
          </div>

          <div className="mt-8 rounded-2xl border border-slate-200 bg-white p-4 text-center text-slate-600">
            <p className="text-sm">Digital presence powered by TerraSun Technologies</p>
            <a href="/create" className="mt-3 inline-flex text-sm font-semibold text-sky-700">
              Create your digital presence →
            </a>
          </div>
        </div>
      </div>
    </div>
  );
}

function InfoPill({ label, value, href }: { label: string; value: string; href?: string }) {
  const content = (
    <div className="rounded-2xl border border-slate-200 bg-white p-4 text-left shadow-sm">
      <p className="text-xs uppercase tracking-[0.2em] text-slate-500">{label}</p>
      <p className="mt-2 text-sm text-slate-700">{value}</p>
    </div>
  );

  if (!href) return content;

  return <a href={href} target="_blank" rel="noreferrer">{content}</a>;
}

function CardPreview({ visitor }: { visitor: Visitor }) {
  const meta = templateMeta[visitor.template];
  const profileUrl = buildProfileUrl(visitor.id);
  const titleColor = visitor.template === 'corporate' ? 'text-slate-900' : 'text-white';
  const qrBadgeClass = visitor.template === 'corporate' ? 'border-slate-300 bg-slate-100 text-slate-700' : 'border-white/15 bg-white/10 text-slate-100';
  const scanTextClass = visitor.template === 'corporate' ? 'text-slate-500' : 'text-slate-300';

  return (
    <div className={`relative overflow-hidden rounded-[30px] border border-slate-300/60 shadow-card ${meta.surface}`}>
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(56,189,248,0.18),transparent_32%),radial-gradient(circle_at_bottom_right,rgba(168,85,247,0.17),transparent_38%)]" />
      <div className="relative aspect-[9/5] p-5 sm:p-6">
        <div className="flex h-full flex-col justify-between">
          <div className="flex items-start justify-between gap-3">
            <div>
              <div className={`inline-flex rounded-full px-2 py-1 text-[10px] font-medium uppercase tracking-[0.25em] ${meta.badge}`}>
                TerraSun
              </div>
              <div className={`mt-5 text-[26px] font-semibold leading-tight sm:text-[32px] ${titleColor}`}>
                {visitor.name}
              </div>
              {visitor.designation && <div className={`mt-2 text-sm ${meta.smallText}`}>{visitor.designation}</div>}
              {visitor.company && <div className={`mt-1 text-sm ${meta.text}`}>{visitor.company}</div>}
            </div>
            <div className={`rounded-2xl border p-2 text-[10px] font-medium uppercase tracking-[0.2em] ${qrBadgeClass}`}>
              QR
            </div>
          </div>

          <div className="flex items-end justify-between gap-3">
            <div className="space-y-1 text-xs leading-5">
              {visitor.email && <div className={meta.smallText}>{visitor.email}</div>}
              {visitor.phone && <div className={meta.smallText}>{visitor.phone}</div>}
              {visitor.location && <div className={meta.smallText}>{visitor.location}</div>}
            </div>

            <div className="flex items-center gap-3">
              <div className="rounded-xl bg-white p-2 shadow-lg">
                <QRCodeSVG value={profileUrl} size={72} includeMargin />
              </div>
              <div className="text-right">
                <div className={`text-[10px] uppercase tracking-[0.26em] ${scanTextClass}`}>Scan to connect</div>
                <div className="mt-1 text-[10px] text-slate-400">terrasun.tech</div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default App;
